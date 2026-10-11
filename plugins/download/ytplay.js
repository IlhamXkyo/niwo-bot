import axios from "axios";
import { sendHTMLRichMessage } from "../../src/lib/whatsappCompat.js";

const config = {
  name: "ytplay",
  alias: ["ytp", "ytvideo", "playvideo"],
  category: "download",
  description: "Putar video YouTube dengan HTML AI Rich + WebSocket",
  usage: ".ytplay <judul/link>",
  example: ".ytplay Alan Walker Faded",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const UA = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138 Mobile Safari/537.36";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsEsc(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/</g, "\\x3C")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function cleanYoutubeUrl(value) {
  try {
    const u = new URL(String(value).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/^(youtube\.com|m\.youtube\.com|youtu\.be)$/.test(host)) return "";
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
    }
    if (u.pathname === "/watch" && u.searchParams.get("v")) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(u.searchParams.get("v"))}`;
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/").filter(Boolean)[1];
      return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
    }
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/").filter(Boolean)[1];
      return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
    }
    return "";
  } catch {
    return "";
  }
}

function isYoutubeUrl(value) {
  return !!cleanYoutubeUrl(value);
}

function textOf(node) {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map(x => x?.text || "").join("");
  return "";
}

async function searchYoutube(query) {
  const endpoint = "https://www.youtube.com/youtubei/v1/search?prettyPrint=false";
  const body = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260904.01.00",
        hl: "id",
        gl: "ID",
      },
    },
    query: String(query).trim(),
  };

  const { data } = await axios.post(endpoint, body, {
    timeout: 25000,
    headers: {
      "user-agent": UA,
      accept: "application/json",
      "content-type": "application/json",
      origin: "https://www.youtube.com",
      referer: "https://www.youtube.com/",
    },
  });

  const hits = [];
  const seen = new Set();
  const walk = node => {
    if (!node || typeof node !== "object" || hits.length >= 8) return;
    const v = node.videoRenderer;
    if (v?.videoId && !seen.has(v.videoId)) {
      seen.add(v.videoId);
      hits.push({
        id: v.videoId,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        title: textOf(v.title) || "YouTube Video",
        channel: textOf(v.ownerText) || textOf(v.longBylineText) || "YouTube",
        thumb: v.thumbnail?.thumbnails?.at(-1)?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: textOf(v.lengthText) || "",
      });
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(data);

  if (!hits.length) throw new Error("Video YouTube tidak ditemukan");
  return hits[0];
}

async function getOembed(url) {
  try {
    const { data } = await axios.get("https://www.youtube.com/oembed", {
      params: { url, format: "json" },
      timeout: 10000,
      headers: { "user-agent": UA },
    });
    return {
      title: data?.title || "YouTube Video",
      channel: data?.author_name || "YouTube",
      thumb: data?.thumbnail_url || "",
    };
  } catch {
    return null;
  }
}

async function posterData(url) {
  if (!url) return "";
  try {
    const r = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 12000,
      headers: { "user-agent": UA },
      maxContentLength: 3 * 1024 * 1024,
    });
    const type = String(r.headers?.["content-type"] || "image/jpeg").split(";")[0];
    if (!/^image\//i.test(type)) return "";
    return `data:${type};base64,${Buffer.from(r.data).toString("base64")}`;
  } catch {
    return "";
  }
}


function youtubeId(value) {
  try {
    const u = new URL(String(value).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" || parts[0] === "embed") return parts[1] || "";
    }
  } catch {}
  return "";
}

function qualityNumber(value) {
  const m = String(value || "").match(/(\d{3,4})p/i);
  return m ? Number(m[1]) : 0;
}

async function getPlayableStream(youtubeUrl) {
  const id = youtubeId(youtubeUrl);
  if (!id) return null;

  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
  ];

  for (const base of pipedInstances) {
    try {
      const { data } = await axios.get(`${base}/streams/${encodeURIComponent(id)}`, {
        timeout: 12000,
        headers: { "user-agent": UA, accept: "application/json" },
      });

      const streams = Array.isArray(data?.videoStreams) ? data.videoStreams : [];
      const candidates = streams
        .filter(x => x?.url && x?.videoOnly === false && /^video\/mp4(?:;|$)/i.test(String(x?.mimeType || "")))
        .sort((a, b) => qualityNumber(b.quality) - qualityNumber(a.quality));

      if (candidates[0]?.url) {
        // "all" diurutkan dari kualitas TERKECIL -> dipakai buat cari stream
        // yang muat diunduh & ditempel sebagai data: URI (lihat pickEmbeddableStream).
        const all = [...candidates].reverse().map(c => ({
          url: c.url,
          mime: String(c.mimeType || "video/mp4").split(";")[0],
        }));
        return {
          url: candidates[0].url,
          mime: String(candidates[0].mimeType || "video/mp4").split(";")[0],
          duration: Number(data?.duration) > 0 ? Number(data.duration) : 0,
          server: new URL(candidates[0].url).hostname,
          source: "Piped",
          all,
        };
      }
    } catch (e) {
      console.warn(`[YTPLAY] Piped resolver failed (${base}):`, e?.message || e);
    }
  }

  const invidiousInstances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
  ];

  for (const base of invidiousInstances) {
    try {
      const { data } = await axios.get(`${base}/api/v1/videos/${encodeURIComponent(id)}`, {
        params: { local: "true" },
        timeout: 12000,
        headers: { "user-agent": UA, accept: "application/json" },
      });

      const streams = Array.isArray(data?.formatStreams) ? data.formatStreams : [];
      const candidates = streams
        .filter(x => x?.url && /mp4/i.test(String(x?.type || "")))
        .sort((a, b) => qualityNumber(b.quality) - qualityNumber(a.quality));

      if (candidates[0]?.url) {
        const all = [...candidates].reverse().map(c => ({ url: c.url, mime: "video/mp4" }));
        return {
          url: candidates[0].url,
          mime: "video/mp4",
          duration: Number(data?.lengthSeconds) > 0 ? Number(data.lengthSeconds) : 0,
          server: new URL(candidates[0].url).hostname,
          source: "Invidious",
          all,
        };
      }
    } catch (e) {
      console.warn(`[YTPLAY] Invidious resolver failed (${base}):`, e?.message || e);
    }
  }

  return null;
}

function playerHtml({ title, channel, duration, videoUrl, poster, mediaUrl, mediaMime, mediaServer, mediaSource }) {
  const t = esc(title), c = esc(channel), d = esc(duration || "0:00");
  const u = jsEsc(videoUrl), p = esc(poster || ""), media = esc(mediaUrl || "");
  const mmime = esc(mediaMime || "video/mp4");
  const mserver = esc(mediaServer || "stream.kanara.my.id");
  const msource = esc(mediaSource || "WebSocket");
  return `<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}html,body{margin:0;width:100%;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#090a0f;color:#fff}body{padding:10px}.wrap{width:100%;max-width:440px;margin:auto}.card{position:relative;overflow:hidden;background:#111318;border:1px solid rgba(255,255,255,.12);border-radius:22px;box-shadow:0 10px 40px rgba(0,0,0,.55)}.bg{position:absolute;inset:-30px;background:center/cover no-repeat url('${p}');filter:blur(24px);opacity:.3;transform:scale(1.12)}.ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,10,.28),rgba(5,6,10,.82))}.content{position:relative;z-index:2;padding:17px}.top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.tt{font-size:13px;font-weight:800;letter-spacing:.9px}.sub{font-size:10px;opacity:.5;margin-top:3px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon{width:35px;height:35px;border:0;border-radius:50%;background:rgba(255,255,255,.09);color:#fff;display:flex;align-items:center;justify-content:center}.frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 12px 35px rgba(0,0,0,.45)}video{width:100%;height:100%;display:block;object-fit:contain;background:#000}.big{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.16)}.big button{width:62px;height:62px;border:0;border-radius:50%;background:#fff;color:#090a0f;font-size:25px}.playing .big{opacity:0;pointer-events:none}.title{font-size:19px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:15px}.artist{font-size:13px;opacity:.58;margin-top:5px}.range{width:100%;height:4px;accent-color:#fff}.prog{margin-top:17px}.times{display:flex;justify-content:space-between;font-size:10px;opacity:.55;margin-top:7px}.controls{display:flex;align-items:center;justify-content:center;gap:25px;margin-top:13px}.ctrl{width:40px;height:40px;border:0;background:transparent;color:#fff;font-size:23px}.bottom{display:flex;align-items:center;justify-content:space-between;margin-top:14px}.volume{width:86px}.debug{margin-top:12px;background:#111318;border:1px solid rgba(255,255,255,.12);border-radius:17px;padding:12px;font-family:monospace}.dh{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.dt{font-size:11px;font-weight:800;letter-spacing:.8px}.state{font-size:10px;font-weight:800;padding:4px 8px;border-radius:20px;background:rgba(255,255,255,.08);color:#ffd166}.server{font-size:9px;opacity:.5;word-break:break-all;margin-bottom:8px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}.cell{background:rgba(255,255,255,.05);border-radius:8px;padding:6px 8px;min-width:0}.cell span{display:block;font-size:8px;opacity:.5}.cell b{display:block;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar{height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:8px}.fill{height:100%;width:0;background:linear-gradient(90deg,#4cc9f0,#7bff9f)}.log{height:100px;overflow-y:auto;background:rgba(0,0,0,.35);border-radius:8px;padding:6px 8px;font-size:9px;line-height:1.6;color:rgba(255,255,255,.76);word-break:break-all}</style>
<div class="wrap"><div class="card"><div class="bg"></div><div class="ov"></div><div class="content"><div class="top"><div><div class="tt">NOW PLAYING VIDEO</div><div class="sub">${t}</div></div><button class="icon" onclick="mute()">◖</button></div><div class="frame" id="frame" onclick="toggle()"><video id="v" playsinline webkit-playsinline preload="auto" controls poster="${p}" src="${media}" crossorigin="anonymous"></video><div class="big"><button onclick="event.stopPropagation();toggle()">▶</button></div></div><div class="title">${t}</div><div class="artist">${c}</div><div class="prog"><input class="range" id="progress" type="range" min="0" max="100" value="0" step=".1" oninput="seek(this.value)"><div class="times"><span id="cur">0:00</span><span id="dur">${d}</span></div></div><div class="controls"><button class="ctrl" onclick="jump(-10)">↶</button><button class="ctrl" onclick="toggle()" id="cp">▶</button><button class="ctrl" onclick="jump(10)">↷</button></div><div class="bottom"><button class="icon" onclick="toggleLoop()">↻</button><div><button class="icon" onclick="mute()">◖</button><input class="range volume" id="volume" type="range" min="0" max="1" step=".01" value=".8" oninput="setVol(this.value)"></div></div></div></div><div class="debug"><div class="dh"><div class="dt">WEBSOCKET VIDEO</div><div class="state" id="state">CONNECTING</div></div><div class="server" id="server">${mserver} · ${msource} · ${mmime}</div><div class="grid"><div class="cell"><span>MIME</span><b id="mime">-</b></div><div class="cell"><span>Downloaded</span><b id="downloaded">0 B</b></div><div class="cell"><span>Total</span><b id="total">-</b></div><div class="cell"><span>Progress</span><b id="pct">0%</b></div><div class="cell"><span>Chunks</span><b id="chunks">0</b></div><div class="cell"><span>Loop</span><b id="loopText">OFF</b></div></div><div class="bar"><div class="fill" id="fill"></div></div><div class="log" id="log">Preparing stream...</div></div></div>
<script>(function(){var CFG={videoUrl:"${u}",mediaUrl:"${media}",mediaMime:"${mmime}",mediaServer:"${mserver}",mediaSource:"${msource}"};var v=document.getElementById('v'),frame=document.getElementById('frame'),progress=document.getElementById('progress'),cur=document.getElementById('cur'),dur=document.getElementById('dur'),vol=document.getElementById('volume'),cp=document.getElementById('cp');var ws=null,chunks=[],downloaded=0,total=null,mime=CFG.mediaMime||'video/mp4',obj=null,done=false,repeat=false,lastLog=0;function $(x){return document.getElementById(x)}function size(n){if(!isFinite(n))return'0 B';if(n>=1048576)return(n/1048576).toFixed(2)+' MB';if(n>=1024)return(n/1024).toFixed(2)+' KB';return Math.round(n)+' B'}function tm(n){if(!isFinite(n))return'0:00';return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')}function state(x){$('state').textContent=x}function log(x){$('log').textContent+=('\n'+x);$('log').scrollTop=$('log').scrollHeight}function ui(){var paused=v.paused;cp.textContent=paused?'▶':'Ⅱ';frame.classList.toggle('playing',!paused)}window.toggle=function(){if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){log('Tekan tombol ▶ pada player bila autoplay diblokir')})}else v.pause();ui()};window.jump=function(n){if(isFinite(v.duration))v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+n))};window.seek=function(x){if(isFinite(v.duration))v.currentTime=Number(x)/100*v.duration};window.setVol=function(x){v.volume=Math.max(0,Math.min(1,Number(x)||0));v.muted=false};window.mute=function(){v.muted=!v.muted};window.toggleLoop=function(){repeat=!repeat;v.loop=repeat;$('loopText').textContent=repeat?'ON':'OFF'};v.volume=.8;v.onloadedmetadata=function(){dur.textContent=tm(v.duration);$('total').textContent=tm(v.duration);if(CFG.mediaUrl)state('READY')};v.oncanplay=function(){if(CFG.mediaUrl){state('READY');log('Direct video source siap diputar')}};v.ontimeupdate=function(){if(!isFinite(v.duration))return;var p=v.currentTime/v.duration*100;progress.value=p;cur.textContent=tm(v.currentTime);dur.textContent=tm(v.duration);$('pct').textContent=p.toFixed(1)+'%';$('fill').style.width=p+'%'};v.onplay=ui;v.onpause=ui;v.onended=function(){ui();if(repeat){v.currentTime=0;v.play().catch(function(){})}};v.onerror=function(){var e=v.error;state('ERROR');log('Video gagal diputar'+(e&&e.code?' (MediaError '+e.code+')':''));if(CFG.videoUrl)startWs()};function attachBlob(){if(!chunks.length)return false;try{var blob=new Blob(chunks,{type:mime||'video/mp4'});if(!blob.size)return false;if(obj)try{URL.revokeObjectURL(obj)}catch(e){}obj=URL.createObjectURL(blob);v.removeAttribute('src');v.src=obj;v.load();return true}catch(e){log('Blob gagal: '+(e&&e.message||e));return false}}function finish(){if(done)return;done=true;state('FINALIZING');log('Stream complete');if(attachBlob()){state('READY');log('Video siap diputar')}if(ws)try{ws.close()}catch(e){}}var fallbackStarted=false;function startWs(){if(fallbackStarted||typeof WebSocket==='undefined'||!CFG.videoUrl)return;fallbackStarted=true;var wsUrl='wss://stream.kanara.my.id/?url='+encodeURIComponent(CFG.videoUrl);$('server').textContent='stream.kanara.my.id · WebSocket';state('CONNECTING');log('Connecting WebSocket...');try{ws=new WebSocket(wsUrl)}catch(e){state('ERROR');log('WebSocket gagal: '+(e&&e.message||e));return}ws.binaryType='arraybuffer';ws.onopen=function(){state('CONNECTED');log('WebSocket OPEN')};ws.onmessage=function(e){if(typeof e.data==='string'){try{var x=JSON.parse(e.data);if(x.type==='start'){mime=x.mime||'video/mp4';total=x.contentLength!=null?Number(x.contentLength):x.length!=null?Number(x.length):null;$('mime').textContent=mime;state('DOWNLOADING');if(total)$('total').textContent=size(total);log('Stream started')}else if(x.type==='end'){finish()}else if(x.type==='error'){state('ERROR');log('Server error: '+(x.message||'unknown'))}}catch(err){log('Pesan server tidak valid')}}return}var part=e.data;if(part instanceof Blob)chunks.push(part);else if(part instanceof ArrayBuffer)chunks.push(part);else if(ArrayBuffer.isView(part))chunks.push(part.buffer.slice(part.byteOffset,part.byteOffset+part.byteLength));else return;var last=chunks[chunks.length-1];downloaded+=last.size!=null?last.size:last.byteLength||0;$('downloaded').textContent=size(downloaded);$('chunks').textContent=chunks.length;if(total){var p=Math.min(100,downloaded/total*100);$('pct').textContent=p.toFixed(1)+'%';$('fill').style.width=p+'%'}if(Date.now()-lastLog>700){lastLog=Date.now();log('Received '+size(downloaded))}};ws.onerror=function(){state('ERROR');log('WebSocket connection error')};ws.onclose=function(e){if(!done){state('CLOSED');log('WebSocket closed: '+e.code)}}}function safePlay(){try{var p=v.play();if(p&&p.catch)p.catch(function(e){log('Play ditolak: '+(e&&e.message||'tekan PLAY lagi'))})}catch(e){log('Play error: '+(e&&e.message||e))}ui()}function bindControls(){var big=document.querySelector('.big button'),frame=document.getElementById('frame'),play=document.getElementById('cp');if(big){big.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();safePlay()})}if(frame){frame.addEventListener('pointerdown',function(e){if(e.target===frame||e.target===v)safePlay()})}if(play){play.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();if(v.paused)safePlay();else v.pause();ui()})}}function boot(){if(CFG.mediaUrl){$('mime').textContent=CFG.mediaMime||'video/mp4';$('server').textContent=CFG.mediaServer+' · '+CFG.mediaSource;state('READY');log('Direct video source siap diputar');v.load();}else startWs();bindControls();ui()}boot()})();</script>`;
}

/**
 * AKAR MASALAH video tidak bisa play: kartu HTML (.ytplay) dirender di
 * sandbox WA yang TIDAK BISA melakukan request jaringan keluar (persis
 * seperti .play2 yang harus nempel audio sebagai data: URI, bukan link).
 * Jadi src remote (Piped/Invidious) & WebSocket streaming di atas TIDAK
 * PERNAH bisa dimuat oleh video tag di dalam kartu : makanya videonya
 * cuma diam di "CONNECTING/ERROR" dan tidak pernah mulai.
 *
 * Fix: unduh videonya di server (Node) dulu, baru ditempel sebagai
 * data: URI (persis pola .play2 / .ttplayer). Dicoba dari kualitas
 * TERKECIL supaya kemungkinan besar muat di batas ukuran kartu HTML.
 */
const MAX_EMBED_RAW_BYTES = 8 * 1024 * 1024;      // batas unduhan mentah per percobaan
const MAX_EMBED_BASE64_BYTES = 10.5 * 1024 * 1024; // batas base64 di dalam kartu HTML

async function downloadCapped(url, maxBytes) {
  try {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 45000,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      headers: { "user-agent": UA },
    });
    return Buffer.from(data);
  } catch {
    return null;
  }
}

/** Coba tiap kandidat stream dari kualitas terkecil, ambil yang pertama muat. */
async function pickEmbeddableStream(stream) {
  if (!stream?.url) return null;
  const list = Array.isArray(stream.all) && stream.all.length ? stream.all : [{ url: stream.url, mime: stream.mime }];

  for (const cand of list) {
    const buf = await downloadCapped(cand.url, MAX_EMBED_RAW_BYTES);
    if (!buf || !buf.length) continue;
    const dataUri = `data:${cand.mime || "video/mp4"};base64,${buf.toString("base64")}`;
    if (Buffer.byteLength(dataUri, "utf8") <= MAX_EMBED_BASE64_BYTES) {
      return dataUri;
    }
  }
  return null;
}

function tmServer(n) {
  n = Number(n) || 0;
  return Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");
}

async function handler(m, { sock }) {
  const query = String(m.text || "").trim();
  if (!query) return m.reply(`〄 *YT PLAY*\n\n〄 ${m.prefix}ytplay <judul/link>\n〄 ${m.prefix}ytplay https://youtu.be/xxxx`);

  try {
    await m.react("🕐");
    let meta;
    if (isYoutubeUrl(query)) {
      const url = cleanYoutubeUrl(query);
      meta = { url, title: "YouTube Video", channel: "YouTube", thumb: "" };
      const o = await getOembed(url);
      if (o) Object.assign(meta, o);
    } else {
      meta = await searchYoutube(query);
    }

    if (!meta?.url) throw new Error("Video YouTube tidak ditemukan");

    const stream = await getPlayableStream(meta.url);
    if (!stream?.url) throw new Error("Tidak ada sumber video yang bisa diputar (Piped/Invidious lagi down).");

    const poster = await posterData(meta.thumb);
    const embedUrl = await pickEmbeddableStream(stream);

    if (!embedUrl) {
      // Semua kualitas kegedean buat kartu HTML (atau gagal diunduh) :
      // daripada kirim player yang videonya tidak akan pernah play,
      // kirim sebagai video biasa saja (WA yang unduh, bukan sandbox kartu).
      await sock.sendMessage(
        m.chat,
        {
          video: { url: stream.url },
          caption: `〄 *${meta.title || "YouTube Video"}*\n〄 ${meta.channel || "YouTube"}\n\n〄 Video ini terlalu besar buat mode player, dikirim sebagai video biasa.`,
        },
        { quoted: m.raw || m },
      );
      await m.react("✅");
      return;
    }

    const html = playerHtml({
      title: meta.title || "YouTube Video",
      channel: meta.channel || "YouTube",
      duration: meta.duration || (stream?.duration ? tmServer(stream.duration) : "0:00"),
      videoUrl: meta.url,
      poster,
      mediaUrl: embedUrl,
      mediaMime: stream?.mime || "video/mp4",
      mediaServer: stream?.server || "",
      mediaSource: stream?.source || "",
    });

    await sendHTMLRichMessage(sock, m.chat, html, {
      title: "YouTube Player",
      fallbackText: `〄 *YT PLAY*\n\n〄 ${meta.title || "YouTube Video"}\n〄 ${meta.channel || "YouTube"}\n\n〄 Player video siap diputar.`,
    });
    await m.react("✅");
  } catch (e) {
    console.error("[YTPLAY]", e?.stack || e?.message || e);
    await m.react("❌");
    return m.reply(`〄 *YT PLAY ERROR*\n\n〄 ${e?.message || "Gagal memproses video."}`);
  }
}

export default { config, handler };
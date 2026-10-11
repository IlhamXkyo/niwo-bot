// plugins/spotifycard.js
const pluginConfig = {
  name: "spotifycard",
  alias: ['spcard', 'spotifycanvas'],
  category: "canvas",
  description: "Membuat kartu Spotify : bisa manual atau cari lagu otomatis",
  usage: ".spotifycard <judul> | <artis> | <url_cover>  |  .spotifycard <query>",
  example: ".spotifycard Bergema sampai selamanya | Nadhif Basalamah | https://c.top4top.io/p_3815mp2s21.jpg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/canvas/spotifycard";
const API_KEY = "FREE";
const ITUNES_API = "https://itunes.apple.com/search";

/* ========== FETCH IMAGE UNIVERSAL ========== */
async function fetchImage(url, maxRetry = 3) {
  let lastErr;
  for (let i = 1; i <= maxRetry; i++) {
    try {
      const res = await fetch(url);
      console.log(`[spotifycard] try ${i} status:`, res.status);

      if (res.status >= 500) {
        const body = await res.text().catch(() => "");
        throw new Error(`API HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();

      if (ct.includes("json")) {
        const raw = await res.text();
        let json;
        try { json = JSON.parse(raw); } catch { json = null; }

        if (json) {
          const imgUrl = findImageUrl(json);
          if (!imgUrl) throw new Error(`JSON tanpa URL gambar: ${raw.slice(0, 200)}`);
          return await downloadFromUrl(imgUrl);
        }
        if (/^https?:\/\//.test(raw.trim())) return await downloadFromUrl(raw.trim());
        throw new Error(`Response tak dikenal: ${raw.slice(0, 200)}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error("Response kosong (0 bytes).");
      return buf;
    } catch (e) {
      lastErr = e;
      console.log(`[spotifycard] err try ${i}:`, e.message);
      if (i < maxRetry) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

function findImageUrl(obj) {
  if (!obj) return null;
  if (typeof obj === "string") return /^https?:\/\//.test(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const it of obj) { const f = findImageUrl(it); if (f) return f; }
    return null;
  }
  if (typeof obj === "object") {
    for (const k of ["url", "image", "img", "link", "result", "data", "output", "file", "photo"]) {
      if (obj[k] !== undefined) { const f = findImageUrl(obj[k]); if (f) return f; }
    }
    for (const v of Object.values(obj)) { const f = findImageUrl(v); if (f) return f; }
  }
  return null;
}

async function downloadFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal unduh gambar: HTTP ${res.status}`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("json")) {
    const json = await res.json();
    const nested = findImageUrl(json);
    if (nested && nested !== url) return await downloadFromUrl(nested);
    throw new Error("Nested JSON tanpa gambar.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Gambar kosong saat diunduh.");
  return buf;
}

/* ========== SEARCH LAGU via iTunes ========== */
async function searchSong(query) {
  const url = `${ITUNES_API}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes search HTTP ${res.status}`);
  const json = await res.json();

  if (!json.results || !json.results.length) return null;

  const r = json.results[0];
  return {
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    // iTunes kasih 100x100, ganti ke 600x600 biar HD
    cover: (r.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
    preview: r.previewUrl,
  };
}

/* ========== HANDLER ========== */
async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "spotifycard";

  try {
    let text = (ctx.text ?? m?.text ?? m?.body ?? "").trim();
    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text) {
      return m.reply(
        `🎵 *Spotify Card Generator*\n\n` +
        `*Mode 1 : Manual (3 field):*\n` +
        `${usedPrefix}${command} <judul> | <artis> | <url_cover>\n` +
        `_Contoh:_\n` +
        `${usedPrefix}${command} Bergema sampai selamanya | Nadhif Basalamah | https://c.top4top.io/p_3815mp2s21.jpg\n\n` +
        `*Mode 2 : Auto cari lagu:*\n` +
        `${usedPrefix}${command} <judul lagu>\n` +
        `_Contoh:_\n` +
        `${usedPrefix}${command} Bergema sampai selamanya\n` +
        `${usedPrefix}${command} Komang Raim Laode`
      );
    }

    let title, artist, cover;

    // Deteksi mode: kalau ada "|" berarti manual
    if (text.includes("|")) {
      const v = text.split("|").map((s) => s.trim());

      if (v.length < 3 || !v[0] || !v[1] || !v[2]) {
        return m.reply(
          `⚠️ *Mode manual butuh 3 field!*\n\n` +
          `Format: ${usedPrefix}${command} <judul> | <artis> | <url_cover>\n` +
          `_Atau ketik tanpa "|" untuk auto-cari._`
        );
      }

      title = v[0];
      artist = v[1];
      cover = v[2];

      if (!/^https?:\/\/.+/.test(cover)) {
        return m.reply(`⚠️ URL cover tidak valid: \`${cover}\``);
      }
    } else {
      // Mode auto-cari via iTunes
      await m.reply(`🔍 Mencari lagu *"${text}"*...`);

      let song;
      try {
        song = await searchSong(text);
      } catch (e) {
        return m.reply(`❌ Gagal cari lagu: ${e.message}`);
      }

      if (!song) {
        return m.reply(
          `❌ Lagu *"${text}"* tidak ditemukan.\n\n` +
          `Coba:\n` +
          `• Pakai judul + nama artis\n` +
          `• Atau pakai mode manual dengan format:\n` +
          `${usedPrefix}${command} <judul> | <artis> | <url_cover>`
        );
      }

      title = song.title;
      artist = song.artist;
      cover = song.cover;

      await m.reply(
        `✅ Ditemukan:\n` +
        `🎵 *${song.title}*\n` +
        `👤 ${song.artist}\n` +
        `💿 ${song.album || "-"}\n\n` +
        `_Membuat kartu..._`
      );
    }

    // Panggil API spotifycard
    const url =
      `${API_BASE}?title=${encodeURIComponent(title)}` +
      `&artist=${encodeURIComponent(artist)}` +
      `&cover=${encodeURIComponent(cover)}` +
      `&apikey=${API_KEY}`;

    const buffer = await fetchImage(url);

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption:
          `🎵 *Spotify Card*\n\n` +
          `🎧 ${title}\n` +
          `👤 ${artist}`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[spotifycard] ERROR:", err);
    try { await m.reply(`❌ Gagal:\n${err.message || err}`); } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
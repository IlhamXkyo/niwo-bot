/**
 * plugins/download/tiktokplayer.js : NIWO BOT
 * -------------------------------------------------------------------------
 * .ttplayer <link/kata kunci>
 *
 * Sama seperti .tiktok, tapi videonya dikirim sebagai kartu HTML "gemes"
 * (video player custom, tema pastel + emoji) langsung di dalam chat WA :
 * pakai teknik yang sama dengan .play2 (botForwardedMessage HTML card).
 *
 * Kalau videonya kegedean untuk dijadikan kartu HTML, atau kartu HTML
 * gagal terkirim (device/versi WA tidak semuanya dukung), otomatis turun
 * ke kirim video biasa (persis seperti .tiktok) : fitur ini best-effort,
 * tidak boleh bikin command gagal total.
 *
 * Dependency: axios, crypto (bawaan), @itsliaaa/baileys : semua sudah ada.
 * -------------------------------------------------------------------------
 */

'use strict';

import axios from 'axios';
import { randomUUID } from 'crypto';

/* =========================================================
 * TIKWM API (sama seperti plugins/download/tiktok.js)
 * ========================================================= */

async function searchTikTok(query) {
  const { data } = await axios.get('https://tikwm.com/api/feed/search', {
    params: { keywords: query, count: 1 },
    timeout: 20000,
  });

  if (!data || data.code !== 0 || !data.data?.videos?.length) {
    throw new Error('Video tidak ditemukan');
  }

  const v = data.data.videos[0];
  return `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`;
}

async function getTikTok(url) {
  const { data } = await axios.get('https://tikwm.com/api/', {
    params: { url, hd: 1 },
    timeout: 20000,
  });

  if (!data || data.code !== 0) {
    throw new Error('Gagal mengambil data TikTok, coba lagi nanti');
  }

  return data.data;
}

function formatNumber(num = 0) {
  return Number(num || 0).toLocaleString('id-ID');
}

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function downloadBuffer(url, maxBytes) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes,
    headers: { 'User-Agent': 'Mozilla/5.0 (NIWO-BOT)' },
  });
  return Buffer.from(res.data);
}

/* =========================================================
 * HTML : kartu player "gemes" (pastel + kawaii)
 * ========================================================= */

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createTiktokPlayer({ title, uploader, duration, views, likes, videoSrc }) {
  const safeTitle = escapeHtml(title || 'TikTok');
  const safeUploader = escapeHtml(uploader || '-');

  return `
<div id="ttgemes-root">
  <style>
    #ttgemes-root {
      --pink: #ff8fc7;
      --pink-deep: #ff5ea8;
      --lav: #c9b6ff;
      --cream: #fff6fb;
      box-sizing: border-box;
      max-width: 360px;
      margin: 0 auto;
      padding: 14px;
      border-radius: 28px;
      background: linear-gradient(160deg, var(--cream), #ffe4f2 60%, #f1e6ff);
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      box-shadow: 0 10px 24px rgba(255, 94, 168, 0.18);
    }
    #ttgemes-root * { box-sizing: border-box; }
    .tg-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .tg-badge {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      color: #fff;
      background: linear-gradient(120deg, var(--pink-deep), var(--lav));
      padding: 4px 12px;
      border-radius: 999px;
    }
    .tg-emoji { font-size: 18px; }
    .tg-video-wrap {
      position: relative;
      border-radius: 22px;
      overflow: hidden;
      background: #000;
      aspect-ratio: 9 / 16;
      max-height: 480px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    }
    .tg-video-wrap video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      display: block;
    }
    .tg-hearts {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .tg-heart {
      position: absolute;
      bottom: -20px;
      font-size: 16px;
      opacity: 0;
      animation: tg-float 4.5s ease-in infinite;
    }
    @keyframes tg-float {
      0%   { transform: translateY(0) scale(0.8); opacity: 0; }
      12%  { opacity: 0.9; }
      100% { transform: translateY(-360px) scale(1.1); opacity: 0; }
    }
    .tg-info {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 16px;
      background: rgba(255,255,255,0.7);
    }
    .tg-title {
      font-size: 14px;
      font-weight: 700;
      color: #6a2c53;
      line-height: 1.3;
      margin: 0 0 4px;
      word-break: break-word;
    }
    .tg-uploader {
      font-size: 12px;
      color: #a1548a;
      margin: 0 0 8px;
    }
    .tg-stats {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 11.5px;
      color: #7a3a63;
    }
    .tg-stat {
      background: #ffe1f0;
      border-radius: 999px;
      padding: 3px 10px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  </style>

  <div class="tg-head">
    <span class="tg-badge">NIWO BOT ❆ TIKTOK</span>
    <span class="tg-emoji">🎀</span>
  </div>

  <div class="tg-video-wrap">
    <video src="${videoSrc}" controls playsinline preload="metadata"></video>
    <div class="tg-hearts">
      <span class="tg-heart" style="left:8%;animation-delay:0s;">💕</span>
      <span class="tg-heart" style="left:32%;animation-delay:1.1s;">✨</span>
      <span class="tg-heart" style="left:58%;animation-delay:2.2s;">🎀</span>
      <span class="tg-heart" style="left:80%;animation-delay:0.6s;">💖</span>
    </div>
  </div>

  <div class="tg-info">
    <p class="tg-title">${safeTitle}</p>
    <p class="tg-uploader">🎬 ${safeUploader}</p>
    <div class="tg-stats">
      <span class="tg-stat">⏱️ ${escapeHtml(duration)}</span>
      <span class="tg-stat">👁️ ${escapeHtml(views)}</span>
      <span class="tg-stat">❤️ ${escapeHtml(likes)}</span>
    </div>
  </div>
</div>
`;
}

/* =========================================================
 * PENGIRIM KARTU HTML (sama seperti sendMusicPlayer di play2.js)
 * ========================================================= */

async function sendHtmlCard(conn, m, html, label = 'TikTok Player') {
  const responseId = randomUUID();

  await conn.relayMessage(
    m.chat,
    {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: '',
          botResponseId: responseId,
        },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: label }],
            unifiedResponse: {
              data: Buffer.from(
                JSON.stringify({
                  response_id: responseId,
                  sections: [
                    {
                      view_model: {
                        primitive: {
                          __typename: 'GenAIaeacdsnwHtmlPrimitive',
                          payload: html,
                          trusted_sources: [],
                        },
                        __typename: 'GenAISingleLayoutViewModel',
                      },
                    },
                  ],
                }),
              ).toString('base64'),
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
              forwardOrigin: 4,
            },
          },
        },
      },
    },
    { messageId: responseId },
  );
}

/* =========================================================
 * HANDLER
 * ========================================================= */

// Batas ukuran video mentah yang diunduh (biar tidak menggantung lama).
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
// Batas base64 video di dalam kartu HTML : di atas ini kartu HTML dilewati,
// fallback kirim video biasa (sama seperti .tiktok).
const MAX_HTML_VIDEO_BASE64 = 9 * 1024 * 1024;

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    throw `Contoh:\n${usedPrefix + command} https://vt.tiktok.com/xxxxx\n${usedPrefix + command} elaina edit`;
  }

  await m.react('🎀');

  const input = text.trim();
  const quoted = m.raw || m;

  try {
    const url = /^https?:\/\//i.test(input) ? input : await searchTikTok(input);
    const res = await getTikTok(url);

    const title = String(res.title || '-').replace(/\s+/g, ' ').trim();
    const uploader = res.author?.nickname || res.author?.unique_id || '-';
    const duration = formatDuration(res.duration);
    const views = formatNumber(res.play_count || res.play || res.views || 0);
    const likes = formatNumber(res.digg_count || res.likes || 0);

    const playUrl = res.hdplay || res.play;
    if (!playUrl) throw new Error('URL video tidak tersedia');

    let videoBuf = null;
    try {
      videoBuf = await downloadBuffer(playUrl, MAX_DOWNLOAD_BYTES);
    } catch (err) {
      console.log(`[ttplayer] gagal unduh video, fallback link langsung: ${err.message}`);
    }

    const videoBase64Src = videoBuf ? `data:video/mp4;base64,${videoBuf.toString('base64')}` : null;
    const fitsHtmlCard = videoBase64Src && Buffer.byteLength(videoBase64Src, 'utf8') <= MAX_HTML_VIDEO_BASE64;

    if (fitsHtmlCard) {
      try {
        const html = createTiktokPlayer({
          title, uploader, duration, views, likes, videoSrc: videoBase64Src,
        });
        await sendHtmlCard(conn, m, html, 'TikTok Player');
        await m.react('✅');
        return;
      } catch (err) {
        console.log(`[ttplayer] kartu HTML gagal terkirim, fallback video biasa: ${err.message}`);
      }
    }

    // Fallback: video biasa (device tidak dukung kartu HTML, atau video kegedean).
    const caption = [
      ': TIKTOK PLAYER :',
      '',
      `❀ Judul   : ${title.length > 80 ? title.slice(0, 80) + '...' : title}`,
      `❀ Uploader: ${uploader}`,
      `❀ Durasi  : ${duration}`,
      `❀ Views   : ${views}`,
    ].join('\n');

    if (videoBuf) {
      await conn.sendMessage(m.chat, { video: videoBuf, caption, mimetype: 'video/mp4' }, { quoted });
    } else {
      await conn.sendMessage(m.chat, { video: { url: playUrl }, caption }, { quoted });
    }
    await m.react('✅');
  } catch (error) {
    await m.react('❌');
    console.error('[ttplayer] gagal:', error?.message || error);
    await conn.sendMessage(
      m.chat,
      { text: `❌ ${error?.message || 'Gagal memproses video TikTok.'}` },
      { quoted },
    );
  }
};

handler.help = ['ttplayer'];
handler.tags = ['download'];
handler.command = ['ttplayer', 'tiktokplayer', 'ttgemes'];
handler.limit = true;

export default handler;

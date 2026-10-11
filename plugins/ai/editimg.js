// editimg.js
// Niwo Bot - ESM Plugin

import axios from 'axios';
import FormData from 'form-data';

const config = {
  name: 'editimg',
  alias: ['editimage', 'editfoto'],
  category: 'ai',
  description: 'Edit foto menggunakan prompt AI.',
  usage: '.editimg <prompt> (reply foto)',
  example: '.editimg Edit karakter ini jadi tersenyum',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true
};

/* =========================
 * GET TEXT
 * ========================= */

function getText(m) {
  return String(
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.imageMessage?.caption ||
    ''
  ).trim();
}

/* =========================
 * GET QUOTED
 * ========================= */

function getQuoted(m) {
  return (
    m?.quoted ||
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    null
  );
}

/* =========================
 * GET MIME
 * ========================= */

function getMime(q) {
  if (!q) return '';

  return String(
    q?.mimetype ||
    q?.msg?.mimetype ||
    q?.mediaType ||
    q?.message?.imageMessage?.mimetype ||
    q?.message?.documentMessage?.mimetype ||
    ''
  );
}

/* =========================
 * DOWNLOAD MEDIA
 * ========================= */

async function downloadMedia(q) {
  if (!q) return null;

  if (typeof q.download === 'function') {
    return await q.download();
  }

  if (typeof q.downloadMedia === 'function') {
    return await q.downloadMedia();
  }

  throw new Error(
    'Fungsi download media tidak tersedia di bot.'
  );
}

/* =========================
 * EXTRACT COMMAND
 * ========================= */

function getPrompt(m) {
  const text = getText(m);

  const match = text.match(
    /^[.!#/]?(?:editimg|editimage|editfoto)\b\s*([\s\S]*)$/i
  );

  return match?.[1]?.trim() || '';
}

/* =========================
 * GET IMAGE URL
 * ========================= */

function getUrlFromText(text) {
  const match = String(text || '').match(
    /https?:\/\/[^\s]+/i
  );

  return match?.[0] || null;
}

/* =========================
 * UPLOAD UGUU
 * ========================= */

async function uploadToUguu(buffer, mime) {
  const form = new FormData();

  const ext =
    mime.split('/')[1]?.split(';')[0] ||
    'jpg';

  form.append(
    'files[]',
    buffer,
    {
      filename: `upload.${ext}`,
      contentType: mime
    }
  );

  const response = await axios.post(
    'https://uguu.se/upload.php',
    form,
    {
      headers: {
        ...form.getHeaders()
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    }
  );

  const url =
    response?.data?.files?.[0]?.url;

  if (!url) {
    throw new Error(
      'Gagal upload gambar ke Uguu.'
    );
  }

  return url;
}

/* =========================
 * REACTION
 * ========================= */

async function react(m, emoji) {
  try {
    if (typeof m?.react === 'function') {
      await m.react(emoji);
    }
  } catch {}
}

/* =========================
 * REPLY
 * ========================= */

async function reply(m, text) {
  if (typeof m?.reply === 'function') {
    return m.reply(text);
  }

  throw new Error(text);
}

/* =========================
 * HANDLER
 * ========================= */

async function handler(m, { sock } = {}) {
  try {
    const fullText = getText(m);

    let prompt =
      getPrompt(m) ||
      'Edit karakter ini jadi tersenyum';

    let imageUrl = null;

    /*
     * =========================
     * REPLY FOTO
     * =========================
     */

    const q = getQuoted(m);

    if (q) {
      const quotedMime =
        getMime(q);

      if (/^image\//i.test(quotedMime)) {
        await react(m, '⬆️');

        const media =
          await downloadMedia(q);

        if (!media) {
          throw new Error(
            'Gagal mengunduh foto.'
          );
        }

        imageUrl =
          await uploadToUguu(
            media,
            quotedMime
          );
      }
    }

    /*
     * =========================
     * FOTO YANG DIKIRIM LANGSUNG
     * =========================
     */

    if (!imageUrl) {
      const mime =
        getMime(m);

      if (/^image\//i.test(mime)) {
        await react(m, '⬆️');

        const media =
          await downloadMedia(m);

        if (!media) {
          throw new Error(
            'Gagal mengunduh foto.'
          );
        }

        imageUrl =
          await uploadToUguu(
            media,
            mime
          );
      }
    }

    /*
     * =========================
     * URL GAMBAR
     * =========================
     */

    if (!imageUrl) {
      const url =
        getUrlFromText(fullText);

      if (url) {
        imageUrl = url;

        const cleanPrompt =
          getPrompt(m);

        if (cleanPrompt) {
          prompt = cleanPrompt
            .replace(url, '')
            .trim() ||
            'Edit karakter ini jadi tersenyum';
        }
      }
    }

    /*
     * =========================
     * TIDAK ADA GAMBAR
     * =========================
     */

    if (!imageUrl) {
      return reply(
        m,
        `〄 *Cara menggunakan EditImg*

Reply foto dengan:
*.editimg <prompt>*

Contoh:
*.editimg Edit karakter ini jadi tersenyum*

Atau kirim URL gambar:
*.editimg https://example.com/foto.jpg ubah background jadi malam*`
      );
    }

    await react(m, '⏳');

    await reply(
      m,
      '〄 Tunggu sebentar, sedang mengedit foto...'
    );

    /*
     * =========================
     * API FAA EDIT FOTO
     * =========================
     */

    const apiUrl =
      'https://api-faa.my.id/faa/editfoto';

    const response =
      await axios.get(
        apiUrl,
        {
          params: {
            url: imageUrl,
            prompt
          },
          responseType: 'arraybuffer',
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

    if (!response?.data) {
      throw new Error(
        'API tidak mengembalikan gambar.'
      );
    }

    const result =
      Buffer.from(response.data);

    /*
     * =========================
     * KIRIM HASIL
     * =========================
     */

    if (
      sock &&
      typeof sock.sendMessage === 'function'
    ) {
      await sock.sendMessage(
        m.chat,
        {
          image: result,
          mimetype: 'image/jpeg',
          fileName: 'edit.jpg',
          caption:
            '〄 *Edit foto selesai* ✨'
        },
        {
          quoted: m
        }
      );
    } else {
      throw new Error(
        'sock.sendMessage tidak tersedia.'
      );
    }

    await react(m, '✅');

  } catch (error) {
    console.error(
      '[editimg]',
      error
    );

    await react(m, '❌');

    const message =
      error?.response?.data
        ? 'API edit foto sedang bermasalah.'
        : (
            error?.message ||
            'Terjadi error, coba lagi nanti.'
          );

    try {
      await reply(
        m,
        `〄 *EditImg gagal*\n\n${message}`
      );
    } catch {}
  }
}

export default {
  config,
  handler
};
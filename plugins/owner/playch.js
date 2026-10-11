// playch.js
// PLAY CHANNEL - Niwo Bot
// ESM Plugin

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

// ============================================================
// CONFIG
// ============================================================

const CHANNEL_ID = '120363427915199733@newsletter'

const API_URL =
  'https://api.neosoft.best/api/downloader/youtube-play'

const MAX_FILE_SIZE = 50 * 1024 * 1024

// ============================================================
// PLUGIN CONFIG
// ============================================================

const config = {
  name: 'playch',

  alias: ['playchannel', 'pch'],

  category: 'owner',

  description:
    'Download audio YouTube lalu kirim ke WhatsApp Channel.',

  usage:
    '.playch <judul lagu>',

  example:
    '.playch lofi hip hop',

  isOwner: true,
  isPremium: false,

  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 0,

  isEnabled: true
}

// ============================================================
// TEXT HELPER
// ============================================================

function getText(m) {
  return String(
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    ''
  ).trim()
}

// ============================================================
// GET QUERY
// ============================================================

function getQuery(m) {
  const text = getText(m)

  return text
    .replace(
      /^[.!#/]?(?:playch|playchannel|pch)\b\s*/i,
      ''
    )
    .trim()
}

// ============================================================
// REACTION
// ============================================================

async function react(m, emoji) {
  try {
    if (typeof m?.react === 'function') {
      await m.react(emoji)
    }
  } catch {}
}

// ============================================================
// REPLY
// ============================================================

async function reply(m, text) {
  if (typeof m?.reply === 'function') {
    return m.reply(text)
  }

  throw new Error(text)
}

// ============================================================
// THUMBNAIL
// ============================================================

async function getThumb(url) {
  if (!url) return null

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000
    })

    return await sharp(
      Buffer.from(response.data)
    )
      .resize(1280, 720, {
        fit: 'cover'
      })
      .jpeg({
        quality: 90
      })
      .toBuffer()

  } catch (e) {
    console.error(
      '[PLAYCH THUMB ERROR]',
      e?.message || e
    )

    return null
  }
}

// ============================================================
// HIGH QUALITY THUMBNAIL
// ============================================================
//
// Sengaja tidak menggunakan:
//
// @itsliaaa/baileys
// prepareWAMessageMedia
//
// Supaya kompatibel dengan Niwo Bot.
// ============================================================

async function createHighQualityThumbnail(thumb) {
  if (!thumb?.length) {
    return null
  }

  return thumb
}

// ============================================================
// SAFE FILE NAME
// ============================================================

function safeFileName(name) {
  return String(name || 'audio')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

// ============================================================
// HANDLER
// ============================================================

async function handler(m, { sock }) {

  const text = getQuery(m)

  // ==========================================================
  // CHECK QUERY
  // ==========================================================

  if (!text) {

    return reply(
      m,
      `╭─❏ 𝗣𝗹𝗮𝘆 𝗖𝗵𝗮𝗻𝗻𝗲𝗹
│
│✧ Masukkan judul lagu!
│
│✧ Format:
│ .playch <judul lagu>
│
│✧ Contoh:
│ .playch lofi hip hop
│
╰──────────────❏`
    )
  }

  // ==========================================================
  // CHECK CHANNEL
  // ==========================================================

  if (
    !CHANNEL_ID ||
    !CHANNEL_ID.includes('@newsletter')
  ) {

    return reply(
      m,
      `╭─❏ 𝗣𝗹𝗮𝘆 𝗖𝗵𝗮𝗻𝗻𝗲𝗹
│
│✧ ID Channel belum diatur!
│
│✧ Edit bagian:
│ const CHANNEL_ID = '...@newsletter'
│
╰──────────────❏`
    )
  }

  // ==========================================================
  // CHECK SOCKET
  // ==========================================================

  if (!sock?.sendMessage) {

    return reply(
      m,
      '〄 sock.sendMessage tidak tersedia di bot.'
    )
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  await react(m, '⏳')

  let inputPath = null
  let outputPath = null

  try {

    // ========================================================
    // REQUEST API
    // ========================================================

    console.log(
      '[PLAYCH] Searching:',
      text
    )

    const { data } = await axios.get(
      API_URL,
      {
        params: {
          q: text,
          type: 'mp3'
        },

        timeout: 30000
      }
    )

    // ========================================================
    // CHECK API
    // ========================================================

    if (
      !data ||
      !data.status ||
      !data.download
    ) {

      throw new Error(
        'Audio tidak ditemukan'
      )
    }

    // ========================================================
    // API DATA
    // ========================================================

    const title =
      String(data.title || text)

    const artist =
      String(data.artist || 'Unknown')

    const thumbnail =
      String(data.thumbnail || '')

    const source =
      String(data.source || '')

    const duration =
      String(data.durationText || '-')

    const views =
      Number(data.views || 0)
        .toLocaleString('id-ID')

    const uploaded =
      String(data.uploadedAt || '-')

    const downloadUrl =
      String(data.download)

    // ========================================================
    // THUMBNAIL
    // ========================================================

    const thumb =
      await getThumb(thumbnail)

    const highQualityThumbnail =
      await createHighQualityThumbnail(
        thumb
      )

    // ========================================================
    // CAPTION
    // ========================================================

    const invisible =
      '\u200B'.repeat(400)

    const caption =
      `┈─ ◦ now playing ◦ ─┈
🎵 ${title}
👤 ${artist}
⏱️ ${duration}
👁️ ${views}
📆 ${uploaded}
⏳ sedang mengambil audio...`.trim()

    // ========================================================
    // SEND LINK PREVIEW TO CHANNEL
    // ========================================================

    if (source) {

      const previewText =
        `${source}${invisible}\n${caption}`

      const linkPreview = {

        'matched-text':
          source,

        matchedText:
          source,

        canonicalUrl:
          source,

        title:
          title,

        description:
          `🎧 Niwo Bot • ${duration}`,

        previewType:
          0,

        jpegThumbnail:
          thumb || undefined,

        highQualityThumbnail:
          highQualityThumbnail || undefined,

        thumbnailUrl:
          thumbnail || undefined,

        linkPreviewMetadata: {

          linkMediaDuration:
            Number(data.duration || 0),

          socialMediaPostType:
            4
        }
      }

      try {

        await sock.sendMessage(
          CHANNEL_ID,
          {
            text:
              previewText,

            linkPreview,

            favicon:
              thumbnail
                ? {
                    url: thumbnail
                  }
                : undefined
          }
        )

      } catch (previewError) {

        console.warn(
          '[PLAYCH PREVIEW FALLBACK]',
          previewError?.message ||
          previewError
        )

        // Fallback kalau fork Baileys
        // tidak menerima linkPreview.

        await sock.sendMessage(
          CHANNEL_ID,
          {
            text:
              previewText
          }
        )
      }

    } else {

      await sock.sendMessage(
        CHANNEL_ID,
        {
          text:
            caption
        }
      )
    }

    // ========================================================
    // TEMP DIRECTORY
    // ========================================================

    const tmpDir =
      path.resolve('./tmp')

    if (
      !fs.existsSync(tmpDir)
    ) {

      fs.mkdirSync(
        tmpDir,
        {
          recursive: true
        }
      )
    }

    // ========================================================
    // FILE NAME
    // ========================================================

    const fileName =
      `playch_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`

    inputPath =
      path.join(
        tmpDir,
        `${fileName}.mp3`
      )

    outputPath =
      path.join(
        tmpDir,
        `${fileName}.opus`
      )

    // ========================================================
    // DOWNLOAD MP3
    // ========================================================

    console.log(
      '[PLAYCH] Downloading audio...'
    )

    const audioResponse =
      await axios({

        method:
          'GET',

        url:
          downloadUrl,

        responseType:
          'stream',

        timeout:
          120000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity
      })

    // ========================================================
    // SAVE STREAM
    // ========================================================

    const writer =
      fs.createWriteStream(
        inputPath
      )

    audioResponse.data.pipe(
      writer
    )

    await new Promise(
      (resolve, reject) => {

        writer.on(
          'finish',
          resolve
        )

        writer.on(
          'error',
          reject
        )

        audioResponse.data.on(
          'error',
          reject
        )
      }
    )

    // ========================================================
    // CHECK FILE
    // ========================================================

    if (
      !fs.existsSync(inputPath)
    ) {

      throw new Error(
        'File audio tidak ditemukan'
      )
    }

    const stats =
      fs.statSync(inputPath)

    if (
      stats.size >
      MAX_FILE_SIZE
    ) {

      throw new Error(
        'FILE_TOO_LARGE'
      )
    }

    // ========================================================
    // CONVERT MP3 -> OPUS
    // ========================================================

    console.log(
      '[PLAYCH] Converting to Opus...'
    )

    await execPromise(

      `ffmpeg -y ` +
      `-i "${inputPath}" ` +
      `-vn ` +
      `-c:a libopus ` +
      `-ac 1 ` +
      `-ar 48000 ` +
      `-b:a 32k ` +
      `-application voip ` +
      `-map_metadata -1 ` +
      `"${outputPath}"`,

      {
        timeout:
          180000
      }
    )

    // ========================================================
    // CHECK OUTPUT
    // ========================================================

    if (
      !fs.existsSync(outputPath)
    ) {

      throw new Error(
        'FFmpeg gagal menghasilkan audio'
      )
    }

    const audioBuffer =
      fs.readFileSync(
        outputPath
      )

    if (
      !audioBuffer ||
      !audioBuffer.length
    ) {

      throw new Error(
        'Buffer audio kosong'
      )
    }

    // ========================================================
    // SEND AUDIO TO CHANNEL
    // ========================================================

    console.log(
      '[PLAYCH] Sending audio to channel...'
    )

    await sock.sendMessage(
      CHANNEL_ID,
      {
        audio:
          audioBuffer,

        mimetype:
          'audio/ogg; codecs=opus',

        fileName:
          `${safeFileName(title)}.opus`,

        ptt:
          false
      }
    )

    // ========================================================
    // SUCCESS
    // ========================================================

    await react(
      m,
      '✅'
    )

    return reply(
      m,
      `╭─❏ 𝗣𝗹𝗮𝘆 𝗖𝗵𝗮𝗻𝗻𝗲𝗹
│
│✧ Berhasil dikirim!
│
│✧ Judul : ${title}
│✧ Artist : ${artist}
│✧ Durasi : ${duration}
│✧ Views : ${views}
│
╰──────────────❏`
    )

  } catch (e) {

    console.error(
      '[PLAYCH ERROR]',
      e
    )

    // ========================================================
    // ERROR REACTION
    // ========================================================

    await react(
      m,
      '❌'
    )

    // ========================================================
    // ERROR MESSAGE
    // ========================================================

    let errorMsg =
      'Terjadi kesalahan saat proses.'

    if (
      e?.message ===
      'FILE_TOO_LARGE'
    ) {

      errorMsg =
        'File terlalu besar. Maksimal 50MB.'

    } else if (
      e?.code ===
        'ECONNABORTED' ||
      e?.code ===
        'ETIMEDOUT'
    ) {

      errorMsg =
        'Request timeout. Coba lagi nanti.'

    } else if (
      e?.response?.status ===
      404
    ) {

      errorMsg =
        'Lagu atau audio tidak ditemukan.'

    } else if (
      e?.response?.status ===
      403
    ) {

      errorMsg =
        'Download ditolak oleh server.'

    } else if (
      e?.response?.status ===
      429
    ) {

      errorMsg =
        'API sedang terlalu banyak digunakan.'

    } else if (
      e?.code ===
      'ENOTFOUND'
    ) {

      errorMsg =
        'Server API tidak dapat dihubungi.'

    } else if (
      e?.message ===
      'Audio tidak ditemukan'
    ) {

      errorMsg =
        'Audio tidak ditemukan dari API.'

    } else if (
      e?.message ===
      'FFmpeg gagal menghasilkan audio'
    ) {

      errorMsg =
        'FFmpeg gagal mengconvert audio.'

    } else if (
      e?.code ===
      'ENOENT'
    ) {

      errorMsg =
        'FFmpeg tidak ditemukan di VPS.'

    }

    return reply(
      m,
      `╭─❏ 𝗣𝗹𝗮𝘆 𝗖𝗵𝗮𝗻𝗻𝗲𝗹
│
│✧ Status : Gagal
│✧ Error :
│ ${errorMsg}
│
╰──────────────❏`
    )

  } finally {

    // ========================================================
    // CLEANUP
    // ========================================================

    try {

      if (
        inputPath &&
        fs.existsSync(inputPath)
      ) {

        fs.unlinkSync(
          inputPath
        )
      }

      if (
        outputPath &&
        fs.existsSync(outputPath)
      ) {

        fs.unlinkSync(
          outputPath
        )
      }

    } catch (err) {

      console.error(
        '[PLAYCH CLEANUP]',
        err?.message ||
        err
      )
    }
  }
}

// ============================================================
// EXPORT NIWO
// ============================================================

export default {
  config,
  handler
}
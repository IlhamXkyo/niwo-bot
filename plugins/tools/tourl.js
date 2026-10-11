/*
 * TO URL - PONE.RS
 * Type    : Plugin ESM
 * Support : All Media
 * Creator : dekzyy
 * Ported  : Niwo Bot
 */

import path from 'node:path'
import axios from 'axios'
import FormData from 'form-data'

const API = 'https://pone.rs/upload.php'

const config = {
  name: 'tourl',
  alias: ['tolink', 'upload'],
  category: 'tools',
  description: 'Upload media ke Pone.rs dan mendapatkan URL.',
  usage: '.tourl',
  example: '.tourl',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

function getExtFromMime(mime = '') {
  mime = String(mime).toLowerCase()

  if (mime.includes('image/jpeg')) return '.jpg'
  if (mime.includes('image/png')) return '.png'
  if (mime.includes('image/webp')) return '.webp'
  if (mime.includes('image/gif')) return '.gif'

  if (mime.includes('video/mp4')) return '.mp4'
  if (mime.includes('video/webm')) return '.webm'
  if (mime.includes('video/3gpp')) return '.3gp'

  if (mime.includes('audio/mpeg')) return '.mp3'
  if (mime.includes('audio/ogg')) return '.ogg'
  if (mime.includes('audio/mp4')) return '.m4a'
  if (mime.includes('audio/wav')) return '.wav'

  if (mime.includes('application/pdf')) return '.pdf'
  if (mime.includes('application/zip')) return '.zip'
  if (mime.includes('application/x-rar')) return '.rar'

  return '.bin'
}

function getMime(q) {
  return (
    q?.mimetype ||
    q?.msg?.mimetype ||
    q?.message?.imageMessage?.mimetype ||
    q?.message?.videoMessage?.mimetype ||
    q?.message?.audioMessage?.mimetype ||
    q?.message?.documentMessage?.mimetype ||
    ''
  )
}

function getFileName(q, mime) {
  const name =
    q?.fileName ||
    q?.msg?.fileName ||
    q?.message?.documentMessage?.fileName

  if (name) {
    return path.basename(String(name))
  }

  return `Niwo-${Date.now()}${getExtFromMime(mime)}`
}

async function uploadPone(buffer, filename = 'file.bin') {
  const form = new FormData()

  form.append('files[]', buffer, {
    filename
  })

  try {
    const res = await axios.post(API, form, {
      headers: {
        ...form.getHeaders(),
        'user-agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
        accept: '*/*',
        origin: 'https://pone.rs',
        referer: 'https://pone.rs/'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000,
      validateStatus: () => true
    })

    const data = res.data

    const url =
      data?.files?.[0]?.url?.replaceAll('\\/', '/') ||
      data?.files?.[0]?.url ||
      null

    return {
      status: Boolean(data?.success && url),
      code: res.status,
      result_url: url
    }
  } catch (err) {
    return {
      status: false,
      code: err?.response?.status || 500,
      result_url: null,
      error: err?.message || 'Request gagal'
    }
  }
}

function getQuotedOrMessage(m) {
  return m?.quoted || m
}

async function react(m, emoji) {
  try {
    if (typeof m?.react === 'function') {
      await m.react(emoji)
    }
  } catch {}
}

async function handler(m) {
  const q = getQuotedOrMessage(m)
  const mime = getMime(q)

  if (!mime) {
    return m.reply(
      `🌸 *TO URL - PONE.RS*\n\n` +
      `Reply/kirim media dengan caption:\n` +
      `*.tourl*\n\n` +
      `Support:\n` +
      `• Image\n` +
      `• Video\n` +
      `• Audio\n` +
      `• Sticker\n` +
      `• Document\n` +
      `• PDF\n` +
      `• ZIP\n` +
      `• Dan media lainnya`
    )
  }

  await react(m, '🕒')

  try {
    if (typeof q?.download !== 'function') {
      await react(m, '❌')
      return m.reply(
        '❌ Media tidak bisa didownload dari pesan tersebut.'
      )
    }

    const buffer = await q.download()

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1) {
      await react(m, '❌')
      return m.reply(
        '❌ Gagal download media, buffer kosong.'
      )
    }

    const filename = getFileName(q, mime)

    const result = await uploadPone(buffer, filename)

    if (!result.status || !result.result_url) {
      await react(m, '❌')

      return m.reply(
        `❌ *Upload gagal!*\n\n` +
        `Code: ${result.code || '-'}\n` +
        `Error: ${result.error || 'Tidak diketahui'}`
      )
    }

    await react(m, '✅')

    return m.reply(
      `乂 *TO URL - PONE.RS*\n\n` +
      `✅ *Status:* Success\n` +
      `📦 *File:* ${filename}\n` +
      `📁 *Size:* ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n\n` +
      `🔗 *URL:*\n` +
      `${result.result_url}`
    )
  } catch (e) {
    console.error('[tourl]', e)

    await react(m, '❌')

    return m.reply(
      `❌ *Upload Error*\n\n${e?.message || 'Unknown error'}`
    )
  }
}

export default {
  config,
  handler
}
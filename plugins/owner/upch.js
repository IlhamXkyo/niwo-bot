import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { tmpdir } from 'os'

const CH_ID = '120363427915199733@newsletter'

const config = {
  name: 'upch',
  alias: ['sendch'],
  category: 'owner',
  description: 'Upload media ke WhatsApp Channel',
  usage: '.upch (reply media)',
  example: '.upch',
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true
}

function convertToOpus(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .audioCodec('libopus')
      .format('opus')
      .on('end', resolve)
      .on('error', reject)
      .save(output)
  })
}

function getTarget(m) {
  if (typeof m.resolveMediaTarget === 'function') {
    try {
      const target = m.resolveMediaTarget()
      if (target) return target
    } catch {}
  }

  return m.quoted || null
}

function getQuotedMessage(m) {
  return (
    m.quoted?.message ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    m.msg?.contextInfo?.quotedMessage ||
    null
  )
}

async function downloadMedia(target) {
  if (!target || typeof target.download !== 'function') {
    throw new Error('Media tidak memiliki fungsi download.')
  }

  const buffer = await target.download()

  if (!buffer || !buffer.length) {
    throw new Error('Gagal mengunduh media.')
  }

  return Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer)
}

async function handler(m, { sock }) {
  const target = getTarget(m)
  const quoted = getQuotedMessage(m)

  if (!target || !quoted) {
    return m.reply(
      `❌ Reply media terlebih dahulu!\n\n` +
      `Contoh:\n.upch`
    )
  }

  let media
  let type
  let mimetype

  const caption =
    quoted.imageMessage?.caption ||
    quoted.videoMessage?.caption ||
    quoted.documentMessage?.caption ||
    target.text ||
    ''

  if (quoted.imageMessage) {
    media = quoted.imageMessage
    type = 'image'
    mimetype = media.mimetype || 'image/jpeg'

  } else if (quoted.videoMessage) {
    media = quoted.videoMessage
    type = media.ptv ? 'ptv' : 'video'
    mimetype = media.mimetype || 'video/mp4'

  } else if (quoted.audioMessage) {
    media = quoted.audioMessage
    type = 'audio'
    mimetype = media.mimetype || 'audio/mpeg'

  } else if (quoted.stickerMessage) {
    media = quoted.stickerMessage
    type = 'sticker'
    mimetype = 'image/webp'
  }

  if (!media) {
    return m.reply('❌ Media tidak didukung!')
  }

  const ext =
    mimetype
      ?.split('/')[1]
      ?.split(';')[0]
      ?.replace('x-', '') || 'bin'

  const filename = `upch-${Date.now()}`
  const inputPath = path.join(
    tmpdir(),
    `${filename}.${ext}`
  )

  const opusPath = path.join(
    tmpdir(),
    `${filename}.opus`
  )

  try {
    await m.reply(
      `🔄 Sedang memproses *${type}*...`
    )

    // =========================
    // DOWNLOAD MEDIA
    // =========================

    const inputBuffer =
      await downloadMedia(target)

    fs.writeFileSync(
      inputPath,
      inputBuffer
    )

    // =========================
    // SEND IMAGE
    // =========================

    if (type === 'image') {
      await sock.sendMessage(
        CH_ID,
        {
          image: inputBuffer,
          caption
        }
      )
    }

    // =========================
    // SEND VIDEO
    // =========================

    else if (type === 'video') {
      await sock.sendMessage(
        CH_ID,
        {
          video: inputBuffer,
          caption
        }
      )
    }

    // =========================
    // SEND PTV
    // =========================

    else if (type === 'ptv') {
      await sock.sendMessage(
        CH_ID,
        {
          video: inputBuffer,
          ptv: true,
          caption
        }
      )
    }

    // =========================
    // SEND STICKER
    // =========================

    else if (type === 'sticker') {
      await sock.sendMessage(
        CH_ID,
        {
          sticker: inputBuffer
        }
      )
    }

    // =========================
    // SEND AUDIO
    // =========================

    else if (type === 'audio') {
      const isOpus =
        mimetype.includes('opus') ||
        mimetype.includes('ogg')

      if (isOpus) {
        fs.copyFileSync(
          inputPath,
          opusPath
        )
      } else {
        await convertToOpus(
          inputPath,
          opusPath
        )
      }

      const opusBuffer =
        fs.readFileSync(opusPath)

      await sock.sendMessage(
        CH_ID,
        {
          audio: opusBuffer,
          mimetype:
            'audio/ogg; codecs=opus',
          ptt: false
        }
      )
    }

    await m.reply(
      `✅ *${type}* berhasil dikirim ke channel!`
    )

  } catch (e) {
    console.error(
      '[UPCH ERROR]',
      e
    )

    await m.reply(
      `❌ Gagal mengirim media!\n\n` +
      `${e?.message || String(e)}`
    )

  } finally {
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath)
      }
    } catch {}

    try {
      if (fs.existsSync(opusPath)) {
        fs.unlinkSync(opusPath)
      }
    } catch {}
  }
}

export default {
  config,
  handler
}
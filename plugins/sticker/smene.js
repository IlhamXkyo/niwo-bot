// plugins/smeme.js
// Niwo Bot - ESM Plugin
// Support: Image / GIF / Video / Animated WebP
// Command: .smeme / .stikermeme

import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'
import { execFile } from 'child_process'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import axios from 'axios'
import sharp from 'sharp'

const EMOJI_CACHE = path.join(process.cwd(), 'tmp', 'emoji-cache')

if (!fs.existsSync(EMOJI_CACHE)) {
  fs.mkdirSync(EMOJI_CACHE, { recursive: true })
}

const FONT_PATH = path.join(process.cwd(), 'font', 'impact.ttf')

if (fs.existsSync(FONT_PATH)) {
  GlobalFonts.registerFromPath(FONT_PATH, 'Impact')
}

const config = {
  name: 'smeme',
  alias: ['stikermeme', 'memesticker'],
  category: 'sticker',
  description: 'Membuat sticker meme dari gambar, GIF, video, atau animated WebP.',
  usage: '.smeme <teks atas>|<teks bawah>',
  example: '.smeme INI ATAS|INI BAWAH',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

function tmpFile(ext) {
  return path.join(
    os.tmpdir(),
    `smeme-${randomBytes(8).toString('hex')}.${ext}`
  )
}

function safeUnlink(...files) {
  for (const file of files) {
    try {
      fs.unlinkSync(file)
    } catch {}
  }
}

function isAnimatedWebp(buffer) {
  if (!buffer || buffer.length < 16) return false

  if (buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return false
  }

  if (buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return false
  }

  return buffer.includes(Buffer.from('ANIM'))
}

function emojiToFilename(emoji) {
  return [...emoji]
    .map(char => char.codePointAt(0))
    .filter(codePoint => codePoint !== 0xfe0f)
    .map(codePoint => codePoint.toString(16))
    .join('-') + '.png'
}

async function getEmojiPath(emoji) {
  const fileName = emojiToFilename(emoji)
  const localPath = path.join(EMOJI_CACHE, fileName)

  if (fs.existsSync(localPath)) {
    return localPath
  }

  try {
    const response = await axios.get(
      `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${fileName}`,
      {
        responseType: 'arraybuffer',
        timeout: 5000
      }
    )

    fs.writeFileSync(
      localPath,
      Buffer.from(response.data)
    )

    return localPath
  } catch {
    return null
  }
}

function toSegments(text) {
  const emojiRe = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu

  const parts = []
  let last = 0

  for (const match of text.matchAll(emojiRe)) {
    if (match.index > last) {
      parts.push({
        t: 'text',
        v: text.slice(last, match.index)
      })
    }

    parts.push({
      t: 'emoji',
      v: match[0]
    })

    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push({
      t: 'text',
      v: text.slice(last)
    })
  }

  return parts
}

function segWidth(ctx, seg, size) {
  return seg.t === 'text'
    ? ctx.measureText(seg.v).width
    : size * 1.15
}

async function drawMemeText(ctx, segments, isTop) {
  const emojiPathMap = {}

  await Promise.all(
    segments
      .filter(seg => seg.t === 'emoji')
      .map(async seg => {
        emojiPathMap[seg.v] = await getEmojiPath(seg.v)
      })
  )

  let fontSize = 50

  ctx.font = `bold ${fontSize}px Impact, Arial`

  let totalWidth = segments.reduce(
    (sum, seg) => sum + segWidth(ctx, seg, fontSize),
    0
  )

  while (totalWidth > 480 && fontSize > 18) {
    fontSize -= 2

    ctx.font = `bold ${fontSize}px Impact, Arial`

    totalWidth = segments.reduce(
      (sum, seg) => sum + segWidth(ctx, seg, fontSize),
      0
    )
  }

  let startX = (512 - totalWidth) / 2

  const yPos = isTop
    ? 20
    : 512 - fontSize - 30

  for (const seg of segments) {
    if (seg.t === 'text') {
      ctx.fillStyle = 'white'
      ctx.strokeStyle = 'black'
      ctx.lineWidth = Math.max(3, fontSize / 8)

      ctx.strokeText(
        seg.v,
        startX,
        yPos
      )

      ctx.fillText(
        seg.v,
        startX,
        yPos
      )

      startX += ctx.measureText(seg.v).width
    } else {
      const emojiPath = emojiPathMap[seg.v]

      if (emojiPath && fs.existsSync(emojiPath)) {
        try {
          const image = await loadImage(emojiPath)

          ctx.drawImage(
            image,
            startX,
            yPos + fontSize * 0.05,
            fontSize,
            fontSize
          )
        } catch {}
      }

      startX += fontSize * 1.15
    }
  }
}

function execFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      args,
      {
        maxBuffer: 10 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr ||
              error.message ||
              'FFmpeg gagal.'
            )
          )
          return
        }

        resolve()
      }
    )
  })
}

async function processAnimatedWebp(
  buffer,
  canvasBuffer,
  outputPath
) {
  const meta = await sharp(
    buffer,
    { animated: true }
  ).metadata()

  const pages = meta.pages || 1

  const delays =
    meta.delay &&
    meta.delay.length === pages
      ? meta.delay
      : Array(pages).fill(100)

  const frameDir = path.join(
    os.tmpdir(),
    `smeme-frames-${randomBytes(6).toString('hex')}`
  )

  fs.mkdirSync(frameDir, {
    recursive: true
  })

  try {
    await Promise.all(
      Array.from(
        { length: pages },
        async (_, i) => {
          const frame = await sharp(
            buffer,
            {
              page: i,
              pages: 1
            }
          )
            .resize(512, 512, {
              fit: 'fill'
            })
            .composite([
              {
                input: canvasBuffer,
                top: 0,
                left: 0
              }
            ])
            .png()
            .toBuffer()

          fs.writeFileSync(
            path.join(
              frameDir,
              `frame_${String(i).padStart(4, '0')}.png`
            ),
            frame
          )
        }
      )
    )

    const avgDelay =
      delays.reduce(
        (a, b) => a + b,
        0
      ) / delays.length

    const fps = Math.max(
      1,
      Math.min(
        12,
        Math.round(
          1000 / (avgDelay || 100)
        )
      )
    )

    const encode = async quality => {
      await execFFmpeg([
        '-y',
        '-framerate',
        String(fps),
        '-i',
        path.join(
          frameDir,
          'frame_%04d.png'
        ),
        '-c:v',
        'libwebp',
        '-lossless',
        '0',
        '-q:v',
        String(quality),
        '-compression_level',
        '4',
        '-loop',
        '0',
        '-an',
        '-vsync',
        'passthrough',
        outputPath
      ])
    }

    await encode(50)

    if (
      fs.statSync(outputPath).size >
      480 * 1024
    ) {
      await encode(30)
    }

  } finally {
    fs.rmSync(
      frameDir,
      {
        recursive: true,
        force: true
      }
    )
  }
}

function getText(m) {
  return String(
    m?.text ??
    m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    m?.message?.imageMessage?.caption ??
    m?.message?.videoMessage?.caption ??
    ''
  ).trim()
}

function getQuoted(m) {
  return (
    m?.quoted ||
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ? m?.quoted
      : null
  )
}

function getMime(q) {
  return String(
    q?.mimetype ||
    q?.mediaType ||
    q?.msg?.mimetype ||
    q?.message?.imageMessage?.mimetype ||
    q?.message?.videoMessage?.mimetype ||
    q?.message?.documentMessage?.mimetype ||
    ''
  ).toLowerCase()
}

async function downloadMedia(q) {
  if (!q) return null

  if (typeof q.download === 'function') {
    return await q.download()
  }

  if (typeof q.downloadMedia === 'function') {
    return await q.downloadMedia()
  }

  return null
}

async function react(m, emoji) {
  try {
    if (typeof m.react === 'function') {
      await m.react(emoji)
    }
  } catch {}
}

async function handler(m, { sock }) {
  const fullText = getText(m)

  /*
   * Ambil teks setelah command.
   * Mendukung:
   * .smeme atas|bawah
   * smeme atas|bawah
   * atau Niwo yang sudah mengirim args saja.
   */
  let text = fullText

  text = text.replace(
    /^[.!#/]?(?:smeme|stikermeme|memesticker)\b\s*/i,
    ''
  ).trim()

  if (!text) {
    throw (
      'Format: .smeme <teks atas>|<teks bawah>\n\n' +
      'Contoh:\n' +
      '.smeme INI ATAS|INI BAWAH'
    )
  }

  const q = getQuoted(m) || m
  const mime = getMime(q)

  if (!mime) {
    throw (
      'Balas gambar, GIF, video, atau animated WebP dengan perintah:\n\n' +
      '.smeme <teks atas>|<teks bawah>'
    )
  }

  const supported =
    mime.startsWith('image/') ||
    mime.startsWith('video/')

  if (!supported) {
    throw 'Media harus berupa gambar, GIF, video, atau WebP.'
  }

  await react(m, '🕒')

  const buffer = await downloadMedia(q)

  if (!buffer) {
    throw 'Gagal mengunduh media.'
  }

  const isVideo = mime.startsWith('video/')
  const isGif = mime === 'image/gif'

  const isAnimWebp =
    mime.startsWith('image/webp') &&
    isAnimatedWebp(buffer)

  const isAnimated =
    isVideo ||
    isGif ||
    isAnimWebp

  const inputExt =
    isVideo
      ? (
          mime
            .split('/')[1]
            ?.split(';')[0] ||
          'mp4'
        )
      : (
          isGif
            ? 'gif'
            : (
                mime.startsWith('image/webp')
                  ? 'webp'
                  : 'jpg'
              )
        )

  const inputPath = tmpFile(inputExt)
  const canvasPath = tmpFile('png')
  const outputPath = tmpFile('webp')

  try {
    fs.writeFileSync(
      inputPath,
      buffer
    )

    const [
      topRaw,
      bottomRaw
    ] = text.split('|')

    const textCanvas =
      createCanvas(512, 512)

    const ctx =
      textCanvas.getContext('2d')

    ctx.textBaseline = 'top'

    if (
      topRaw &&
      topRaw.trim()
    ) {
      await drawMemeText(
        ctx,
        toSegments(
          topRaw
            .trim()
            .toUpperCase()
        ),
        true
      )
    }

    if (
      bottomRaw &&
      bottomRaw.trim()
    ) {
      await drawMemeText(
        ctx,
        toSegments(
          bottomRaw
            .trim()
            .toUpperCase()
        ),
        false
      )
    }

    const canvasBuffer =
      textCanvas.toBuffer('image/png')

    fs.writeFileSync(
      canvasPath,
      canvasBuffer
    )

    /*
     * Animated WebP
     */
    if (isAnimWebp) {

      await processAnimatedWebp(
        buffer,
        canvasBuffer,
        outputPath
      )

    /*
     * Gambar statis
     */
    } else if (!isAnimated) {

      const baseImage =
        await sharp(buffer)
          .resize(512, 512, {
            fit: 'fill'
          })
          .toBuffer()

      await sharp(baseImage)
        .composite([
          {
            input: canvasBuffer,
            top: 0,
            left: 0
          }
        ])
        .webp({
          quality: 80
        })
        .toFile(outputPath)

    /*
     * Video / GIF
     */
    } else {

      const encode = async ({
        fps,
        duration,
        quality
      }) => {

        await execFFmpeg([
          '-y',
          '-analyzeduration',
          '20M',
          '-probesize',
          '10M',
          '-t',
          String(duration),
          '-i',
          inputPath,
          '-i',
          canvasPath,

          '-filter_complex',
          `[0:v]scale=512:512,fps=${fps}[base];` +
          `[base][1:v]overlay=0:0[v_final]`,

          '-map',
          '[v_final]',

          '-c:v',
          'libwebp',

          '-lossless',
          '0',

          '-q:v',
          String(quality),

          '-compression_level',
          '4',

          '-loop',
          '0',

          '-an',

          outputPath
        ])
      }

      await encode({
        fps: 10,
        duration: 4,
        quality: 50
      })

      if (
        fs.statSync(outputPath).size >
        480 * 1024
      ) {
        await encode({
          fps: 8,
          duration: 3,
          quality: 30
        })
      }
    }

    const stickerBuffer =
      fs.readFileSync(outputPath)

    if (!sock?.sendMessage) {
      throw new Error(
        'sock.sendMessage tidak tersedia.'
      )
    }

    await sock.sendMessage(
      m.chat,
      {
        sticker: stickerBuffer
      },
      {
        quoted: m
      }
    )

    await react(m, '✨')

  } catch (e) {

    await react(m, '❌')

    throw (
      `Gagal memproses meme:\n` +
      `${e?.message || e}`
    )

  } finally {

    safeUnlink(
      inputPath,
      canvasPath,
      outputPath
    )
  }
}

export default {
  config,
  handler
}
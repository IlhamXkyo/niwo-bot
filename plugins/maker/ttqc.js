// plugins/maker/ttqc.js

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ASSETS_DIR = join(__dirname, '../../assets/ttqc')
const FONTS_DIR = join(ASSETS_DIR, 'fonts')
const TEMPLATE_PATH = join(ASSETS_DIR, 'template.png')

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/qyzwa.png'

const FONT_ASSETS = [
  {
    file: 'PlusJakartaSans-Regular.ttf',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Regular.ttf',
    family: 'Plus Jakarta Sans'
  },
  {
    file: 'PlusJakartaSans-Medium.ttf',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Medium.ttf',
    family: 'Plus Jakarta Sans'
  },
  {
    file: 'PlusJakartaSans-Bold.ttf',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/PlusJakartaSans-Bold.ttf',
    family: 'Plus Jakarta Sans'
  },
  {
    file: 'fa-solid-900.ttf',
    url: 'https://raw.githubusercontent.com/Ditzzx-vibecoder/Assets/main/ttqc/fa-solid-900.ttf',
    family: 'Font Awesome 6 Free'
  },
  {
    file: 'NotoColorEmoji.ttf',
    url: 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
    family: 'Noto Color Emoji'
  }
]

const MENU_ICONS = [
  { unicode: '\uf3e5', text: 'Balas', color: '#000000' },
  { unicode: '\uf064', text: 'Teruskan', color: '#000000' },
  { unicode: '\uf0c5', text: 'Salin', color: '#000000' },
  { unicode: '\uf1ab', text: 'Terjemahkan', color: '#000000' },
  { unicode: '\uf2ed', text: 'Hapus untuk saya', color: '#000000' },
  { unicode: '\uf024', text: 'Laporkan', color: '#ea4335' }
]

const renderConfig = {
  topPPX: 183,
  topPPY: 83,
  topPPRadius: 42,

  topNameX: 250,
  topNameY: 82,
  topNameSize: 34,

  chatPPX: 75,
  chatPPRadius: 38,

  textX: 175,
  textY: 962,

  bubbleWidth: 520,
  textSize: 30,

  bubbleBgColor: '#ffffff',
  textColor: '#161823'
}

const config = {
  name: 'ttqc',
  aliases: [],
  category: 'maker',
  description: 'Membuat tampilan chat WhatsApp bergaya screenshot',
  usage: '.ttqc Nama|Pesan',
  cooldown: 5,
  energi: 0
}

/* =========================
   FETCH BUFFER
========================= */

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    },
    redirect: 'follow'
  })

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil asset: HTTP ${response.status}`
    )
  }

  return Buffer.from(await response.arrayBuffer())
}

/* =========================
   ASSET
========================= */

async function ensureAssets() {
  await mkdir(FONTS_DIR, {
    recursive: true
  })

  if (!existsSync(TEMPLATE_PATH)) {
    const templateBuffer = await fetchBuffer(TEMPLATE_URL)

    await writeFile(
      TEMPLATE_PATH,
      templateBuffer
    )
  }

  for (const font of FONT_ASSETS) {
    const dest = join(
      FONTS_DIR,
      font.file
    )

    if (!existsSync(dest)) {
      const buffer = await fetchBuffer(font.url)

      await writeFile(
        dest,
        buffer
      )
    }

    try {
      GlobalFonts.registerFromPath(
        dest,
        font.family
      )
    } catch (e) {
      console.error(
        `[TTQC] Gagal register font ${font.file}:`,
        e.message
      )
    }
  }
}

/* =========================
   LOAD IMAGE
========================= */

async function loadImageSmart(src) {
  if (
    typeof src === 'string' &&
    /^https?:\/\//i.test(src)
  ) {
    const buffer = await fetchBuffer(src)

    return loadImage(buffer)
  }

  return loadImage(src)
}

/* =========================
   TEXT WRAP
========================= */

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/(\s+)/)

  const lines = []

  let current = ''

  for (const word of words) {
    if (!word) continue

    const test = current + word

    if (
      ctx.measureText(test).width >
      maxWidth
    ) {
      if (current) {
        lines.push(
          current.trimEnd()
        )

        current = word.trimStart()
      } else {
        lines.push(test)

        current = ''
      }
    } else {
      current = test
    }
  }

  if (current.trim()) {
    lines.push(
      current.trimEnd()
    )
  }

  return lines
}

/* =========================
   ROUNDED RECT
========================= */

function drawRoundedRect(
  ctx,
  x,
  y,
  w,
  h,
  r,
  fill,
  stroke = null,
  shadow = false
) {
  ctx.save()

  if (shadow) {
    ctx.shadowColor =
      'rgba(0,0,0,0.05)'

    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 12
  }

  ctx.fillStyle = fill

  ctx.beginPath()

  ctx.moveTo(
    x + r,
    y
  )

  ctx.lineTo(
    x + w - r,
    y
  )

  ctx.quadraticCurveTo(
    x + w,
    y,
    x + w,
    y + r
  )

  ctx.lineTo(
    x + w,
    y + h - r
  )

  ctx.quadraticCurveTo(
    x + w,
    y + h,
    x + w - r,
    y + h
  )

  ctx.lineTo(
    x + r,
    y + h
  )

  ctx.quadraticCurveTo(
    x,
    y + h,
    x,
    y + h - r
  )

  ctx.lineTo(
    x,
    y + r
  )

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  )

  ctx.closePath()

  ctx.fill()

  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.restore()
}

/* =========================
   CIRCLE IMAGE
========================= */

function drawCircleImage(
  ctx,
  img,
  cx,
  cy,
  r
) {
  ctx.save()

  ctx.beginPath()

  ctx.arc(
    cx,
    cy,
    r,
    0,
    Math.PI * 2
  )

  ctx.closePath()

  ctx.clip()

  ctx.drawImage(
    img,
    cx - r,
    cy - r,
    r * 2,
    r * 2
  )

  ctx.restore()
}

/* =========================
   RENDER
========================= */

async function render(
  username,
  chatText,
  avatarSrc
) {
  await ensureAssets()

  const template =
    await loadImage(
      TEMPLATE_PATH
    )

  const avatar =
    await loadImageSmart(
      avatarSrc
    )

  const canvas =
    createCanvas(
      2160,
      4560
    )

  const ctx =
    canvas.getContext('2d')

  /*
   * Template asli 1080x2280
   * lalu diperbesar 2x supaya hasil lebih HD.
   */
  ctx.scale(2, 2)

  ctx.drawImage(
    template,
    0,
    0,
    1080,
    2280
  )

  /* =====================
     TOP PROFILE
  ===================== */

  drawCircleImage(
    ctx,
    avatar,
    renderConfig.topPPX,
    renderConfig.topPPY,
    renderConfig.topPPRadius
  )

  ctx.font =
    `bold ${renderConfig.topNameSize}px ` +
    `'Plus Jakarta Sans'`

  ctx.fillStyle = '#000000'

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillText(
    username,
    renderConfig.topNameX,
    renderConfig.topNameY
  )

  /* =====================
     CHAT TEXT
  ===================== */

  ctx.font =
    `500 ${renderConfig.textSize}px ` +
    `'Plus Jakarta Sans'`

  ctx.textAlign = 'left'

  const lines = wrapText(
    ctx,
    chatText,
    renderConfig.bubbleWidth - 52
  )

  const lineH =
    renderConfig.textSize * 1.45

  let maxW = 0

  for (const line of lines) {
    maxW = Math.max(
      maxW,
      ctx.measureText(line).width
    )
  }

  const bubbleW =
    Math.min(
      maxW + 60,
      renderConfig.bubbleWidth
    )

  const bubbleH =
    lines.length * lineH + 48

  const bubbleX =
    renderConfig.textX - 30

  const bubbleY =
    renderConfig.textY - 24

  /* =====================
     CHAT AVATAR
  ===================== */

  drawCircleImage(
    ctx,
    avatar,
    renderConfig.chatPPX,
    bubbleY + bubbleH / 2,
    renderConfig.chatPPRadius
  )

  /* =====================
     CHAT BUBBLE
  ===================== */

  drawRoundedRect(
    ctx,
    bubbleX,
    bubbleY,
    bubbleW,
    bubbleH,
    35,
    renderConfig.bubbleBgColor
  )

  ctx.fillStyle =
    renderConfig.textColor

  ctx.textBaseline =
    'alphabetic'

  lines.forEach(
    (line, i) => {
      ctx.fillText(
        line,
        renderConfig.textX,
        renderConfig.textY +
          i * lineH +
          renderConfig.textSize / 2
      )
    }
  )

  /* =====================
     MENU
  ===================== */

  const menuX = 90

  const menuY =
    bubbleY +
    bubbleH +
    28

  drawRoundedRect(
    ctx,
    menuX,
    menuY,
    565,
    580,
    40,
    '#ffffff',
    'rgba(0,0,0,0.02)',
    true
  )

  MENU_ICONS.forEach(
    (item, i) => {
      const cy =
        menuY +
        25 +
        i * 90 +
        45

      /* icon */
      ctx.font =
        `900 34px 'Font Awesome 6 Free'`

      ctx.fillStyle =
        item.color

      ctx.textAlign =
        'center'

      ctx.textBaseline =
        'middle'

      ctx.fillText(
        item.unicode,
        menuX + 60,
        cy
      )

      /* text */
      ctx.font =
        `500 34px 'Plus Jakarta Sans'`

      ctx.textAlign =
        'left'

      ctx.fillStyle =
        '#000000'

      ctx.fillText(
        item.text,
        menuX + 130,
        cy
      )
    }
  )

  return canvas.encode('png')
}

/* =========================
   HANDLER
========================= */

async function handler(
  m,
  {
    sock,
    text,
    command
  }
) {
  if (!text?.trim()) {
    return m.reply(
      `❌ Format salah!\n\n` +
      `Gunakan:\n` +
      `.${command} Nama|Pesan\n\n` +
      `Contoh:\n` +
      `.${command} Ditzzx|Just friend kok cemburu 😂`
    )
  }

  const parts =
    text.split('|')

  const name =
    parts.shift()?.trim()

  const chat =
    parts.join('|').trim()

  if (!name) {
    return m.reply(
      `❌ Nama tidak boleh kosong.\n\n` +
      `Contoh:\n` +
      `.${command} Ditzzx|Halo 😂`
    )
  }

  if (!chat) {
    return m.reply(
      `❌ Pesan tidak boleh kosong.\n\n` +
      `Contoh:\n` +
      `.${command} Ditzzx|Halo 😂`
    )
  }

  try {
    await m.reply(
      '⏳ Sedang membuat TTQC...'
    )

    /*
     * Ambil PP user.
     * Fallback kalau PP tidak tersedia.
     */
    let avatar

    try {
      avatar =
        await sock.profilePictureUrl(
          m.sender,
          'image'
        )
    } catch {
      avatar =
        'https://i.ibb.co/4pDNDk1/avatar.png'
    }

    const buffer =
      await render(
        name,
        chat,
        avatar
      )

    const outputDir =
      join(
        __dirname,
        '../../tmp'
      )

    await mkdir(
      outputDir,
      {
        recursive: true
      }
    )

    const file =
      join(
        outputDir,
        `ttqc-${Date.now()}.png`
      )

    await writeFile(
      file,
      buffer
    )

    /*
     * Kirim menggunakan sock.sendMessage
     * agar kompatibel dengan loader bot.
     */
    await sock.sendMessage(
      m.chat,
      {
        image: {
          url: file
        },
        mimetype:
          'image/png',
        fileName:
          'ttqc.png',
        caption:
          `✅ TTQC berhasil dibuat.`
      },
      {
        quoted: m
      }
    )

    await unlink(file).catch(
      () => {}
    )

  } catch (error) {
    console.error(
      '[TTQC ERROR]',
      error
    )

    return m.reply(
      `❌ Gagal membuat TTQC.\n\n` +
      `${error?.message || error}`
    )
  }
}

export default {
  config,
  handler
}
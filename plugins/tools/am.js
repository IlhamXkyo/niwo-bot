/*
 Created for Niwo Bot
*/

import axios from 'axios'
import fs from 'fs'

const pluginConfig = {
  name: 'am',
  alias: ['ampv3', 'emailgen', 'send'],
  category: 'tools',
  description: 'Kirim Magic Link (.am) dan verifikasi link (.send)',
  usage: '.am <email> atau .send <link>',
  example: '.am ikyyxd12@gmail.com',
  isOwner: false,
  isPremium: true,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

const BASE_URL = 'https://satriam.satriadeveloperz.workers.dev'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Accept-Language':
    'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
  'Origin': BASE_URL,
  'Referer': `${BASE_URL}/`
}

const waitingVerification = new Map()

// ============================================================
// KIRIM MAGIC LINK
// ============================================================
async function sendMagicLink(email) {
  const res = await axios.post(
    `${BASE_URL}/api/satriam/send-link`,
    { email },
    { headers: HEADERS, timeout: 15000 }
  )

  if (!res.data?.success) {
    throw new Error(
      res.data?.message ||
      `Gagal mengirim Magic Link untuk ${email}`
    )
  }

  return res.data
}

// ============================================================
// VERIFIKASI LINK
// ============================================================
async function verifyMagicLink(email, magicLink) {
  const res = await axios.post(
    `${BASE_URL}/api/satriam/verify-link`,
    { email, magicLink },
    { headers: HEADERS, timeout: 15000 }
  )

  if (!res.data?.success) {
    throw new Error(
      res.data?.message ||
      'Verifikasi gagal'
    )
  }

  return res.data
}

// ============================================================
// FORMAT HASIL
// ============================================================
function formatPremiumResult(email, result) {
  const safeEmail = email.replace(/[@.]/g, '_')
  const outFile = `satriam_${safeEmail}.json`
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2))

  return (
    '✅ *PREMIUM AKTIF*\n\n' +
    `📧 Email: ${email}\n` +
    `🆔 UID: ${result?.uid || '-'}\n` +
    `📦 Plan: ${result?.planName || '-'}\n` +
    `⏰ Valid Until: ${result?.validUntil || '-'}\n\n` +
    `💾 Tersimpan: ${outFile}\n\n` +
    '━━━━━━━━━━━━━━\n' +
    '🎉 *SIAP DIPAKAI!*'
  )
}

// ============================================================
// HANDLER BOT WA : FULL PERBAIKAN
// ============================================================
async function handler(m, { sock }) {
  // Ambil teks dari berbagai properti
  const rawText = (
    m.text ||
    m.body ||
    m.content ||
    m.command ||
    m.msg ||
    m.message ||
    m.caption ||
    ''
  ).trim()

  console.log('[DEBUG] rawText:', JSON.stringify(rawText))

  // ============================================================
  // DETEKSI COMMAND
  // ============================================================
  const lowerText = rawText.toLowerCase()

  const isSend =
    lowerText.startsWith('.send') ||
    lowerText.startsWith('send ')

  const isAm =
    lowerText.startsWith('.am') ||
    lowerText.startsWith('.ampv3') ||
    lowerText.startsWith('.emailgen') ||
    lowerText.startsWith('am ')

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  console.log('[DEBUG] isSend:', isSend)
  console.log('[DEBUG] isAm:', isAm)

  // ============================================================
  // AMBIL ARGUMENT
  // ============================================================
  let argsText = ''

  if (isSend) {
    const prefix = lowerText.startsWith('.send') ? '.send' : 'send'
    argsText = rawText.substring(prefix.length).trim()
  } else if (isAm) {
    let prefix = '.am'
    if (lowerText.startsWith('.ampv3')) prefix = '.ampv3'
    else if (lowerText.startsWith('.emailgen')) prefix = '.emailgen'
    else if (lowerText.startsWith('am ')) prefix = 'am'

    argsText = rawText.substring(prefix.length).trim()
  } else {
    // Fallback: cari email di teks
    const emailMatch = rawText.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    )

    if (emailMatch) {
      argsText = emailMatch[0]
    } else if (rawText.includes('http')) {
      argsText = rawText
    }
  }

  console.log('[DEBUG] argsText:', JSON.stringify(argsText))

  // ============================================================
  // MODE .send : VERIFIKASI LINK
  // ============================================================
  if (isSend || (rawText.includes('http') && !isAm)) {
    const link = argsText || rawText

    if (!link) {
      return sock.sendMessage(
        m.chat,
        { text: '❌ Link tidak boleh kosong.\n\n`.send <link>`' },
        { quoted: m }
      )
    }

    if (!waitingVerification.has(m.sender)) {
      return sock.sendMessage(
        m.chat,
        {
          text:
            '❌ Belum ada email yang menunggu.\n\n' +
            'Kirim email dulu: `.am <email>`'
        },
        { quoted: m }
      )
    }

    const pendingEmail = waitingVerification.get(m.sender)

    try {
      await sock.sendMessage(
        m.chat,
        { text: '⏳ Verifikasi link...' },
        { quoted: m }
      )

      const result = await verifyMagicLink(pendingEmail, link)
      waitingVerification.delete(m.sender)

      const output = formatPremiumResult(pendingEmail, result)

      return sock.sendMessage(
        m.chat,
        { text: output },
        { quoted: m }
      )
    } catch (err) {
      waitingVerification.delete(m.sender)

      return sock.sendMessage(
        m.chat,
        {
          text:
            `❌ *VERIFIKASI GAGAL*\n\n` +
            `${err?.message || 'Terjadi kesalahan'}`
        },
        { quoted: m }
      )
    }
  }

  // ============================================================
  // MODE .am : KIRIM MAGIC LINK
  // ============================================================
  if (isAm || emailRegex.test(argsText)) {
    const email = argsText

    if (!emailRegex.test(email)) {
      return sock.sendMessage(
        m.chat,
        {
          text:
            '❌ Format email tidak valid.\n\n' +
            '`.am <email>`\n\n' +
            'Contoh:\n' +
            '`.am ikyyxd12@gmail.com`'
        },
        { quoted: m }
      )
    }

    try {
      await sock.sendMessage(
        m.chat,
        {
          text:
            `⏳ Mengirim Magic Link ke:\n` +
            `📧 ${email}`
        },
        { quoted: m }
      )

      const result = await sendMagicLink(email)

      waitingVerification.set(m.sender, email)

      await sock.sendMessage(
        m.chat,
        {
          text:
            '✅ *MAGIC LINK TERKIRIM*\n\n' +
            `📧 Email: ${email}\n` +
            `📨 ${result?.message || 'Silakan cek inbox email'}\n\n` +
            '━━━━━━━━━━━━━━\n' +
            '📋 *LANGKAH SELANJUTNYA:*\n' +
            '1. Buka inbox email\n' +
            '2. Copy link verifikasi\n' +
            '3. Ketik `.send <link>`'
        },
        { quoted: m }
      )
    } catch (err) {
      await sock.sendMessage(
        m.chat,
        {
          text:
            `❌ *AM ERROR*\n\n` +
            `${err?.message || 'Terjadi kesalahan'}`
        },
        { quoted: m }
      )
    }

    return
  }

  // ============================================================
  // TIDAK ADA INPUT VALID
  // ============================================================
  return sock.sendMessage(
    m.chat,
    {
      text:
        '📧 *AM PREMIUM*\n\n' +
        'Gunakan:\n' +
        '`.am <email>` : kirim Magic Link\n' +
        '`.send <link>` : verifikasi link\n\n' +
        'Contoh:\n' +
        '`.am ikyyxd12@gmail.com`\n' +
        '`.send https://...`'
    },
    { quoted: m }
  )
}

export { pluginConfig as config, handler }

export default {
  config: pluginConfig,
  handler
}
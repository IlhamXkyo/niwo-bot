import axios from 'axios'
import FormData from 'form-data'

const pluginConfig = {
  name: 'gemini',
  alias: ['gem', 'aigemini', 'geminichat'],
  category: 'ai',
  description: 'Chat dengan AI Gemini (support image)',
  usage: '.gemini <pertanyaan>',
  example: '.gemini apa itu javascript?',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
}

const sessions = new Map()
const API_URL = 'https://my.izuka-api.xyz/api/ai/gemmy-chat'
const TIMEOUT = 60000
const COMMANDS = ['gemini', 'gem', 'aigemini', 'geminichat']

function getSession(userId) {
  if (!sessions.has(userId)) sessions.set(userId, { messages: [] })
  return sessions.get(userId)
}

function getClient(ctx = {}) {
  return ctx.sock || ctx.conn
}

function getText(m, text) {
  return String(
    text ?? m?.text ?? m?.body ?? m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ?? ''
  ).trim()
}

function stripCommand(value) {
  const s = String(value || '').trim()
  if (!s) return ''
  const re = new RegExp(`^[.!/#](${COMMANDS.map(x => x.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')).join('|')})\\b`, 'i')
  const m = s.match(re)
  return m ? s.slice(m[0].length).trim() : s
}

function getQuoted(m) {
  return m?.quoted || m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null
}

function isImageQuoted(m) {
  const q = getQuoted(m)
  return Boolean(q?.message?.imageMessage || q?.imageMessage || q?.image)
}

async function downloadImage(conn, quoted) {
  if (!quoted || typeof conn?.downloadMediaMessage !== 'function') return null
  const data = await conn.downloadMediaMessage(quoted)
  if (!data) return null
  return Buffer.isBuffer(data) ? data : Buffer.from(data)
}

function extractResult(data) {
  if (data == null) throw new Error('Response kosong dari API')
  if (typeof data === 'string') {
    const s = data.trim()
    if (!s) throw new Error('Response kosong dari API')
    return s
  }
  if (data.status === false || data.success === false) {
    throw new Error(data.message || data.error || 'API menolak permintaan')
  }

  let result = data.result ?? data.data ?? data.response ?? data.message ?? data.text ?? data.content
  if (result == null) result = data

  if (typeof result === 'object') {
    result = result.text ?? result.message ?? result.content ?? result.response ?? result.answer ?? JSON.stringify(result, null, 2)
  }

  const output = String(result ?? '').trim()
  if (!output) throw new Error('API mengembalikan hasil kosong')
  return output
}

function readableError(error) {
  if (!error) return 'Terjadi kesalahan'
  const msg = String(error.message || '')
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || /timeout/i.test(msg)) {
    return '⏰ Request timeout setelah 60 detik. Coba lagi.'
  }
  const status = error.response?.status
  if (status === 429) return '⛔ Terlalu banyak request. Coba beberapa saat lagi.'
  if (status === 404) return '🔌 Endpoint Gemini tidak ditemukan (404).'
  if (status >= 500) return `🔴 Server API bermasalah (${status}).`
  if (error.response?.data) {
    try {
      const d = error.response.data
      return `📛 ${typeof d === 'string' ? d : (d.message || d.error || JSON.stringify(d))}`
    } catch {}
  }
  return `📛 ${msg || 'Terjadi kesalahan'}`
}

async function askGemini(prompt, imageBuffer = null, model = '') {
  const form = new FormData()
  form.append('prompt', String(prompt || ''))
  if (imageBuffer?.length) {
    form.append('media', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg',
      knownLength: imageBuffer.length
    })
  }
  if (model) form.append('model', String(model))

  const response = await axios.post(API_URL, form, {
    headers: {
      ...form.getHeaders(),
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: TIMEOUT,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true
  })

  if (response.status < 200 || response.status >= 300) {
    const err = new Error(typeof response.data === 'string'
      ? response.data
      : response.data?.message || response.data?.error || `HTTP ${response.status}`)
    err.response = response
    throw err
  }

  return extractResult(response.data)
}

async function deleteMessage(conn, key) {
  if (!conn || !key) return false
  try {
    await conn.sendMessage(key.remoteJid, { delete: key })
    return true
  } catch {
    try {
      await conn.sendMessage(key.remoteJid, { delete: key }, { quoted: key })
      return true
    } catch {
      return false
    }
  }
}

async function handler(m, ctx = {}) {
  const conn = getClient(ctx)
  if (!conn) throw new Error('Socket/connection tidak tersedia')
  if (!m?.chat) throw new Error('Chat ID tidak ditemukan')

  let query = stripCommand(getText(m, ctx.text))
  const userId = m.sender || m.participant || m.key?.participant || m.chat
  const quoted = getQuoted(m)
  const imageExists = isImageQuoted(m)
  let imageBuffer = null

  if (imageExists) {
    try {
      imageBuffer = await downloadImage(conn, m.quoted || quoted)
    } catch (e) {
      console.error('[GEMINI] download image:', e?.message)
    }
  }

  if (!query && imageBuffer) query = 'Jelaskan gambar ini secara detail.'

  if (query.toLowerCase() === 'reset' || query.toLowerCase() === 'clear') {
    sessions.delete(userId)
    return conn.sendMessage(m.chat, { text: '🔄 *Session Gemini di-reset!*' }, { quoted: m })
  }

  if (!query && !imageBuffer) {
    return conn.sendMessage(m.chat, {
      text:
        '🤖 *GEMINI AI CHAT*\n\n' +
        '📌 `.gemini <pertanyaan>` - Tanya AI\n' +
        '📌 Reply gambar + `.gemini <pertanyaan>` - Analisis gambar\n' +
        '📌 `.gemini reset` - Reset session\n\n' +
        'Alias: `.gem`, `.aigemini`, `.geminichat`'
    }, { quoted: m })
  }

  const session = getSession(userId)
  session.messages.push({ role: 'user', content: query, hasImage: Boolean(imageBuffer), timestamp: Date.now() })
  if (session.messages.length > 20) session.messages.splice(0, session.messages.length - 20)

  let loading = null
  try {
    loading = await conn.sendMessage(m.chat, {
      text: `🤖 *Gemini sedang berpikir...*\n\n📝 ${query}${imageBuffer ? '\n🖼️ + gambar' : ''}`
    }, { quoted: m })
  } catch (e) {
    console.error('[GEMINI] loading:', e?.message)
  }

  try {
    const response = await askGemini(query, imageBuffer)
    session.messages.push({ role: 'assistant', content: response, timestamp: Date.now() })
    if (session.messages.length > 20) session.messages.splice(0, session.messages.length - 20)

    if (loading?.key) await deleteMessage(conn, loading.key)

    return conn.sendMessage(m.chat, {
      text: `🤖 *Gemini AI*\n\n📝 *Pertanyaan:*\n${query}${imageBuffer ? ' (+ gambar)' : ''}\n\n💬 *Jawaban:*\n${response}`
    }, { quoted: m })
  } catch (error) {
    console.error('[GEMINI ERROR]', error?.message)
    if (loading?.key) await deleteMessage(conn, loading.key)
    return conn.sendMessage(m.chat, { text: `❌ *Gagal chat dengan Gemini:*\n\n${readableError(error)}` }, { quoted: m })
  }
}

export { pluginConfig as config, handler }
export default { config: pluginConfig, handler }
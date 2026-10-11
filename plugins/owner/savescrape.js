// plugins/owner/savescrape.js

import { promises as fs } from 'node:fs'
import path from 'node:path'

const config = {
  name: 'savescrape',
  aliases: [],
  category: 'owner',
  description: 'Menyimpan kode scrape ke folder lib/scrape',
  usage: '.savescrape <nama>',
  isOwner: true,
  cooldown: 0,
  energi: 0
}

async function handler(m, { text }) {
  if (!text) {
    return m.reply(
      '❌ Nama file belum diberikan.\n\n' +
      'Contoh:\n' +
      '.savescrape y2mate\n\n' +
      'Lalu reply pesan yang berisi kode scrape.'
    )
  }

  if (!m.quoted) {
    return m.reply('❌ Reply kode scrape yang mau disimpan.')
  }

  const code = m.quoted.text || m.quoted.caption || ''

  if (!code.trim()) {
    return m.reply('❌ Kode tidak terbaca dari pesan yang direply.')
  }

  // Hanya izinkan nama file yang aman
  const cleanName = String(text)
    .trim()
    .replace(/\.js$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()

  if (!cleanName) {
    return m.reply('❌ Nama file tidak valid.')
  }

  if (cleanName.length > 80) {
    return m.reply('❌ Nama file terlalu panjang.')
  }

  const filename = `${cleanName}.js`

  // Folder lib/scrape di root Niwo Bot
  const scrapeDir = path.join(process.cwd(), 'lib', 'scrape')
  const filepath = path.join(scrapeDir, filename)

  try {
    await fs.mkdir(scrapeDir, {
      recursive: true
    })

    // Cegah path traversal
    if (!filepath.startsWith(path.resolve(scrapeDir) + path.sep)) {
      return m.reply('❌ Nama file tidak aman.')
    }

    await fs.writeFile(
      filepath,
      code,
      'utf8'
    )

    const importName = cleanName.replace(/[^a-zA-Z0-9_$]/g, '')

    return m.reply(
      `✅ *Scraper berhasil disimpan!*\n\n` +
      `📁 File: \`${filename}\`\n` +
      `📂 Lokasi: \`lib/scrape/${filename}\`\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `*Import:*\n` +
      `import { ${importName} } from '../lib/scrape/${filename}'`
    )

  } catch (error) {
    console.error('[SAVESCRAPE]', error)

    return m.reply(
      `❌ Gagal menyimpan scraper.\n\n` +
      `Error: ${error?.message || error}`
    )
  }
}

export default {
  config,
  handler
}
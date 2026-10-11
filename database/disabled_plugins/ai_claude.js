// plugins/ai.js
import axios from 'axios';

const pluginConfig = {
  name: "ai",
  alias: ['claude', 'ask', 'tanya'],
  category: "ai",
  description: "Tanya jawab dengan AI Claude dari RanggaCode API",
  usage: ".ai <pertanyaan>",
  example: ".ai apa itu javascript?",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { text }) {
  // Ambil query
  let query = text || m.text || m.body || '';
  
  // Hapus prefix
  const prefixes = ['.ai', '.claude', '.ask', '.tanya'];
  for (const prefix of prefixes) {
    if (query.toLowerCase().startsWith(prefix)) {
      query = query.slice(prefix.length).trim();
      break;
    }
  }

  // Jika gaada query, tampilkan menu
  if (!query) {
    return m.reply(
      `🤖 *CLAUDE AI*\n\n` +
      `Tanya apa saja ke AI Claude.\n\n` +
      `📌 *Cara Pakai:*\n` +
      `.ai apa itu javascript?\n` +
      `.ai jelaskan tentang black hole\n` +
      `.ai siapa presiden Indonesia?\n\n` +
      `📌 *Alias:*\n` +
      `.claude, .ask, .tanya`
    );
  }

  try {
    // Kirim pesan loading
    await m.reply(`🤖 *Claude AI sedang berpikir...*\n\n📝 Pertanyaan: ${query}`);

    const apiUrl = `https://api.ranggacode.my.id/api/ai/claude?apikey=RANGGACODE-API&text=${encodeURIComponent(query)}`;
    
    const { data } = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (!data.status || !data.result) {
      throw new Error(data.message || 'Gagal mendapatkan respon dari AI');
    }

    const response = data.result;

    // Kirim jawaban
    await m.reply(
      `🤖 *Claude AI*\n\n` +
      `📝 *Pertanyaan:*\n${query}\n\n` +
      `💬 *Jawaban:*\n${response}\n\n` +
      `⚡ Powered by RanggaCode API`
    );

  } catch (error) {
    console.error('[AI]', error?.message || error);
    
    let errorMsg = `❌ *Gagal mendapatkan respon AI:*\n\n`;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMsg += '⏰ Waktu permintaan habis (30 detik). Coba lagi.';
    } else if (error.response?.status === 429) {
      errorMsg += '⛔ Terlalu banyak permintaan. Tunggu beberapa saat.';
    } else if (error.response?.status === 404) {
      errorMsg += '🔌 API tidak ditemukan. Coba lagi nanti.';
    } else {
      errorMsg += `📛 ${error?.message || 'Terjadi kesalahan tidak diketahui'}`;
    }
    
    await m.reply(errorMsg);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
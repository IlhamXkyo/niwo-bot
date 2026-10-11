// plugins/wagroup.js
const pluginConfig = {
  name: "wagroup",
  alias: ['searchgroup', 'gb', 'cari grup wa'],
  category: "search",
  description: "Mencari grup WhatsApp berdasarkan kata kunci",
  usage: ".wagroup <kata kunci>",
  example: ".wagroup jual beli",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/search/wa-group";
const API_KEY = "FREE";

async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "wagroup";

  try {
    const text =
      (ctx.text ?? ctx.body ?? m?.text ?? m?.body ?? "").trim() ||
      (ctx.args ? ctx.args.slice(1).join(" ") : "");

    // Ambil query: buang command dari awal kalau text masih berisi prefix+command
    let query = text;
    if (query.startsWith(usedPrefix)) {
      query = query.slice(usedPrefix.length);
    }
    const parts = query.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    query = parts.join(" ").trim();

    if (!query) {
      return m.reply(
        `🔍 *Cara pakai:*\n\n` +
        `• ${usedPrefix}${command} <kata kunci>\n\n` +
        `*Contoh:*\n` +
        `${usedPrefix}${command} jual beli\n` +
        `${usedPrefix}${command} jb`
      );
    }

    await m.reply(`🔎 Mencari grup WhatsApp untuk *"${query}"*...`);

    const url = `${API_BASE}?q=${encodeURIComponent(query)}&apikey=${API_KEY}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

    const json = await res.json();

    if (!json || json.status !== true || !Array.isArray(json.result) || !json.result.length) {
      return m.reply(`❌ Tidak ada hasil untuk *"${query}"*.`);
    }

    const maxShow = Math.min(json.result.length, 10);
    let caption = `*🔍 Hasil pencarian grup WA:* "${query}"\n`;
    caption += `*Total:* ${json.total ?? json.result.length} grup\n`;
    caption += `*Ditampilkan:* ${maxShow} teratas\n\n`;

    for (let i = 0; i < maxShow; i++) {
      const g = json.result[i];
      caption +=
        `*${i + 1}. ${g.nama || "-"}*\n` +
        `• 📂 ${g.kategori || "-"}\n` +
        `• 🌏 ${g.negara || "-"}\n` +
        `• 🔗 ${g.link || "-"}\n` +
        `• 📝 ${truncate(g.deskripsi, 120) || "-"}\n\n`;
    }

    caption += `_Powered by api.synoxcloud.xyz_`;

    // Kirim dengan foto grup pertama sebagai thumbnail
    const first = json.result[0];
    if (first?.foto) {
      try {
        await conn.sendMessage(
          m.chat,
          { image: { url: first.foto }, caption },
          { quoted: m }
        );
        return;
      } catch (_) {
        // fallback ke teks jika gagal kirim gambar
      }
    }

    await m.reply(caption);

    // Kirim sisanya sebagai teks tambahan jika lebih dari 10
    if (json.result.length > maxShow) {
      let more = `*📋 Sisa hasil (${json.result.length - maxShow}):*\n\n`;
      for (let i = maxShow; i < json.result.length; i++) {
        const g = json.result[i];
        more += `${i + 1}. ${g.nama || "-"}\n🔗 ${g.link || "-"}\n\n`;
        if (more.length > 3000) {
          await m.reply(more);
          more = "";
        }
      }
      if (more) await m.reply(more);
    }
  } catch (err) {
    console.error("[wagroup] error:", err);
    try {
      await m.reply(`❌ Gagal mencari grup:\n${err.message || err}`);
    } catch (_) {}
  }
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "..." : str;
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
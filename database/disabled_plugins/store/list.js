// plugins/store/list.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "list",
  alias: ["liststore", "infostore"],
  category: "store",
  description: "📋 Lihat daftar informasi toko",
  usage: ".list atau .list <nomor>",
  example: ".list 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const lists = Array.isArray(db.setting("storeLists"))
    ? db.setting("storeLists")
    : [];

  if (lists.length === 0) {
    return m.reply(
      `📋 *BELUM ADA INFORMASI TOKO*\n\n` +
      `Saat ini belum ada informasi yang ditambahkan oleh admin 😔\n\n` +
      `Silakan cek kembali nanti atau hubungi admin untuk informasi lebih lanjut.\n\n` +
      `_Terima kasih atas ketertarikan Anda_ 🙏`
    );
  }

  const input = String(m.text || "").trim();
  const idx = Number.parseInt(input, 10) - 1;

  if (Number.isInteger(idx) && idx >= 0 && idx < lists.length) {
    const item = lists[idx];
    const content = String(item?.content || "Tidak ada isi informasi.");

    if (item?.image) {
      await sock.sendMessage(
        m.chat,
        {
          image: { url: item.image },
          caption: content
        },
        { quoted: m }
      );
      return;
    }

    if (item?.video) {
      await sock.sendMessage(
        m.chat,
        {
          video: { url: item.video },
          caption: content
        },
        { quoted: m }
      );
      return;
    }

    return m.reply(content);
  }

  let txt =
    `📋 *DAFTAR INFORMASI TOKO*\n\n` +
    `Berikut informasi yang tersedia saat ini 📝\n` +
    `Ketik \`${m.prefix}list <nomor>\` untuk melihat detail.\n\n`;

  for (let i = 0; i < lists.length; i++) {
    const item = lists[i];
    const mediaIcon = item?.image
      ? "🖼️"
      : item?.video
        ? "🎬"
        : "📝";

    txt += `*${i + 1}.* ${mediaIcon} *${item?.name || "Tanpa nama"}*\n`;
  }

  txt +=
    `\n💡 _Ketik \`${m.prefix}list <nomor>\` untuk membaca detail informasi_`;

  return m.reply(txt);
}

export default {
  config,
  handler
};
// plugins/store/hapuslist.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "hapuslist",
  alias: ["dellist", "deletelist"],
  category: "store",
  description: "🗑️ Hapus informasi toko",
  usage: ".hapuslist <nomor>",
  example: ".hapuslist 1",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
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
      `📭 *Belum ada informasi.*\n\n` +
      `Tambahkan informasi terlebih dahulu: \`${m.prefix}addlist\` ➕`
    );
  }

  const idx = Number.parseInt(String(m.text || "").trim(), 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= lists.length) {
    let txt =
      `🗑️ *PILIH INFORMASI YANG DIHAPUS*\n\n` +
      `Ketik \`${m.prefix}hapuslist <nomor>\`\n\n`;

    for (let i = 0; i < lists.length; i++) {
      const item = lists[i];
      const mediaIcon = item.image ? "🖼️" : item.video ? "🎬" : "📝";
      txt += `${mediaIcon} *${i + 1}.* ${item.name || "Tanpa nama"}\n`;
    }

    return m.reply(txt);
  }

  const deleted = lists.splice(idx, 1)[0];
  db.setting("storeLists", lists);

  await m.react("✅");

  return m.reply(
    `🗑️ *INFORMASI DIHAPUS*\n\n` +
    `🏷️ Nama: *${deleted?.name || "Tanpa nama"}*\n\n` +
    `⚠️ _Informasi telah dihapus secara permanen dan tidak dapat dikembalikan._`
  );
}

export default {
  config,
  handler
};
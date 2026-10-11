// plugins/store/hapusproduk.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "hapusproduk",
  alias: ["delproduk", "delproduct", "deleteproduk"],
  category: "store",
  description: "🗑️ Hapus produk dari toko",
  usage: ".hapusproduk <nomor>",
  example: ".hapusproduk 1",
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
  const products = Array.isArray(db.setting("storeProducts"))
    ? db.setting("storeProducts")
    : [];

  if (products.length === 0) {
    return m.reply(
      `📭 *Belum ada produk.*\n\n` +
      `Tambahkan produk terlebih dahulu dengan \`${m.prefix}addproduk\` ➕`
    );
  }

  const idx = Number.parseInt(String(m.text || "").trim(), 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= products.length) {
    let txt =
      `🗑️ *PILIH PRODUK YANG DIHAPUS*\n\n` +
      `Ketik \`${m.prefix}hapusproduk <nomor>\`\n\n`;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const typeIcon = p.type === "fisik" ? "📦" : "🔑";

      const stockDisplay =
        p.type === "fisik"
          ? p.stock === -1
            ? "♾️"
            : `${Number(p.stock || 0)} pcs`
          : `${Array.isArray(p.stockItems) ? p.stockItems.length : 0} akun`;

      txt += `${typeIcon} *${i + 1}.* ${p.name || "Tanpa nama"} — Rp ${Number(p.price || 0).toLocaleString("id-ID")} (${stockDisplay})\n`;
    }

    return m.reply(txt);
  }

  const deleted = products.splice(idx, 1)[0];
  db.setting("storeProducts", products);

  const typeIcon = deleted?.type === "fisik" ? "📦" : "🔑";

  const deletedStock =
    deleted?.type === "fisik"
      ? deleted?.stock === -1
        ? "♾️ Unlimited"
        : `${Number(deleted?.stock || 0)} pcs`
      : `${Array.isArray(deleted?.stockItems) ? deleted.stockItems.length : 0} akun`;

  await m.react("✅");

  return m.reply(
    `🗑️ *PRODUK DIHAPUS*\n\n` +
    `${typeIcon} Nama: *${deleted?.name || "Tanpa nama"}*\n` +
    `💰 Harga: *Rp ${Number(deleted?.price || 0).toLocaleString("id-ID")}*\n` +
    `📊 Stok terhapus: *${deletedStock}*\n\n` +
    `⚠️ _Produk telah dihapus secara permanen dan tidak dapat dikembalikan._`
  );
}

export default {
  config,
  handler
};
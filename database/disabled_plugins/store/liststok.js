// plugins/store/liststok.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "liststok",
  alias: ["liststock", "stok", "stock"],
  category: "store",
  description: "📋 Lihat daftar stok item produk",
  usage: ".liststok <nomor_produk>",
  example: ".liststok 1",
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
      `Tambahkan produk terlebih dahulu: \`${m.prefix}addproduk\` ➕`
    );
  }

  const input = String(m.text || "").trim();
  const idx = Number.parseInt(input, 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= products.length) {
    let txt =
      `📋 *DAFTAR STOK PRODUK*\n\n` +
      `Pilih produk untuk melihat stok:\n\n`;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const type = p?.type === "fisik" ? "fisik" : "digital";
      const typeIcon = type === "fisik" ? "📦" : "🔑";

      let stockDisplay;
      let available;

      if (type === "fisik") {
        stockDisplay =
          p.stock === -1
            ? "♾️"
            : `${Number(p.stock || 0)} pcs`;
        available = p.stock === -1 || Number(p.stock || 0) > 0;
      } else {
        const count = Array.isArray(p.stockItems)
          ? p.stockItems.length
          : 0;
        stockDisplay =
          p.stock === -1
            ? "♾️"
            : `${count} akun`;
        available = p.stock === -1 || count > 0;
      }

      const statusIcon = available ? "✅" : "⚠️";

      txt +=
        `${typeIcon} *${i + 1}.* ${p?.name || "Tanpa nama"} — ` +
        `${stockDisplay} ${statusIcon}\n`;
    }

    txt +=
      `\nKetik \`${m.prefix}liststok <nomor>\` ` +
      `untuk melihat detail stok 📊`;

    return m.reply(txt);
  }

  const product = products[idx];
  const type = product?.type === "fisik" ? "fisik" : "digital";

  if (type === "fisik") {
    return m.reply(
      `📦 *STOK: ${product.name || "Tanpa nama"}*\n\n` +
      `📊 Tipe: *Fisik*\n` +
      `📦 Total: *${
        product.stock === -1
          ? "♾️ Unlimited"
          : `${Number(product.stock || 0)} pcs`
      }*\n\n` +
      `*Kelola stok:*\n` +
      `• Tambah: \`${m.prefix}addstok ${idx + 1} <jumlah>\`\n` +
      `• Edit: \`${m.prefix}editproduk ${idx + 1} stok <jumlah>\`\n` +
      `• Kurangi: \`${m.prefix}hapusstok ${idx + 1} <jumlah>\`\n\n` +
      `_Stok fisik diatur berdasarkan jumlah, bukan per-item_ 📦`
    );
  }

  const stockItems = Array.isArray(product.stockItems)
    ? product.stockItems
    : [];

  if (stockItems.length === 0) {
    return m.reply(
      `🔑 *STOK: ${product.name || "Tanpa nama"}*\n\n` +
      `📭 Belum ada stok item yang ditambahkan.\n\n` +
      `*Tambah stok:*\n` +
      `• Manual: \`${m.prefix}addstok ${idx + 1}|<detail>\`\n` +
      `• Import: \`${m.prefix}addstok ${idx + 1}\` (reply file .txt 📄)\n\n` +
      `_Stok item bersifat rahasia 🔒 dan hanya dikirim ke pembeli setelah pembayaran dikonfirmasi_`
    );
  }

  let txt =
    `🔑 *STOK: ${product.name || "Tanpa nama"}*\n\n` +
    `📊 Total: *${stockItems.length}* akun\n\n`;

  const showItems = stockItems.slice(0, 30);

  for (let i = 0; i < showItems.length; i++) {
    const detail = String(showItems[i]?.detail || "");
    const preview = detail.replace(/\n/g, " ").substring(0, 40);

    txt +=
      `\`${i + 1}.\` ${preview}` +
      `${detail.length > 40 ? "..." : ""}\n`;
  }

  if (stockItems.length > 30) {
    txt +=
      `\n_dan ${stockItems.length - 30} item lainnya..._ 📋`;
  }

  txt +=
    `\n\n🛠️ *Kelola stok:*\n` +
    `🗑️ Hapus: \`${m.prefix}hapusstok ${idx + 1} <nomor_item>\`\n` +
    `✏️ Edit: \`${m.prefix}editstok ${idx + 1} <nomor_item>|<detail_baru>\`\n` +
    `➕ Tambah: \`${m.prefix}addstok ${idx + 1}|<detail>\``;

  return m.reply(txt);
}

export default {
  config,
  handler
};
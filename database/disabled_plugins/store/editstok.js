// plugins/store/editstok.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "editstok",
  alias: ["editstock"],
  category: "store",
  description: "✏️ Edit stok item produk (hanya di private chat)",
  usage: ".editstok <nomor_produk> <nomor_item>|<detail_baru>",
  example: ".editstok 1 3|Email: baru@mail.com;;Password: newpass",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true
};

async function handler(m, { sock }) {
  if (m.isGroup) {
    return m.reply(
      `🚫 *Akses Ditolak*\n\n` +
      `Untuk menjaga privasi 🛡️, pengeditan stok hanya dapat dilakukan di *private chat*.\n\n` +
      `Silakan chat bot secara langsung 📱`
    );
  }

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

  const text = String(m.text || "").trim();
  const firstPipe = text.indexOf("|");

  if (firstPipe === -1) {
    return m.reply(
      `✏️ *EDIT STOK*\n\n` +
      `📋 Format: \`${m.prefix}editstok <nomor_produk> <nomor_item>|<detail_baru>\`\n\n` +
      `📝 *Contoh:*\n` +
      `\`${m.prefix}editstok 1 3|Email: baru@mail.com;;Password: newpass\`\n\n` +
      `• Gunakan \`;;\` untuk baris baru dalam detail 🔑\n` +
      `📋 Lihat nomor item: \`${m.prefix}liststok <nomor_produk>\`\n\n` +
      `⚠️ _Stok yang sudah terkirim ke pembeli tidak akan berubah_ 🔒`
    );
  }

  const before = text.substring(0, firstPipe).trim();
  const newDetail = text
    .substring(firstPipe + 1)
    .trim()
    .replace(/;;/g, "\n");

  const parts = before.split(/\s+/);

  if (parts.length < 2) {
    return m.reply(
      `❌ *Format tidak lengkap.*\n\n` +
      `Gunakan:\n` +
      `\`${m.prefix}editstok <nomor_produk> <nomor_item>|<detail_baru>\``
    );
  }

  const productNo = Number.parseInt(parts[0], 10) - 1;
  const itemNo = Number.parseInt(parts[1], 10) - 1;

  if (
    !Number.isInteger(productNo) ||
    productNo < 0 ||
    productNo >= products.length
  ) {
    return m.reply(
      `❌ *Nomor produk tidak valid.*\n\n` +
      `Rentang: 1-${products.length} 📋`
    );
  }

  const product = products[productNo];

  if (product.type === "fisik") {
    return m.reply(
      `📦 *Produk Fisik*\n\n` +
      `Produk fisik tidak memiliki data per-item 🔑\n\n` +
      `Untuk mengubah stok, gunakan:\n` +
      `\`${m.prefix}editproduk ${productNo + 1} stok <jumlah>\``
    );
  }

  const stockItems = Array.isArray(product.stockItems)
    ? product.stockItems
    : [];

  if (
    !Number.isInteger(itemNo) ||
    itemNo < 0 ||
    itemNo >= stockItems.length
  ) {
    return m.reply(
      `❌ *Nomor item tidak valid.*\n\n` +
      `Rentang: 1-${stockItems.length}\n\n` +
      `📋 Lihat daftar: \`${m.prefix}liststok ${productNo + 1}\``
    );
  }

  if (!newDetail || newDetail.length < 3) {
    return m.reply(
      `❌ *Detail terlalu pendek.*\n\n` +
      `Minimal 3 karakter diperlukan 🔑`
    );
  }

  const item = stockItems[itemNo];
  const oldDetail = String(item.detail || "");

  item.detail = newDetail;
  item.updatedAt = new Date().toISOString();

  product.stock = stockItems.length;
  db.setting("storeProducts", products);

  await m.react("✅");

  return m.reply(
    `✅ *STOK DIPERBARUI*\n\n` +
    `🏷️ Produk: *${product.name}*\n` +
    `🔑 Item #${itemNo + 1}\n\n` +
    `❌ *Sebelum:*\n` +
    `\`${oldDetail.replace(/\n/g, " ").substring(0, 100)}\`\n\n` +
    `✅ *Sesudah:*\n` +
    `\`${newDetail.replace(/\n/g, " ").substring(0, 100)}\`\n\n` +
    `⚠️ _Perubahan hanya berlaku untuk item yang belum dikirim ke pembeli_ 🔒`
  );
}

export default {
  config,
  handler
};
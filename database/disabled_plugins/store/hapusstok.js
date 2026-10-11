// plugins/store/hapusstok.js
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "hapusstok",
  alias: ["delstok", "delstock", "deletestok"],
  category: "store",
  description: "🗑️ Hapus stok item dari produk",
  usage: ".hapusstok <nomor_produk> <nomor_item>",
  example: ".hapusstok 1 3",
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

  const args = String(m.text || "").trim().split(/\s+/).filter(Boolean);

  if (args.length < 2) {
    return m.reply(
      `🗑️ *HAPUS STOK*\n\n` +
      `Format: \`${m.prefix}hapusstok <nomor_produk> <nomor_item>\`\n\n` +
      `📝 *Contoh:*\n` +
      `\`${m.prefix}hapusstok 1 3\` — Hapus item ke-3 dari produk ke-1\n\n` +
      `📋 Lihat nomor item: \`${m.prefix}liststok <nomor_produk>\``
    );
  }

  const productNo = Number.parseInt(args[0], 10) - 1;
  const itemNo = Number.parseInt(args[1], 10) - 1;

  if (!Number.isInteger(productNo)) {
    return m.reply(
      `❌ *Nomor produk tidak valid.*\n\n` +
      `Rentang: 1-${products.length} 📋`
    );
  }

  if (productNo < 0 || productNo >= products.length) {
    return m.reply(
      `❌ *Nomor produk tidak valid.*\n\n` +
      `Rentang: 1-${products.length} 📋`
    );
  }

  const product = products[productNo];

  if (product.type === "fisik") {
    const reduceCount = Number.parseInt(args[1], 10);

    if (!Number.isInteger(reduceCount) || reduceCount <= 0) {
      return m.reply(
        `📦 *PRODUK FISIK*\n\n` +
        `Untuk mengurangi stok fisik, gunakan:\n` +
        `\`${m.prefix}editproduk ${productNo + 1} stok <jumlah_baru>\`\n\n` +
        `📊 Stok saat ini: *${
          product.stock === -1
            ? "♾️ Unlimited"
            : `${Number(product.stock || 0)} pcs`
        }*`
      );
    }

    if (product.stock === -1) {
      return m.reply(
        `♾️ *Stok unlimited tidak bisa dikurangi.*\n\n` +
        `Ubah stok terlebih dahulu:\n` +
        `\`${m.prefix}editproduk ${productNo + 1} stok <jumlah>\``
      );
    }

    const currentStock = Math.max(0, Number(product.stock) || 0);

    if (reduceCount > currentStock) {
      return m.reply(
        `❌ *Jumlah melebihi stok.*\n\n` +
        `📊 Stok saat ini: *${currentStock} pcs*\n` +
        `➖ Yang ingin dihapus: *${reduceCount} pcs*`
      );
    }

    product.stock = currentStock - reduceCount;
    db.setting("storeProducts", products);

    await m.react("✅");

    return m.reply(
      `📦 *STOK FISIK DIKURANGI*\n\n` +
      `🏷️ Produk: *${product.name}*\n` +
      `➖ Dikurangi: *${reduceCount} pcs*\n` +
      `📊 Sisa stok: *${product.stock} pcs*`
    );
  }

  const stockItems = Array.isArray(product.stockItems)
    ? product.stockItems
    : [];

  if (!Number.isInteger(itemNo) || itemNo < 0 || itemNo >= stockItems.length) {
    return m.reply(
      `❌ *Nomor item tidak valid.*\n\n` +
      `Rentang: 1-${stockItems.length}\n\n` +
      `📋 Lihat daftar: \`${m.prefix}liststok ${productNo + 1}\``
    );
  }

  const deleted = stockItems.splice(itemNo, 1)[0];
  product.stock = stockItems.length;

  db.setting("storeProducts", products);

  await m.react("✅");

  const deletedDetail = String(deleted?.detail || "")
    .replace(/\n/g, " ")
    .substring(0, 100);

  return m.reply(
    `🗑️ *STOK DIHAPUS*\n\n` +
    `🏷️ Produk: *${product.name}*\n` +
    `🔑 Item: \`${deletedDetail || "-"}\`\n` +
    `📊 Sisa stok: *${stockItems.length} akun*`
  );
}

export default {
  config,
  handler
};
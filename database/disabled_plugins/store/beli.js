// plugins/store/beli.js
import { getDatabase } from "../../src/lib/database.js";
import appConfig from "../../config.js";

const config = {
  name: "beli",
  alias: ["order", "pesan", "buyitem"],
  category: "store",
  description: "🛒 Pesan produk dan dapatkan nomor transaksi",
  usage: ".beli <nomor_produk>",
  example: ".beli 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true
};

function formatPrice(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const products = Array.isArray(db.setting("storeProducts")) ? db.setting("storeProducts") : [];

  if (products.length === 0) {
    return m.reply(`📭 *Belum ada produk tersedia.*\n\nKetik \`${m.prefix}listproduk\` untuk melihat daftar produk 🛍️`);
  }

  const args = String(m.text || "").trim().split(/\s+/).filter(Boolean);
  const idx = Number.parseInt(args[0], 10) - 1;

  if (!Number.isInteger(idx) || idx < 0 || idx >= products.length) {
    let txt = `🛒 *PILIH PRODUK*\n\nKetik \`${m.prefix}beli <nomor>\` untuk memesan.\n\n`;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const typeIcon = p.type === "fisik" ? "📦" : "🔑";
      const isAvailable = p.type === "fisik"
        ? Number(p.stock) > 0 || p.stock === -1
        : (Array.isArray(p.stockItems) && p.stockItems.length > 0) || p.stock === -1;

      txt += `${typeIcon} *${i + 1}.* ${p.name} — ${formatPrice(p.price)} ${isAvailable ? "✅" : "❌"}\n`;
    }

    return m.reply(txt);
  }

  const product = products[idx];
  const typeIcon = product.type === "fisik" ? "📦" : "🔑";
  const typeLabel = product.type === "fisik" ? "Fisik" : "Digital";

  const isAvailable = product.type === "fisik"
    ? Number(product.stock) > 0 || product.stock === -1
    : (Array.isArray(product.stockItems) && product.stockItems.length > 0) || product.stock === -1;

  if (!isAvailable) {
    return m.reply(
      `❌ *STOK HABIS*\n\n` +
      `${typeIcon} Produk *${product.name}* saat ini sedang tidak tersedia 😔\n\n` +
      `Silakan hubungi admin atau cek kembali nanti.\n\n` +
      `_Kami akan segera mengisi ulang stok_ 🙏`
    );
  }

  const transactions = db.setting("storeTransactions");
  const trxData = transactions && typeof transactions === "object" && !Array.isArray(transactions) ? transactions : {};
  let trxCounter = Number(db.setting("storeTrxCounter") || 0) + 1;
  const trxId = `TRX-${String(trxCounter).padStart(3, "0")}`;

  db.setting("storeTrxCounter", trxCounter);

  trxData[trxId] = {
    trxId,
    buyerJid: m.sender,
    buyerName: m.pushName || String(m.sender || "").split("@")[0],
    purchaseChat: m.chat,
    purchaseIsGroup: !!m.isGroup,
    productIndex: idx,
    productId: product.id,
    productName: product.name,
    productType: product.type,
    price: product.price,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.setting("storeTransactions", trxData);

  let ownerNumbers = appConfig?.owner?.number || [];
  if (!Array.isArray(ownerNumbers)) ownerNumbers = [ownerNumbers];

  const ownerNumber = ownerNumbers.find(n => String(n || "").replace(/\D/g, "").length > 5);
  const cleanOwnerNumber = ownerNumber ? String(ownerNumber).replace(/\D/g, "") : null;
  const ownerJid = cleanOwnerNumber ? `${cleanOwnerNumber}@s.whatsapp.net` : null;

  let txt = `🛒 *PESANAN DIBUAT*\n\n`;
  txt += `🧾 Nomor Transaksi: \`${trxId}\`\n\n`;
  txt += `📦 *DETAIL PESANAN:*\n`;
  txt += `${typeIcon} Produk: *${product.name}*\n`;
  txt += `🏷️ Tipe: *${typeLabel}*\n`;
  txt += `💰 Harga: *${formatPrice(product.price)}*\n`;

  if (product.originalPrice) {
    txt += `🏷️ ~~${formatPrice(product.originalPrice)}~~\n`;
  }

  if (product.description) {
    txt += `📝 _${product.description}_\n`;
  }

  txt += `\n`;

  if (product.image) {
    await sock.sendMessage(
      m.chat,
      { image: { url: product.image }, caption: txt },
      { quoted: m }
    );
  } else if (product.video) {
    await sock.sendMessage(
      m.chat,
      { video: { url: product.video }, caption: txt },
      { quoted: m }
    );
  } else {
    await m.reply(txt);
  }

  let paymentTxt = `💳 *INSTRUKSI PEMBAYARAN*\n\n`;
  paymentTxt += `1️⃣ Transfer sebesar *${formatPrice(product.price)}* ke nomor admin 💰\n`;

  if (Array.isArray(appConfig?.store?.payment) && appConfig.store.payment.length) {
    for (const p of appConfig.store.payment) {
      if (!p) continue;
      paymentTxt += `   🏦 ${p.name || "Payment"}: \`${p.number || "-"}\` a.n ${p.holder || "-"}\n`;
    }
  }

  if (appConfig?.store?.qris) {
    paymentTxt += `   📱 QRIS: Tersedia\n`;
  }

  paymentTxt += `\n2️⃣ Setelah transfer, kirim *bukti pembayaran* ke admin 📸\n`;
  paymentTxt += `3️⃣ Admin akan memverifikasi dan mengirim data produk ke Anda ✅\n\n`;
  paymentTxt += `🧾 Nomor Transaksi Anda: \`${trxId}\`\n`;
  paymentTxt += `_Simpan nomor ini untuk referensi_ 📌`;

  if (ownerJid) {
    paymentTxt += `\n\n📞 Hubungi admin: wa.me/${cleanOwnerNumber}`;
  }

  await m.reply(paymentTxt);

  if (ownerJid) {
    const buyerNum = String(m.sender || "").split("@")[0];

    await sock.sendMessage(ownerJid, {
      text:
        `🛒 *PESANAN BARU*\n\n` +
        `🧾 TRX: \`${trxId}\`\n` +
        `👤 Pembeli: *${m.pushName || buyerNum}*\n` +
        `📱 Nomor: \`${buyerNum}\`\n` +
        `${typeIcon} Produk: *${product.name}*\n` +
        `💰 Harga: *${formatPrice(product.price)}*\n\n` +
        `_Setelah menerima bukti transfer 📸, reply pesan pembeli lalu ketik \`${m.prefix}done ${trxId}\`_ ✅`
    });
  }
}

export default {
  config,
  handler
};
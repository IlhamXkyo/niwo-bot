// plugins/store/listproduk.js
import { getDatabase } from "../../src/lib/database.js";
import appConfig from "../../config.js";

const config = {
  name: "listproduk",
  alias: ["produk", "katalog", "catalog"],
  category: "store",
  description: "🛍️ Lihat daftar produk yang tersedia",
  usage: ".listproduk",
  example: ".listproduk",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

function formatPrice(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const products = Array.isArray(db.setting("storeProducts"))
    ? db.setting("storeProducts")
    : [];

  if (products.length === 0) {
    return m.reply(
      `🏪 *PRODUK BELUM TERSEDIA*\n\n` +
      `Saat ini belum ada produk yang ditambahkan oleh admin 😔\n\n` +
      `Silakan cek kembali nanti atau hubungi admin untuk informasi lebih lanjut.\n\n` +
      `_Terima kasih atas ketertarikan Anda_ 🙏`
    );
  }

  let txt =
    `🛍️ *DAFTAR PRODUK*\n\n` +
    `Berikut adalah produk yang tersedia saat ini 🎉\n` +
    `Untuk pembelian, ketik \`${m.prefix}beli <nomor>\`\n\n`;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const type = p?.type === "fisik" ? "fisik" : "digital";
    const typeIcon = type === "digital" ? "🔑" : "📦";
    const typeLabel = type === "digital" ? "Digital" : "Fisik";

    let stockDisplay;
    let isAvailable;

    if (type === "digital") {
      const count = Array.isArray(p.stockItems) ? p.stockItems.length : 0;
      stockDisplay =
        p.stock === -1 ? "♾️ Unlimited" : `${count} akun`;
      isAvailable = count > 0 || p.stock === -1;
    } else {
      const stock = Number(p.stock || 0);
      stockDisplay =
        p.stock === -1 ? "♾️ Unlimited" : `${stock} pcs`;
      isAvailable = stock > 0 || p.stock === -1;
    }

    const statusIcon = isAvailable ? "✅" : "❌";
    const priceStr = formatPrice(p.price);
    const originalPriceStr = p.originalPrice
      ? `~~${formatPrice(p.originalPrice)}~~ `
      : "";

    txt += `*${i + 1}.* ${typeIcon} *${p.name || "Tanpa nama"}*\n`;
    txt += `   💰 ${originalPriceStr}${priceStr}\n`;
    txt += `   📊 Stok: ${stockDisplay} ${statusIcon}\n`;
    txt += `   🏷️ Tipe: ${typeLabel}\n`;

    if (p.description) {
      const description = String(p.description);
      txt += `   📝 _${description.substring(0, 60)}${description.length > 60 ? "..." : ""}_\n`;
    }

    txt += `\n`;
  }

  txt += `💡 _Ketik \`${m.prefix}beli <nomor>\` untuk memesan produk_`;

  if (m.isGroup) {
    const saluranId =
      appConfig?.saluran?.id ||
      "120363427915199733@newsletter";

    const saluranName =
      appConfig?.saluran?.name ||
      appConfig?.bot?.name ||
      "Hiyuki MD";

    return sock.sendMessage(
      m.chat,
      {
        text: txt,
        contextInfo: {
          forwardingScore: 9999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: saluranId,
            newsletterName: saluranName,
            serverMessageId: 127
          }
        }
      },
      { quoted: m }
    );
  }

  return m.reply(txt);
}

export default {
  config,
  handler
};
// plugins/store/editproduk.js
import { getDatabase } from "../../src/lib/database.js";
import axios from "axios";
import FormData from "form-data";

const config = {
  name: "editproduk",
  alias: ["editproduct"],
  category: "store",
  description: "✏️ Edit produk toko (hanya di private chat)",
  usage: ".editproduk <nomor> <field> <nilai>",
  example: ".editproduk 1 harga 30000",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true
};

async function uploadToCatbox(buffer, filename = "file.jpg") {
  try {
    const form = new FormData();
    form.append("fileToUpload", buffer, { filename });
    form.append("reqtype", "fileupload");

    const res = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024
    });

    return typeof res.data === "string" && res.data.startsWith("http")
      ? res.data.trim()
      : null;
  } catch (error) {
    console.error("[EditProduk] Catbox:", error?.message || error);
    return null;
  }
}

async function handler(m, { sock }) {
  if (m.isGroup) {
    return m.reply(
      `🚫 *Akses Ditolak*\n\n` +
      `Untuk menjaga privasi 🛡️, pengeditan produk hanya dapat dilakukan di *private chat*.\n\n` +
      `Silakan chat bot secara langsung 📱`
    );
  }

  const db = getDatabase();
  const products = Array.isArray(db.setting("storeProducts"))
    ? db.setting("storeProducts")
    : [];

  if (products.length === 0) {
    return m.reply(
      `📭 *Belum ada produk.*\n\nTambahkan produk terlebih dahulu: \`${m.prefix}addproduk\` ➕`
    );
  }

  const text = String(m.text || "").trim();
  const match = text.match(
    /^(\d+)\s+(nama|harga|diskon|stok|deskripsi|detail|gambar|video|tipe)\s*(.*)$/i
  );

  if (!match) {
    return m.reply(
      `✏️ *EDIT PRODUK*\n\n` +
      `📋 Format: \`${m.prefix}editproduk <nomor> <field> <nilai>\`\n\n` +
      `📌 *Field yang bisa diedit:*\n` +
      `• *nama* 🏷️ — Nama produk\n` +
      `• *harga* 💰 — Harga jual\n` +
      `• *diskon* 🏷️ — Harga asli/coret (0 untuk hapus)\n` +
      `• *stok* 📊 — Jumlah stok atau \`unlimited\`\n` +
      `• *tipe* 🔑📦 — \`digital\` atau \`fisik\`\n` +
      `• *deskripsi* 📝 — Deskripsi produk\n` +
      `• *detail* 🔒 — Info rahasia\n` +
      `• *gambar* 🖼️ — Upload gambar baru\n` +
      `• *video* 🎬 — Upload video baru\n\n` +
      `📝 *Contoh:*\n` +
      `\`${m.prefix}editproduk 1 harga 30000\`\n` +
      `\`${m.prefix}editproduk 1 diskon 40000\`\n` +
      `\`${m.prefix}editproduk 1 stok 10\`\n` +
      `\`${m.prefix}editproduk 1 stok unlimited\`\n` +
      `\`${m.prefix}editproduk 1 tipe fisik\`\n` +
      `\`${m.prefix}editproduk 1 nama Netflix Premium\`\n` +
      `\`${m.prefix}editproduk 1 deskripsi Akun sharing 1 bulan\`\n` +
      `\`${m.prefix}editproduk 1 gambar\` (reply gambar 🖼️)`
    );
  }

  const idx = Number.parseInt(match[1], 10) - 1;
  const field = match[2].toLowerCase();
  const value = String(match[3] || "").trim();

  if (!Number.isInteger(idx) || idx < 0 || idx >= products.length) {
    return m.reply(
      `❌ *Nomor produk tidak valid.*\n\nRentang: 1-${products.length} 📋`
    );
  }

  const product = products[idx];

  switch (field) {
    case "nama": {
      if (value.length < 2) {
        return m.reply(`❌ *Nama terlalu pendek.* Minimal 2 karakter 🏷️`);
      }

      product.name = value;
      break;
    }

    case "harga": {
      const price = Number.parseInt(value.replace(/[^\d]/g, ""), 10);

      if (!Number.isInteger(price) || price < 1000) {
        return m.reply(`❌ *Harga tidak valid.* Minimal Rp 1.000 💰`);
      }

      product.price = price;

      if (
        product.originalPrice &&
        Number(product.originalPrice) <= price
      ) {
        product.originalPrice = null;
      }

      break;
    }

    case "diskon": {
      const origPrice = Number.parseInt(value.replace(/[^\d]/g, ""), 10);

      if (!Number.isInteger(origPrice) || origPrice === 0) {
        product.originalPrice = null;
        break;
      }

      if (origPrice <= Number(product.price || 0)) {
        return m.reply(
          `❌ *Harga asli harus lebih besar dari harga jual.*\n\n` +
          `💰 Harga jual saat ini: *Rp ${Number(product.price || 0).toLocaleString("id-ID")}*`
        );
      }

      product.originalPrice = origPrice;
      break;
    }

    case "stok": {
      if (value.toLowerCase() === "unlimited") {
        product.stock = -1;
        break;
      }

      const stock = Number.parseInt(value, 10);

      if (!Number.isInteger(stock) || stock < 0) {
        return m.reply(
          `❌ *Stok tidak valid.* Gunakan angka 0 atau lebih, atau \`unlimited\` 📊`
        );
      }

      product.stock = stock;
      break;
    }

    case "tipe": {
      const newType = value.toLowerCase();

      if (newType !== "digital" && newType !== "fisik") {
        return m.reply(
          `❌ *Tipe tidak valid.* Gunakan \`digital\` 🔑 atau \`fisik\` 📦`
        );
      }

      if (
        newType === "fisik" &&
        product.type === "digital" &&
        Array.isArray(product.stockItems) &&
        product.stockItems.length > 0
      ) {
        return m.reply(
          `⚠️ *Tidak bisa mengubah ke Fisik*\n\n` +
          `Produk ini memiliki *${product.stockItems.length}* data stok digital 🔑\n\n` +
          `Hapus stok digital terlebih dahulu sebelum mengubah tipe produk.`
        );
      }

      product.type = newType;

      if (newType === "fisik" && !Number.isInteger(product.stock)) {
        product.stock = 0;
      }

      if (newType === "digital" && !Array.isArray(product.stockItems)) {
        product.stockItems = [];
      }

      break;
    }

    case "deskripsi": {
      if (!value) {
        return m.reply(`❌ *Deskripsi tidak boleh kosong.* 📝`);
      }

      product.description = value.replace(/;;/g, "\n");
      break;
    }

    case "detail": {
      if (!value) {
        return m.reply(`❌ *Detail tidak boleh kosong.* 🔒`);
      }

      product.detail = value.replace(/;;/g, "\n");
      break;
    }

    case "gambar": {
      const quotedType = m.quoted?.type || m.quoted?.mtype;
      const hasMedia =
        !!m.quoted?.isMedia &&
        (m.quoted?.isImage || quotedType === "imageMessage");

      const isDirectImage =
        !!m.isImage ||
        m.type === "imageMessage" ||
        !!m.message?.imageMessage;

      if (!hasMedia && !isDirectImage) {
        return m.reply(
          `🖼️ *Reply atau kirim gambar baru.*\n\n` +
          `Kirim gambar lalu reply dengan command ini.`
        );
      }

      await m.reply(`⏳ _Mengunggah gambar..._`);

      try {
        const buffer = hasMedia
          ? await m.quoted.download()
          : await m.download();

        if (!buffer?.length) {
          return m.reply(`❌ *Gambar tidak dapat dibaca.* 🖼️`);
        }

        const url = await uploadToCatbox(buffer, "image.jpg");

        if (!url) {
          return m.reply(`❌ *Gagal mengunggah gambar.* Coba lagi nanti 🖼️`);
        }

        product.image = url;
      } catch (error) {
        console.error("[EditProduk] Image:", error?.message || error);
        return m.reply(`❌ *Gagal mengunggah gambar.* Coba lagi nanti 🖼️`);
      }

      break;
    }

    case "video": {
      const quotedType = m.quoted?.type || m.quoted?.mtype;
      const hasMedia =
        !!m.quoted?.isMedia &&
        (m.quoted?.isVideo || quotedType === "videoMessage");

      const isDirectVideo =
        !!m.isVideo ||
        m.type === "videoMessage" ||
        !!m.message?.videoMessage;

      if (!hasMedia && !isDirectVideo) {
        return m.reply(
          `🎬 *Reply atau kirim video baru.*\n\n` +
          `Kirim video lalu reply dengan command ini.`
        );
      }

      await m.reply(`⏳ _Mengunggah video..._`);

      try {
        const buffer = hasMedia
          ? await m.quoted.download()
          : await m.download();

        if (!buffer?.length) {
          return m.reply(`❌ *Video tidak dapat dibaca.* 🎬`);
        }

        const url = await uploadToCatbox(buffer, "video.mp4");

        if (!url) {
          return m.reply(`❌ *Gagal mengunggah video.* Coba lagi nanti 🎬`);
        }

        product.video = url;
      } catch (error) {
        console.error("[EditProduk] Video:", error?.message || error);
        return m.reply(`❌ *Gagal mengunggah video.* Coba lagi nanti 🎬`);
      }

      break;
    }

    default:
      return m.reply(
        `❌ *Field tidak dikenali.*\n\n` +
        `Gunakan: nama, harga, diskon, stok, tipe, deskripsi, detail, gambar, video 📋`
      );
  }

  db.setting("storeProducts", products);
  await m.react("✅");

  const typeIcon = product.type === "fisik" ? "📦" : "🔑";
  const typeLabel = product.type === "fisik" ? "Fisik" : "Digital";

  let reply = `✅ *PRODUK DIPERBARUI*\n\n`;
  reply += `🏷️ Nama: *${product.name}*\n`;
  reply += `💰 Harga: *Rp ${Number(product.price || 0).toLocaleString("id-ID")}*`;

  if (product.originalPrice) {
    reply += ` ~~Rp ${Number(product.originalPrice).toLocaleString("id-ID")}~~`;
  }

  reply += `\n`;
  reply += `${typeIcon} Tipe: *${typeLabel}*\n`;
  reply += `📊 Stok: *${
    product.stock === -1
      ? "♾️ Unlimited"
      : product.type === "digital"
        ? `${Array.isArray(product.stockItems) ? product.stockItems.length : 0} akun`
        : `${Number(product.stock || 0)} pcs`
  }*\n`;

  if (field === "deskripsi") {
    reply += `📝 Deskripsi: _${product.description || "-"}_\n`;
  }

  if (field === "gambar") reply += `🖼️ Gambar: ✅\n`;
  if (field === "video") reply += `🎬 Video: ✅\n`;

  reply += `\n👀 _Lihat perubahan: \`${m.prefix}listproduk\`_`;

  return m.reply(reply);
}

export default {
  config,
  handler
};
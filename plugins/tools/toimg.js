// plugins/tools/toimg.js
// NIWO BOT : STICKER TO IMAGE

const config = {
  name: "toimg",
  alias: ["toimage", "stickertoimage", "stimg"],
  category: "tools",
  description: "Mengubah sticker menjadi gambar",
  usage: ".toimg (reply/caption sticker)",
  example: ".toimg",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  let mediaSource = null;
  let downloadFn = null;

  const selfIsSticker =
    m.isSticker ||
    m.type === "stickerMessage" ||
    m.mtype === "stickerMessage" ||
    !!m.message?.stickerMessage;

  const quotedIsSticker =
    m.quoted &&
    (
      m.quoted.isSticker ||
      m.quoted.type === "stickerMessage" ||
      m.quoted.mtype === "stickerMessage" ||
      !!m.quoted.message?.stickerMessage
    );

  // Sticker yang dikirim langsung + caption
  if (selfIsSticker) {
    mediaSource = "self";

    if (typeof m.download === "function") {
      downloadFn = m.download.bind(m);
    }
  }

  // Sticker yang direply
  else if (quotedIsSticker) {
    mediaSource = "quoted";

    if (typeof m.quoted.download === "function") {
      downloadFn = m.quoted.download.bind(m.quoted);
    }
  }

  if (!mediaSource || !downloadFn) {
    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> Tidak ada sticker yang terdeteksi!\n\n` +
      `*Cara penggunaan:*\n` +
      `> 1. Kirim sticker + caption \`${m.prefix}toimg\`\n` +
      `> 2. Reply sticker dengan \`${m.prefix}toimg\``
    );
  }

  // Ambil informasi sticker
  const stickerMsg =
    mediaSource === "self"
      ? m.message?.stickerMessage
      : m.quoted?.message?.stickerMessage;

  // Cek sticker animasi
  const isAnimated =
    stickerMsg?.isAnimated === true ||
    stickerMsg?.isAnimated === 1;

  if (isAnimated) {
    return m.reply(
      `⚠️ *sᴛɪᴄᴋᴇʀ ᴀɴɪᴍᴀsɪ*\n\n` +
      `> Sticker ini adalah sticker animasi (GIF).\n` +
      `> Gunakan \`${m.prefix}tovideo\` untuk mengubahnya.`
    );
  }

  try {
    await m.react("🕕");

    const buffer = await downloadFn();

    if (!buffer || !buffer.length) {
      throw new Error("Sticker tidak dapat diunduh.");
    }

    if (buffer.length < 100) {
      throw new Error("File sticker tidak valid atau rusak.");
    }

    /*
     * Sticker WhatsApp biasanya berupa WebP.
     * Jangan hanya mengubah mimetype menjadi image/jpeg,
     * karena buffer aslinya tetap WebP.
     *
     * Kirim sebagai document/image sesuai kemampuan Baileys.
     * Untuk sticker statis, WhatsApp dapat menampilkan WebP
     * sebagai gambar.
     */

    await sock.sendMessage(
      m.chat,
      {
        image: buffer,
        mimetype: "image/webp",
        caption: "🖼️ *Sticker berhasil diubah menjadi gambar*",
      },
      {
        quoted: m,
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error(
      "[TOIMG] Error:",
      error?.message || error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ᴇʀʀᴏʀ*\n\n` +
      `> Terjadi kesalahan saat memproses sticker.\n` +
      `> ${error?.message || "Unknown error"}`
    );
  }
}

export default {
  config,
  handler,
};
// plugins/tools/txt2qr.js
// NIWO BOT : TEXT TO QR CODE

import axios from "axios";

const config = {
  name: "txt2qr",
  alias: ["texttoqr", "qrcode", "qrcreate"],
  category: "tools",
  description: "Generate QR code dari teks",
  usage: ".txt2qr <text>",
  example: ".txt2qr https://google.com",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { text: rawText, sock }) {
  const text = String(
    rawText ||
    m.text ||
    (m.args && m.args.length ? m.args.join(" ") : "") ||
    ""
  ).trim();

  if (!text) {
    return m.reply(
      `📱 *ᴛᴇxᴛ ᴛᴏ Qʀ*\n\n` +
      `> Masukkan teks atau URL.\n\n` +
      `Contoh:\n` +
      `\`${m.prefix}txt2qr https://google.com\``
    );
  }

  try {
    await m.react("📱");

    let imageBuffer;
    try {
      const QRCode = (await import("qrcode")).default || (await import("qrcode"));
      imageBuffer = await QRCode.toBuffer(text, {
        errorCorrectionLevel: "H",
        type: "png",
        margin: 2,
        scale: 8,
      });
    } catch {
      const response = await axios.get(
        "https://api.qrserver.com/v1/create-qr-code/",
        {
          params: { data: text, size: "512x512" },
          responseType: "arraybuffer",
          timeout: 15000,
        }
      );
      imageBuffer = Buffer.from(response.data);
    }

    const preview =
      text.length > 100
        ? `${text.substring(0, 100)}...`
        : text;

    await sock.sendMessage(
      m.chat,
      {
        image: imageBuffer,
        caption:
          `📱 *Qʀ ᴄᴏᴅᴇ*\n\n` +
          `> ${preview}`,
      },
      {
        quoted: m,
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error(
      "[TXT2QR] Error:",
      error?.response?.status ||
      error?.message ||
      error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ɢᴀɢᴀʟ ᴍᴇᴍʙᴜᴀᴛ Qʀ*\n\n` +
      `> Gagal menghubungi layanan QR.\n` +
      `> Silakan coba lagi beberapa saat kemudian.`
    );
  }
}

export default {
  config,
  handler,
};
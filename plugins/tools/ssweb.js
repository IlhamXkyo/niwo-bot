// plugins/tools/ssweb.js
// NIWO BOT : WEBSITE SCREENSHOT

import axios from "axios";

const config = {
  name: "ssweb",
  alias: ["screenshot", "ss", "webss"],
  category: "tools",
  description: "Screenshot website",
  usage: ".ssweb <url>",
  example: ".ssweb https://google.com",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

async function ssweb(url, mode = "desktop") {
  const width = mode === "mobile" ? 720 : 1920;

  const apiUrl =
    `https://image.thum.io/get/` +
    `width/${width}/` +
    `crop/1080/` +
    `noanimate/` +
    url;

  const response = await axios.get(apiUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 15 * 1024 * 1024,
    maxBodyLength: 15 * 1024 * 1024,
  });

  return Buffer.from(response.data);
}

async function handler(m, { sock }) {
  let text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `📸 *sᴄʀᴇᴇɴsʜᴏᴛ ᴡᴇʙ*\n\n` +
      `> Screenshot halaman website\n\n` +
      `> *Contoh:*\n` +
      `> ${m.prefix}ssweb https://google.com\n` +
      `> ${m.prefix}ss https://github.com --mobile`
    );
  }

  // Mode mobile
  let mode = "desktop";

  if (/(--mobile|--hp)\b/i.test(text)) {
    mode = "mobile";
    text = text
      .replace(/--mobile\b/gi, "")
      .replace(/--hp\b/gi, "")
      .trim();
  }

  if (!text) {
    return m.reply(
      `❌ *URL WEBSITE TIDAK ADA*\n\n` +
      `Contoh:\n` +
      `${m.prefix}ssweb https://google.com`
    );
  }

  // Tambahkan https jika user hanya memasukkan domain
  if (!/^https?:\/\//i.test(text)) {
    text = `https://${text}`;
  }

  // Validasi URL
  let targetUrl;

  try {
    targetUrl = new URL(text);

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      throw new Error("Protocol tidak valid");
    }
  } catch {
    return m.reply(
      `❌ *URL TIDAK VALID*\n\n` +
      `Contoh:\n` +
      `${m.prefix}ssweb https://google.com`
    );
  }

  await m.react("🕕");

  try {
    const imageBuffer = await ssweb(
      targetUrl.toString(),
      mode
    );

    if (!imageBuffer || !imageBuffer.length) {
      throw new Error("Screenshot kosong");
    }

    await sock.sendMessage(
      m.chat,
      {
        image: imageBuffer,
        caption:
          `📸 *WEBSITE SCREENSHOT*\n\n` +
          `🌐 URL: ${targetUrl.toString()}\n` +
          `📱 Mode: ${mode === "mobile" ? "Mobile" : "Desktop"}`
      },
      {
        quoted: m
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error(
      "[SSWEB] Error:",
      error?.response?.status ||
        error?.message ||
        error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *GAGAL SCREENSHOT WEBSITE*\n\n` +
      `> Website mungkin tidak dapat diakses atau layanan screenshot sedang bermasalah.\n\n` +
      `> Silakan coba lagi beberapa saat kemudian.`
    );
  }
}

export {
  ssweb
};

export default {
  config,
  handler
};
// plugins/tools/caribug.js
// HIYUKI MD — CODE BUG ANALYZER

import axios from "axios";
import appConfig from "../../config.js";

const config = {
  name: "caribug",
  alias: ["debug", "findbug"],
  category: "tools",
  description: "Cari bug di kode pemrograman",
  usage: ".caribug [kode] atau reply kode",
  example: ".caribug function test() {}",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 20,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  let code = "";

  // Prioritas: kode dari reply
  if (m.quoted?.text) {
    code = String(m.quoted.text).trim();
  }

  // Jika tidak reply, ambil dari argument
  if (!code && Array.isArray(m.args)) {
    code = m.args.join(" ").trim();
  }

  // Fallback jika SC tidak mengisi m.args
  if (!code && m.text) {
    code = String(m.text)
      .replace(/^\S+\s*/, "")
      .trim();
  }

  if (!code) {
    return m.reply(
      `🐛 *ᴄᴀʀɪ ʙᴜɢ*\n\n` +
      `> Kirim kode atau reply pesan yang berisi kode untuk dianalisa.\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}caribug function test() {}\``
    );
  }

  // Batas agar request API tidak terlalu besar
  if (code.length > 50000) {
    return m.reply(
      `❌ *ᴋᴏᴅᴇ ᴛᴇʀʟᴀʟᴜ ᴘᴀɴᴊᴀɴɢ*\n\n` +
      `> Maksimal kode yang dapat dianalisa adalah *50.000 karakter*.`
    );
  }

  const apiKey =
    appConfig?.APIkey?.cuki ||
    appConfig?.apikey?.cuki ||
    appConfig?.apiKey?.cuki ||
    "";

  if (!apiKey) {
    return m.reply(
      `❌ *ᴀᴘɪ ᴋᴇʏ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ*\n\n` +
      `> API key Cuki belum tersedia di \`config.js\`.\n\n` +
      `> Pastikan konfigurasi:\n` +
      `\`APIkey.cuki\``
    );
  }

  try {
    await m.react("🕕");

    const response = await axios.get(
      "https://api.cuki.biz.id/api/aicode/caribug",
      {
        params: {
          apikey: apiKey,
          code,
          language: "auto",
        },
        timeout: 60000,
        validateStatus: () => true,
      }
    );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        `API HTTP ${response.status}`
      );
    }

    const data = response.data;

    if (!data?.success || !data?.data) {
      throw new Error(
        data?.message ||
        data?.msg ||
        "Gagal menganalisa kode dari server."
      );
    }

    const info = data.data || {};
    const meta = info.metadata || {};
    const bugInfo = info.bugsFound || {};

    const severity =
      meta.severityInfo || {};

    let text =
      `🐛 *ʜᴀsɪʟ ᴀɴᴀʟɪsᴀ ʙᴜɢ*\n\n`;

    text +=
      `╭┈┈⬡「 🔍 *ɪɴғᴏʀᴍᴀsɪ* 」\n`;

    text +=
      `┃ 💻 Bahasa: *${
        meta.detectedLanguage ||
        "Unknown"
      }*\n`;

    text +=
      `┃ ⚠️ Tingkat: *${
        severity.level ||
        "Unknown"
      }* ${
        severity.icon || ""
      }\n`;

    text +=
      `┃ 🐛 Bug ditemukan: *${
        bugInfo.total ?? 0
      }*\n`;

    text +=
      `╰┈┈⬡\n\n`;

    if (bugInfo.summary) {
      text +=
        `📝 *ʀɪɴɢᴋᴀsᴀɴ*\n` +
        `${bugInfo.summary}\n\n`;
    }

    const fixedCode =
      info.codeAnalysis?.fixed?.code;

    if (fixedCode) {
      const language =
        meta.detectedLanguage ||
        "";

      text +=
        `✨ *ᴋᴏᴅᴇ ᴘᴇʀʙᴀɪᴋᴀɴ*\n\n`;

      text +=
        "```" +
        `${language}\n` +
        `${fixedCode}\n` +
        "```\n\n";
    }

    const details =
      Array.isArray(bugInfo.details)
        ? bugInfo.details
        : [];

    if (details.length > 0) {
      text +=
        `📌 *ᴅᴇᴛᴀɪʟ ʙᴜɢ*\n\n`;

      details.forEach((bug, index) => {
        const description =
          bug?.type ||
          bug?.description ||
          "Bug tidak diketahui";

        text +=
          `${index + 1}. ${description}\n`;
      });
    }

    // Batasi pesan agar tidak melebihi limit WhatsApp
    if (text.length > 60000) {
      text =
        text.substring(0, 59500) +
        `\n\n... *hasil dipotong karena terlalu panjang*`;
    }

    await m.react("✅");
    return m.reply(text.trim());

  } catch (error) {
    console.error(
      "[CARIBUG] Error:",
      error?.response?.data ||
      error?.message ||
      error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ᴄᴀʀɪ ʙᴜɢ ɢᴀɢᴀʟ*\n\n` +
      `> Gagal menganalisa kode.\n\n` +
      `> ${
        error?.message ||
        "Terjadi kesalahan saat menghubungi API."
      }`
    );
  }
}

export default {
  config,
  handler,
};
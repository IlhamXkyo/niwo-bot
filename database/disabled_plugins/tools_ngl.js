// plugins/tools/ngl.js
// HIYUKI MD — NGL SENDER

import axios from "axios";

const config = {
  name: "ngl",
  alias: ["sendngl"],
  category: "tools",
  description: "Kirim pesan ke NGL",
  usage: ".ngl <url> | <text>",
  example: ".ngl https://ngl.link/xxxx | hai",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  // Ambil argument setelah command
  const raw = String(m.text || "")
    .replace(/^\S+\s*/, "")
    .trim();

  // Pisahkan URL dan pesan
  const parts = raw
    .split("|")
    .map((v) => v.trim());

  const link = parts[0];
  const kata = parts.slice(1).join("|").trim();

  // =========================================================
  // VALIDASI LINK
  // =========================================================

  if (!link) {
    return m.reply(
      `*LINK NGL NYA MANA?*\n\n` +
      `Contoh:\n` +
      `${m.prefix}ngl https://ngl.link/xxxx | hai`
    );
  }

  // =========================================================
  // VALIDASI PESAN
  // =========================================================

  if (!kata) {
    return m.reply(
      `*KATA-KATANYA MANA?*\n\n` +
      `Contoh:\n` +
      `${m.prefix}ngl https://ngl.link/xxxx | hai`
    );
  }

  // =========================================================
  // VALIDASI URL NGL
  // =========================================================

  if (
    !/^https?:\/\/(?:www\.)?ngl\.link\/[^\s]+$/i.test(
      link
    )
  ) {
    return m.reply(
      "*URL NGL tidak valid.*\n\n" +
      "Contoh:\n" +
      `${m.prefix}ngl https://ngl.link/xxxx | hai`
    );
  }

  try {
    await m.react("⏳");

    // =======================================================
    // API NGL
    // =======================================================

    const apiUrl =
      "https://api.cuki.biz.id/api/tools/sendngl";

    const response = await axios.get(apiUrl, {
      params: {
        apikey: "cuki-x",
        link,
        text: kata,
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    // =======================================================
    // CEK RESPONSE API
    // =======================================================

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        `API HTTP ${response.status}`
      );
    }

    // =======================================================
    // SUKSES
    // =======================================================

    await m.react("✅");

    return sock.sendMessage(
      m.chat,
      {
        text:
          `✅ *NGL BERHASIL DIKIRIM*\n\n` +
          `╭┈┈⬡「 📩 *DETAIL* 」\n` +
          `┃ 🎯 Target: ${link}\n` +
          `┃ 💬 Pesan: ${kata}\n` +
          `╰┈┈┈┈┈┈┈┈⬡`,
      },
      {
        quoted: m,
      }
    );
  } catch (error) {
    console.error(
      "[NGL] Error:",
      error?.response?.data ||
        error?.message ||
        error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *GAGAL MENGIRIM NGL*\n\n` +
      `> ${error?.message || "Terjadi kesalahan saat menghubungi API."}`
    );
  }
}

export default {
  config,
  handler,
};
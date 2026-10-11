// plugins/tools/reactwa.js
// WhatsApp Channel Reaction
// ESM Plugin

import axios from "axios";

const config = {
  name: "reactwa",
  alias: ["reactionwa", "wreact"],
  category: "tools",
  description: "Mengirim reaction ke WhatsApp Channel",
  usage: ".reactwa <link> <emoji>",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  limit: true,
  isEnabled: true
};

async function handler(m, {
  text,
  prefix,
  usedPrefix,
  command
} = {}) {
  const pfx = usedPrefix || prefix || ".";
  const cmd = command || config.name;

  if (!text) {
    return m.reply(
      `❀ *Cara penggunaan:*\n\n` +
      `${pfx + cmd} <link> <emoji>\n\n` +
      `Contoh:\n` +
      `${pfx + cmd} https://whatsapp.com/channel/xxxx/123 😘`
    );
  }

  const parts = String(text).trim().split(/\s+/);
  const link = parts[0];
  const emoji = parts.slice(1).join(" ").trim();

  if (!link) {
    return m.reply("❌ Link WhatsApp Channel tidak ditemukan.");
  }

  if (
    !/^https?:\/\/(www\.)?whatsapp\.com\/channel\/[^\/]+\/\d+/i.test(link)
  ) {
    return m.reply(
      `❌ *Link tidak valid.*\n\n` +
      `Contoh:\n` +
      `${pfx + cmd} https://whatsapp.com/channel/xxxx/123 😘`
    );
  }

  if (!emoji) {
    return m.reply(
      `❌ *Emoji belum diberikan.*\n\n` +
      `Contoh:\n` +
      `${pfx + cmd} ${link} 😘`
    );
  }

  const apiKey = global.reactApiKey;

  if (!apiKey) {
    return m.reply(
      `❌ *API Key belum disetel.*\n\n` +
      `Tambahkan API Key dari:\n` +
      `https://reaction-whatsapp.edgeone.dev/\n\n` +
      `Kemudian set:\n` +
      `global.reactApiKey = "API_KEY_KAMU"`
    );
  }

  await m.reply("⏳ Mengirim reaction...");

  try {
    const response = await axios.post(
      "https://reaction-whatsapp.edgeone.dev/react",
      {
        link,
        emoji
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        timeout: 30000
      }
    );

    const data = response.data;

    let resultText = "✅ *Reaction berhasil dikirim!*";

    if (data && typeof data === "object") {
      if (data.message) {
        resultText += `\n\n${data.message}`;
      }

      if (data.status) {
        resultText += `\nStatus: ${data.status}`;
      }

      if (data.emoji) {
        resultText += `\nEmoji: ${data.emoji}`;
      }
    }

    return m.reply(resultText);
  } catch (error) {
    let msg = "Gagal mengirim reaction.";

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        msg = "API Key tidak valid atau sudah expired.";
      } else if (status === 400) {
        msg = "Request ditolak. Pastikan link dan emoji benar.";
      } else if (status === 403) {
        msg = "Akses ditolak oleh API.";
      } else if (status === 429) {
        msg = "Terlalu banyak request. Coba lagi nanti.";
      } else if (typeof data === "string") {
        msg = data;
      } else if (data?.message) {
        msg = data.message;
      } else if (data?.error) {
        msg = data.error;
      }

      msg += `\n\nHTTP Status: ${status}`;
    } else if (
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT"
    ) {
      msg = "Request timeout. Server API terlalu lama merespons.";
    } else if (error.message) {
      msg = error.message;
    }

    return m.reply(
      `❌ *Reaction gagal!*\n\n${msg}`
    );
  }
}

export default { config, handler };
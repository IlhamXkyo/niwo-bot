// plugins/tools/nftoken.js

const config = {
  name: "nftoken",
  alias: ["netflixtoken"],
  category: "tools",
  description: "Generate Netflix Token",
  usage: ".nftoken",
  example: ".nftoken",
  cooldown: 10,
  energi: 1
};

async function handler(m, { sock }) {
  try {
    await m.reply("⏳ Sedang generate Netflix Token...");

    const api = "https://api.omegatech.app/api/tools/Nftoken?action=generate";

    const response = await fetch(api, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("NFTOKEN RESPONSE:", JSON.stringify(data, null, 2));

    if (!data?.success || !data?.data?.token) {
      return m.reply("❌ API tidak mengembalikan token yang valid.");
    }

    const result = data.data;
    const links = result.links || {};
    const allLinks = Array.isArray(links.all) ? links.all : [];

    let teks =
      `🎬 *NETFLIX TOKEN GENERATOR*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔑 *Token :* ${String(result.token).substring(0, 50)}...\n` +
      `📅 *Generated :* ${result.generatedAt || "-"}\n` +
      `📡 *Source :* ${data.source || "Omegatech"}\n\n`;

    if (allLinks.length > 0) {
      teks += `🔗 *LINK DEVICE :*\n`;

      for (const item of allLinks) {
        teks += `\n▪️ *${item.device || "Device"}*\n${item.url || "-"}\n`;
      }
    } else {
      teks +=
        `🔗 *PC / Browser :*\n${links.pc || "-"}\n\n` +
        `📱 *Android :*\n${links.android || "-"}\n\n` +
        `📺 *TV (6 Digit) :*\n${links.tv6 || "-"}\n\n` +
        `📺 *TV (8 Digit) :*\n${links.tv8 || "-"}\n`;
    }

    teks +=
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 Author: dekzyy`;

    await sock.sendMessage(
      m.chat,
      { text: teks },
      { quoted: m }
    );

  } catch (err) {
    console.error(
      "NFTOKEN ERROR:",
      err?.message || err
    );

    return m.reply(
      `❌ *NFTOKEN GAGAL*\n\n${err?.message || "Gagal menghubungi API."}`
    );
  }
}

export default { config, handler };
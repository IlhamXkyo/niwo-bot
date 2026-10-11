// plugins/topanime.js
import axios from "axios";

const pluginConfig = {
  name: "topanime",
  alias: ["topwaifu", "waifutop"],
  category: "anime",
  description: "Ambil daftar top anime/waifu dari MyWaifuList",
  usage: ".topanime <jumlah>",
  example: ".topanime 5",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { conn, text, usedPrefix, command }) {
  await m.react("🌸");

  const rawText = m.text || m.body || "";
  const prefix = usedPrefix || ".";
  const cmd = command || pluginConfig.name;
  const args = (text || rawText.replace(new RegExp(`^\\${prefix}\\S+\\s*`), "")).trim();

  // Default 5, max 15 biar ga kena limit WA
  let limit = parseInt(args) || 5;
  if (isNaN(limit) || limit < 1) limit = 5;
  if (limit > 15) limit = 15;

  try {
    const { data } = await axios.get(
      "https://my.izuka-api.xyz/api/anime/top-anime",
      { headers: { Accept: "application/json" } }
    );

    if (!data.status || !data.result?.result) {
      throw new Error("Response API tidak valid");
    }

    const list = data.result.result.slice(0, limit);
    const top1 = list[0];

    // Format caption : ringkas & rapi
    let caption = `🌸 *TOP ${limit} WAIFU ANIME* 🌸\n`;
    caption += `_Source: MyWaifuList_\n\n`;

    for (const w of list) {
      caption += `*${w.rank} ${w.name}* ${w.japanese}\n`;
      caption += `📺 ${w.anime}\n`;
      caption += `❤️ ${w.favorites} · 🗳️ ${w.votes}\n\n`;
    }

    caption += `_Maks 15 per request_`;

    // Kirim pakai gambar top 1
    if (top1?.image) {
      await conn.sendMessage(
        m.chat,
        {
          image: { url: top1.image },
          caption,
        },
        { quoted: m }
      );
    } else {
      await m.reply(caption);
    }
  } catch (e) {
    console.error("=== ERROR TOPANIME ===");
    console.error(e.message);
    await m.reply(`❌ Gagal ambil data top anime: ${e.message}`);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
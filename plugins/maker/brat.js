import { renderBratSticker } from "../../src/lib/bratRender.js";

const config = {
  name: "bratmaker",
  alias: ["bratgen"],
  category: "maker",
  description: "Membuat sticker bergaya brat dari teks",
  usage: ".bratmaker <text>",
  example: ".bratmaker hello world",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `〄 *BRAT MAKER*\n\n` +
        `┌──────────────\n` +
        `│ 〄 Masukkan teks\n` +
        `│\n` +
        `│ 〄 Contoh:\n` +
        `│ ${m.prefix}${config.name} hello world\n` +
        `└──────────────`
    );
  }

  try {
    await m.react("🕐");

    // Brat dirender lokal (RanggaCode tidak punya endpoint brat) dan
    // hasilnya SELALU dikirim sebagai sticker, bukan gambar.
    const sticker = await renderBratSticker(text, "bratimg");

    await sock.sendMessage(m.chat, { sticker }, { quoted: m });

    await m.react("✅");
  } catch (error) {
    console.error("[bratmaker]", error);
    await m.react("❌");

    return m.reply(`❌ *Gagal membuat BRAT MAKER!*\n\n> ${error.message}`);
  }
}

export default { config, handler };

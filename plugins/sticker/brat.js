import {
  STYLE_PRESETS,
  renderBratPng,
  pngToStickerWebp,
} from "../../src/lib/bratRender.js";
import { sendInteractiveMessage } from "../../src/lib/whatsappCompat.js";

const config = {
  name: "brat",
  alias: ["bratmenu", "bratimg", "bratgreen", "bratcewek", "bratvermeil", "brathd", "bratgojo", "bratvid2", "bratvermeilvid", "bratgojovid"],
  category: "sticker",
  description: "Menu variant brat dan generator sticker brat",
  usage: ".brat | .bratimg <text>",
  example: ".bratimg Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

const VIDEO_VARIANTS = new Set([
  "bratvid", "bratvid2", "bratvermeilvid", "bratgojovid",
]);

const BRAT_VARIANTS = [
  { title: "Brat Default", description: "Sticker brat versi biasa", command: "bratimg" },
  { title: "Brat Green", description: "Variant brat warna hijau", command: "bratgreen" },
  { title: "Brat Cewek", description: "Variant brat pink", command: "bratcewek" },
  { title: "Brat Vermeil", description: "Variant brat merah marun", command: "bratvermeil" },
  { title: "Brat HD", description: "Variant brat resolusi lebih tinggi", command: "brathd" },
  { title: "Brat Gojo", description: "Variant brat biru gelap", command: "bratgojo" },
  { title: "Brat Video (belum didukung)", description: "Sticker brat animated : coming soon", command: "bratvid" },
];

function buildVariantRows(prefix, text) {
  return BRAT_VARIANTS.map((item) => ({
    title: item.title,
    description: `${item.description} • ${prefix}${item.command} <text>`,
    id: `${prefix}${item.command} ${text || ""}`.trim(),
  }));
}

async function sendBratMenu(m, sock, text) {
  const caption = "🌿 *kamu mau buat brat yak, silahkan pilih variant brat di bawah*";
  const rows = buildVariantRows(m.prefix, text);
  const fallbackText = `${caption}\n\n` +
    rows.map((item) => `• *${item.title}*\n  ${item.id}`).join("\n\n");

  return sendInteractiveMessage(sock, m.chat, {
    text: caption,
    footer: "Pilih variant brat",
    buttonTitle: "🌾 Pilih Variant Brat",
    buttons: [
      {
        type: "single_select",
        text: "🌾 Pilih Variant Brat",
        sections: [{ title: "Variant Brat", rows }],
      },
    ],
    fallbackText,
    quoted: m.raw || m,
  });
}

async function handler(m, { sock, config: botConfig }) {
  const command = String(m.command || "").toLowerCase();
  const text = m.text;

  if (command === "brat" || command === "bratmenu") {
    await sendBratMenu(m, sock, text);
    return;
  }

  if (VIDEO_VARIANTS.has(command)) {
    await m.reply(
      "🚧 Variant video belum didukung di versi ini (butuh rendering ffmpeg terpisah).\n" +
      `Coba variant gambar statis dulu, misal: ${m.prefix}bratimg <text>`,
    );
    return;
  }

  if (!text) {
    return m.reply(
      `🖼️ *ʙʀᴀᴛ ɪᴍᴀɢᴇ*\n\n> Masukkan teks\n\nContoh: ${m.prefix}${command || "bratimg"} Hai semua`,
    );
  }

  const preset = STYLE_PRESETS[command] || STYLE_PRESETS.bratimg;

  await m.react("🕕");
  try {
    const png = renderBratPng(text, preset);
    const webp = await pngToStickerWebp(png, preset.size >= 768 ? 512 : preset.size);

    await sock.sendMessage(m.chat, { sticker: webp }, { quoted: m });
    await m.react("✅");
  } catch (error) {
    await m.react("☢");
    await m.reply(`❌ Gagal bikin sticker brat: ${error.message}`);
  }
}

export default { config, handler };
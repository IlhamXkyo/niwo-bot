// plugins/maker/ttp.js : NIWO BOT
// Mengubah teks menjadi stiker (Text To Picture) secara lokal & offline

import { createCanvas } from "@napi-rs/canvas";
import stickerLib from "../../esmlib/sticker.js";
import configApp from "../../config.js";

const config = {
  name: "ttp",
  alias: ["texttopict", "ttpict", "text2pic"],
  category: "maker",
  description: "Mengubah teks menjadi stiker (Text To Picture)",
  usage: ".ttp <teks>",
  example: ".ttp niwo bot",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

function renderText(text) {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 512, 512);

  const cleanText = String(text || "").trim();
  const words = cleanText.split(/\s+/);

  let fontSize = 65;
  if (cleanText.length > 50) fontSize = 35;
  else if (cleanText.length > 25) fontSize = 48;

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    const width = ctx.measureText(testLine).width;
    if (width < 460) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.25;
  const totalHeight = lines.length * lineHeight;
  let startY = (512 - totalHeight) / 2 + (lineHeight / 2);

  for (const line of lines) {
    // Stroke luar hitam tebal agar teks terbaca jelas
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(6, Math.floor(fontSize / 8));
    ctx.lineJoin = "round";
    ctx.strokeText(line, 256, startY);

    // Teks putih bersih
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(line, 256, startY);

    startY += lineHeight;
  }

  return canvas.toBuffer("image/png");
}

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `🖼️ *TTP MAKER*\n\n` +
        `Ubah teks jadi stiker secara instan.\n` +
        `Contoh: *${m.prefix}ttp ${config.example}*`
    );
  }

  await m.react("🕐");

  try {
    const pngBuffer = renderText(text);
    const webp = await stickerLib.writeExif(
      { data: pngBuffer, type: "image", mimetype: "image/png" },
      {
        packName: configApp.stickerPackname || "niwo bot",
        packPublish: configApp.stickerAuthor || "ilham",
      }
    );

    await sock.sendMessage(m.chat, { sticker: webp }, { quoted: m.raw || m });
    await m.react("✅");
  } catch (err) {
    console.error("[TTP ERROR]", err);
    await m.react("❌");
    await m.reply(`❌ Gagal membuat stiker teks: ${err?.message || "Unknown error"}`);
  }
}

export default { config, handler };

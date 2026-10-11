// plugins/maker/attp.js : NIWO BOT
// Mengubah teks menjadi stiker bergerak warna-warni (Animated Text To Picture) secara lokal

import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import os from "os";
import ff from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import stickerLib from "../../esmlib/sticker.js";
import configApp from "../../config.js";

if (ffmpegInstaller?.path) {
  ff.setFfmpegPath(ffmpegInstaller.path);
}

const config = {
  name: "attp",
  alias: ["atextpict"],
  category: "maker",
  description: "Mengubah teks menjadi stiker bergerak warna-warni",
  usage: ".attp <teks>",
  example: ".attp niwo bot",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const COLORS = ["#FF0055", "#FF7700", "#FFDD00", "#00DD55", "#00BBFF", "#AA00FF"];

function renderFrame(text, color) {
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
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(6, Math.floor(fontSize / 8));
    ctx.lineJoin = "round";
    ctx.strokeText(line, 256, startY);

    ctx.fillStyle = color;
    ctx.fillText(line, 256, startY);

    startY += lineHeight;
  }

  return canvas.toBuffer("image/png");
}

async function generateAnimatedWebp(text) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "attp-"));

  try {
    COLORS.forEach((color, i) => {
      const frameBuf = renderFrame(text, color);
      fs.writeFileSync(path.join(tmpDir, `frame_${i}.png`), frameBuf);
    });

    const outWebp = path.join(tmpDir, "out.webp");

    await new Promise((resolve, reject) => {
      ff()
        .input(path.join(tmpDir, "frame_%d.png"))
        .inputOptions(["-framerate", "5"])
        .outputOptions([
          "-vcodec", "libwebp",
          "-lossless", "0",
          "-quality", "65",
          "-loop", "0",
          "-preset", "default",
          "-an",
          "-vsync", "0"
        ])
        .toFormat("webp")
        .saveToFile(outWebp)
        .on("end", resolve)
        .on("error", reject);
    });

    const result = fs.readFileSync(outWebp);
    return result;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `🖼️ *ATTP MAKER*\n\n` +
        `Ubah teks jadi stiker bergerak warna-warni.\n` +
        `Contoh: *${m.prefix}attp ${config.example}*`
    );
  }

  await m.react("🕐");

  try {
    const rawAnimatedWebp = await generateAnimatedWebp(text);
    const webp = await stickerLib.writeExif(
      { data: rawAnimatedWebp, type: "video", mimetype: "image/webp" },
      {
        packName: configApp.stickerPackname || "niwo bot",
        packPublish: configApp.stickerAuthor || "ilham",
      }
    );

    await sock.sendMessage(m.chat, { sticker: webp }, { quoted: m.raw || m });
    await m.react("✅");
  } catch (err) {
    console.error("[ATTP ERROR]", err);
    await m.react("❌");
    await m.reply(`❌ Gagal membuat stiker bergerak: ${err?.message || "Unknown error"}`);
  }
}

export default { config, handler };

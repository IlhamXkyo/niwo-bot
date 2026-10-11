// plugins/canvas/fakestory.js
import { getAssetBuffer } from "../../src/lib/asset-manager.js";
import * as canvas from "@napi-rs/canvas";
import axios from "axios";

const config = {
  name: "fakestory",
  alias: ["fstory", "fakeinsta", "igstory"],
  category: "canvas",
  description: "Membuat fake Instagram Story",
  usage: ".fakestory",
  example: ".fakestory",
  cooldown: 5
};

const { createCanvas, loadImage } = canvas;
const DEFAULT_PP_BUFFER = getAssetBuffer("pp-kosong");

async function downloadImage(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 20000 });
  return Buffer.from(res.data);
}

async function getAvatarBuffer(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    if (url) return await downloadImage(url);
  } catch {}
  if (DEFAULT_PP_BUFFER) return DEFAULT_PP_BUFFER;
  throw new Error("Asset pp-kosong tidak tersedia");
}

async function roundedImage(ctx, image, x, y, width, height, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

async function handler(m, { sock }) {
  try {
    if (!m.isImage && !(m.quoted && m.quoted.isImage)) {
      return m.reply("Reply atau kirim gambar dengan caption *.fakestory*");
    }

    const imageBuffer = m.isImage ? await m.download() : await m.quoted.download();
    if (!imageBuffer) return m.reply("Gagal mengambil gambar.");

    const avatarBuffer = await getAvatarBuffer(sock, m.sender);
    const mainImage = await loadImage(imageBuffer);
    const avatar = await loadImage(avatarBuffer);

    const width = 1080;
    const height = 1920;
    const c = createCanvas(width, height);
    const ctx = c.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#101010");
    bg.addColorStop(0.5, "#262626");
    bg.addColorStop(1, "#050505");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#000";
    ctx.fillRect(35, 35, width - 70, height - 70);

    const imageY = 330;
    const imageH = 1250;
    const imageW = 1010;
    const imageX = 35;

    ctx.save();
    ctx.beginPath();
    ctx.rect(imageX, imageY, imageW, imageH);
    ctx.clip();

    const scale = Math.max(imageW / mainImage.width, imageH / mainImage.height);
    const drawW = mainImage.width * scale;
    const drawH = mainImage.height * scale;
    const drawX = imageX + (imageW - drawW) / 2;
    const drawY = imageY + (imageH - drawH) / 2;

    ctx.drawImage(mainImage, drawX, drawY, drawW, drawH);
    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(35, 35, width - 70, 220);

    await roundedImage(ctx, avatar, 70, 80, 110, 110, 55);

    ctx.font = "bold 42px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(m.pushName || "Instagram User", 205, 130);

    ctx.font = "32px Arial";
    ctx.fillStyle = "#ddd";
    ctx.fillText("5m", 205, 180);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 55px Arial";
    ctx.fillText("•••", 925, 145);

    const progressY = 55;
    const progressX = 70;
    const progressW = 940;
    const progressH = 8;

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(progressX, progressY, progressW, progressH);

    ctx.fillStyle = "#fff";
    ctx.fillRect(progressX, progressY, progressW * 0.65, progressH);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(35, 1540, width - 70, 345);

    ctx.font = "bold 38px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText("Send message", 90, 1690);

    ctx.beginPath();
    ctx.arc(940, 1680, 32, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(930, 1680);
    ctx.lineTo(955, 1680);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(942, 1667);
    ctx.lineTo(942, 1693);
    ctx.stroke();

    ctx.font = "28px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Your story", 80, 1810);

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, width - 70, height - 70);

    const result = await c.encode("jpeg", 95);

    await sock.sendMessage(m.chat, {
      image: result,
      caption: `Fake Instagram Story\n\n© Niwo Bot`
    }, { quoted: m });

  } catch (e) {
    console.error("[FAKESTORY]", e);
    return m.reply(`❌ Gagal membuat Fake Story:\n${e.message}`);
  }
}

export default { config, handler };
/**
 * bratRender.js
 * Renderer sticker bergaya "brat" (background polos + teks huruf kecil tebal).
 *
 * Dipakai bersama oleh plugins/sticker/brat.js dan plugins/maker/brat.js.
 * Sengaja dirender lokal karena penyedia API (RanggaCode) tidak menyediakan
 * endpoint brat : dan hasil lokal jauh lebih cepat serta selalu tersedia.
 */

import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";

/** Preset warna & ukuran tiap variant brat. */
const STYLE_PRESETS = {
  bratimg: { bg: "#ffffff", fg: "#000000", size: 512 },
  bratgreen: { bg: "#8ace00", fg: "#000000", size: 512 },
  bratcewek: { bg: "#ffc0cb", fg: "#5c1a2b", size: 512 },
  bratvermeil: { bg: "#7b1e3a", fg: "#ffffff", size: 512 },
  brathd: { bg: "#ffffff", fg: "#000000", size: 768 },
  bratgojo: { bg: "#1b1f3b", fg: "#ffffff", size: 512 },
};

/** Pecah teks menjadi baris-baris yang muat dalam maxWidth. */
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  return lines;
}

/** Render PNG bergaya brat: background solid + teks huruf kecil tebal. */
function renderBratPng(text, preset = STYLE_PRESETS.bratimg) {
  const { bg, fg, size } = preset;

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const label = String(text || "brat").toLowerCase();
  const padding = size * 0.12;
  const maxWidth = size - padding * 2;

  let fontSize = Math.floor(size * 0.16);
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;

  let lines;
  do {
    ctx.font = `bold ${fontSize}px sans-serif`;
    lines = wrapLines(ctx, label, maxWidth);
    fontSize -= 4;
  } while (lines.length * fontSize * 1.2 > size - padding * 2 && fontSize > 12);

  const lineHeight = fontSize * 1.35;
  const totalHeight = lines.length * lineHeight;
  let y = size / 2 - totalHeight / 2 + lineHeight / 2;

  ctx.textAlign = "center";
  for (const line of lines) {
    ctx.fillText(line, size / 2, y, maxWidth);
    y += lineHeight;
  }

  return canvas.toBuffer("image/png");
}

/** PNG -> WEBP sticker buffer via sharp. */
async function pngToStickerWebp(pngBuffer, targetSize = 512) {
  return sharp(pngBuffer)
    .resize(targetSize, targetSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer();
}

/** Render langsung dari teks ke buffer WEBP siap kirim sebagai sticker. */
async function renderBratSticker(text, presetName = "bratimg") {
  const preset = STYLE_PRESETS[presetName] || STYLE_PRESETS.bratimg;
  const png = renderBratPng(text, preset);

  return pngToStickerWebp(png, preset.size >= 768 ? 512 : preset.size);
}

export {
  STYLE_PRESETS,
  renderBratPng,
  pngToStickerWebp,
  renderBratSticker,
};

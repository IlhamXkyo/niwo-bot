import { createCanvas } from "@napi-rs/canvas";

const config = {
  name: "gradient",
  alias: ["gradientext", "gradasi"],
  category: "maker",
  description: "Membuat gambar teks dengan latar gradien (offline, tanpa API)",
  usage: ".gradient <teks>",
  example: ".gradient niwo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const PALETTES = [
  ["#ff6a00", "#ee0979"],
  ["#00c6ff", "#0072ff"],
  ["#f7971e", "#ffd200"],
  ["#7f00ff", "#e100ff"],
  ["#11998e", "#38ef7d"],
  ["#fc466b", "#3f5efb"],
];

/** Bungkus teks supaya muat di lebar kanvas. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines;
}

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `〄 *GRADIENT MAKER*\n\n` +
        `┌──────────────\n` +
        `│ 〄 Masukkan teks\n` +
        `│\n` +
        `│ 〄 Contoh:\n` +
        `│ ${m.prefix}gradient niwo\n` +
        `└──────────────`
    );
  }

  if (text.length > 120) {
    return m.reply("❌ Teks terlalu panjang. Maksimal 120 karakter.");
  }

  try {
    await m.react("🕐");

    const W = 1000;
    const H = 1000;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const [c1, c2] = PALETTES[Math.floor(Math.random() * PALETTES.length)];

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c1);
    bg.addColorStop(1, c2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Ukuran font menyesuaikan panjang teks supaya selalu proporsional.
    const fontSize = text.length > 40 ? 64 : text.length > 20 ? 88 : 120;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = wrapText(ctx, text, W - 120);
    const lineHeight = fontSize * 1.25;
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff";

    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineHeight);
    });

    const buffer = canvas.toBuffer("image/png");

    await sock.sendMessage(m.chat, { image: buffer }, { quoted: m });

    await m.react("✅");
  } catch (error) {
    console.error("[gradient]", error);
    await m.react("❌");

    return m.reply(`❌ *Gagal membuat gradient!*\n\n> ${error.message}`);
  }
}

export default { config, handler };

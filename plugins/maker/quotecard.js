import { createCanvas } from "@napi-rs/canvas";

const config = {
  name: "quotecard",
  alias: ["qc", "quotedark"],
  category: "maker",
  description: "Membuat kartu kutipan elegan (offline, tanpa API)",
  usage: ".quotecard <teks> | reply pesan",
  example: ".quotecard hidup itu pilihan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

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
  // Bisa dipakai langsung dengan teks, atau dengan me-reply pesan orang lain.
  const text = String(m.text || "").trim() || m.quoted?.body || "";
  const author = m.text ? m.pushName : m.quoted?.pushName || m.pushName;

  if (!text) {
    return m.reply(
      `〄 *QUOTE CARD*\n\n` +
        `┌──────────────\n` +
        `│ 〄 Masukkan teks atau reply pesan\n` +
        `│\n` +
        `│ 〄 Contoh:\n` +
        `│ ${m.prefix}quotecard hidup itu pilihan\n` +
        `└──────────────`
    );
  }

  if (text.length > 300) {
    return m.reply("❌ Teks terlalu panjang. Maksimal 300 karakter.");
  }

  try {
    await m.react("🕐");

    const W = 1000;
    const H = 1000;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Latar gelap elegan
    ctx.fillStyle = "#12141c";
    ctx.fillRect(0, 0, W, H);

    // Aksen garis di kiri
    const accent = ctx.createLinearGradient(0, 0, 0, H);
    accent.addColorStop(0, "#7f5af0");
    accent.addColorStop(1, "#2cb67d");
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, H);

    // Tanda kutip besar sebagai dekorasi
    ctx.font = "bold 220px serif";
    ctx.fillStyle = "rgba(127,90,240,0.22)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("\u201C", 70, 90);

    // Isi kutipan
    const fontSize = text.length > 160 ? 40 : text.length > 80 ? 52 : 64;
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = "#fffffe";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const lines = wrapText(ctx, text, W - 200);
    const lineHeight = fontSize * 1.45;
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, 90, startY + i * lineHeight);
    });

    // Nama penulis
    ctx.font = "italic 38px sans-serif";
    ctx.fillStyle = "#94a1b2";
    ctx.fillText(`: ${author || "Anonim"}`, 90, H - 130);

    const buffer = canvas.toBuffer("image/png");

    await sock.sendMessage(m.chat, { image: buffer }, { quoted: m });

    await m.react("✅");
  } catch (error) {
    console.error("[quotecard]", error);
    await m.react("❌");

    return m.reply(`❌ *Gagal membuat quote card!*\n\n> ${error.message}`);
  }
}

export default { config, handler };

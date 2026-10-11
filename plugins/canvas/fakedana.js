
import { createCanvas } from '@napi-rs/canvas';

const pluginConfig = {
  name: "fakedana",
  alias: ['fdana', 'danafake'],
  category: "canvas",
  description: "Membuat bukti saldo DANA palsu (Offline Canvas)",
  usage: ".fakedana <nominal>",
  example: ".fakedana 1500000",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "fakedana";

  try {
    let text = (ctx.text ?? ctx.body ?? m?.text ?? m?.body ?? "").trim() || (ctx.args ? ctx.args.join(" ") : "");
    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text || isNaN(text)) {
      return m.reply(`Masukkan jumlah saldo berupa angka!\nContoh: ${usedPrefix}${command} 5000000`);
    }

    const saldo = parseInt(text).toLocaleString('id-ID');
    await m.reply("Sedang mencetak struk DANA secara offline...");

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const cctx = canvas.getContext('2d');

    cctx.fillStyle = '#118ee9';
    cctx.fillRect(0, 0, width, height);

    cctx.fillStyle = '#ffffff';
    cctx.beginPath();
    cctx.arc(width / 2, -150, 400, 0, Math.PI * 2);
    cctx.fill();

    cctx.fillStyle = '#118ee9';
    cctx.font = 'bold 50px sans-serif';
    cctx.textAlign = 'center';
    cctx.fillText('D A N A', width / 2, 80);

    cctx.fillStyle = '#ffffff';
    cctx.font = 'bold 36px sans-serif';
    cctx.fillText('Transaksi Berhasil', width / 2, 220);

    cctx.font = 'bold 60px monospace';
    cctx.fillText(`Rp ${saldo}`, width / 2, 300);

    const now = new Date();
    const timeStr = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
    cctx.font = '20px sans-serif';
    cctx.fillStyle = '#e0f2fe';
    cctx.fillText(timeStr, width / 2, 360);

    const buffer = canvas.toBuffer('image/png');

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: `dY *FAKE DANA OFFLINE GENERATED!*\n\nIni dibuat murni pakai Canvas di laptopmu. Anti error server!\n\n_Disclaimer: Hanya untuk Have Fun / Prank!_`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[fakedana-lokal] error:", err);
    await m.reply(`?O Gagal memproses canvas lokal:\n${err.message || err}`);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };

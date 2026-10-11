const fs = require('fs');

const ktpCode = `
import { createCanvas, loadImage } from '@napi-rs/canvas';

const pluginConfig = {
  name: "ektp",
  alias: ['fakektp', 'ktp'],
  category: "canvas",
  description: "Membuat E-KTP Custom Lokal (Kirim foto dengan caption)",
  usage: ".ektp <provinsi> | <kota> | <nik> | <nama> | <ttl> | <jk> | <goldar> | <alamat> | <rt/rw> | <desa> | <kecamatan> | <agama> | <status> | <pekerjaan> | <kewarganegaraan> | <masa_berlaku> | <terbuat>",
  example: ".ektp jawa barat | bandung | 3273010101010001 | Budi | Bandung, 01-01-2001 | LAKI-LAKI | O | JL. Merdeka | 001/002 | Sukajadi | Sukajadi | ISLAM | BELUM KAWIN | PELAJAR | WNI | SEUMUR HIDUP | 01-01-2020",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const FIELDS = [
  "provinsi", "kota", "nik", "nama", "ttl", "jenis_kelamin", "golongan_darah",
  "alamat", "rt_rw", "kel_desa", "kecamatan", "agama", "status", "pekerjaan",
  "kewarganegaraan", "masa_berlaku", "terbuat"
];

async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "ektp";

  try {
    let text = (ctx.text ?? ctx.body ?? m?.text ?? m?.body ?? "").trim() || (ctx.args ? ctx.args.join(" ") : "");
    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text) {
      return m.reply(
        \`dY *NIWO ID Card Generator (Offline)*\\n\\n\` +
        \`Kirim gambar/foto dengan caption 17 format data dipisah garis lurus |\\n(Atau balas gambar dengan perintah ini)\\n\\n\` +
        \`Contoh:\\n\` +
        \`\${usedPrefix}\${command} JAWA BARAT | KOTA BANDUNG | 3273010101010001 | KAZUMA | TOKYO, 01-01-2001 | LAKI-LAKI | O | JL. MANSION | 001/002 | SUKAJADI | SUKAJADI | ISLAM | LAJANG | PETUALANG | WNI | SEUMUR HIDUP | 01-01-2020\`
      );
    }

    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || '';
    if (!mime.startsWith('image/')) {
      return m.reply('s,? *Mana fotonya?*\\nKirim gambar/foto dengan caption perintah, atau balas (reply) foto yang sudah ada!');
    }

    const values = text.split("|").map((s) => s.trim());
    if (values.length < 17) {
      return m.reply(\`s,? *Data kurang!* Butuh 17 data teks, kamu hanya ngirim \${values.length}.\`);
    }

    const data = {};
    for (let i = 0; i < FIELDS.length; i++) data[FIELDS[i]] = values[i].toUpperCase() || "-";

    await m.reply("dY Sedang mencetak E-KTP (Desain Asli)... tunggu sebentar!");

    let photoBuffer;
    if (typeof q.download === 'function') photoBuffer = await q.download();
    else if (typeof q.downloadMedia === 'function') photoBuffer = await q.downloadMedia();
    else throw new Error("Fitur download media tidak disupport.");

    // Ukuran standar KTP ~ 85.60 x 53.98 mm -> rasio 1.58
    const width = 800;
    const height = 506;
    const canvas = createCanvas(width, height);
    const cctx = canvas.getContext('2d');

    // Background KTP (Cyan Biru terang)
    const grd = cctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, '#cceeff');
    grd.addColorStop(0.5, '#e6f7ff');
    grd.addColorStop(1, '#99ddff');
    cctx.fillStyle = grd;
    cctx.fillRect(0, 0, width, height);

    // Faint watermark pattern (Fake Guilloche)
    cctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    cctx.font = 'bold 150px sans-serif';
    cctx.save();
    cctx.translate(width/2, height/2);
    cctx.rotate(-Math.PI / 6);
    cctx.textAlign = 'center';
    cctx.fillText('INDONESIA', 0, 0);
    cctx.restore();

    // HEADER
    cctx.fillStyle = '#000000';
    cctx.font = 'bold 24px Arial, sans-serif';
    cctx.textAlign = 'center';
    cctx.fillText(\`PROVINSI \${data.provinsi}\`, width / 2, 40);
    cctx.fillText(data.kota, width / 2, 70);

    // NIK
    cctx.font = 'bold 30px "Courier New", Courier, monospace';
    cctx.textAlign = 'left';
    cctx.fillText('NIK', 30, 130);
    cctx.fillText(':', 200, 130);
    cctx.fillText(data.nik, 220, 130);

    // DETAILS TEXT
    cctx.font = '16px Arial, sans-serif';
    let y = 175;
    const lh = 24; // line height
    
    // Label x: 30, Indented Label x: 70
    // Colon x: 200
    // Value x: 215

    const drawLine = (label, val, indent = false) => {
      cctx.fillText(label, indent ? 70 : 30, y);
      cctx.fillText(':', 200, y);
      cctx.fillText(val, 215, y);
      y += lh;
    };

    drawLine('Nama', data.nama);
    drawLine('Tempat/Tgl Lahir', data.ttl);
    
    // Jenis Kelamin & Gol Darah in one line
    cctx.fillText('Jenis Kelamin', 30, y);
    cctx.fillText(':', 200, y);
    cctx.fillText(data.jenis_kelamin, 215, y);
    cctx.fillText('Gol. Darah :', 410, y);
    cctx.fillText(data.golongan_darah, 510, y);
    y += lh;

    drawLine('Alamat', data.alamat);
    drawLine('RT/RW', data.rt_rw, true);
    drawLine('Kel/Desa', data.kel_desa, true);
    drawLine('Kecamatan', data.kecamatan, true);
    drawLine('Agama', data.agama);
    drawLine('Status Perkawinan', data.status);
    drawLine('Pekerjaan', data.pekerjaan);
    drawLine('Kewarganegaraan', data.kewarganegaraan);
    drawLine('Berlaku Hingga', data.masa_berlaku);

    // PAS PHOTO (Kanan)
    const px = 580;
    const py = 120;
    const pw = 180;
    const ph = 240;
    
    try {
      const photo = await loadImage(photoBuffer);
      cctx.drawImage(photo, px, py, pw, ph);
    } catch (e) {
      cctx.fillStyle = '#666';
      cctx.fillRect(px, py, pw, ph);
      cctx.fillStyle = '#fff';
      cctx.font = '16px sans-serif';
      cctx.textAlign = 'center';
      cctx.fillText('FOTO', px + pw/2, py + ph/2);
      cctx.fillStyle = '#000'; // back to black
    }

    // TTD & KOTA
    cctx.textAlign = 'center';
    cctx.font = '14px Arial, sans-serif';
    cctx.fillText(data.kota, px + pw/2, py + ph + 25);
    cctx.fillText(data.terbuat, px + pw/2, py + ph + 45);

    // Fake Signature / Scribble
    cctx.beginPath();
    cctx.moveTo(px + 40, py + ph + 70);
    cctx.quadraticCurveTo(px + 90, py + ph + 50, px + 80, py + ph + 85);
    cctx.quadraticCurveTo(px + 120, py + ph + 70, px + 140, py + ph + 90);
    cctx.strokeStyle = '#000';
    cctx.lineWidth = 2;
    cctx.stroke();

    const buffer = canvas.toBuffer('image/png');

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: \`dY *E-KTP GENERATED!*\\n\\nDesain sudah disesuaikan agar mirip dengan e-KTP asli.\\n\\n_Disclaimer: Hanya untuk Have Fun / Prank!_\`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[ektp-lokal] error:", err);
    await m.reply(\`?O Gagal:\\n\${err.message || err}\`);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
`

fs.writeFileSync('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js', ktpCode, 'utf8');
console.log('ktp code updated with real layout');

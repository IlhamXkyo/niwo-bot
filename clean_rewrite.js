const fs = require('fs');

const ktpCode = `
import { createCanvas, loadImage } from '@napi-rs/canvas';

const pluginConfig = {
  name: "ektp",
  alias: ['fakektp', 'ktp'],
  category: "canvas",
  description: "Membuat E-KTP Custom Lokal (100% Offline)",
  usage: ".ektp <provinsi> | <kota> | <nik> | <nama> | <ttl> | <jk> | <goldar> | <alamat> | <rt/rw> | <desa> | <kecamatan> | <agama> | <status> | <pekerjaan> | <kewarganegaraan> | <masa_berlaku> | <terbuat> | <pas_photo_url>",
  example: ".ektp tokyo | nerima | 2112090309120001 | doraemon | matsushiba, 03-09-2112 | laki-laki | Dorayaki | rumah keluarga nobi | 005/002 | nerima | tsukimidai | Dorayakisme | menikah | robot | WNA | seumur hidup | 03-09-2112 | https://k.top4top.io/p_3816oexr91.jpg",
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
  "kewarganegaraan", "masa_berlaku", "terbuat", "pas_photo"
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
        \`Kirim dengan 18 format yang dipisah dengan garis lurus |\\n\\n\` +
        \`Contoh:\\n\` +
        \`\${usedPrefix}\${command} Isekai | Axel | 3273010101010001 | Kazuma | Tokyo, 01-01-2001 | laki-laki | O | Mansion Kazuma | 001/002 | Sukajadi | Sukajadi | Aqua | Lajang | Petualang | WNA | seumur hidup | 01-01-2020 | https://i.ibb.co/xxxx/photo.jpg\`
      );
    }

    const values = text.split("|").map((s) => s.trim());
    if (values.length < 18) {
      return m.reply(\`s,? *Data kurang!* Butuh 18 data, kamu hanya kirim \${values.length}.\`);
    }

    const data = {};
    for (let i = 0; i < FIELDS.length; i++) data[FIELDS[i]] = values[i] || "-";

    await m.reply("dY Sedang menggambar ID Card 100% lokal di laptop...");

    const width = 900;
    const height = 550;
    const canvas = createCanvas(width, height);
    const cctx = canvas.getContext('2d');

    const grd = cctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, '#0f172a');
    grd.addColorStop(1, '#1e293b');
    cctx.fillStyle = grd;
    cctx.fillRect(0, 0, width, height);

    const accent = cctx.createLinearGradient(0, 0, width, 0);
    accent.addColorStop(0, '#3b82f6');
    accent.addColorStop(1, '#8b5cf6');
    cctx.fillStyle = accent;
    cctx.fillRect(0, 0, width, 18);
    cctx.fillRect(0, height - 18, width, 18);

    cctx.fillStyle = '#60a5fa';
    cctx.font = 'bold 32px sans-serif';
    cctx.textAlign = 'center';
    cctx.fillText(\`PROVINSI \${data.provinsi.toUpperCase()}\`, width / 2, 60);
    cctx.fillStyle = '#f8fafc';
    cctx.font = 'bold 24px sans-serif';
    cctx.fillText(\`KOTA \${data.kota.toUpperCase()}\`, width / 2, 95);

    try {
      if (/^https?:\\/\\//.test(data.pas_photo)) {
        const photo = await loadImage(data.pas_photo);
        cctx.drawImage(photo, 40, 130, 200, 280);
      } else {
        throw new Error('Not an image URL');
      }
    } catch (e) {
      cctx.fillStyle = '#334155';
      cctx.fillRect(40, 130, 200, 280);
      cctx.fillStyle = '#94a3b8';
      cctx.font = '20px sans-serif';
      cctx.textAlign = 'center';
      cctx.fillText('FOTO ERROR', 140, 270);
    }

    cctx.fillStyle = '#2dd4bf';
    cctx.font = 'bold 30px monospace';
    cctx.textAlign = 'left';
    cctx.fillText(\`NIK : \${data.nik}\`, 280, 150);

    cctx.fillStyle = '#334155';
    cctx.fillRect(280, 165, 580, 2);

    cctx.font = '18px sans-serif';
    let y = 200;
    const spacing = 32;
    const xLabel = 280;
    const xTitik = 460;
    const xValue = 480;

    const drawLine = (label, val) => {
      cctx.fillStyle = '#94a3b8';
      cctx.fillText(label, xLabel, y);
      cctx.fillText(':', xTitik, y);
      cctx.fillStyle = '#f1f5f9';
      cctx.fillText(val.length > 35 ? val.substring(0, 35) + '...' : val, xValue, y);
      y += spacing;
    };

    drawLine('Nama', data.nama.toUpperCase());
    drawLine('Tempat/Tgl Lahir', data.ttl);
    drawLine('Jenis Kelamin', \`\${data.jenis_kelamin}   Gol. Darah: \${data.golongan_darah}\`);
    drawLine('Alamat', data.alamat);
    drawLine('Agama', data.agama);
    drawLine('Status Kawin', data.status);
    drawLine('Pekerjaan', data.pekerjaan);
    drawLine('Kewarganegaraan', data.kewarganegaraan);
    drawLine('Berlaku Hingga', data.masa_berlaku);

    cctx.fillStyle = '#94a3b8';
    cctx.font = '16px sans-serif';
    cctx.textAlign = 'center';
    cctx.fillText(data.kota, 750, 440);
    cctx.fillText(data.terbuat, 750, 460);
    cctx.fillStyle = '#475569';
    cctx.fillRect(700, 470, 100, 2); 
    cctx.fillText('Niwo Bot Auth', 750, 490);

    const buffer = canvas.toBuffer('image/png');

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: \`dY *NIWO ID CARD GENERATED!*\\n\\nIni dibuat murni secara 'offline' pakai Canvas mesin laptopmu, tanpa butuh internet ke API orang lain!\`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[ektp-lokal] error:", err);
    await m.reply(\`?O Gagal memproses gambar secara lokal:\\n\${err.message || err}\`);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
`;

const danaCode = `
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
    const parts = text.split(/\\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text || isNaN(text)) {
      return m.reply(\`Masukkan jumlah saldo berupa angka!\\nContoh: \${usedPrefix}\${command} 5000000\`);
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
    cctx.fillText(\`Rp \${saldo}\`, width / 2, 300);

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
        caption: \`dY *FAKE DANA OFFLINE GENERATED!*\\n\\nIni dibuat murni pakai Canvas di laptopmu. Anti error server!\\n\\n_Disclaimer: Hanya untuk Have Fun / Prank!_\`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[fakedana-lokal] error:", err);
    await m.reply(\`?O Gagal memproses canvas lokal:\\n\${err.message || err}\`);
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
`;

fs.writeFileSync('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js', ktpCode, 'utf8');
fs.writeFileSync('C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakedana.js', danaCode, 'utf8');
console.log('Rewritten everything cleanly!');

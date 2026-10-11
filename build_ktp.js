const fs = require('fs');
const path = 'C:/Users/ACER NITRO/Downloads/Hiyuki-AI-21-09-26-1789982840727/plugins/canvas/fakektp.js';

const newCode = `
// plugins/ektp.js
import { createCanvas, loadImage } from 'canvas';

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

    // TATA LETAK CANVAS
    const width = 900;
    const height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background Gradient (Tema Niwo Bot / Dark Cyberpunk)
    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, '#0f172a');
    grd.addColorStop(1, '#1e293b');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    // Header Accent Line
    const accent = ctx.createLinearGradient(0, 0, width, 0);
    accent.addColorStop(0, '#3b82f6');
    accent.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, 18);
    ctx.fillRect(0, height - 18, width, 18);

    // Judul Header
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(\`PROVINSI \${data.provinsi.toUpperCase()}\`, width / 2, 60);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(\`KOTA \${data.kota.toUpperCase()}\`, width / 2, 95);

    // Pas Foto
    try {
      if (/^https?:\\/\\//.test(data.pas_photo)) {
        const photo = await loadImage(data.pas_photo);
        ctx.drawImage(photo, 40, 130, 200, 280);
      } else {
        throw new Error('Not an image URL');
      }
    } catch (e) {
      // Fallback kalo foto error/mati
      ctx.fillStyle = '#334155';
      ctx.fillRect(40, 130, 200, 280);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FOTO ERROR', 140, 270);
    }

    // NIK Box
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(\`NIK : \${data.nik}\`, 280, 150);

    // Garis Bawah NIK
    ctx.fillStyle = '#334155';
    ctx.fillRect(280, 165, 580, 2);

    // Render Data Teks
    ctx.font = '18px sans-serif';
    let y = 200;
    const spacing = 32;
    const xLabel = 280;
    const xTitik = 460;
    const xValue = 480;

    const drawLine = (label, val) => {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(label, xLabel, y);
      ctx.fillText(':', xTitik, y);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(val.length > 35 ? val.substring(0, 35) + '...' : val, xValue, y);
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

    // Tanda Tangan & Cap Jempol Area
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.kota, 750, 440);
    ctx.fillText(data.terbuat, 750, 460);
    ctx.fillStyle = '#475569';
    ctx.fillRect(700, 470, 100, 2); 
    ctx.fillText('Niwo Bot Auth', 750, 490);

    const buffer = canvas.toBuffer('image/png');

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: \`dY *NIWO ID CARD GENERATED!*\\n\\nIni dibuat murni secara \`\`\`offline\`\`\` pakai Canvas mesin laptopmu, tanpa butuh internet ke API orang lain!\`,
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

fs.writeFileSync(path, newCode, 'utf8');
console.log('fakektp.js rewritten for offline canvas!');

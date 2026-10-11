// plugins/store/editlist.js
import { getDatabase } from "../../src/lib/database.js";
import axios from "axios";
import FormData from "form-data";

const config = {
  name: "editlist",
  alias: ["editinfo"],
  category: "store",
  description: "✏️ Edit informasi toko (hanya di private chat)",
  usage: ".editlist <nomor> <field> <nilai>",
  example: ".editlist 1 isi Konten baru di sini",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true
};

async function uploadToCatbox(buffer, filename = "file.jpg") {
  try {
    const form = new FormData();
    form.append("fileToUpload", buffer, { filename });
    form.append("reqtype", "fileupload");
    const res = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    return typeof res.data === "string" && res.data.startsWith("http") ? res.data.trim() : null;
  } catch (error) {
    console.error("[EditList] Catbox:", error?.message || error);
    return null;
  }
}

async function handler(m, { sock }) {
  if (m.isGroup) {
    return m.reply(
      `🚫 *Akses Ditolak*\n\n` +
      `Untuk menjaga keamanan data 🛡️, pengeditan informasi hanya dapat dilakukan di *private chat*.\n\n` +
      `Silakan chat bot secara langsung 📱`
    );
  }

  const db = getDatabase();
  const lists = Array.isArray(db.setting("storeLists")) ? db.setting("storeLists") : [];

  if (lists.length === 0) {
    return m.reply(`📭 *Belum ada informasi.*\n\nTambahkan informasi terlebih dahulu: \`${m.prefix}addlist\` ➕`);
  }

  const text = String(m.text || "").trim();
  const match = text.match(/^(\d+)\s+(nama|isi|deskripsi|gambar|video)\s*(.*)$/i);

  if (!match) {
    return m.reply(
      `✏️ *EDIT INFORMASI TOKO*\n\n` +
      `📋 Format: \`${m.prefix}editlist <nomor> <field> <nilai>\`\n\n` +
      `📌 *Field yang bisa diedit:*\n` +
      `• *nama* 🏷️ — Judul informasi\n` +
      `• *isi* 📝 — Konten informasi (gunakan \`;;\` untuk baris baru)\n` +
      `• *deskripsi* 📋 — Deskripsi singkat\n` +
      `• *gambar* 🖼️ — Upload gambar baru (reply gambar)\n` +
      `• *video* 🎬 — Upload video baru (reply video)\n\n` +
      `📝 *Contoh:*\n` +
      `\`${m.prefix}editlist 1 isi Syarat baru;;Ketentuan baru\`\n` +
      `\`${m.prefix}editlist 1 nama FAQ Pembayaran\`\n` +
      `\`${m.prefix}editlist 1 gambar\` (reply gambar 🖼️)\n\n` +
      `_Gunakan \`;;\` untuk baris baru dalam isi_ ✍️`
    );
  }

  const idx = Number.parseInt(match[1], 10) - 1;
  const field = match[2].toLowerCase();
  const value = String(match[3] || "").trim();

  if (idx < 0 || idx >= lists.length) {
    return m.reply(`❌ *Nomor tidak valid.*\n\nRentang: 1-${lists.length} 📋`);
  }

  const item = lists[idx];

  switch (field) {
    case "nama": {
      if (!value || value.length < 2) {
        return m.reply(`❌ *Nama terlalu pendek.* Minimal 2 karakter 🏷️`);
      }
      item.name = value;
      break;
    }

    case "isi": {
      if (!value || value.length < 3) {
        return m.reply(`❌ *Isi terlalu pendek.* Minimal 3 karakter 📝`);
      }
      item.content = value.replace(/;;/g, "\n");
      item.description = item.content.substring(0, 80).replace(/\n/g, " ");
      break;
    }

    case "deskripsi": {
      if (!value) {
        return m.reply(`❌ *Deskripsi tidak boleh kosong.* 📋`);
      }
      item.description = value.replace(/;;/g, " ");
      break;
    }

    case "gambar": {
      const quotedType = m.quoted?.type || m.quoted?.mtype;
      const hasMedia = !!m.quoted?.isMedia && (m.quoted?.isImage || quotedType === "imageMessage");
      const isDirectImage = !!m.isImage || m.type === "imageMessage" || !!m.message?.imageMessage;

      if (!hasMedia && !isDirectImage) {
        return m.reply(`🖼️ *Reply atau kirim gambar baru.*\n\nKirim gambar lalu reply dengan command ini.`);
      }

      await m.reply(`⏳ _Mengunggah gambar..._`);

      try {
        const buffer = hasMedia ? await m.quoted.download() : await m.download();
        if (!buffer?.length) return m.reply(`❌ *Gambar tidak dapat dibaca.* Coba lagi nanti 🖼️`);

        const url = await uploadToCatbox(buffer, "image.jpg");
        if (!url) return m.reply(`❌ *Gagal mengunggah gambar.* Coba lagi nanti 🖼️`);

        item.image = url;
        item.video = null;
      } catch (error) {
        console.error("[EditList] Image:", error?.message || error);
        return m.reply(`❌ *Gagal mengunggah gambar.* Coba lagi nanti 🖼️`);
      }
      break;
    }

    case "video": {
      const quotedType = m.quoted?.type || m.quoted?.mtype;
      const hasMedia = !!m.quoted?.isMedia && (m.quoted?.isVideo || quotedType === "videoMessage");
      const isDirectVideo = !!m.isVideo || m.type === "videoMessage" || !!m.message?.videoMessage;

      if (!hasMedia && !isDirectVideo) {
        return m.reply(`🎬 *Reply atau kirim video baru.*\n\nKirim video lalu reply dengan command ini.`);
      }

      await m.reply(`⏳ _Mengunggah video..._`);

      try {
        const buffer = hasMedia ? await m.quoted.download() : await m.download();
        if (!buffer?.length) return m.reply(`❌ *Video tidak dapat dibaca.* Coba lagi nanti 🎬`);

        const url = await uploadToCatbox(buffer, "video.mp4");
        if (!url) return m.reply(`❌ *Gagal mengunggah video.* Coba lagi nanti 🎬`);

        item.video = url;
        item.image = null;
      } catch (error) {
        console.error("[EditList] Video:", error?.message || error);
        return m.reply(`❌ *Gagal mengunggah video.* Coba lagi nanti 🎬`);
      }
      break;
    }

    default:
      return m.reply(`❌ *Field tidak dikenali.*\n\nGunakan: nama, isi, deskripsi, gambar, video 📋`);
  }

  db.setting("storeLists", lists);
  await m.react("✅");

  let reply = `✅ *INFORMASI DIPERBARUI*\n\n`;
  reply += `🏷️ Nama: *${item.name}*\n`;

  if (field === "isi") reply += `📝 Isi:\n${item.content}\n`;
  if (field === "deskripsi") reply += `📋 Deskripsi: _${item.description}_\n`;
  if (field === "gambar") reply += `🖼️ Gambar: ✅\n`;
  if (field === "video") reply += `🎬 Video: ✅\n`;

  reply += `\n👀 _Lihat perubahan: \`${m.prefix}list\`_`;
  return m.reply(reply);
}

export default {
  config,
  handler
};
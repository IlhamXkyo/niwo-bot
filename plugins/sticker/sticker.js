// plugins/sticker/sticker.js : NIWO BOT
// .sticker / .s / .stiker : ubah foto, video, atau stiker jadi stiker WebP

import stickerLib from "../../esmlib/sticker.js";

const config = {
  name: "sticker",
  alias: ["s", "stiker", "stickervid", "stickerimg"],
  category: "sticker",
  description: "Ubah foto/video/stiker jadi stiker WhatsApp",
  usage: ".sticker (reply foto/video/stiker) [packname|author]",
  example: ".sticker niwo bot|ilham",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function pickTarget(m) {
  if (m.quoted && (m.quoted.isImage || m.quoted.isVideo || m.quoted.isSticker || /image|video|sticker/.test(m.quoted.mtype || ""))) {
    return m.quoted;
  }
  if (m.isImage || m.isVideo || m.isSticker || /image|video|sticker/.test(m.mtype || "")) {
    return m;
  }
  return null;
}

async function handler(m, { sock, text }) {
  const target = pickTarget(m);

  if (!target) {
    return m.reply(
      `🖼️ *STICKER MAKER*\n\n` +
        `Reply foto, video (maks ±7 detik), atau stiker dengan caption *${m.prefix}sticker*.\n` +
        `Bisa juga kirim langsung foto/video pakai caption *${m.prefix}sticker*.\n\n` +
        `Custom nama pack: *${m.prefix}sticker Nama Pack|Nama Author*`,
    );
  }

  await m.react("🕐");

  try {
    let buffer = null;

    if (m.quoted && typeof m.quoted.download === "function") {
      try { buffer = await m.quoted.download(); } catch (err) {
        console.error("[STICKER] quoted download error:", err.message);
      }
    }

    if (!buffer && typeof m.download === "function") {
      try { buffer = await m.download(); } catch (err) {
        console.error("[STICKER] direct download error:", err.message);
      }
    }

    if (!buffer && typeof m.resolveMediaTarget === "function") {
      try { buffer = await m.resolveMediaTarget(); } catch (err) {}
    }

    if (!buffer || !buffer.length) {
      throw new Error("Gagal mengambil media. Pastikan reply foto/video yang masih aktif.");
    }

    if (buffer.length > MAX_SOURCE_BYTES) {
      throw new Error("Media terlalu besar untuk dijadikan sticker (maks 20MB).");
    }

    const [packName, author] = String(text || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

    const isVideo = Boolean(
      target.isVideo ||
      target.mtype === "videoMessage" ||
      /video/.test(target.mimetype || "")
    );

    const webp = await stickerLib.writeExif(
      { data: buffer, type: isVideo ? "video" : "image" },
      {
        packName: packName || "niwo bot",
        packPublish: author || "ilham",
      },
    );

    await sock.sendMessage(m.chat, { sticker: webp }, { quoted: m.raw || m });
    await m.react("✅");
  } catch (error) {
    await m.react("❌");
    console.error("[STICKER ERROR]", error);
    await m.reply(`❌ Gagal bikin sticker.\n> ${error?.message || "Unknown error"}`);
  }
}

export default { config, handler };

// plugins/tools/rvo.js
// NIWO BOT : READ VIEW ONCE

const config = {
  name: "readvo",
  alias: ["readviewonce", "readview"],
  category: "tools",
  description: "Baca pesan sekali lihat (view once)",
  usage: ".rvo (reply pesan view once)",
  example: ".rvo",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

function getQuotedMessageType(quoted) {
  return String(
    quoted?.type ||
      quoted?.mtype ||
      Object.keys(quoted?.message || {})[0] ||
      ""
  );
}

function getCaption(quoted) {
  const type = getQuotedMessageType(quoted);
  const content = quoted?.message?.[type];

  return String(
    content?.caption ||
      quoted?.caption ||
      quoted?.body ||
      ""
  ).trim();
}

function getMimeType(quoted) {
  const type = getQuotedMessageType(quoted);
  const content = quoted?.message?.[type];

  return (
    content?.mimetype ||
    quoted?.mimetype ||
    "application/octet-stream"
  );
}

function isImage(quoted) {
  const type = getQuotedMessageType(quoted).toLowerCase();
  return Boolean(
    quoted?.isImage ||
      type.includes("image") ||
      getMimeType(quoted).startsWith("image/")
  );
}

function isVideo(quoted) {
  const type = getQuotedMessageType(quoted).toLowerCase();
  return Boolean(
    quoted?.isVideo ||
      type.includes("video") ||
      getMimeType(quoted).startsWith("video/")
  );
}

function isAudio(quoted) {
  const type = getQuotedMessageType(quoted).toLowerCase();
  return Boolean(
    quoted?.isAudio ||
      type.includes("audio") ||
      getMimeType(quoted).startsWith("audio/")
  );
}

function isViewOnce(quoted) {
  const type = getQuotedMessageType(quoted).toLowerCase();

  return Boolean(
    quoted?.isViewOnce ||
      quoted?.viewOnce ||
      type.includes("viewonce") ||
      quoted?.message?.viewOnceMessage ||
      quoted?.message?.viewOnceMessageV2 ||
      quoted?.message?.viewOnceMessageV2Extension
  );
}

function getExtension(mime, type) {
  const cleanMime = String(mime || "").split(";")[0].toLowerCase();

  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "application/pdf": "pdf",
  };

  if (map[cleanMime]) return map[cleanMime];

  const t = String(type || "")
    .replace(/Message$/i, "")
    .replace(/[^a-z0-9]/gi, "");

  return t || "bin";
}

async function handler(m, { sock }) {
  const quoted = m?.quoted;

  if (!quoted) {
    return m.reply(
      `Reply pesan sekali lihat (view once) untuk membukanya.\n\n` +
      `Contoh: ${m?.prefix || "."}rvo`
    );
  }

  if (!isViewOnce(quoted) && !quoted?.isMedia) {
    return m.reply(
      "❌ Reply pesan view once (sekali lihat) untuk membukanya."
    );
  }

  await m.react?.("⏱️");

  try {
    if (typeof quoted.download !== "function") {
      throw new Error("Fitur download media tidak tersedia.");
    }

    const buffer = await quoted.download();

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("Gagal download media.");
    }

    const captionText = getCaption(quoted);
    const caption = captionText
      ? `\`Pesan :\`\n> ${captionText}`
      : "";

    const mime = getMimeType(quoted);
    const type = getQuotedMessageType(quoted);

    if (isImage(quoted)) {
      await sock.sendMessage(
        m.chat,
        {
          image: buffer,
          caption,
        },
        { quoted: m }
      );
    } else if (isVideo(quoted)) {
      await sock.sendMessage(
        m.chat,
        {
          video: buffer,
          caption,
        },
        { quoted: m }
      );
    } else if (isAudio(quoted)) {
      await sock.sendMessage(
        m.chat,
        {
          audio: buffer,
          mimetype: mime || "audio/mpeg",
        },
        { quoted: m }
      );
    } else {
      const ext = getExtension(mime, type);

      await sock.sendMessage(
        m.chat,
        {
          document: buffer,
          fileName: `rvo_${Date.now()}.${ext}`,
          mimetype: mime,
          caption: caption || "📎 View once media",
        },
        { quoted: m }
      );
    }

    await m.react?.("✅");
  } catch (e) {
    console.error("[RVO]", e);

    await m.react?.("❌");

    let msg = String(e?.message || e || "Unknown error");

    const lower = msg.toLowerCase();

    if (
      lower.includes("gagal download") ||
      lower.includes("decrypt") ||
      lower.includes("download") ||
      lower.includes("timeout") ||
      lower.includes("404") ||
      lower.includes("gone") ||
      lower.includes("media") &&
        lower.includes("expired")
    ) {
      msg =
        "Media sudah kadaluarsa atau sudah tidak tersedia dari server WhatsApp.";
    }

    return m.reply(
      `❌ *Gagal Membuka View Once*\n\n> ${msg}`
    );
  }
}

export default {
  config,
  handler,
};
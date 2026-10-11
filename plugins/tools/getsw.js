// plugins/tools/getsw.js
// NIWO BOT : GET STATUS (ambil ulang status/pesan yang di-reply)

const config = {
  name: "getsw",
  alias: ["getstatus", "savestatus"],
  category: "tools",
  description: "Ambil ulang status WhatsApp / pesan grup yang di-reply.",
  usage: ".getsw (reply status/pesan)",
  example: ".getsw",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const quoted = m.quoted;

  if (!quoted) {
    return m.reply("Reply status atau pesan yang mau diambil dengan perintah ini.");
  }

  if (quoted.isImage === false && quoted.isVideo === false && quoted.isAudio === false && !quoted.isMedia) {
    const text = quoted.text || quoted.body || quoted.caption || "";
    if (!text) return m.reply("Quoted kosong / tidak didukung.");
    return sock.sendMessage(m.chat, { text }, { quoted: m });
  }

  await m.react("⏳");

  try {
    if (typeof quoted.download !== "function") {
      throw new Error("Media tidak dapat diunduh.");
    }

    const buffer = await quoted.download();
    if (!buffer || !buffer.length) throw new Error("Gagal mengunduh media.");

    if (quoted.isImage) {
      await sock.sendMessage(m.chat, { image: buffer }, { quoted: m });
    } else if (quoted.isVideo) {
      await sock.sendMessage(m.chat, { video: buffer }, { quoted: m });
    } else if (quoted.isAudio) {
      await sock.sendMessage(
        m.chat,
        { audio: buffer, mimetype: "audio/mp4", ptt: false },
        { quoted: m }
      );
    } else {
      await sock.sendMessage(
        m.chat,
        { document: buffer, fileName: `getsw_${Date.now()}`, mimetype: quoted.mimetype || "application/octet-stream" },
        { quoted: m }
      );
    }

    await m.react("✅");
  } catch (error) {
    console.error("[GETSW]", error);
    await m.react("❌");
    await m.reply(`❌ Gagal mengambil status.\n> ${error?.message || "Unknown error"}`);
  }
}

export default { config, handler };

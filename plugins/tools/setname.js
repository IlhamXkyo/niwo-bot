// plugins/tools/setname.js
// NIWO BOT : SET NAMA BOT

const config = {
  name: "setname",
  alias: ["setnamebot", "setbotnama"],
  category: "tools",
  description: "Mengubah nama profil bot",
  usage: ".setname <nama baru>",
  example: ".setname NIWO BOT",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function getText(m) {
  const text = String(
    m?.text ??
    m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    ""
  ).trim();

  if (!text) return "";

  const prefix = String(m?.prefix || ".");

  const regex = new RegExp(
    `^${escapeRegex(prefix)}(?:setname|setnamebot|setbotnama)(?:\\s+|$)`,
    "i"
  );

  return text.replace(regex, "").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function handler(m, { sock }) {
  const newName = getText(m);

  if (!newName) {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> \`${m?.prefix || "."}setname Nama Bot Baru\``
    );
  }

  if (newName.length < 1 || newName.length > 25) {
    return m.reply(
      `⚠️ *ᴠᴀʟɪᴅᴀsɪ*\n\n` +
      `> Nama bot harus 1-25 karakter.\n` +
      `> Panjang nama: *${newName.length}/25*`
    );
  }

  if (typeof sock?.updateProfileName !== "function") {
    return m.reply(
      `❌ *GAGAL*\n\n` +
      `> Method \`updateProfileName\` tidak tersedia pada koneksi bot.`
    );
  }

  await m.react?.("⏳");

  try {
    await sock.updateProfileName(newName);

    await m.react?.("✅");

    return m.reply(
      `✅ *ɴᴀᴍᴀ ʙᴏᴛ ᴅɪᴜʙᴀʜ*\n\n` +
      `> Nama bot sekarang: *${newName}*`
    );
  } catch (error) {
    console.error("[SETNAME]", error);

    await m.react?.("❌");

    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> Tidak dapat mengubah nama bot.\n` +
      `> _${error?.message || "Terjadi kesalahan."}_`
    );
  }
}

export default {
  config,
  handler,
};
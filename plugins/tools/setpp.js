// plugins/tools/setpp.js
// NIWO BOT : SET FOTO PROFIL BOT

const config = {
  name: "setpp",
  alias: ["setprofilebot", "setppbot", "setfotobot"],
  category: "tools",
  description: "Mengubah foto profil bot",
  usage: ".setpp (reply gambar)",
  example: ".setpp",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

function isImageMessage(m) {
  return Boolean(
    m?.isImage ||
    m?.mtype === "imageMessage" ||
    m?.type === "imageMessage" ||
    m?.message?.imageMessage ||
    m?.msg?.mimetype?.startsWith("image/")
  );
}

async function handler(m, { sock }) {
  let buffer = null;

  // Reply gambar
  if (m?.quoted && isImageMessage(m.quoted)) {
    try {
      if (typeof m.quoted.download !== "function") {
        throw new Error("Method download tidak tersedia.");
      }

      buffer = await m.quoted.download();
    } catch (error) {
      console.error("[SETPP] Download quoted:", error);
      return m.reply("❌ Gagal mengambil gambar.");
    }
  }

  // Gambar langsung + caption .setpp
  if (!buffer && isImageMessage(m)) {
    try {
      if (typeof m.download !== "function") {
        throw new Error("Method download tidak tersedia.");
      }

      buffer = await m.download();
    } catch (error) {
      console.error("[SETPP] Download message:", error);
      return m.reply("❌ Gagal mengambil gambar.");
    }
  }

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> Reply gambar + \`${m?.prefix || "."}setpp\`\n` +
      `> Kirim gambar + caption \`${m?.prefix || "."}setpp\``
    );
  }

  if (typeof sock?.updateProfilePicture !== "function") {
    return m.reply(
      `❌ *GAGAL*\n\n` +
      `> Method \`updateProfilePicture\` tidak tersedia pada koneksi bot.`
    );
  }

  const botJid = sock?.user?.id;

  if (!botJid) {
    return m.reply("❌ Bot JID tidak ditemukan.");
  }

  await m.react?.("⏳");

  try {
    await sock.updateProfilePicture(botJid, buffer);

    await m.react?.("✅");

    return m.reply(
      `✅ *ᴘᴘ ʙᴏᴛ ᴅɪᴜʙᴀʜ*\n\n` +
      `> Foto profil bot berhasil diperbarui!`
    );
  } catch (error) {
    console.error("[SETPP]", error);

    await m.react?.("❌");

    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> Tidak dapat mengubah foto bot.\n` +
      `> _${error?.message || "Terjadi kesalahan."}_`
    );
  }
}

export default {
  config,
  handler,
};
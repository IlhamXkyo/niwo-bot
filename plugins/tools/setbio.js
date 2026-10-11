// plugins/tools/setbio.js
// NIWO BOT : SET BIO BOT

const config = {
  name: "setbio",
  alias: ["setbiobot", "setstatus", "setabout"],
  category: "tools",
  description: "Mengubah bio/status bot",
  usage: ".setbio <bio baru>",
  example: ".setbio Bot WhatsApp by Lucky Archz",
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
    `^${escapeRegex(prefix)}(?:setbio|setbiobot|setstatus|setabout)(?:\\s+|$)`,
    "i"
  );

  return text.replace(regex, "").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function handler(m, { sock }) {
  const newBio = getText(m);

  if (!newBio) {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> \`${m?.prefix || "."}setbio Bio bot baru\`\n` +
      `> \`${m?.prefix || "."}setbio clear\` - Hapus bio`
    );
  }

  const bioToSet =
    newBio.toLowerCase() === "clear"
      ? ""
      : newBio;

  if (bioToSet.length > 139) {
    return m.reply(
      `⚠️ *ᴠᴀʟɪᴅᴀsɪ*\n\n` +
      `> Bio maksimal 139 karakter.\n` +
      `> Panjang bio: *${bioToSet.length}/139*`
    );
  }

  if (typeof sock?.updateProfileStatus !== "function") {
    return m.reply(
      `❌ *GAGAL*\n\n` +
      `> Method \`updateProfileStatus\` tidak tersedia pada koneksi bot.`
    );
  }

  await m.react?.("⏳");

  try {
    await sock.updateProfileStatus(bioToSet);

    await m.react?.("✅");

    if (bioToSet) {
      return m.reply(
        `✅ *ʙɪᴏ ʙᴏᴛ ᴅɪᴜʙᴀʜ*\n\n` +
        `> Bio bot sekarang:\n` +
        `> _${bioToSet}_`
      );
    }

    return m.reply(
      `✅ *ʙɪᴏ ʙᴏᴛ ᴅɪʜᴀᴘᴜs*\n\n` +
      `> Bio bot berhasil dihapus!`
    );
  } catch (error) {
    console.error("[SETBIO]", error);

    await m.react?.("❌");

    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> Tidak dapat mengubah bio bot.\n` +
      `> _${error?.message || "Terjadi kesalahan."}_`
    );
  }
}

export default {
  config,
  handler,
};
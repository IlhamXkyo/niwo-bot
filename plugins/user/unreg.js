import { getDatabase } from "../../src/lib/database.js";
import appConfig from "../../config.js";
const config = {
  name: "unreg",
  alias: ["unregister", "hapusdaftar"],
  category: "user",
  description: "Hapus data pendaftaran kamu dari bot",
  usage: ".unreg",
  example: ".unreg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user?.isRegistered) {
    return m.reply(
      `❌ Kamu belum terdaftar!\n\n` + `> Daftar dengan \`${m.prefix}daftar\``,
    );
  }

  const saluranId = appConfig.saluran?.id || "120363427915199733@newsletter";
  const saluranName = appConfig.saluran?.name || appConfig.bot?.name || appConfig.botName || "Niwo Bot";
  const unregisteredAt = new Date().toISOString();

  db.setUser(m.sender, {
    isRegistered: false,
    regName: null,
    regAge: null,
    regGender: null,
    unregisteredAt,
  });

  await db.save();

  await sock.sendMessage(
    m.chat,
    {
      text:
        `✅ *ᴜɴʀᴇɢɪsᴛᴇʀ ʙᴇʀʜᴀsɪʟ!*\n\n` +
        `Data pendaftaran kamu sudah dihapus.\n\n` +
        `> Untuk daftar ulang: \`${m.prefix}daftar\``,
      contextInfo: {
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: saluranId,
          newsletterName: saluranName,
          serverMessageId: 127,
        },
      },
    },
    { quoted: m },
  );

  m.react("✅");
}

export default { config, handler };

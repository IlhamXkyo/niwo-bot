import fs from "fs";
import { createBackup, removeBackup } from "../../src/lib/backup.js";

const config = {
  name: "backup",
  alias: ["backupsc", "bck"],
  category: "owner",
  description: "Backup script bot menjadi file ZIP",
  usage: ".backup",
  example: ".backup",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true
};

async function handler(m, { sock, config: botConfig }) {
  let backup = null;
  try {
    await m.reply("📦 *BACKUP SCRIPT*\n\nSedang membuat backup, tunggu sebentar...");
    const botName = botConfig?.botName || botConfig?.bot?.name || "Niwo Bot";
    backup = await createBackup(botName);

    await sock.sendMessage(
      m.sender,
      {
        document: fs.readFileSync(backup.zipPath),
        fileName: backup.fileName,
        mimetype: "application/zip",
        caption:
          `✅ *BACKUP BERHASIL*\n\n` +
          `〄 Bot : ${botName}\n` +
          `〄 File : ${backup.fileName}\n` +
          `〄 Jumlah : ${backup.count} file\n` +
          `〄 Tanggal : ${backup.date}`
      },
      { quoted: m.raw || m.verifiedQuoted || m }
    );

    if (m.chat !== m.sender) {
      await m.reply("✅ Backup berhasil dibuat dan dikirim ke Private Chat.");
    }
  } catch (err) {
    console.error("[BACKUP ERROR]", err);
    await m.reply(`❌ *BACKUP GAGAL*\n\n${err?.message || err}`);
  } finally {
    if (backup?.zipPath) removeBackup(backup.zipPath);
  }
}

export default { config, handler };

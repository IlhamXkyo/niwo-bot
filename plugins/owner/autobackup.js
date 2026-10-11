import { startAutoBackup, triggerAutoBackupNow, getAutoBackupStatus } from "../../src/lib/autoBackup.js";

const config = {
  name: "autobackup",
  alias: ["autobck", "backupauto"],
  category: "owner",
  description: "Mengatur backup otomatis script bot",
  usage: ".autobackup <on|off|status|now|jam>",
  example: ".autobackup on",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 2,
  energi: 0,
  isEnabled: true
};

async function handler(m, { sock, config: botConfig, db }) {
  const arg = String(m.args?.[0] || "status").toLowerCase();
  const current = getAutoBackupStatus(db);

  if (arg === "on") {
    const hours = Math.max(1, Math.min(168, Number(m.args?.[1]) || current.hours));
    db.setSetting("autoBackupEnabled", true);
    db.setSetting("autoBackupHours", hours);
    startAutoBackup(sock, botConfig, db);
    return m.reply(
      `✅ *AUTO BACKUP AKTIF*\n\n` +
      `〄 Interval : *${hours} jam*\n` +
      `〄 Tujuan   : *Private Chat Owner*\n\n` +
      `Backup pertama otomatis berjalan setelah interval tercapai.\n` +
      `Gunakan *${m.prefix}autobackup now* untuk backup sekarang.`
    );
  }

  if (arg === "off") {
    db.setSetting("autoBackupEnabled", false);
    startAutoBackup(sock, botConfig, db);
    return m.reply("❌ *AUTO BACKUP DIMATIKAN*\n\nBackup otomatis tidak akan berjalan lagi.");
  }

  if (arg === "now") {
    await m.reply("📦 Membuat backup otomatis sekarang...");
    const wasEnabled = current.enabled;

    if (!wasEnabled) db.setSetting("autoBackupEnabled", true);

    try {
      await triggerAutoBackupNow(sock, botConfig, db);
    } finally {
      // Kalau sebelumnya OFF, jangan sampai tetap ON ketika backup gagal.
      if (!wasEnabled) db.setSetting("autoBackupEnabled", false);
    }

    return m.reply("✅ Backup sekarang sudah diproses dan dikirim ke Private Chat Owner.");
  }

  if (/^\d+$/.test(arg)) {
    const hours = Math.max(1, Math.min(168, Number(arg)));
    db.setSetting("autoBackupEnabled", true);
    db.setSetting("autoBackupHours", hours);
    startAutoBackup(sock, botConfig, db);
    return m.reply(`✅ Interval Auto Backup diubah menjadi *${hours} jam*.`);
  }

  const status = getAutoBackupStatus(db);
  const last = status.last ? new Date(status.last).toLocaleString("id-ID") : "Belum pernah";
  return m.reply(
    `━━● 〔 *AUTO BACKUP* 〕 ●━━\n\n` +
    `〄 Status   : *${status.enabled ? "AKTIF" : "NONAKTIF"}*\n` +
    `〄 Interval : *${status.hours} jam*\n` +
    `〄 Terakhir : *${last}*\n\n` +
    `〄 ${m.prefix}autobackup on [jam]\n` +
    `〄 ${m.prefix}autobackup off\n` +
    `〄 ${m.prefix}autobackup status\n` +
    `〄 ${m.prefix}autobackup now`
  );
}

export default { config, handler };

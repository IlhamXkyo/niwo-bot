import fs from "fs";
import { createBackup, removeBackup } from "./backup.js";

let timer = null;
let currentSock = null;
let currentConfig = null;
let currentDb = null;

function normalizeNumber(value) {
  const n = String(value || "").replace(/[^0-9]/g, "");
  return n ? `${n}@s.whatsapp.net` : "";
}

function getOwnerJid(config) {
  const owners = config?.owner?.number;
  const first = Array.isArray(owners) ? owners[0] : owners;
  return normalizeNumber(first);
}

export function getAutoBackupStatus(db) {
  return {
    enabled: Boolean(db?.setting?.("autoBackupEnabled", false)),
    hours: Math.max(1, Number(db?.setting?.("autoBackupHours", 6)) || 6),
    last: db?.setting?.("autoBackupLast", null)
  };
}

async function runBackup() {
  if (!currentSock || !currentConfig || !currentDb) return;
  const status = getAutoBackupStatus(currentDb);
  if (!status.enabled) return;

  let backup = null;
  try {
    const botName = currentConfig?.botName || currentConfig?.bot?.name || "Niwo Bot";
    backup = await createBackup(botName);
    const ownerJid = getOwnerJid(currentConfig);
    if (!ownerJid) throw new Error("Nomor owner di config.js belum tersedia.");

    await currentSock.sendMessage(ownerJid, {
      document: fs.readFileSync(backup.zipPath),
      fileName: backup.fileName,
      mimetype: "application/zip",
      caption:
        `〄 *AUTO BACKUP BERHASIL*\n\n` +
        `〄 Bot : ${botName}\n` +
        `〄 File : ${backup.fileName}\n` +
        `〄 Jumlah : ${backup.count} file\n` +
        `〄 Interval : ${status.hours} jam`
    });

    currentDb.setSetting("autoBackupLast", new Date().toISOString());
    console.log(`[autoBackup] Backup berhasil dikirim ke ${ownerJid}`);
  } catch (err) {
    console.error("[autoBackup] Gagal:", err?.message || err);
  } finally {
    if (backup?.zipPath) removeBackup(backup.zipPath);
  }
}

export function startAutoBackup(sock, config, db) {
  currentSock = sock;
  currentConfig = config;
  currentDb = db;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  const status = getAutoBackupStatus(db);
  if (!status.enabled) return;

  const intervalMs = status.hours * 60 * 60 * 1000;
  timer = setInterval(runBackup, intervalMs);
  timer.unref?.();
  console.log(`[autoBackup] Aktif : setiap ${status.hours} jam.`);
}

export async function triggerAutoBackupNow(sock, config, db) {
  currentSock = sock;
  currentConfig = config;
  currentDb = db;
  await runBackup();
}


const WM = "NIWO BOT\n\n";
const sendReply = (m, text, ...args) => m?.reply?.(typeof text === "string" ? WM + text : text, ...args);
const te = (prefix = ".", command = "command", name = "user") => `❌ Terjadi kesalahan saat menjalankan *${command || "fitur"}*.\n> Silakan coba lagi.`;
const saluranCtx = () => ({});
const isLid = jid => String(jid || "").endsWith("@lid");
const isLidConverted = jid => String(jid || "").includes("@s.whatsapp.net");
const lidToJid = jid => String(jid || "").replace("@lid", "@s.whatsapp.net");
const getParticipantJid = p => p?.jid || p?.id || p?.participant || p;
const getParticipantJids = list => (list || []).map(getParticipantJid).filter(Boolean);
const resolveAnyLidToJid = (jid, participants = []) => {
  const raw = String(jid || "");
  const found = (participants || []).find(p => String(p?.lid || p?.id || p?.jid || "") === raw);
  return getParticipantJid(found) || raw;
};
const findParticipantByNumber = (participants = [], number = "") => {
  const n = String(number || "").replace(/\D/g, "");
  return (participants || []).find(p => String(getParticipantJid(p) || "").replace(/\D/g, "").endsWith(n));
};
const _lidCache = global.__niwoLidCache ||= new Map();
const cacheParticipantLids = participants => (participants || []).forEach(p => {
  const jid = getParticipantJid(p);
  if (p?.lid && jid) _lidCache.set(String(p.lid), jid);
});
const getCachedJid = jid => _lidCache.get(String(jid)) || null;
const getAssetBuffer = () => null;
const createWideDiscordCard = async () => null;
const createGoodbyeCard = async (user, ppUrl) => ppUrl || null;
const getPlugin = command => {
  const plugins = global.plugins || globalThis.plugins || {};
  return Object.values(plugins).find(p => {
    const c = p?.config || p;
    const names = [c?.name, ...(c?.alias || [])].flat().map(x => String(x).toLowerCase());
    return names.includes(String(command || "").toLowerCase());
  }) || null;
};
const stickerStore = global.__niwoStickerStore ||= {};
const readStickerStore = () => stickerStore;
const writeStickerStore = data => Object.assign(stickerStore, data);
const getQuotedStickerHash = m => {
  const q = m?.quoted;
  const h = q?.msg?.fileSha256 || q?.fileSha256 || q?.message?.stickerMessage?.fileSha256;
  return h ? Buffer.from(h).toString("base64") : null;
};
const listStickerCommands = () => Object.entries(readStickerStore()).map(([hash, value]) => ({ hash, ...value }));
const addStickerCommand = (hash, command, creator) => {
  if (!hash || !command) return false;
  const d = readStickerStore(); d[hash] = { command, creator, createdAt: Date.now() }; writeStickerStore(d); return true;
};
const deleteStickerCommand = hash => {
  const d = readStickerStore(); if (!d[hash]) return false; delete d[hash]; writeStickerStore(d); return true;
};
const findByCommand = command => listStickerCommands().find(x => String(x.command).toLowerCase() === String(command).toLowerCase()) || null;
const fromTimestamp = (ts, format = "DD/MM/YYYY HH:mm") => {
  try { return new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(ts)); } catch { return new Date(ts).toLocaleString("id-ID"); }
};
const fetchGroupsSafe = async sock => {
  try {
    const all = await sock.groupFetchAllParticipating();
    return Object.entries(all || {}).map(([id, g]) => ({ id, ...g }));
  } catch { return []; }
};
const timeHelper = { fromTimestamp };

import { getDatabase } from "../../src/lib/database.js";
import appConfig from "../../appConfig.js";
const config = {
  name: "publicthisgc",
  alias: ["publicgc", "publicgroup", "publicthisgroup"],
  category: "group",
  description: "Aktifkan mode public hanya di grup ini",
  usage: ".publicthisgc",
  example: ".publicthisgc",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const db = getDatabase();
  const selfGroups = db.setting("selfGroups") || [];
  const publicGroups = db.setting("publicGroups") || [];

  const isSelfGroup = selfGroups.includes(m.chat);
  const isPublicGroup = publicGroups.includes(m.chat);

  if (isPublicGroup && !isSelfGroup) {
    return sendReply(m, 
      `ℹ️ *ɢʀᴜᴘ ɪɴɪ sᴜᴅᴀʜ ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ*\n\n` +
        `> Bot merespon semua member di grup ini\n\n` +
        `_Gunakan ${m.prefix}selfthisgc untuk menutup akses_`,
    );
  }

  const updatedSelf = selfGroups.filter((id) => id !== m.chat);
  db.setting("selfGroups", updatedSelf);

  if (!publicGroups.includes(m.chat)) {
    db.setting("publicGroups", [...publicGroups, m.chat]);
  }

  m.react?.("🌐");
  return sendReply(m, 
    `🌐 *ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ ᴅɪᴀᴋᴛɪꜰᴋᴀsɪ*\n\n` +
      `> Bot sekarang merespon semua member di grup ini\n` +
      `> Override mode global aktif untuk grup ini\n\n` +
      `📋 *Grup lain tidak terpengaruh*\n\n` +
      `_Gunakan ${m.prefix}selfthisgc untuk menutup akses lagi_`,
  );
}

;

export default { config, handler };

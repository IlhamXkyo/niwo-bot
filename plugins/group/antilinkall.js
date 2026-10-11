
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
const config = {
  name: "antilinkall",
  alias: ["alall", "antialllink", "antlink", "antylink", "antilink"],
  category: "group",
  description: "Anti semua jenis link (deteksi domain extension)",
  usage: ".antilinkall <on/off/metode> [kick/remove]",
  example: ".antilinkall on",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
  isAdmin: true,
  isBotAdmin: true,
};

function handler(m, { sock }) {
  const db = getDatabase();
  const option = m.text?.toLowerCase()?.trim();

  if (!option) {
    const groupData = db.getGroup(m.chat) || {};
    const status = groupData.antilinkall || "off";
    const mode = groupData.antilinkallMode || "remove";

    return sendReply(m, 
      `🔗 *Antilink All*\n\n` +
        `> Status: *${status === "on" ? "Aktif ✅" : "Nonaktif ❌"}*\n` +
        `> Mode: *${mode.toUpperCase()}*\n\n` +
        `*DETEKSI:*\n` +
        `> • https:// / http:// (dengan protokol)\n` +
        `> • www. (subdomain)\n` +
        `> • Domain extension (.com, .id, .io, .net, dll)\n` +
        `> • Shortlink (bit.ly, t.me, tinyurl, dll)\n\n` +
        `*PENGGUNAAN:*\n` +
        `> *${m.prefix}antilinkall on* : Aktifkan\n` +
        `> *${m.prefix}antilinkall off* : Nonaktifkan\n` +
        `> *${m.prefix}antilinkall metode kick* : Mode kick user\n` +
        `> *${m.prefix}antilinkall metode remove* : Mode hapus pesan`
    );
  }

  if (option === "on") {
    db.setGroup(m.chat, { antilinkall: "on" });
    return sendReply(m, 
      `✅ *Antilink All Aktif*\n\n` +
        `> Semua link akan dideteksi otomatis\n> Mendeteksi domain extension, bukan hanya http/https`
    );
  }

  if (option === "off") {
    db.setGroup(m.chat, { antilinkall: "off" });
    return sendReply(m, `❌ *Antilink All Nonaktif*\n\n> Link tidak akan difilter lagi`);
  }

  if (option.startsWith("metode")) {
    const method = m.args?.[1]?.toLowerCase();
    if (method === "kick") {
      db.setGroup(m.chat, { antilinkall: "on", antilinkallMode: "kick" });
      return sendReply(m, 
        `✅ *Antilink All : Mode Kick*\n\n> User yang kirim link akan di-kick`
      );
    } else if (method === "remove" || method === "delete") {
      db.setGroup(m.chat, { antilinkall: "on", antilinkallMode: "remove" });
      return sendReply(m, 
        `✅ *Antilink All : Mode Delete*\n\n> Pesan dengan link akan dihapus`
      );
    } else {
      return sendReply(m, 
        `❌ *Metode Tidak Valid*\n\n> Gunakan *kick* atau *remove*\n> Contoh: *${m.prefix}antilinkall metode kick*`
      );
    }
  }

  if (option === "kick") {
    db.setGroup(m.chat, { antilinkall: "on", antilinkallMode: "kick" });
    return sendReply(m, 
      `✅ *Antilink All : Mode Kick*\n\n> User yang kirim link akan di-kick`
    );
  }

  if (option === "remove" || option === "delete") {
    db.setGroup(m.chat, { antilinkall: "on", antilinkallMode: "remove" });
    return sendReply(m, 
      `✅ *Antilink All : Mode Delete*\n\n> Pesan dengan link akan dihapus`
    );
  }

  return sendReply(m, 
    `❌ *Opsi Tidak Valid*\n\n> Gunakan *on*, *off*, *metode kick*, atau *metode remove*`
  );
}

;

export default { config, handler };

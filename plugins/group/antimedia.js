
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
  name: "antimedia",
  alias: ["nomedia"],
  category: "group",
  description: "Mengatur antimedia di grup (blokir gambar/video/audio/dokumen)",
  usage: ".antimedia <on/off>",
  example: ".antimedia on",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: true,
  isBotAdmin: true,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function gpMsg(key, replacements = {}) {
  const defaults = {
    antimedia: "⚠ *AntiMedia* : Media dari @%user% dihapus.",
  };
  let text = appConfig.groupProtection?.[key] || defaults[key] || "";
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`%${k}%`, "g"), v);
  }
  return text;
}

async function checkAntimedia(m, sock, db) {
  if (!m.isGroup) return false;
  if (m.isAdmin || m.isOwner || m.fromMe) return false;

  const groupData = db.getGroup(m.chat) || {};
  if (!groupData.antimedia) return false;

  const isMedia =
    m.isImage || m.isVideo || m.isGif || m.isAudio || m.isDocument;
  if (!isMedia) return false;

  try {
    await sock.sendMessage(m.chat, { delete: m.key });
  } catch {}

  await sock.sendMessage(m.chat, {
    text: gpMsg("antimedia", { user: m.sender.split("@")[0] }),
    mentions: [m.sender],
  });

  return true;
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const action = (m.args || [])[0]?.toLowerCase();
  const groupData = db.getGroup(m.chat) || {};

  if (!action) {
    const status = groupData.antimedia ? "✅ ON" : "❌ OFF";
    await sendReply(m, 
      `🖼️ *AntiMedia*\n\n> Status: *${status}*\n\n> \`.antimedia on/off\``,
    );
    return;
  }

  if (action === "on") {
    db.setGroup(m.chat, { antimedia: true });
    m.react?.("✅");
    await sendReply(m, `✅ *AntiMedia diaktifkan*`);
    return;
  }

  if (action === "off") {
    db.setGroup(m.chat, { antimedia: false });
    m.react?.("❌");
    await sendReply(m, `❌ *AntiMedia dinonaktifkan*`);
    return;
  }

  await sendReply(m, `❌ Gunakan \`.antimedia on\` atau \`.antimedia off\``);
}


export default { config, handler };


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
  name: ["antibot", "botdetect"],
  alias: [],
  category: "group",
  description: "Deteksi dan kick bot WhatsApp (baileys) dari grup",
  usage: ".antibot <on/off>",
  example: ".antibot on",
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
    antibot: "🤖 *AntiBot* : @%user% terdeteksi sebagai bot dan di-kick.",
  };
  let text = appConfig.groupProtection?.[key] || defaults[key] || "";
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`%${k}%`, "g"), v);
  }
  return text;
}

function extractMessageId(m) {
  return String(m?.key?.id || m?.id || "").trim();
}

function extractSenderDevice(m) {
  const participant = String(m?.key?.participant || "");
  const match = participant.match(/:(\d+)@/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function isUnknownPushName(pushName) {
  const value = String(pushName || "")
    .trim()
    .toLowerCase();
  return !value || ["unknown", "undefined", "null"].includes(value);
}

function analyzeBotMessage(m) {
  const messageId = extractMessageId(m);
  if (!messageId) {
    return { isBot: false, score: 0, reasons: [], confidence: "low" };
  }

  if (messageId.startsWith("WAMID.") || messageId.startsWith("false_") || messageId.startsWith("true_")) {
    return { isBot: false, score: 0, reasons: [], confidence: "low" };
  }

  let score = 0;
  const reasons = [];
  const idUpper = messageId.toUpperCase();

  if (idUpper.startsWith("BAE5")) {
    score += 5;
    reasons.push("id-BAE5");
  } else if (idUpper.startsWith("3EB0") && idUpper.length === 22) {
    score += 4;
    reasons.push("id-3EB0");
  } else if (idUpper.startsWith("B24E")) {
    score += 5;
    reasons.push("id-B24E");
  } else if (idUpper.startsWith("94DD")) {
    score += 5;
    reasons.push("id-94DD");
  } else if (idUpper.startsWith("B1E")) {
    score += 5;
    reasons.push("id-B1E");
  } else if (/^[A-F0-9]{28,40}$/i.test(messageId)) {
    score += 2;
    reasons.push("id-upper-hex");
  } else if (messageId.length === 16) {
    score += 3;
    reasons.push("id-length-16");
  } else if (messageId.length < 20 && !messageId.includes("-")) {
    score += 2;
    reasons.push("id-length-suspicious");
  }

  if (m?.isBaileys === true) {
    score += 5;
    reasons.push("flag-isBaileys");
  }
  const msg = m?.message || {};
  const actualMsg = msg.ephemeralMessage?.message || msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || msg;

  const botMessageTypes = [
    'buttonsMessage', 'templateMessage', 'listMessage',
    'interactiveMessage', 'buttonsResponseMessage',
    'templateButtonReplyMessage', 'listResponseMessage',
    'interactiveResponseMessage'
  ];

  for (const type of botMessageTypes) {
    if (actualMsg[type]) {
      score += 6;
      reasons.push(`message-type-${type}`);
      break;
    }
  }

  if (msg.deviceSentMessage) {
    score += 1;
    reasons.push("message-deviceSent");
    if (msg.deviceSentMessage?.message) {
      score += 1;
      reasons.push("message-deviceWrapper");
    }
  }

  const senderDevice = extractSenderDevice(m);
  if (Number.isInteger(senderDevice) && senderDevice > 20) {
    score += 2;
    reasons.push("participant-highDevice");
  }

  if (isUnknownPushName(m?.pushName)) {
    score += 1;
    reasons.push("pushname-unknown");
  }

  const confidence = score >= 6 ? "high" : score >= 4 ? "medium" : "low";
  return {
    isBot: score >= 5,
    score,
    reasons,
    confidence,
    messageId,
    senderDevice,
  };
}

function handler(m, { sock }) {
  const db = getDatabase();
  const args = m.args[0]?.toLowerCase();
  const groupData = db.getGroup(m.chat) || {};
  const current = groupData.antibot || false;

  if (!args || args === "status") {
    return sendReply(m, 
      `🤖 *AntiBot*\n\n` +
      `> Status: ${current ? "✅ Aktif" : "❌ Nonaktif"}\n\n` +
      `> Deteksi: *Smart Heuristic*\n\n` +
      `> \`.antibot on/off\``,
    );
  }

  if (args === "on") {
    db.setGroup(m.chat, { ...groupData, antibot: true });
    db.save();
    m.react?.("✅");
    return sendReply(m, `✅ *AntiBot diaktifkan*`);
  }

  if (args === "off") {
    db.setGroup(m.chat, { ...groupData, antibot: false });
    db.save();
    m.react?.("❌");
    return sendReply(m, `❌ *AntiBot dinonaktifkan*`);
  }

  return sendReply(m, `❌ Gunakan \`.antibot on\` atau \`.antibot off\``);
}

function isBotMessage(m) {
  const result = analyzeBotMessage(m);
  return {
    isBot: result.isBot,
    reason: result.reasons[0] || null,
    score: result.score,
    reasons: result.reasons,
    confidence: result.confidence,
  };
}

async function detectBot(m, sock) {
  if (!m.isGroup) return false;

  const db = getDatabase();
  const groupData = db.getGroup(m.chat);
  if (!groupData?.antibot) return false;

  const result = isBotMessage(m);
  if (!result.isBot) return false;

  const botJid = m.sender;
  if (!botJid) return false;

  const groupMeta = m.groupMetadata;
  if (!groupMeta) return false;

  const myNumber = sock.user?.id?.split(":")[0] || sock.user?.id?.split("@")[0];
  const myJid = myNumber + "@s.whatsapp.net";
  if (botJid === myJid) return false;

  const botParticipant = findParticipantByNumber(groupMeta.participants, myJid);
  if (!botParticipant?.admin) return false;

  const targetParticipant = findParticipantByNumber(
    groupMeta.participants,
    botJid,
  );
  if (targetParticipant?.admin) return false;

  const targetJidToKick = targetParticipant
    ? getParticipantJid(targetParticipant)
    : botJid;

  try {
    try {
      await sock.sendMessage(m.chat, { delete: m.key });
    } catch {
      await sock.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          fromMe: false,
          id: m.key?.id || m.id,
          participant: m.sender,
        },
      });
    }
    await sock.groupParticipantsUpdate(m.chat, [targetJidToKick], "remove");

    await sock.sendMessage(m.chat, {
      text: gpMsg("antibot", { user: botJid.split("@")[0] }),
      mentions: [botJid],
    });

    return true;
  } catch (err) {
    return false;
  }
}


export default { config, handler };


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

const config = {
    name: 'pin',
    alias: ['pinmsg', 'pinpesan'],
    category: 'group',
    description: 'Pin pesan penting di grup',
    usage: '.pin (reply pesan)',
    example: '.pin',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: true,
    isBotAdmin: true
};

async function handler(m, { sock, args }) {
    if (!m.quoted || !m.quoted.key || !m.quoted.key.id) {
        await sendReply(m, 
            `⚠️ *ᴠᴀʟɪᴅᴀsɪ ɢᴀɢᴀʟ*\n\n` +
            `> Reply pesan yang ingin di-pin!\n\n` +
            `*Cara penggunaan:*\n` +
            `> Reply pesan → ketik \`.pin\`\n` +
            `> Optional: \`.pin 24\` (pin 24 jam)`
        );
        return;
    }
    
    let duration = 86400;
    if (args && args.length > 0 && args[0]) {
        const hours = parseInt(args[0]);
        if (!isNaN(hours) && hours >= 1 && hours <= 720) {
            duration = hours * 3600;
        }
    }
    
    try {
        const pinKey = {
            remoteJid: m.chat,
            fromMe: m.quoted.key.fromMe || false,
            id: m.quoted.key.id,
            participant: m.quoted.key.participant || m.quoted.sender
        };
        
        await sock.sendMessage(m.chat, {
            pin: pinKey,
            type: 1,
            time: duration
        });
        
        const durationText = duration >= 86400 
            ? `${Math.floor(duration / 86400)} hari` 
            : `${Math.floor(duration / 3600)} jam`;
        
        const successMsg = `✅ Success pin pesan ini`;
        await sendReply(m, successMsg, { mentions: [m.sender] })
        
    } catch (error) {
        await sendReply(m, 
            `❌ *ᴇʀʀᴏʀ*\n\n` +
            `> Gagal mem-pin pesan.\n` +
            `> _${error.message}_`
        );
    }
}

export default { config, handler };

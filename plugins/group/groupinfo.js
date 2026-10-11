
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
    name: 'groupinfo',
    alias: ['infogroup', 'gcinfo', 'gc'],
    category: 'group',
    description: 'Menampilkan informasi lengkap grup',
    usage: '.groupinfo',
    example: '.groupinfo',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    cooldown: 10,
    energi: 0,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: false
}

function featureStatus(val) {
    if (val === true || val === 'on') return '✅'
    return '❌'
}

async function handler(m, { sock, db }) {
    try {
        const groupMeta = m.groupMetadata
        const participants = groupMeta.participants || []
        const admins = participants.filter(p => p.admin)

        let ownerJid = null
        if (groupMeta.owner) ownerJid = resolveAnyLidToJid(groupMeta.owner, participants)
        if (!ownerJid || ownerJid.includes('@lid')) {
            const superAdmin = participants.find(p => p.admin === 'superadmin')
            if (superAdmin) ownerJid = getParticipantJid(superAdmin)
        }
        if (!ownerJid || ownerJid.includes('@lid')) {
            const firstAdmin = admins[0]
            if (firstAdmin) ownerJid = getParticipantJid(firstAdmin)
        }

        const group = db.getGroup(m.chat) || {}

        const createdDate = groupMeta.creation
            ? timeHelper.fromTimestamp(groupMeta.creation * 1000, 'D MMMM YYYY')
            : 'Tidak diketahui'

        const ownerNumber = ownerJid ? ownerJid.split('@')[0] : null
        const ownerDisplay = ownerNumber && !ownerNumber.includes(':')
            ? `@${ownerNumber}`
            : 'Tidak diketahui'

        let ppUrl = null
        try {
            ppUrl = await sock.profilePictureUrl(m.chat)
        } catch {}

        const isOpen = groupMeta.announce === false || !groupMeta.announce

        let text = `👥 *INFO GRUP*\n\n`
        text += `Nama: *${groupMeta.subject}*\n`
        text += `ID: ${m.chat}\n`
        text += `Owner: ${ownerDisplay}\n`
        text += `Dibuat: ${createdDate}\n`
        text += `Status: ${isOpen ? '🔓 Terbuka' : '🔒 Tertutup'}\n\n`

        text += `📊 *MEMBER*\n`
        text += `Total: ${participants.length}\n`
        text += `Admin: ${admins.length}\n`
        text += `Member: ${participants.length - admins.length}\n\n`

        text += `🔧 *FITUR AKTIF*\n`
        text += `Welcome: ${featureStatus(group.welcome)}\n`
        text += `Goodbye: ${featureStatus(group.goodbye)}\n`
        text += `Autoreply: ${featureStatus(group.autoreply)}\n`
        text += `AutoAI: ${featureStatus(group.autoai)}\n`
        text += `AutoDL: ${featureStatus(group.autodl)}\n`
        text += `AutoSticker: ${featureStatus(group.autosticker)}\n`
        text += `AutoMedia: ${featureStatus(group.automedia)}\n\n`

        text += `🛡️ *PROTEKSI*\n`
        text += `AntiLink: ${featureStatus(group.antilink)}\n`
        text += `AntiBot: ${featureStatus(group.antibot)}\n`
        text += `AntiToxic: ${featureStatus(group.antitoxic)}\n`
        text += `AntiRemove: ${featureStatus(group.antiremove)}\n`
        text += `AntiHidetag: ${featureStatus(group.antihidetag)}\n`
        text += `AntiSticker: ${featureStatus(group.antisticker)}\n`
        text += `AntiMedia: ${featureStatus(group.antimedia)}\n`
        text += `AntiDocument: ${featureStatus(group.antidocument)}`

        if (groupMeta.desc) {
            text += `\n\n📝 *DESKRIPSI*\n${groupMeta.desc}`
        }

        const mentions = ownerJid && !ownerJid.includes(':') ? [ownerJid] : []

        if (ppUrl) {

            try {
                const ppBuffer = Buffer.from((await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 10000 })).data)
                await sock.sendMessage(m.chat, {
                    image: ppBuffer,
                    caption: text,
                    mentions
                }, { quoted: m })
            } catch {
                await sendReply(m, text, { mentions })
            }
        } else {
            await sendReply(m, text, { mentions })
        }
    } catch (error) {
        sendReply(m, te(m.prefix, m.command, m.pushName))
    }
}

export default { config, handler };

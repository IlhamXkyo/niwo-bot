
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
    name: "antispam",
    alias: ["antispamgc"],
    category: "group",
    description: "Mengatur fitur perlindungan grup dari pesan spam secara brutal",
    usage: ".antispam <on/off/action/delay>",
    example: ".antispam on\n.antispam warning\n.antispam 2",
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

const spamTracker = new Map()

async function handler(m, { sock, db }) {
    const args = m.args
    const action = args[0]?.toLowerCase()
    const delayMatch = action?.match(/^(\d+)(s|ms)?$/)
    
    if (!action || (!["on", "off", "warning", "kick", "delete"].includes(action) && !delayMatch)) {
        return sendReply(m, 
            `🛡️ *ANTI SPAM GROUP*\n\n` +
            `Fitur ini melindungi grup dari member yang mengirim pesan berulang-ulang dengan sangat cepat dan brutal sehingga mengganggu kenyamanan member lain\n\n` +
            `*Cara pakai:*\n` +
            `> \`${m.prefix}antispam on\` (Aktifkan fitur antispam)\n` +
            `> \`${m.prefix}antispam off\` (Matikan fitur antispam)\n\n` +
            `*Pilih Metode Hukuman:*\n` +
            `> \`${m.prefix}antispam warning\` (Beri teguran keras hingga 3 kali peringatan)\n` +
            `> \`${m.prefix}antispam kick\` (Otomatis tendang spammer langsung tanpa ampun)\n` +
            `> \`${m.prefix}antispam delete\` (Hapus seluruh pesan spam yang dikirimkan)\n\n` +
            `*Atur Sensitivitas Jeda (Delay):*\n` +
            `> \`${m.prefix}antispam 2\` (Set jarak antar pesan maksimal 2 detik)\n` +
            `> \`${m.prefix}antispam 1500\` (Set jarak ke 1500 milidetik)`
        )
    }

    const groupData = db.getGroup(m.chat) || {}
    
    if (delayMatch) {
        let delayMs = parseInt(delayMatch[1])
        if (delayMatch[2] === "s" || (delayMs >= 1 && delayMs <= 10)) {
            delayMs = delayMs * 1000
        }
        
        if (delayMs < 500) delayMs = 500
        if (delayMs > 10000) delayMs = 10000
        
        groupData.antispamDelay = delayMs
        db.setGroup(m.chat, groupData)
        
        return sendReply(m, 
            `🛡️ *SENSITIVITAS ANTI SPAM DIPERBARUI*\n\n` +
            `> Jeda Maksimal: *${delayMs} ms* (${(delayMs/1000).toFixed(1)} detik)\n\n` +
            `Sistem kini akan menganggap pesan sebagai spam jika anggota mengirim beberapa pesan dengan jeda di bawah *${(delayMs/1000).toFixed(1)} detik* antar pesannya`
        )
    }

    if (action === "on" || action === "off") {
        const isEnable = action === "on"
        if (groupData.antispam === isEnable) {
            return sendReply(m, `✅ Fitur antispam sudah ${isEnable ? "aktif" : "nonaktif"} di grup ini, tidak ada perubahan yang dibuat`)
        }
        
        groupData.antispam = isEnable
        db.setGroup(m.chat, groupData)
        
        await sendReply(m, 
            `🛡️ *ANTI SPAM DIPERBARUI*\n\n` +
            `> Status: *${isEnable ? "AKTIF ✅" : "NONAKTIF ❌"}*\n\n` +
            `Sistem bot kini akan ${isEnable ? "mengawasi secara ketat" : "berhenti mengawasi"} setiap aktivitas spam atau flood pesan yang dilakukan oleh member di dalam grup ini`
        )
    } else {
        groupData.antispamAction = action
        db.setGroup(m.chat, groupData)
        
        let textAction = ""
        if (action === "warning") textAction = "Memberikan peringatan keras secara bertahap"
        if (action === "kick") textAction = "Menendang member yang membandel secara otomatis"
        if (action === "delete") textAction = "Menghapus pesan spam yang mengganggu"
        
        await sendReply(m, 
            `🛡️ *AKSI ANTI SPAM DIPERBARUI*\n\n` +
            `> Metode Hukuman: *${action.toUpperCase()}*\n\n` +
            `Sistem bot akan langsung mengambil tindakan berupa *${textAction}* apabila ada member yang terdeteksi melakukan pelanggaran berupa tindakan spam brutal`
        )
    }
}

async function checkSpam(m, sock, db) {
    if (!m.isGroup || m.isAdmin || m.isOwner || m.fromMe) return false
    
    const groupData = db.getGroup(m.chat)
    if (!groupData || !groupData.antispam) return false

    const senderId = m.sender
    const chatKey = `${m.chat}_${senderId}`
    const now = Date.now()
    const delayThreshold = groupData.antispamDelay || 2000

    const userData = spamTracker.get(chatKey) || { count: 0, lastMessage: 0, warnings: 0 }
    
    if (now - userData.lastMessage < delayThreshold) {
        userData.count += 1
    } else {
        if (now - userData.lastMessage > delayThreshold + 1000) {
            userData.count = 1
        } else {
            userData.count = Math.max(1, userData.count - 1)
        }
    }
    
    userData.lastMessage = now
    spamTracker.set(chatKey, userData)

    if (userData.count >= 5) {
        return true
    }
    
    return false
}

async function handleSpamAction(m, sock, db) {
    const groupData = db.getGroup(m.chat)
    const action = groupData.antispamAction || "warning"
    const senderId = m.sender
    const chatKey = `${m.chat}_${senderId}`
    const userData = spamTracker.get(chatKey)

    if (action === "warning") {
        userData.warnings += 1
        spamTracker.set(chatKey, userData)
        
        if (userData.warnings >= 3) {
            await sendReply(m, 
                `⚠️ *PERINGATAN SPAM MAKSIMAL*\n\n` +
                `> Teruntuk: @${senderId.split("@")[0]}\n\n` +
                `Kamu telah mendapatkan 3 kali teguran peringatan karena mengirim pesan spam secara berkelanjutan. Harap segera berhenti melakukan spam atau jajaran admin grup dapat mengambil tindakan tegas terhadap pelanggaran ini!`,
                { mentions: [senderId] }
            )
            userData.warnings = 0 
            userData.count = 0
            spamTracker.set(chatKey, userData)
        } else {
            await sendReply(m, 
                `⚠️ *TEGURAN SPAM TERDETEKSI*\n\n` +
                `> Peringatan ke-${userData.warnings} dari maksimal 3 peringatan\n\n` +
                `Halo @${senderId.split("@")[0]}, tolong jangan melakukan pengiriman pesan berulang-ulang di grup ini secara cepat! Sistem kami mendeteksi aktivitasmu sebagai spam. Mohon hargai kenyamanan member lainnya`,
                { mentions: [senderId] }
            )
            userData.count = 0 
            spamTracker.set(chatKey, userData)
        }
    } else if (action === "kick") {
        if (m.isBotAdmin) {
            await sendReply(m, 
                `🛑 *SPAMMER DIKELUARKAN*\n\n` +
                `Maaf sekali @${senderId.split("@")[0]}, kamu akan dikeluarkan secara paksa oleh sistem karena kamu terdeteksi melakukan aksi spam brutal di grup ini!`, 
                { mentions: [senderId] }
            )
            await sock.groupParticipantsUpdate(m.chat, [senderId], "remove")
            spamTracker.delete(chatKey)
        } else {
            await sendReply(m, 
                `⚠️ *SPAM TERDETEKSI*\n\n` +
                `Telah terdeteksi aktivitas spam brutal dari @${senderId.split("@")[0]}, namun sistem bot sayangnya tidak dapat menendang member tersebut karena bot saat ini tidak memiliki akses sebagai admin grup. Tolong jadikan bot admin agar fitur ini bekerja maksimal`, 
                { mentions: [senderId] }
            )
            userData.count = 0
            spamTracker.set(chatKey, userData)
        }
    } else if (action === "delete") {
        if (m.isBotAdmin) {
            await sock.sendMessage(m.chat, { delete: m.key })
        } else {
            userData.count = 0
            spamTracker.set(chatKey, userData)
        }
    }
}

export default { config, handler };

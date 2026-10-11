
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
    name: 'acc',
    alias: ['accall', 'joinrequest', 'reqjoin'],
    category: 'group',
    description: 'Kelola permintaan masuk grup (accept/reject)',
    usage: '.acc <list|approve|reject> [all|nomor]',
    example: '.acc approve all',
    isOwner: false,
    isPremium: false,
    isGroup: true,
    isPrivate: false,
    isAdmin: true,
    isBotAdmin: true,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function formatDate(timestamp) {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(timestamp * 1000))
}

async function handler(m, { sock }) {
    const args = m.args || []
    const sub = args[0]?.toLowerCase()
    const option = args.slice(1).join(' ')?.trim()

    if (!sub || !['list', 'approve', 'reject'].includes(sub)) {
        return sendReply(m, 
            `📋 *ᴊᴏɪɴ ʀᴇQᴜᴇsᴛ ᴍᴀɴᴀɢᴇʀ*\n\n` +
            `╭┈┈⬡「 📌 *ᴄᴏᴍᴍᴀɴᴅ* 」\n` +
            `┃ ${m.prefix}acc list\n` +
            `┃ ${m.prefix}acc approve all\n` +
            `┃ ${m.prefix}acc reject all\n` +
            `┃ ${m.prefix}acc approve 1|2|3\n` +
            `┃ ${m.prefix}acc reject 1|2|3\n` +
            `╰┈┈┈┈┈┈┈┈⬡`
        )
    }

    await m.react?.('🕕')

    try {
        const pendingList = await sock.groupRequestParticipantsList(m.chat)

        if (!pendingList?.length) {
            await m.react?.('📭')
            return sendReply(m, `📭 Tidak ada permintaan masuk yang tertunda.`)
        }

        if (sub === 'list') {
            let text = `📋 *ᴅᴀꜰᴛᴀʀ ᴘᴇʀᴍɪɴᴛᴀᴀɴ ᴍᴀsᴜᴋ*\n\n`
            text += `> Total: ${pendingList.length} permintaan\n\n`

            for (let i = 0; i < pendingList.length; i++) {
                const req = pendingList[i]
                const number = req.jid?.split('@')[0] || 'Unknown'
                const method = req.request_method || '-'
                const time = req.request_time ? formatDate(req.request_time) : '-'

                text += `*${i + 1}.* @${number}\n`
                text += `   📱 ${number}\n`
                text += `   📨 ${method}\n`
                text += `   🕐 ${time}\n\n`
            }

            text += `> Gunakan \`${m.prefix}acc approve all\` atau \`${m.prefix}acc reject all\``

            const mentions = pendingList.map(r => r.jid)
            await m.react?.('📋')
            return sendReply(m, text, { mentions })
        }

        const action = sub

        if (option === 'all') {
            const jids = pendingList.map(r => r.jid)

            const results = await sock.groupRequestParticipantsUpdate(m.chat, jids, action)

            const success = results.filter(r => r.status === '200' || !r.status || r.status === 200).length
            const failed = results.length - success

            const label = action === 'approve' ? 'Diterima' : 'Ditolak'
            await m.react?.('✅')
            return sendReply(m, 
                `✅ *${label.toUpperCase()} SEMUA*\n\n` +
                `> ✅ Berhasil: ${success}\n` +
                `> ❌ Gagal: ${failed}\n` +
                `> 📊 Total: ${results.length}`
            )
        }

        const indices = option.split('|').map(n => parseInt(n.trim()) - 1).filter(n => !isNaN(n) && n >= 0 && n < pendingList.length)

        if (!indices.length) {
            await m.react?.('❌')
            return sendReply(m, 
                `❌ Nomor tidak valid.\n\n` +
                `> Gunakan \`${m.prefix}acc list\` untuk melihat daftar.\n` +
                `> Contoh: \`${m.prefix}acc ${action} 1|2|3\``
            )
        }

        const targets = indices.map(i => pendingList[i])
        let text = ''
        const label = action === 'approve' ? 'Diterima' : 'Ditolak'
        let successCount = 0

        for (const target of targets) {
            try {
                const result = await sock.groupRequestParticipantsUpdate(m.chat, [target.jid], action)
                const status = result[0]?.status
                const ok = status === '200' || !status || status === 200

                const number = target.jid.split('@')[0]
                text += `${ok ? '✅' : '❌'} ${number} : ${ok ? label : 'Gagal'}\n`
                if (ok) successCount++
            } catch {
                const number = target.jid.split('@')[0]
                text += `❌ ${number} : Error\n`
            }
        }

        await m.react?.('✅')
        return sendReply(m, 
            `📋 *ʜᴀsɪʟ ${label.toUpperCase()}*\n\n` +
            text + `\n` +
            `> ✅ ${successCount}/${targets.length} berhasil`
        )
    } catch (error) {
        await m.react?.('☢')
        sendReply(m, te(m.prefix, m.command, m.pushName))
    }
}

export default { config, handler };

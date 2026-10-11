
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
import fs from 'fs'
import path from 'path'
const config = {
    name: 'autoreply',
    alias: ['smarttrigger', 'smarttriggers'],
    category: 'group',
    description: 'Mengatur autoreply/smart triggers per grup',
    usage: '.autoreply on/off/add/del/list/private',
    example: '.autoreply on',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true,
    isAdmin: false,
    isBotAdmin: false
}

const AUTOREPLY_MEDIA_DIR = path.join(process.cwd(), 'database', 'autoreply_media')

if (!fs.existsSync(AUTOREPLY_MEDIA_DIR)) {
    fs.mkdirSync(AUTOREPLY_MEDIA_DIR, { recursive: true })
}

async function handler(m, { sock }) {
    const db = getDatabase()
    const args = m.args || []
    const action = args[0]?.toLowerCase()
    
    const privateAutoreply = db.setting('autoreplyPrivate') ?? false
    
    if (action === 'private') {
        if (!m.isOwner) {
            return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Hanya owner yang bisa mengatur autoreply private!`)
        }
        
        const subAction = args[1]?.toLowerCase()
        
        if (subAction === 'on') {
            db.setting('autoreplyPrivate', true)
            m.react?.('✅')
            return sendReply(m, `✅ *ᴀᴜᴛᴏʀᴇᴘʟʏ ᴘʀɪᴠᴀᴛᴇ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n\n> Bot akan merespon otomatis di private chat`)
        }
        
        if (subAction === 'off') {
            db.setting('autoreplyPrivate', false)
            m.react?.('❌')
            return sendReply(m, `❌ *ᴀᴜᴛᴏʀᴇᴘʟʏ ᴘʀɪᴠᴀᴛᴇ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ*\n\n> Bot tidak akan merespon otomatis di private chat`)
        }
        
        const currentStatus = db.setting('autoreplyPrivate') ?? false
        return sendReply(m, 
            `📱 *AUTOREPLY PRIVATE*\n\n` +
            `Status: *${currentStatus ? '✅ AKTIF' : '❌ NONAKTIF'}*\n\n` +
            `*PERINTAH TERSEDIA:*\n` +
            `• *${m.prefix}autoreply private on* : Aktifkan private\n` +
            `• *${m.prefix}autoreply private off* : Nonaktifkan private`
        )
    }
    
    if (action === 'global') {
        if (!m.isOwner) {
            return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Hanya owner yang bisa mengatur global autoreply!`)
        }
        
        const subAction = args[1]?.toLowerCase()
        const globalCustomReplies = db.setting('globalCustomReplies') || []
        
        if (subAction === 'add') {
            const fullBody = m.body || ''
            const pipeIdx = fullBody.indexOf('|')
            if (pipeIdx === -1) {
                return sendReply(m, 
                    `❌ *ꜰᴏʀᴍᴀᴛ sᴀʟᴀʜ*\n\n` +
                    `> Gunakan format: \`trigger|reply\`\n\n` +
                    `> Contoh:\n` +
                    `> \`${m.prefix}autoreply global add halo|Hai {name}!\``
                )
            }
            
            const triggerStart = fullBody.toLowerCase().indexOf('global add ') + 'global add '.length
            const triggerEnd = pipeIdx
            const trigger = fullBody.substring(triggerStart, triggerEnd).trim()
            const reply = fullBody.substring(pipeIdx + 1)
            
            if (!trigger.trim() || !reply) {
                return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Trigger dan reply tidak boleh kosong!`)
            }
            
            const existingIndex = globalCustomReplies.findIndex(r => r.trigger.toLowerCase() === trigger.trim().toLowerCase())
            if (existingIndex !== -1) {
                globalCustomReplies[existingIndex].reply = reply
            } else {
                globalCustomReplies.push({ trigger: trigger.trim().toLowerCase(), reply: reply })
            }
            
            db.setting('globalCustomReplies', globalCustomReplies)
            await db.save()
            
            m.react?.('✅')
            return sendReply(m, 
                `✅ *GLOBAL AUTOREPLY DITAMBAHKAN*\n\n` +
                `• Trigger: *${trigger.trim()}*\n` +
                `• Total: *${globalCustomReplies.length}* replies\n\n` +
                `_Aktif di semua grup dan private chat_`
            )
        }
        
        if (subAction === 'del' || subAction === 'rm') {
            const trigger = args.slice(2).join(' ').toLowerCase().trim()
            if (!trigger) {
                return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Masukkan trigger yang mau dihapus!`)
            }
            
            const index = globalCustomReplies.findIndex(r => r.trigger === trigger)
            if (index === -1) {
                return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Trigger \`${trigger}\` tidak ditemukan!`)
            }
            
            globalCustomReplies.splice(index, 1)
            db.setting('globalCustomReplies', globalCustomReplies)
            await db.save()
            
            m.react?.('🗑️')
            return sendReply(m, `🗑️ *GLOBAL AUTOREPLY DIHAPUS*\n\nTrigger *${trigger}* berhasil dihapus!`)
        }
        
        if (subAction === 'list' || !subAction) {
            if (globalCustomReplies.length === 0) {
                return sendReply(m, 
                    `📋 *GLOBAL AUTOREPLY*\n\n` +
                    `Status: *❌ TIDAK ADA DATA*\n\n` +
                    `*PERINTAH TERSEDIA:*\n` +
                    `• *${m.prefix}autoreply global add <trigger>|<reply>*`
                )
            }
            
            let text = `📋 *GLOBAL AUTOREPLY*\n\n`
            text += `Total: *${globalCustomReplies.length}* replies\n`
            text += `Berlaku di: *Semua Grup & Private Chat*\n\n`
            text += `*DAFTAR TRIGGER:*\n`
            globalCustomReplies.forEach((r, i) => {
                const hasImage = r.image ? '🖼️' : ''
                text += `${i + 1}. *${r.trigger}* ${hasImage}\n   ↳ ${r.reply.substring(0, 30)}${r.reply.length > 30 ? '...' : ''}\n\n`
            })
            return sendReply(m, text.trim())
        }
        
        return sendReply(m, 
            `📱 *ɢʟᴏʙᴀʟ ᴀᴜᴛᴏʀᴇᴘʟʏ*\n\n` +
            `> \`${m.prefix}autoreply global add trigger|reply\`\n` +
            `> \`${m.prefix}autoreply global del trigger\`\n` +
            `> \`${m.prefix}autoreply global list\``
        )
    }
    
    if (!m.isGroup) {
        return sendReply(m, 
            `📱 *SISTEM AUTOREPLY*\n\n` +
            `Autoreply Private: *${privateAutoreply ? '✅ AKTIF' : '❌ NONAKTIF'}*\n\n` +
            `*PERINTAH TERSEDIA:*\n` +
            `• *${m.prefix}autoreply private on/off* : Toggle private\n` +
            `• *${m.prefix}autoreply global add/del/list* : Global triggers\n\n` +
            `_Catatan: Untuk setting autoreply grup, gunakan perintah ini di dalam grup._`
        )
    }
    
    if (!m.isAdmin && !m.isOwner) {
        return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Hanya admin yang bisa mengatur autoreply di grup!`)
    }
    
    const groupData = db.getGroup(m.chat) || {}
    const globalSmartTriggers = db.setting('smartTriggers') ?? appConfig.features?.smartTriggers ?? false
    
    if (!action || action === 'status') {
        const groupStatus = groupData.autoreply
        const effectiveStatus = groupStatus ?? globalSmartTriggers
        const customReplies = groupData.customReplies || []
        
        let text = `🤖 *SISTEM AUTOREPLY GRUP*\n\n`
        text += `Status Global: *${globalSmartTriggers ? '✅ AKTIF' : '❌ NONAKTIF'}*\n`
        text += `Status Grup Ini: *${groupStatus === undefined ? 'DEFAULT' : (groupStatus ? '✅ AKTIF' : '❌ NONAKTIF')}*\n`
        text += `Status Private: *${privateAutoreply ? '✅ AKTIF' : '❌ NONAKTIF'}*\n`
        text += `Efektif di Grup: *${effectiveStatus ? '✅ AKTIF' : '❌ NONAKTIF'}*\n`
        text += `Total Custom Reply (Grup): *${customReplies.length}*\n\n`
        text += `*MANAJEMEN GRUP:*\n`
        text += `• *${m.prefix}autoreply on* : Aktifkan di grup ini\n`
        text += `• *${m.prefix}autoreply off* : Nonaktifkan di grup ini\n`
        text += `• *${m.prefix}autoreply add <trigger>|<reply>* : Tambah custom reply\n`
        text += `• *${m.prefix}autoreply del <trigger>* : Hapus custom reply\n`
        text += `• *${m.prefix}autoreply list* : Lihat semua trigger di grup ini\n`
        text += `• *${m.prefix}autoreply reset* : Hapus SEMUA custom di grup ini\n\n`
        
        if (m.isOwner) {
            text += `*MANAJEMEN GLOBAL (OWNER):*\n`
            text += `• *${m.prefix}autoreply global add <trigger>|<reply>*\n`
            text += `• *${m.prefix}autoreply global del <trigger>*\n`
            text += `• *${m.prefix}autoreply global list* : Trigger yang berlaku aktif\n`
            text += `• *${m.prefix}autoreply private on/off* : Toggle bot reply di DM\n\n`
        }
        
        text += `*CARA PENAMBAHAN GAMBAR:*\n`
        text += `1. Kirim gambar beserta caption: *${m.prefix}autoreply add trigger|reply*\n`
        text += `2. Atau reply gambar dengan: *${m.prefix}autoreply add trigger|reply*\n\n`
        text += `*DAPAT MENGGUNAKAN PLACEHOLDER:*\n`
        text += `{name} • {tag} • {sender} • {botname} • {time} • {date}`
        
        return sendReply(m, text)
    }
    
    if (action === 'on') {
        db.setGroup(m.chat, { ...groupData, autoreply: true })
        m.react?.('✅')
        return sendReply(m, `✅ *ᴀᴜᴛᴏʀᴇᴘʟʏ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ*\n\n> Bot akan merespon otomatis di grup ini`)
    }
    
    if (action === 'off') {
        db.setGroup(m.chat, { ...groupData, autoreply: false })
        m.react?.('❌')
        return sendReply(m, `❌ *ᴀᴜᴛᴏʀᴇᴘʟʏ ᴅɪɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ*\n\n> Bot tidak akan merespon otomatis di grup ini`)
    }
    
    if (action === 'add') {
        const fullBody = m.body || ''
        const pipeIdx = fullBody.indexOf('|')
        
        if (pipeIdx === -1) {
            return sendReply(m, 
                `❌ *FORMAT SALAH*\n\n` +
                `Gunakan format: *trigger|reply*\n\n` +
                `*Text Only:*\n` +
                `• ${m.prefix}ar add halo|Hai {name}! 👋\n\n` +
                `*Dengan Gambar:*\n` +
                `1. Reply gambar + ${m.prefix}ar add trigger|caption\n` +
                `2. Kirim gambar + caption ${m.prefix}ar add trigger|caption\n\n` +
                `*Placeholder:*\n` +
                `• {name} - Nama user\n` +
                `• {tag} - Tag @user\n` +
                `• {sender} - Nomor user\n` +
                `• {botname} - Nama bot\n` +
                `• {time} - Waktu sekarang\n` +
                `• {date} - Tanggal sekarang`
            )
        }
        
        const addIdx = fullBody.toLowerCase().indexOf('add ')
        const triggerStart = addIdx + 'add '.length
        const trigger = fullBody.substring(triggerStart, pipeIdx).trim()
        const reply = fullBody.substring(pipeIdx + 1)
        
        if (!trigger) {
            return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Trigger tidak boleh kosong!`)
        }
        
        let imageBuffer = null
        let imagePath = null
        
        const hasQuotedImage = m.quoted && (m.quoted.mtype === 'imageMessage' || m.quoted.type === 'image')
        const hasDirectImage = m.mtype === 'imageMessage' || m.type === 'image'
        
        if (hasQuotedImage) {
            try {
                imageBuffer = await m.quoted.download()
            } catch (e) {
                console.error('[Autoreply] Failed to download quoted image:', e.message)
            }
        } else if (hasDirectImage) {
            try {
                imageBuffer = await m.download()
            } catch (e) {
                console.error('[Autoreply] Failed to download direct image:', e.message)
            }
        }
        
        if (imageBuffer) {
            const filename = `${m.chat.replace('@g.us', '')}_${trigger.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`
            imagePath = path.join(AUTOREPLY_MEDIA_DIR, filename)
            fs.writeFileSync(imagePath, imageBuffer)
        }
        
        const customReplies = groupData.customReplies || []
        const existingIndex = customReplies.findIndex(r => r.trigger.toLowerCase() === trigger.toLowerCase())
        
        const replyData = {
            trigger: trigger.toLowerCase(),
            reply: reply || '',
            image: imagePath || null,
            createdAt: Date.now()
        }
        
        if (existingIndex !== -1) {
            if (customReplies[existingIndex].image && customReplies[existingIndex].image !== imagePath) {
                try {
                    if (fs.existsSync(customReplies[existingIndex].image)) {
                        fs.unlinkSync(customReplies[existingIndex].image)
                    }
                } catch {}
            }
            customReplies[existingIndex] = replyData
        } else {
            customReplies.push(replyData)
        }
        
        db.setGroup(m.chat, { ...groupData, customReplies })
        
        m.react?.('✅')
        
        let successMsg = `✅ *AUTOREPLY DITAMBAHKAN*\n\n`
        successMsg += `*DETAIL:*\n`
        successMsg += `• Trigger: *${trigger.trim()}*\n`
        if (reply) {
            successMsg += `• Reply: ${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}\n`
        }
        if (imagePath) {
            successMsg += `• Image: ✅ Tersimpan\n`
        }
        successMsg += `\nTotal: *${customReplies.length}* replies di grup ini`
        
        return sendReply(m, successMsg)
    }
    
    if (action === 'del' || action === 'rm' || action === 'remove') {
        const trigger = args.slice(1).join(' ').toLowerCase().trim()
        
        if (!trigger) {
            return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Masukkan trigger yang mau dihapus!\n\n\`${m.prefix}autoreply del halo\``)
        }
        
        const customReplies = groupData.customReplies || []
        const index = customReplies.findIndex(r => r.trigger === trigger)
        
        if (index === -1) {
            return sendReply(m, `❌ *ɢᴀɢᴀʟ*\n\n> Trigger \`${trigger}\` tidak ditemukan!`)
        }
        
        if (customReplies[index].image) {
            try {
                if (fs.existsSync(customReplies[index].image)) {
                    fs.unlinkSync(customReplies[index].image)
                }
            } catch {}
        }
        
        customReplies.splice(index, 1)
        db.setGroup(m.chat, { ...groupData, customReplies })
        
        m.react?.('🗑️')
        return sendReply(m, 
            `🗑️ *AUTOREPLY DIHAPUS*\n\n` +
            `Trigger *${trigger}* berhasil dihapus!\n` +
            `Sisa: *${customReplies.length}* replies`
        )
    }
    
    if (action === 'list') {
        const customReplies = groupData.customReplies || []
        
        const defaultTriggers = [
            { trigger: '@mention', reply: '👋 Hai! Ada yang manggil bot?' },
            { trigger: 'p', reply: '💬 Budayakan salam sebelum percakapan!' },
            { trigger: 'bot / niwo', reply: '🤖 Bot aktif dan siap!' },
            { trigger: 'assalamualaikum', reply: 'Waalaikumsalam saudaraku' }
        ]
        
        let text = `📋 *DAFTAR AUTOREPLY GRUP*\n\n`
        
        text += `*DEFAULT TRIGGERS:*\n`
        defaultTriggers.forEach((r, i) => {
            text += `• *${r.trigger}*\n`
            text += `  ↳ ${r.reply}\n`
        })
        text += `\n`
        
        if (customReplies.length > 0) {
            text += `*CUSTOM TRIGGERS:*\n`
            customReplies.forEach((r, i) => {
                const hasImage = r.image ? '🖼️' : ''
                text += `• *${r.trigger}* ${hasImage}\n`
                if (r.reply) {
                    text += `  ↳ ${r.reply.substring(0, 35)}${r.reply.length > 35 ? '...' : ''}\n`
                }
            })
            text += `\n`
        } else {
            text += `*CUSTOM TRIGGERS:*\n`
            text += `_Belum ada custom trigger di grup ini_\n\n`
        }
        
        text += `_Catatan: Default triggers bawaan bot tidak bisa di-edit._`
        
        return sendReply(m, text)
    }
    
    if (action === 'reset' || action === 'clear') {
        const customReplies = groupData.customReplies || []
        for (const r of customReplies) {
            if (r.image) {
                try {
                    if (fs.existsSync(r.image)) fs.unlinkSync(r.image)
                } catch {}
            }
        }
        
        db.setGroup(m.chat, { ...groupData, customReplies: [] })
        m.react?.('🗑️')
        return sendReply(m, `🗑️ *ᴀᴜᴛᴏʀᴇᴘʟʏ ᴅɪʀᴇsᴇᴛ*\n\n> Semua autoreply custom dihapus!`)
    }
    
    return sendReply(m, `❌ *ᴀᴄᴛɪᴏɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n> Gunakan: \`on\`, \`off\`, \`private on/off\`, \`add\`, \`del\`, \`list\`, \`reset\``)
}

export default { config, handler };

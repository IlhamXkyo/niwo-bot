import appConfig from '../../config.js'
import { getDatabase } from '../../src/lib/database.js'
const config = {
    name: 'cekowner',
    alias: ['ownerinfo'],
    category: 'cek',
    description: 'Cek apakah user adalah owner bot',
    usage: '.cekowner @user',
    example: '.cekowner',
    isOwner: false,
    isPremium: true,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

function wm(text) {
    return `NIWO BOT\n\n${text}`
}

async function handler(m, { sock }) {
    const db = getDatabase()
    let targetNumber = ''
    let targetJid = ''

    if (m.quoted) {
        targetNumber = m.quoted.sender?.replace(/[^0-9]/g, '') || ''
        targetJid = m.quoted.sender
    } else if (m.mentionedJid?.length) {
        targetNumber = m.mentionedJid[0]?.replace(/[^0-9]/g, '') || ''
        targetJid = m.mentionedJid[0]
    } else if (m.args?.length) {
        targetNumber = m.args[0].replace(/[^0-9]/g, '')
        targetJid = targetNumber + '@s.whatsapp.net'
    } else {
        targetNumber = m.sender?.replace(/[^0-9]/g, '') || ''
        targetJid = m.sender
    }

    if (targetNumber.startsWith('0')) targetNumber = '62' + targetNumber.slice(1)

    const isOwnerUser = appConfig?.isOwner(targetNumber)
    const isPartnerUser = appConfig?.isPartner(targetNumber)
    const isPremiumUser = appConfig?.isPremium(targetNumber)
    const user = db.getUser(targetJid)

    const roles = []
    if (isOwnerUser) roles.push('👑 Owner')
    if (isPartnerUser) roles.push('🤝 Partner')
    if (isPremiumUser) roles.push('💎 Premium')
    if (roles.length === 0) roles.push('👤 Free User')

    const ownerList = db.data.owner || []
    const isInOwnerDb = ownerList.includes(targetNumber)

    let txt = `📋 *CEK USER INFO*\n\n`
    txt += `👤 User: @${targetNumber}\n`
    txt += `🏷️ Role: *${roles.join(' • ')}*\n`
    txt += `📊 Owner DB: *${isInOwnerDb ? 'Ya' : 'Tidak'}*\n`
    if (user) {
        txt += `⚡ Energi: *${user.energi === -1 ? '∞' : (user.energi ?? 0)}*\n`
        txt += `💰 Koin: *${user.koin === -1 ? '∞' : (user.koin ?? 0).toLocaleString('id-ID')}*\n`
        txt += `⭐ Level: *${user.level ?? 1}*\n`
    }

    await m.reply(wm(txt), { mentions: [targetJid] })
}

export default { config, handler }
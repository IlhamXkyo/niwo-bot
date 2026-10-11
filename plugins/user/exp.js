import { getDatabase } from '../../src/lib/database.js'

const config = {
    name: 'exp',
    alias: ['cekexp', 'myexp', 'xp'],
    category: 'user',
    description: 'Cek exp user',
    usage: '.exp [@user]',
    example: '.exp',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

async function handler(m, { sock }) {
    const db = getDatabase()
    
    let targetJid = m.sender
    let targetName = m.pushName || 'Kamu'
    
    if (m.quoted) {
        targetJid = m.quoted.sender
        targetName = m.quoted.pushName || targetJid.split('@')[0]
    } else if (m.mentionedJid?.length) {
        targetJid = m.mentionedJid[0]
        targetName = targetJid.split('@')[0]
    }
    
    const user = db.getUser(targetJid) || db.setUser(targetJid)
    const expDisplay = formatNumber(user.exp || 0)
    const level = calculateLevel(user.exp || 0)
    const title = level >= 100 ? '🐉 Mythic' : level >= 80 ? '⚔️ Legend' : level >= 60 ? '💜 Epic' : level >= 40 ? '💪 Grandmaster' : level >= 20 ? '🎖️ Master' : level >= 10 ? '⭐ Elite' : '🛡️ Warrior'
    
    let text = `*〔 ⭐ EXP INFO 〕*\n\n`

text += `*〔 👤 User 〕* ${targetName}\n`
text += `*〔 ⭐ Exp 〕* ${expDisplay}\n`
text += `*〔 🏆 Level 〕* ${level}\n`
text += `*〔 🎖️ Title 〕* ${title}\n`
    
    await m.reply(text)
}

export default { config, handler }
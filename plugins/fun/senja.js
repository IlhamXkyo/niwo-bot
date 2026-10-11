import axios from 'axios'
import appConfig from '../../config.js'
const NEOXR_APIKEY = appConfig?.APIkey?.neoxr || ''

const config = {
    name: 'senja',
    alias: ['katacinta', 'romanticquotes'],
    category: 'fun',
    description: 'Random kata-kata senja/romantis',
    usage: '.senja',
    example: '.senja',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
}

async function handler(m, { sock }) {
    m.react?.('🕕')
    try {
        const res = await axios.get(`https://api.neoxr.eu/api/senja?apikey=${NEOXR_APIKEY}`, { timeout: 30000 })
        
        if (!res.data?.status || !res.data?.data?.text) {
            m.react?.('❌')
            return m.reply(`❌ Gagal mengambil kata senja`)
        }
        await m.reply(res.data.data.text)
        m.react?.('✅')
    } catch (err) {
        m.react?.('☢')
        return m.reply(`❌ Terjadi kesalahan: ${error?.message || "Unknown error"}`)
    }
}

export default { config, handler }
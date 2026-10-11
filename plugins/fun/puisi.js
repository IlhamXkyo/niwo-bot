import axios from 'axios'
import appConfig from '../../config.js'
const NEOXR_APIKEY = appConfig?.APIkey?.neoxr || ''

const config = {
    name: 'puisi',
    alias: ['puisiku', 'sajak'],
    category: 'fun',
    description: 'Random puisi Indonesia',
    usage: '.puisi',
    example: '.puisi',
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
        const res = await axios.get(`https://api.neoxr.eu/api/puisi?apikey=${NEOXR_APIKEY}`, { timeout: 30000 })
        
        if (!res.data?.status || !res.data?.data?.text) {
            m.react?.('❌')
            return m.reply(`❌ Gagal mengambil puisi`)
        }
        
        const text = res.data.data.text
        await m.reply(text)
        m.react?.('✅')
        
    } catch (err) {
        m.react?.('☢')
        return m.reply(`❌ Terjadi kesalahan: ${error?.message || "Unknown error"}`)
    }
}

export default { config, handler }
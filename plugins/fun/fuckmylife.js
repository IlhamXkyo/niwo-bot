import axios from 'axios'
import appConfig from '../../config.js'
const NEOXR_APIKEY = appConfig?.APIkey?.neoxr || ''

const config = {
    name: 'fuckmylife',
    alias: ['fml'],
    category: 'fun',
    description: 'Random FML story',
    usage: '.fuckmylife',
    example: '.fuckmylife',
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
        const data = await axios.get(`https://api.neoxr.eu/api/fml?apikey=${NEOXR_APIKEY}`, { timeout: 30000 })
        
        if (!data?.status || !data?.data?.text) {
            m.react?.('❌')
            return m.reply(`❌ Gagal mengambil FML story`)
        }    
        await m.reply(data.data.text)
        m.react?.('✅')
        
    } catch (err) {
        m.react?.('☢')
        return m.reply(`❌ Terjadi kesalahan: ${error?.message || "Unknown error"}`)
    }
}

export default { config, handler }
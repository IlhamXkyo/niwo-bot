const config = {
    name: 'renungan',
    alias: ['motivasi', 'mutiara'],
    category: 'fun',
    description: 'Random gambar renungan/motivasi',
    usage: '.renungan',
    example: '.renungan',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 0,
    isEnabled: true
};

async function handler(m, { sock }) {
    m.react?.('🕕')
    try {
        await sock.sendMedia(m.chat, `https://picsum.photos/800/1200?random=${Date.now()}`, null, m, {
            type: 'image'
        })
        m.react?.('✅')
    } catch (error) {
        m.react?.('❌')
        await m.reply('❌ Gagal mengambil gambar. Coba lagi!');
    }
}

export default { config, handler }
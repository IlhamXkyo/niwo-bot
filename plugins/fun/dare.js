const dareData = ["Kirim emoji random ke grup.", "Sebutkan 3 hal yang bikin kamu senang hari ini.", "Tulis satu kalimat motivasi untuk temanmu.", "Ceritakan hobi yang paling kamu suka."];
const getRandomItem = a => a[Math.floor(Math.random()*a.length)];
const config = {
    name: 'dare',
    alias: ['dareq', 'tantang'],
    category: 'fun',
    description: 'Random tantangan dare',
    usage: '.dare',
    example: '.dare',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m) {
    const challenge = getRandomItem(dareData);
    
    if (!challenge) {
        await m.reply('❌ Data tidak tersedia!');
        return;
    }
    
    await m.reply(`\`\`\`${challenge}\`\`\``);
}

export default { config, handler }
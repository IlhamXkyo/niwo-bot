const truthData = ["Apa hal yang paling kamu banggakan dari dirimu?", "Apa impian yang ingin kamu capai?", "Siapa orang yang paling menginspirasimu?", "Apa kebiasaan yang ingin kamu ubah?"];
const getRandomItem = a => a[Math.floor(Math.random()*a.length)];
const config = {
    name: 'truth',
    alias: ['truthq'],
    category: 'fun',
    description: 'Random pertanyaan truth',
    usage: '.truth',
    example: '.truth',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m) {
    const question = getRandomItem(truthData);
    if (!question) {
        await m.reply('❌ Data tidak tersedia!');
        return;
    }
    await m.reply(`\`\`\`${question}\`\`\``);
}

export default { config, handler }
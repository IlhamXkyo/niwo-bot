const bucinData = ["Cinta itu sederhana, yang rumit adalah ekspektasi.", "Kalau senyum kamu bikin nyaman, jangan heran kalau ada yang betah.", "Jangan terlalu bucin, tetap jadi versi terbaik dirimu.", "Kadang yang paling indah adalah saling menghargai."];
const getRandomItem = a => a[Math.floor(Math.random()*a.length)];
const config = {
    name: 'bucin',
    alias: ['gombal', 'love', 'romantis'],
    category: 'fun',
    description: 'Random kata-kata bucin/romantis',
    usage: '.bucin',
    example: '.bucin',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 3,
    energi: 0,
    isEnabled: true
};

async function handler(m) {
    const quote = getRandomItem(bucinData);
    
    if (!quote) {
        await m.reply('❌ Data tidak tersedia!');
        return;
    }
    
    await m.reply(`\`\`\`"${quote}"\`\`\`\n\n`);
}

export default { config, handler }
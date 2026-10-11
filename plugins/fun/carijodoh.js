/**
 * plugins/fun/carijodoh.js : NIWO BOT
 * -------------------------------------------------------------------------
 * .carijodoh : pilih satu member grup secara acak lalu mention dia dengan
 * balasan iseng. Khusus grup.
 * -------------------------------------------------------------------------
 */

const ROASTS = [
    (tag) => `${tag} cieee yang kena.`,
    (tag) => `${tag} halah jomblo, cari jodoh di bot.`,
    (tag) => `${tag} cieee kena tag.`,
    (tag) => `${tag} wah kena random.`,
    (tag) => `${tag} jomblo sejati.`,
    (tag) => `${tag} selamat, kamu jodohnya hari ini.`,
    (tag) => `${tag} ditolak duluan sebelum nembak.`,
    (tag) => `${tag} cocok sama sinyal wifi, sama-sama susah diraih.`,
];

const handler = async (m, { conn, participants }) => {
    if (!m.isGroup) return m.reply('Fitur ini hanya dapat digunakan di grup.');

    // Pakai participants dari handler kalau sudah ada, biar tidak request ulang.
    let members = Array.isArray(participants) && participants.length
        ? participants.map(v => v.id || v.jid).filter(Boolean)
        : [];

    if (!members.length) {
        try {
            const metadata = await conn.groupMetadata(m.chat);
            members = (metadata?.participants || []).map(v => v.id).filter(Boolean);
        } catch {
            return m.reply('Gagal mengambil data member grup. Coba lagi sebentar lagi.');
        }
    }

    // Jangan pernah menjodohkan bot dengan dirinya sendiri.
    const botNumber = String(conn.user?.id || '').split(':')[0].split('@')[0];
    members = members.filter(id => !String(id).startsWith(botNumber));

    if (!members.length) return m.reply('Tidak ada member yang bisa dipilih di grup ini.');

    const target = members[Math.floor(Math.random() * members.length)];
    const tag = '@' + String(target).split('@')[0];
    const pilih = ROASTS[Math.floor(Math.random() * ROASTS.length)](tag);

    await conn.sendMessage(m.chat, {
        text: pilih,
        mentions: [target],
    }, { quoted: m.raw || m });
};

handler.command = ['carijodoh', 'jodohku', 'match'];
handler.help = ['carijodoh'];
handler.tags = ['fun'];
handler.isGroup = true;

export default handler;

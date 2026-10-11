import { getDatabase } from "../../src/lib/database.js";
const NIWO_WM = "NIWO BOT";
function wmText(text) {
  return `${NIWO_WM}\n\n${String(text ?? "")}`;
}
function installNiwoWM(m) {
  if (!m || typeof m.reply !== "function" || m.__niwoWM) return;
  const originalReply = m.reply.bind(m);
  m.reply = (text, options) => originalReply(wmText(text), options);
  m.__niwoWM = true;
}
async function addExpWithLevelCheck(sock, m, db, user, amount) {
  amount = Math.max(0, Number(amount) || 0);
  user.exp = (Number(user.exp) || 0) + amount;
  user.level = Math.max(1, Number(user.level) || 1);
  let leveledUp = false;
  while (user.exp >= user.level * 1000) {
    user.exp -= user.level * 1000;
    user.level++;
    leveledUp = true;
  }
  return { leveledUp, level: user.level, exp: user.exp, gained: amount };
}
async function sendRpgPreview(sock, chat, text, title, buttonText, options = {}) {
  const body = `${NIWO_WM}\n\n${title ? `*${title}*\n\n` : ""}${String(text ?? "")}`;
  if (sock?.sendMessage) {
    return sock.sendMessage(chat, { text: body }, { quoted: options?.quoted });
  }
  if (options?.quoted?.reply) return options.quoted.reply(body);
}

const config = {
  name: "challenge",
  alias: ["dailychallenge", "tantangan"],
  category: "rpg",
  description: "Daily challenge untuk hadiah spesial",
  usage: ".challenge",
  example: ".challenge",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

const CHALLENGES = [
  { name: "⚔️ Kalahkan 5 Monster", type: "kill", target: 5, reward: { gold: 500, exp: 200 } },
  { name: "🎣 Tangkap 3 Ikan", type: "fish", target: 3, reward: { gold: 300, exp: 150 } },
  { name: "⛏️ Tambang 10 Ore", type: "mine", target: 10, reward: { gold: 400, exp: 180 } },
  { name: "🌱 Panen 5 Hasil Kebun", type: "harvest", target: 5, reward: { gold: 350, exp: 160 } },
  { name: "🧪 Racik 3 Potion", type: "craft", target: 3, reward: { gold: 450, exp: 190 } },
  { name: "💰 Kumpulkan 1000 Koin", type: "earn", target: 1000, reward: { gold: 500, exp: 250 } },
  { name: "🗺️ Selesaikan 2 Ekspedisi", type: "expedition", target: 2, reward: { gold: 600, exp: 300 } },
];

function getNewDailyChallenge() {
  return {
    ...CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)],
    progress: 0,
    date: new Date().toDateString(),
    claimed: false,
  };
}

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  const today = new Date().toDateString();

  if (!user.rpg.dailyChallenge || user.rpg.dailyChallenge.date !== today) {
    user.rpg.dailyChallenge = getNewDailyChallenge();
    db.save();
  }

  const challenge = user.rpg.dailyChallenge;
  const isComplete = challenge.progress >= challenge.target;

  const args = m.args || [];
  const action = args[0]?.toLowerCase();

  if (action === "claim") {
    if (!isComplete) {
      return m.reply(`❌ Tantangannya belum selesai nih kak!\nProgress kamu baru: *${challenge.progress}/${challenge.target}*`);
    }

    if (challenge.claimed) {
      return m.reply(`Wah kak, hadiah untuk hari ini udah diambil! Tunggu tantangan baru besok ya! 😉`);
    }

    user.koin = (user.koin || 0) + challenge.reward.gold;
    await addExpWithLevelCheck(sock, m, db, user, challenge.reward.exp);

    challenge.claimed = true;
    db.save();

    await m.react?.("🎉");
    return m.reply(
      `🎉 *TANTANGAN HARIAN SELESAI!!* 🎉\n\n` +
        `Kerja bagus kak! Ini hadiah dari Guild buat kamu:\n` +
        `💰 Koin: *+Rp ${challenge.reward.gold.toLocaleString()}*\n` +
        `✨ EXP: *+${challenge.reward.exp}*\n` +
        `\n\n` +
        `> _Tantangan baru akan diberikan besok pagi!_`
    );
  }

  let txt = `📋 *TANTANGAN HARIAN GUILD* 📋\n\n`;
  txt += `Selesaikan tugas khusus hari ini untuk dapet uang jajan tambahan kak!\n\n`;
  
  txt += `*Tugas Kamu Hari Ini:*\n`;
  txt += `🎯 *${challenge.name}*\n`;
  txt += `📊 Progress: *${challenge.progress}/${challenge.target}*\n`;
  txt += `Status: ${isComplete ? "✅ *BISA DICLAIM!*" : "⏳ _Sedang dikerjakan..._"}\n\n`;

  txt += `*🎁 Hadiah Tambahan:*\n`;
  txt += `💰 Koin: *Rp ${challenge.reward.gold.toLocaleString()}*\n`;
  txt += `✨ EXP: *${challenge.reward.exp}*\n\n`;

  if (isComplete && !challenge.claimed) {
    txt += `> 💡 Yuk buruan ketik \`${m.prefix}challenge claim\` untuk klaim hadiahnya kak!`;
  } else if (challenge.claimed) {
    txt += `> ✅ Kamu hebat! Hadiah sudah diambil. Besok ada misi baru lagi ya!`;
  } else {
    txt += `> Semangat kerjainnya kak! Kalau udah selesai nanti ambil hadiahnya.`;
  }

  return m.reply(txt);
}

export default { config, handler };

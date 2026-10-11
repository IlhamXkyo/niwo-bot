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
  name: "nambalban",
  alias: ["tambal", "bengkel"],
  category: "rpg",
  description: "Buka jasa tambal ban, awas ban meledak!",
  usage: ".nambalban",
  example: ".nambalban",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 150,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 14;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Pompa angin macet, tangan kapalan! 🤕\n\nNambal butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Minum es teh dulu! 🧊`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("🛠️");
  await m.reply(`Sssshh... ngecek ban bocor pakai air sabun... 🫧\nKetemu paku nancep! 📍`);
  await new Promise(r => setTimeout(r, 3000));

  const gacha = Math.random();

  if (gacha < 0.15) {
    const healthLoss = 15;
    user.rpg.health = Math.max(0, (user.rpg.health ?? 100) - healthLoss);
    await m.react?.("💥");
    return m.reply(`DUAAAAR! BANNYA MELEDAK! 💥😭\n\nKamu mompa kerasa kenceng dan ban truk itu meledak di depan muka!\n💔 HP berkurang: -${healthLoss}\n⚡ Stamina: -${staminaCost}\n💵 Pendapatan: 0\n\nMuka item kena asep ban, apes bener! 💀`);
  }

  const earning = Math.floor(Math.random() * 20000) + 10000;
  user.koin = (user.koin || 0) + earning;
  const expGain = Math.floor(earning / 25);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  m.reply(`HASIL NAMBAL BAN! 🛠️✨\n\n💵 Pendapatan: *+Rp ${earning.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nSemoga di jalan nggak bocor lagi tuh orang! 💨`);
}

export default { config, handler };

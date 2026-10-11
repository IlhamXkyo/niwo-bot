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
  name: "parkir",
  alias: ["kangparkir", "markir"],
  category: "rpg",
  description: "Jadi tukang parkir minimarket, waspada satpol PP!",
  usage: ".parkir",
  example: ".parkir",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 120,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 12;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Kaki pegel kebanyakan berdiri! 😫\n\nMarkir butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Istirahat dulu di pos! 🏚️`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("🅿️");
  await m.reply(`Priiiit! Terus, terus, bales kiri dikit! 🏁\nMulai narik duit parkir di minimarket... 💰`);
  await new Promise(r => setTimeout(r, 3000));

  const gacha = Math.random();

  if (gacha < 0.1) {
    const denda = Math.floor(Math.random() * 5000) + 1000;
    user.koin = Math.max(0, (user.koin || 0) - denda);
    await m.react?.("🚨");
    return m.reply(`WADUH ADA RAZIA SATPOL PP! 🚓💨\n\nKamu lari terbirit-birit dan duit recehanmu jatuh senilai *Rp ${denda.toLocaleString("id-ID")}*!\n⚡ Stamina: -${staminaCost}\n\nApes banget hari ini! 😭`);
  } else if (gacha > 0.9) {
    const jackpot = Math.floor(Math.random() * 50000) + 20000;
    user.koin = (user.koin || 0) + jackpot;
    const expGain = Math.floor(jackpot / 20);
    await addExpWithLevelCheck(sock, m, db, user, expGain);
    await m.react?.("🤑");
    return m.reply(`JACKPOT! ADA MOBIL SPORT SULTAN! 🏎️✨\n\nPas mau keluar, kaca mobil turun dan sultan ngasih pecahan 100k!\n💵 Pendapatan: *+Rp ${jackpot.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nAlhamdulillah rejeki anak soleh! 🙏`);
  }

  const earning = Math.floor(Math.random() * 8000) + 2000;
  user.koin = (user.koin || 0) + earning;
  const expGain = Math.floor(earning / 20);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  m.reply(`HASIL MARKIR HARI INI! 🅿️✨\n\n💵 Pendapatan: *+Rp ${earning.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nReceh demi receh lama-lama jadi bukit! 💪`);
}

export default { config, handler };

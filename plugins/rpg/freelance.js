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
  name: "freelance",
  alias: ["desain", "koding"],
  category: "rpg",
  description: "Mengerjakan project online klien bule",
  usage: ".freelance",
  example: ".freelance",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 200,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 25;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Otak ngebul mikirin error! 🤯\n\nFreelance butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Refreshing dulu woi! 🌿`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("💻");
  await m.reply(`Ngetik kode / nggambar di laptop... ⌨️\nSemoga klien nggak minta revisi! 🙏`);
  await new Promise(r => setTimeout(r, 4000));

  const gacha = Math.random();

  if (gacha < 0.2) {
    await m.react?.("📉");
    return m.reply(`KLIEN KABUR GAK MAU BAYAR! 📉😡\n\nUdah dikerjain begadang 3 hari 3 malem, eh malah di-ghosting!\n💵 Bayaran: 0\n⚡ Stamina melayang: -${staminaCost}\n\nApes banget, lain kali harus pake DP! 😭`);
  } else if (gacha > 0.85) {
    const dollarRate = 16000;
    const payment = Math.floor(Math.random() * 10) + 5;
    const totalRupiah = payment * dollarRate;
    
    user.koin = (user.koin || 0) + totalRupiah;
    const expGain = Math.floor(totalRupiah / 30);
    await addExpWithLevelCheck(sock, m, db, user, expGain);
    
    await m.react?.("💸");
    return m.reply(`DIBAYAR PAKE DOLLAR OLEH BULE! 💸✨\n\nKlien luar negeri puas banget dan ngasih $${payment}!\n💵 Bayaran: *+Rp ${totalRupiah.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nUang jajan sultan menanti! 🤑`);
  }

  const earning = Math.floor(Math.random() * 40000) + 15000;
  user.koin = (user.koin || 0) + earning;
  const expGain = Math.floor(earning / 20);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  m.reply(`PROJECT SELESAI DAN ACC! 💻✨\n\n💵 Bayaran Lokal: *+Rp ${earning.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nLumayan buat beli kopi kapal api! ☕`);
}

export default { config, handler };

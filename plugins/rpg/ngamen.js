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
  name: "ngamen",
  alias: ["nyanyi", "konser"],
  category: "rpg",
  description: "Ngamen di jalanan untuk mencari koin",
  usage: ".ngamen",
  example: ".ngamen",
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
  
  const staminaCost = 10;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Suara serak, tenggorokan kering! 🥵\n\nNgamen butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Minum es teh dulu gih! ☕`);
  }

  user.rpg.stamina -= staminaCost;

  await m.react?.("🎸");

  const locations = [
    { name: "Perempatan Lampu Merah", min: 3000, max: 10000 },
    { name: "Warung Kopi", min: 5000, max: 15000 },
    { name: "Depan Minimarket", min: 4000, max: 12000 },
    { name: "Kafe Gaul", min: 8000, max: 25000 },
    { name: "Angkringan", min: 2000, max: 8000 }
  ];

  const loc = locations[Math.floor(Math.random() * locations.length)];
  const earning = Math.floor(Math.random() * (loc.max - loc.min + 1)) + loc.min;

  await m.reply(`Mulai jreng-jreng gitar di *${loc.name}*... 🎶\nSemoga hari ini banyak yang ngasih receh! 💸`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  user.koin = (user.koin || 0) + earning;

  const expGain = Math.floor(earning / 20);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");

  let txt = `ALHAMDULILLAH HASIL NGAMEN! 🎸✨\n\n`;
  txt += `Lokasi: *${loc.name}*\n`;
  txt += `💵 Pendapatan: *+Rp ${earning.toLocaleString("id-ID")}*\n`;
  txt += `📈 EXP: *+${expGain}*\n`;
  txt += `⚡ Stamina: *-${staminaCost}*\n\n`;
  txt += `Lumayan buat beli nasi bungkus hari ini! 🤤`;

  m.reply(txt);
}

export default { config, handler };

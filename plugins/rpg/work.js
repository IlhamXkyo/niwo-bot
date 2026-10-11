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
  name: "work",
  alias: ["kerja", "job"],
  category: "rpg",
  description: "Bekerja untuk mendapatkan uang",
  usage: ".work",
  example: ".work",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 180,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  const staminaCost = 10;
  user.rpg.stamina = user.rpg.stamina || 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Hadeh kak, badan kamu udah loyo banget! 🥵💦\n\nKerja butuh *${staminaCost} Stamina*, tapi sisa *${user.rpg.stamina}* doang.\nIstirahat dulu kek, jangan diforsir ntar tepar! 🛌💤`);
  }

  user.rpg.stamina -= staminaCost;

  const jobs = [
    { name: "👨‍🌾 Petani", min: 1000, max: 3000 },
    { name: "🧹 Cleaning Service", min: 2000, max: 5000 },
    { name: "📦 Kurir", min: 3000, max: 7000 },
    { name: "👨‍🍳 Koki", min: 4000, max: 10000 },
    { name: "👨‍💻 Programmer", min: 8000, max: 20000 },
    { name: "👨‍⚕️ Dokter", min: 15000, max: 30000 },
  ];

  const job = jobs[Math.floor(Math.random() * jobs.length)];
  const salary = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
  const expGain = Math.floor(salary / 10);

  await m.reply(`Otw berangkat kerja jadi *${job.name.substring(3)}* dulu kak! 🏃💼💨`);
  await new Promise((r) => setTimeout(r, 3000));

  user.koin = (user.koin || 0) + salary;
  const levelResult = await addExpWithLevelCheck(sock, m, db, user, expGain);

  db.save();

  let txt = `CIE YANG ABIS KERJA! 💸✨\n\n`;
  txt += `Gila, gajinya lumayan banget nih:\n`;
  txt += `💼 Profesi: *${job.name}*\n`;
  txt += `💵 Gaji Bersih: *+Rp ${salary.toLocaleString("id-ID")}*\n`;
  txt += `📈 EXP: *+${expGain}*\n`;
  txt += `⚡ Stamina: *-${staminaCost}*\n\n`;
  txt += `Kerja keras bagai quda membuahkan hasil kak! Lanjutkan! 🐴🔥`;

  await m.reply(txt);
}

export default { config, handler };

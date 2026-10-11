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
  name: "crime",
  alias: ["jahat"],
  category: "rpg",
  description: "Melakukan kejahatan membobol ATM (risiko tinggi)",
  usage: ".crime",
  example: ".crime",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 300,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  await m.react?.("💣");
  await m.reply("Memasang alat peretas di ATM seberang jalan... 💣💻");
  await new Promise((r) => setTimeout(r, 2500));

  const successRate = 0.5;
  const isSuccess = Math.random() < successRate;

  if (isSuccess) {
    const stolen = Math.floor(Math.random() * 15000) + 5000;
    const expGain = Math.floor(stolen / 20);

    user.koin = (user.koin || 0) + stolen;
    await addExpWithLevelCheck(sock, m, db, user, expGain);

    db.save();

    let txt = `HACKING SUKSES!! 💻💵\n\n`;
    txt += `Mesin ATM ngeluarin duit kayak air terjun! Lu langsung kabur bawa koper penuh duit.\n\n`;
    txt += `💰 Hasil Bobol: *+Rp ${stolen.toLocaleString("id-ID")}*\n`;
    txt += `📈 EXP Kriminal: *+${expGain}*`;

    await m.reply(txt);
  } else {
    const fine = Math.floor(Math.random() * 10000) + 5000;
    const actualFine = Math.min(fine, user.koin || 0);

    user.koin = Math.max(0, (user.koin || 0) - actualFine);
    user.rpg.health = Math.max(0, (user.rpg.health || 100) - 15);

    db.save();

    let txt = `NGIIING NGIING!! ALARM BUNYI!! 🚨🚓\n\n`;
    txt += `Sialan, mesinnya error dan polisi langsung ngepung dari segala arah!\n`;
    txt += `Lu dipentung pake tongkat polisi terus dipaksa bayar denda.\n\n`;
    txt += `💸 Denda Pidana: *-Rp ${actualFine.toLocaleString("id-ID")}*\n`;
    txt += `🤕 Memar Kena Pentung: *-15 HP*`;

    await m.reply(txt);
  }
}

export default { config, handler };

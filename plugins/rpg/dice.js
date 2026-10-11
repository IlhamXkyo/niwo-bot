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
  name: "dice",
  alias: ["dadu", "roll"],
  category: "rpg",
  description: "Lempar dadu untuk gambling",
  usage: ".dice <1-6> <bet>",
  example: ".dice 6 5000",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  const args = m.args || [];
  const guess = parseInt(args[0]);
  const bet = parseInt(args[1]);

  if (!guess || guess < 1 || guess > 6) {
    return m.reply(
      `🎲 *Bandar Dadu Jalanan* 🎲\n\n` +
        `Tebak angka yang bakal keluar! (1-6)\n\n` +
        `*Cara Main:*\n` +
        `👉 \`.dice <angka> <taruhan>\`\n\n` +
        `*Contoh:*\n` +
        `👉 \`.dice 6 5000\``
    );
  }

  if (!bet || bet < 1000) {
    return m.reply(`Mana ada bandar nerima taruhan segitu! Minimal bawa *Rp 1.000* sini! 🎲`);
  }

  if ((user.koin || 0) < bet) {
    return m.reply(`Duit lu kurang bos! Di saku cuma ada *Rp ${(user.koin || 0).toLocaleString("id-ID")}*. Jangan ngutang di mari! 😤`);
  }

  user.koin -= bet;

  await sendRpgPreview(sock, m.chat, `🎲 Bandar mengocok dadu di dalam mangkok kayu... *krok krok krok*...`, "🎲 DADU JALANAN", "Rolling!", { quoted: m });
  await new Promise((r) => setTimeout(r, 2500));

  const result = Math.floor(Math.random() * 6) + 1;
  const diceEmoji = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result - 1];

  const isWin = guess === result;

  let txt = `*MANGKOK DIBUKA!* 🎲💥\n\n`;
  txt += `Tebakan Lu: *${guess}*\n`;
  txt += `Mata Dadu: *${result}* ${diceEmoji}\n\n`;

  if (isWin) {
    const winnings = bet * 5;
    user.koin = (user.koin || 0) + winnings;
    txt += `🎉 *GILA LU HOKI BANGET!*\n`;
    txt += `💰 Uang Berlipat 5x: *+Rp ${winnings.toLocaleString("id-ID")}*`;
  } else {
    txt += `🤣 *HAHAHA MAMPUS LU SALAH!*\n`;
    txt += `💸 Duit Lu Ditarik Bandar: *-Rp ${bet.toLocaleString("id-ID")}*`;
  }

  db.save();
  await sendRpgPreview(sock, m.chat, txt, "🎲 HASIL DADU", "Result!", { quoted: m });
}

export default { config, handler };

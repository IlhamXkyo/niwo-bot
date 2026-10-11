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
  name: "buykoin",
  alias: ["belikoin", "belicoin", "exptokoin", "exptocoin"],
  category: "rpg",
  description: "Tukar EXP menjadi Koin",
  usage: ".buykoin <jumlah>",
  example: ".buykoin 10000",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const EXP_PER_KOIN = 2;

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  const args = m.args || [];
  const amountStr = args[0];

  if (!amountStr) {
    let txt = `💱 *Buy Koin*\n\n`;
    txt += `> Tukar EXP menjadi Koin!\n\n`;
    txt += `*📊 Kurs:*\n`;
    txt += `> 💎 ${EXP_PER_KOIN} EXP = 1 Koin\n\n`;
    txt += `*📋 Saldo:*\n`;
    txt += `> 🚄 EXP: *${(user.exp || 0).toLocaleString("id-ID")}*\n`;
    txt += `> 💰 Koin: *${(user.koin || 0).toLocaleString("id-ID")}*\n\n`;
    txt += `> Contoh: \`.buykoin 10000\`\n`;
    txt += `> Akan menggunakan ${10000 * EXP_PER_KOIN} EXP untuk 10.000 Koin`;

    return m.reply(txt);
  }

  let koinAmount = 0;
  if (amountStr === "all" || amountStr === "max") {
    koinAmount = Math.floor((user.exp || 0) / EXP_PER_KOIN);
  } else {
    koinAmount = parseInt(amountStr);
  }

  if (!koinAmount || koinAmount <= 0) {
    return m.reply(`❌ Masukkan jumlah koin yang valid!`);
  }

  const expNeeded = koinAmount * EXP_PER_KOIN;

  if ((user.exp || 0) < expNeeded) {
    const maxPossible = Math.floor((user.exp || 0) / EXP_PER_KOIN);
    return m.reply(
      `❌ *EXP tidak cukup!*\n\n` +
        `> Dibutuhkan: *${expNeeded.toLocaleString("id-ID")} EXP*\n` +
        `> EXP kamu: *${(user.exp || 0).toLocaleString("id-ID")} EXP*\n\n` +
        `> Maksimal: *${maxPossible.toLocaleString("id-ID")} Koin*`,
    );
  }

  // Use manual user update instead of updateKoin/updateExp to do batch update
  // But since logic was db.setUser, let's stick to update logic here
  const newExp = (user.exp || 0) - expNeeded;
  const newKoin = (user.koin || 0) + koinAmount;

  db.setUser(m.sender, {
    exp: newExp,
    koin: newKoin,
  });

  await m.react?.("💱");

  let txt = `💱 *Tukar Berhasil!*\n\n`;
  txt += `*📋 Detail:*\n`;
  txt += `> 🚄 EXP: *-${expNeeded.toLocaleString("id-ID")}*\n`;
  txt += `> 💰 Koin: *+${koinAmount.toLocaleString("id-ID")}*\n\n`;
  txt += `*📊 Saldo Sekarang:*\n`;
  txt += `> 🚄 EXP: *${newExp.toLocaleString("id-ID")}*\n`;
  txt += `> 💰 Koin: *${newKoin.toLocaleString("id-ID")}*`;

  m.reply(txt);
}

export default { config, handler };

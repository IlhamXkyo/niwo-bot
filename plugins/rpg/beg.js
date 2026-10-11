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
  name: "beg",
  alias: ["minta"],
  category: "rpg",
  description: "Mengemis untuk mendapatkan uang receh",
  usage: ".beg",
  example: ".beg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  await m.reply("🙏 *sᴇᴅᴀɴɢ ᴍᴇɴɢᴇᴍɪs...*");
  await new Promise((r) => setTimeout(r, 2000));

  const responses = [
    { success: true, money: 500, exp: 10, msg: "Seorang dermawan memberikanmu uang!" },
    { success: true, money: 1000, exp: 20, msg: "Kamu dapat tips dari orang baik!" },
    { success: true, money: 2000, exp: 50, msg: "WOW! Ada sultan yang kasihan!" },
    { success: false, money: 0, exp: 0, msg: "Tidak ada yang peduli..." },
    { success: false, money: 0, exp: 0, msg: "Orang-orang mengabaikanmu..." },
    { success: true, money: 100, exp: 5, msg: "Dapat receh dari kantong orang!" },
    { success: false, money: -500, exp: 0, msg: "Kamu malah dirampok pengemis lain!" },
  ];

  const result = responses[Math.floor(Math.random() * responses.length)];

  if (result.money > 0) {
    user.koin = (user.koin || 0) + result.money;
    if (result.exp > 0) {
      await addExpWithLevelCheck(sock, m, db, user, result.exp);
    }
  } else if (result.money < 0) {
    user.koin = Math.max(0, (user.koin || 0) + result.money);
  }

  db.save();

  let txt = "";
  if (result.success && result.money > 0) {
    txt = `🙏 *ɴɢᴇᴍɪs sᴜᴋsᴇs*\n\n> ${result.msg}\n> 💰 Dapat: *+Rp ${result.money.toLocaleString("id-ID")}*`;
    if (result.exp > 0) txt += `\n> 🚄 Exp: *+${result.exp}*`;
  } else if (result.money < 0) {
    txt = `😭 *ɴɢᴇᴍɪs ɢᴀɢᴀʟ*\n\n> ${result.msg}\n> 💸 Lost: *Rp ${Math.abs(result.money).toLocaleString("id-ID")}*`;
  } else {
    txt = `😢 *ɴɢᴇᴍɪs ɢᴀɢᴀʟ*\n\n> ${result.msg}`;
  }

  await m.reply(txt);
}

export default { config, handler };

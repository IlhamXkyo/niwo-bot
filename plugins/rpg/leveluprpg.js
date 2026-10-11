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
  name: "leveluprpg",
  alias: ["lvluprpg", "rpglevelup"],
  category: "rpg",
  description: "Toggle notifikasi level up RPG",
  usage: ".leveluprpg <on/off>",
  example: ".leveluprpg on",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);
  const args = m.args || [];
  const sub = args[0]?.toLowerCase();

  if (!user.settings) user.settings = {};

  if (sub === "on") {
    user.settings.rpgLevelupNotif = true;
    db.save();
    return m.reply(`✅ *ʀᴘɢ ʟᴇᴠᴇʟ ᴜᴘ ɴᴏᴛɪꜰ*\n\n` + `> Status: *ON* ✅\n` + `> Kamu akan menerima notifikasi RPG saat naik level!`);
  }

  if (sub === "off") {
    user.settings.rpgLevelupNotif = false;
    db.save();
    return m.reply(`❌ *ʀᴘɢ ʟᴇᴠᴇʟ ᴜᴘ ɴᴏᴛɪꜰ*\n\n` + `> Status: *OFF* ❌\n` + `> Notifikasi RPG level up dinonaktifkan.`);
  }

  const status = user.settings.rpgLevelupNotif !== false ? "ON ✅" : "OFF ❌";
  return m.reply(
    `🔔 *ʀᴘɢ ʟᴇᴠᴇʟ ᴜᴘ ɴᴏᴛɪꜰ*\n\n` +
      `> Status saat ini: *${status}*\n\n` +
      `*📋 *ᴜsᴀɢᴇ:*
\n` +
      `> > \`.leveluprpg on\` - Aktifkan\n` +
      `> > \`.leveluprpg off\` - Nonaktifkan\n` +
      ``,
  );
}

export default { config, handler };

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
  name: "gift",
  alias: ["kasih", "hadiah"],
  category: "rpg",
  description: "Beri hadiah ke pasangan untuk meningkatkan love",
  usage: ".gift <item> <jumlah>",
  example: ".gift diamond 1",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 30,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  if (!user.rpg.spouse) {
    return m.reply(`❌ *ʙᴇʟᴜᴍ ᴍᴇɴɪᴋᴀʜ*\n\n` + `> Kamu belum menikah!\n` + `> Nikah dulu dengan \`.marry @user\``);
  }

  const args = m.args || [];
  const itemKey = args[0]?.toLowerCase();
  const amount = parseInt(args[1]) || 1;

  if (!itemKey) {
    return m.reply(
      `🎁 *ɢɪꜰᴛ*\n\n` +
        `*📋 *ᴜsᴀɢᴇ:*
\n` +
        `> > Pilih item untuk diberikan\n` +
        `> > \`.gift diamond 1\`\n` +
        ``,
    );
  }

  user.inventory = user.inventory || {};

  if ((user.inventory[itemKey] || 0) < amount) {
    return m.reply(`❌ *ɪᴛᴇᴍ ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ*\n\n` + `> Item *${itemKey}* kamu: ${user.inventory[itemKey] || 0}\n` + `> Butuh: ${amount}`);
  }

  const spouseJid = user.rpg.spouse;
  const partner = db.getUser(spouseJid);

  if (!partner) {
    return m.reply(`❌ *ᴘᴀsᴀɴɢᴀɴ ɴᴏᴛ ꜰᴏᴜɴᴅ*\n\n> Pasangan tidak ditemukan di database!`);
  }

  partner.inventory = partner.inventory || {};

  user.inventory[itemKey] -= amount;
  partner.inventory[itemKey] = (partner.inventory[itemKey] || 0) + amount;

  user.rpg.love = (user.rpg.love || 0) + amount * 10;
  if (partner.rpg) partner.rpg.love = (partner.rpg.love || 0) + amount * 10;

  db.save();

  let txt = `🎁 *ɢɪꜰᴛ sᴜᴋsᴇs*\n\n`;
  txt += `> 💝 Kamu memberikan ${amount}x ${itemKey}\n`;
  txt += `> 👤 Untuk: @${spouseJid.split("@")[0]}\n`;
  txt += `> 💕 Love: +${amount * 10}\n\n`;
  txt += `> _So sweet! 💖_`;

  await m.reply(txt, { mentions: [spouseJid] });
}

export default { config, handler };

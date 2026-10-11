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
  name: "meditation",
  alias: ["rest", "istirahat", "tidur", "sleep"],
  category: "rpg",
  description: "Istirahat untuk pulihkan HP dan stamina",
  usage: ".meditation",
  example: ".meditation",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 600,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};

  const currentStamina = user.rpg.stamina ?? 100;
  const currentHealth = user.rpg.health || 100;
  const currentMana = user.rpg.mana || 50;

  const maxStamina = 100;
  const maxHealth = 100 + (user.level || 1) * 5;
  const maxMana = 50 + (user.level || 1) * 3;

  if (currentStamina >= maxStamina && currentHealth >= maxHealth && currentMana >= maxMana) {
    return m.reply(
      `💤 *sᴜᴅᴀʜ ꜰᴜʟʟ*\n\n` +
        `> ⚡ Stamina: ${currentStamina}/${maxStamina}\n` +
        `> ❤️ Health: ${currentHealth}/${maxHealth}\n` +
        `> 💙 Mana: ${currentMana}/${maxMana}\n\n` +
        `💡 Kamu sudah dalam kondisi prima!`,
    );
  }

  await m.react?.("💤");
  await m.reply(`💤 *ʙᴇʀɪsᴛɪʀᴀʜᴀᴛ...*\n\n> Memulihkan energi...`);
  await new Promise((r) => setTimeout(r, 3000));

  const staminaRecovered = Math.min(maxStamina - currentStamina, 40 + Math.floor(Math.random() * 20));
  const healthRecovered = Math.min(maxHealth - currentHealth, 30 + Math.floor(Math.random() * 20));
  const manaRecovered = Math.min(maxMana - currentMana, 25 + Math.floor(Math.random() * 15));

  user.rpg.stamina = Math.min(maxStamina, currentStamina + staminaRecovered);
  user.rpg.health = Math.min(maxHealth, currentHealth + healthRecovered);
  user.rpg.mana = Math.min(maxMana, currentMana + manaRecovered);

  db.save();

  await m.react?.("✨");
  return m.reply(
    `✨ *ɪsᴛɪʀᴀʜᴀᴛ sᴇʟᴇsᴀɪ!*\n\n` +
      `*💖 *ᴘᴜʟɪʜ:*
\n` +
      `> ⚡ Stamina: *+${staminaRecovered}* (${user.rpg.stamina}/${maxStamina})\n` +
      `> ❤️ Health: *+${healthRecovered}* (${user.rpg.health}/${maxHealth})\n` +
      `> 💙 Mana: *+${manaRecovered}* (${user.rpg.mana}/${maxMana})\n` +
      `\n\n` +
      `> Kamu merasa lebih segar! 🌟`,
  );
}

export default { config, handler };

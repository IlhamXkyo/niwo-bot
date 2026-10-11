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
  name: "stamina",
  alias: ["cekstamina"],
  category: "rpg",
  description: "Cek dan pulihkan stamina",
  usage: ".stamina / .stamina isi",
  example: ".stamina",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

function createStaminaBar(current, max) {
  const filled = Math.round((current / max) * 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);
  const args = m.args || [];

  if (!user.rpg) user.rpg = {};
  user.rpg.stamina = user.rpg.stamina ?? 100;
  user.rpg.maxStamina = user.rpg.maxStamina || 100;

  const subCmd = args[0]?.toLowerCase();

  if (subCmd === "isi" || subCmd === "restore" || subCmd === "heal") {
    const potionCost = 5000;

    if (user.rpg.stamina >= user.rpg.maxStamina) {
      return m.reply(`⚡ *sᴛᴀᴍɪɴᴀ ᴘᴇɴᴜʜ*\n\n> Stamina kamu sudah penuh!`);
    }

    if ((user.koin || 0) < potionCost) {
      return m.reply(`❌ *sᴀʟᴅᴏ ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ*\n\n` + `> Biaya: Rp ${potionCost.toLocaleString("id-ID")}\n` + `> Saldo: Rp ${(user.koin || 0).toLocaleString("id-ID")}`);
    }

    user.koin -= potionCost;
    const restored = user.rpg.maxStamina - user.rpg.stamina;
    user.rpg.stamina = user.rpg.maxStamina;

    db.save();

    await m.react?.("⚡");
    return sendRpgPreview(
      sock,
      m.chat,
      `⚡ *sᴛᴀᴍɪɴᴀ ᴅɪɪsɪ*\n\n` +
        `*💊 *ʀᴇsᴛᴏʀᴇ:*
\n` +
        `> ⚡ Stamina: *+${restored}*\n` +
        `> 💵 Biaya: *-Rp ${potionCost.toLocaleString("id-ID")}*\n` +
        `> 📊 Sekarang: *${user.rpg.stamina}/${user.rpg.maxStamina}*\n` +
        ``,
      "⚡ STAMINA",
      "Restore",
      { quoted: m },
    );
  }

  const staminaBar = createStaminaBar(user.rpg.stamina, user.rpg.maxStamina);

  let txt = `⚡ *sᴛᴀᴍɪɴᴀ sᴛᴀᴛᴜs*\n\n`;
  txt += `*📊 *ɪɴꜰᴏ:*
\n`;
  txt += `> ⚡ Stamina: *${user.rpg.stamina}/${user.rpg.maxStamina}*\n`;
  txt += `> 📊 [${staminaBar}]\n`;
  txt += `\n\n`;
  txt += `> Isi stamina: \`${m.prefix}stamina isi\` (Rp 5.000)\n`;
  txt += `> Stamina pulih otomatis setiap jam`;

  await sendRpgPreview(sock, m.chat, txt, "⚡ STAMINA", "Status", {
    quoted: m,
  });
}

export default { config, handler };

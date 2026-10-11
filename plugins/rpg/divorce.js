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
  name: "divorce",
  alias: ["ceraiin", "pisah"],
  category: "rpg",
  description: "Bercerai dari pasangan",
  usage: ".divorce",
  example: ".divorce",
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

  if (!user.rpg.spouse) {
    return m.reply(`Halu tingkat tinggi... Nikah aja belum masa udah mau cerai? 😂💔\nCari pasangan dulu gih pake \`.marry @user\``);
  }

  const spouseJid = user.rpg.spouse;
  const partner = db.getUser(spouseJid);

  const divorceCost = 25000;
  if ((user.koin || 0) < divorceCost) {
    return m.reply(`Aduh, biaya pengacara buat cerai mahal bos! 😭\nButuh *Rp 25.000* buat tanda tangan surat cerai, duit lu cuma *Rp ${(user.koin || 0).toLocaleString("id-ID")}*.\nTahan dulu aja berantemnya!`);
  }

  user.koin -= divorceCost;
  user.rpg.spouse = null;
  user.rpg.marriedAt = null;

  if (partner && partner.rpg) {
    partner.rpg.spouse = null;
    partner.rpg.marriedAt = null;
  }

  db.save();

  await m.react?.("💔");

  let txt = `⛈️ *SIDANG PERCERAIAN SELESAI* ⛈️\n\n`;
  txt += `Palu telah diketuk. Dengan berat hati, hubungan antara:\n`;
  txt += `💔 @${m.sender.split("@")[0]}\n`;
  txt += `         -- PUTUS DENGAN --\n`;
  txt += `💔 @${spouseJid.split("@")[0]}\n\n`;
  txt += `😭 *RESMI BERAKHIR! KINI KALIAN KEMBALI JOMBLO!* 😭\n\n`;
  txt += `💸 Biaya Pengacara/Sidang: *Rp -${divorceCost.toLocaleString("id-ID")}*\n\n`;
  txt += `> _"Sudah sudah... nangisnya di pojokan aja. Life must go on..." - Hakim Bot_ 🥀🚬`;

  await m.reply(txt, { mentions: [m.sender, spouseJid] });
}

export default { config, handler };

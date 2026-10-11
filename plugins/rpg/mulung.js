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
  name: "mulung",
  alias: ["scavenge", "kumpulsampah"],
  category: "rpg",
  description: "Memulung untuk mengumpulkan barang",
  usage: ".mulung",
  example: ".mulung",
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
  if (!user.inventory) user.inventory = {};

  const staminaCost = 15;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Yaela kak, mulung aja butuh tenaga kali! 🥵🗑️\n\nStamina kamu sisa *${user.rpg.stamina}*, padahal butuh *${staminaCost}*. Istirahat gih! 🛌💤`);
  }

  user.rpg.stamina -= staminaCost;

  await m.react?.("🗑️");
  await m.reply(`Mengorek tempat sampah dengan penuh harapan... 🗑️👀\nSemoga hari ini dapet barang bagus! ✨`);
  await new Promise((r) => setTimeout(r, 3000));

  const drops = [
    { item: "botol", name: "🍶 Botol", min: 1, max: 10 },
    { item: "kaleng", name: "🥫 Kaleng", min: 1, max: 8 },
    { item: "kardus", name: "📦 Kardus", min: 1, max: 5 },
    { item: "sampah", name: "🗑️ Sampah", min: 1, max: 15 },
    { item: "koran", name: "📰 Koran", min: 0, max: 3 },
  ];

  let results = [];
  let moneyEarned = 0;

  for (const drop of drops) {
    const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
    if (qty > 0) {
      user.inventory[drop.item] = (user.inventory[drop.item] || 0) + qty;
      results.push({ name: drop.name, qty });
      moneyEarned += qty * Math.floor(Math.random() * 50 + 10);
    }
  }

  user.koin = (user.koin || 0) + moneyEarned;

  const expGain = Math.floor(Math.random() * 200) + 50;
  const levelResult = await addExpWithLevelCheck(sock, m, db, user, expGain);

  db.save();

  await m.react?.("✅");

  let txt = `ASIK DAPET RONGSOKAN! 🗑️💸\n\n`;
  txt += `Kamu berhasil ngumpulin barang rongsokan nih kak:\n`;
  for (const r of results) {
    txt += `• ${r.name}: *+${r.qty}*\n`;
  }
  txt += `\nRongsokannya langsung dijual ke pengepul ya!\n`;
  txt += `💵 Hasil Jual: *+Rp ${moneyEarned.toLocaleString("id-ID")}*\n`;
  txt += `📈 EXP: *+${expGain}*\n`;
  txt += `⚡ Stamina terpakai: *-${staminaCost}*\n\n`;
  txt += `Teruslah memulung sampai kaya raya! 🔥🚀`;

  m.reply(txt);
}

export default { config, handler };

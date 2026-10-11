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
  name: "woodcut",
  alias: ["chop", "nebang"],
  category: "rpg",
  description: "Menebang pohon untuk mendapatkan kayu",
  usage: ".woodcut",
  example: ".woodcut",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
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
  user.rpg.stamina = user.rpg.stamina || 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Tangan kamu udah lecet kak megang kapak terus! 🥵🪓\n\nNebang butuh *${staminaCost} Stamina*, kamu cuma punya *${user.rpg.stamina}*. Istirahat kek! 🛌💤`);
  }

  user.rpg.stamina -= staminaCost;

  await m.react?.("🪓");
  await m.reply("Ctak! Ctak! Tumbangg! 🪓🌳\nMenebang pohon besar dengan sekuat tenaga...");
  await new Promise((r) => setTimeout(r, 3000));

  const drops = [
    { item: "wood", chance: 70, name: "🪵 Kayu", min: 2, max: 5 },
    { item: "stick", chance: 50, name: "🥢 Ranting", min: 1, max: 3 },
    { item: "apple", chance: 20, name: "🍎 Apel", min: 1, max: 2 },
    { item: "rubber", chance: 10, name: "⚫ Karet", min: 1, max: 1 },
  ];

  let results = [];
  for (const drop of drops) {
    if (Math.random() * 100 <= drop.chance) {
      const qty = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
      user.inventory[drop.item] = (user.inventory[drop.item] || 0) + qty;
      results.push({ name: drop.name, qty });
    }
  }

  if (results.length === 0) {
    user.inventory["wood"] = (user.inventory["wood"] || 0) + 1;
    results.push({ name: "🪵 Kayu", qty: 1 });
  }

  const expGain = Math.floor(Math.random() * 200) + 50;
  const levelResult = await addExpWithLevelCheck(sock, m, db, user, expGain);

  db.save();

  await m.react?.("✅");

  let txt = `POHONNYA TUMBANG! 🪓✨\n\n`;
  txt += `Kamu mungutin barang-barang ini:\n`;
  for (const r of results) {
    txt += `• ${r.name}: *+${r.qty}*\n`;
  }
  txt += `\n📈 EXP: *+${expGain}*\n`;
  txt += `⚡ Stamina: *-${staminaCost}*\n\n`;
  txt += `Awas encok kak, kalau capek istirahat (\`.heal\`) ya! 🥵🍃`;

  await m.reply(txt);
}

export default { config, handler };

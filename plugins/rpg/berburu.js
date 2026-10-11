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
  name: "berburu",
  alias: ["huntanimal", "buru"],
  category: "rpg",
  description: "Berburu hewan untuk mendapat item",
  usage: ".berburu",
  example: ".berburu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 120,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  if (!user.inventory) user.inventory = {};

  const staminaCost = 25;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Aduh kak, stamina kamu abis nih! 😭⚡\n\nBuat berburu butuh *${staminaCost} Stamina*, tapi punya kamu sisa *${user.rpg.stamina}*.\nIstirahat dulu gih biar seger lagi! 🛌💤`);
  }

  user.rpg.stamina -= staminaCost;

  await m.react?.("🏹");
  await m.reply(`Mengendap-endap masuk ke hutan... 🤫🌳\nSiapin panah dan bidik dengan teliti! 🏹👀`);
  await new Promise((r) => setTimeout(r, 3000));

  const animals = [
    { name: "🐰 Kelinci", item: "daging_kelinci", chance: 80, min: 1, max: 3, exp: 50, money: 500 },
    { name: "🦌 Rusa", item: "daging_rusa", chance: 50, min: 1, max: 2, exp: 100, money: 1500 },
    { name: "🐗 Babi Hutan", item: "daging_babi", chance: 40, min: 1, max: 2, exp: 150, money: 2000 },
    { name: "🦊 Rubah", item: "bulu_rubah", chance: 30, min: 1, max: 1, exp: 200, money: 3000 },
    { name: "🐻 Beruang", item: "cakar_beruang", chance: 15, min: 1, max: 1, exp: 500, money: 10000 },
    { name: "🦁 Singa", item: "taring_singa", chance: 5, min: 1, max: 1, exp: 1000, money: 25000 },
  ];

  const caught = animals.filter((a) => Math.random() * 100 <= a.chance);

  if (caught.length === 0) {
    await m.react?.("😢");
    db.save();
    return m.reply(`Yahh, apes banget hari ini kak! 😭😭\n\nHewannya pada lari semua, nggak dapet apa-apa deh.\nPadahal stamina udah kepotong *-${staminaCost}* ⚡. Sabar ya, coba lagi nanti! 🥺🌿`);
  }

  let results = [];
  let totalExp = 0;
  let totalMoney = 0;

  for (const animal of caught.slice(0, 3)) {
    const qty = Math.floor(Math.random() * (animal.max - animal.min + 1)) + animal.min;
    user.inventory[animal.item] = (user.inventory[animal.item] || 0) + qty;
    totalExp += animal.exp * qty;
    totalMoney += animal.money * qty;
    results.push({ name: animal.name, qty, money: animal.money * qty });
  }

  user.koin = (user.koin || 0) + totalMoney;
  const levelResult = await addExpWithLevelCheck(sock, m, db, user, totalExp);

  db.save();

  await m.react?.("✅");

  let txt = `CROOT! Kena sasaran kak! 🎯🏹\n\nKamu pulang bawa hasil buruan nih:\n`;
  for (const r of results) {
    txt += `• ${r.name}: *+${r.qty} ekor*\n`;
  }
  txt += `\nHasil buruannya otomatis kejual ya! 🎉\n`;
  txt += `💸 Koin: *+Rp ${totalMoney.toLocaleString("id-ID")}*\n`;
  txt += `📈 EXP: *+${totalExp}*\n`;
  txt += `⚡ Stamina terpakai: *-${staminaCost}*\n\n`;
  txt += `Mantap banget, besok-besok berburu lagi ya kak! 🔥🥩`;

  m.reply(txt);
}

export default { config, handler };

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
  name: "jualan",
  alias: ["dagang", "pedagang"],
  category: "rpg",
  description: "Dagang asongan keliling",
  usage: ".jualan",
  example: ".jualan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 180,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 18;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Kaki lemes kebanyakan keliling! 🥵\n\nJualan butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Ngiyup bentar! 🏖️`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("🛒");
  await m.reply(`Cangcimen cangcimen! Kacang kuaci permen! 🍬\nNawarin dagangan ke orang lewat... 🗣️`);
  await new Promise(r => setTimeout(r, 3000));

  const gacha = Math.random();

  if (gacha < 0.2) {
    const rugi = Math.floor(Math.random() * 10000) + 5000;
    user.koin = Math.max(0, (user.koin || 0) - rugi);
    await m.react?.("🌧️");
    return m.reply(`HUJAN DERAS! DAGANGAN SEPI! 🌧️🥶\n\nNggak ada yang beli dan dagangan kerupukmu melempem semua.\nKerugian Modal: *Rp ${rugi.toLocaleString("id-ID")}*\n⚡ Stamina: -${staminaCost}\n\nBesok harus liat prakiraan cuaca nih! ☂️`);
  } else if (gacha > 0.85) {
    const lakuKeras = Math.floor(Math.random() * 80000) + 40000;
    user.koin = (user.koin || 0) + lakuKeras;
    const expGain = Math.floor(lakuKeras / 20);
    await addExpWithLevelCheck(sock, m, db, user, expGain);
    await m.react?.("🤑");
    return m.reply(`ADA BROMTON LEWAT DIBORONG SEMUA! 🚴‍♂️✨\n\nRombongan sepeda elit mampir dan ngeborong semua isotonik sama cangcimen!\n💵 Omzet Mendadak: *+Rp ${lakuKeras.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nBisa langsung pulang gasik ini mah! 🎉`);
  }

  const earning = Math.floor(Math.random() * 25000) + 10000;
  user.koin = (user.koin || 0) + earning;
  const expGain = Math.floor(earning / 20);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  m.reply(`DAGANGAN LAKU STANDAR! 🛒✨\n\n💵 Omzet: *+Rp ${earning.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nBesok kulakan lagi ah! 🛍️`);
}

export default { config, handler };

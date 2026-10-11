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
  name: "kurir",
  alias: ["antar", "paket"],
  category: "rpg",
  description: "Nganter paket orang, awas anjing galak!",
  usage: ".kurir",
  example: ".kurir",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 120,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 15;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Pinggang encok kebanyakan bawa kardus! 😩\n\nKurir butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Ngurut dulu gih! 💆‍♂️`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("📦");
  await m.reply(`Pakettt!!! 📦\nMencari alamat yang sesuai di maps... 🗺️`);
  await new Promise(r => setTimeout(r, 3000));

  const gacha = Math.random();

  if (gacha < 0.2) {
    const extraStamina = 10;
    user.rpg.stamina = Math.max(0, user.rpg.stamina - extraStamina);
    
    const expGain = 500;
    await addExpWithLevelCheck(sock, m, db, user, expGain);
    
    await m.react?.("🐕");
    return m.reply(`GUK GUK GUK! DIKEJAR ANJING GALAK! 🐕💨\n\nKamu lari keliling komplek demi nyelametin paket orang!\n⚡ Stamina Tambahan: -${extraStamina}\n📈 EXP Kompensasi Lari: *+${expGain}*\n💵 Pendapatan: 0 (Paketnya dilempar ke pagar)\n\nNafas ngos-ngosan banget asli! 🥵`);
  }

  const items = ["Dokumen Rahasia", "Baju Online", "Skincare Bini Orang", "Panci Emak-emak"];
  const item = items[Math.floor(Math.random() * items.length)];
  const earning = Math.floor(Math.random() * 15000) + 5000;
  let tips = 0;

  if (gacha > 0.8) {
    tips = Math.floor(Math.random() * 10000) + 2000;
  }

  const totalEarning = earning + tips;
  user.koin = (user.koin || 0) + totalEarning;
  const expGain = Math.floor(totalEarning / 20);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  let txt = `ALHAMDULILLAH PAKET SAMPAI! 📦✨\n\nBarang: *${item}*\n💵 Ongkir: *+Rp ${earning.toLocaleString("id-ID")}*\n`;
  if (tips > 0) txt += `🎁 Tips Tambahan: *+Rp ${tips.toLocaleString("id-ID")}*\n`;
  txt += `📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nBerhasil nganter tepat waktu! 🚚💨`;
  m.reply(txt);
}

export default { config, handler };

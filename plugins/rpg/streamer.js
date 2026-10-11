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
  name: "streamer",
  alias: ["live", "vtuber"],
  category: "rpg",
  description: "Live streaming game dapet donasi besar tapi resiko dibanned platform!",
  usage: ".streamer",
  example: ".streamer",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 180,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, plugin }) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);

  if (!user.rpg) user.rpg = {};
  
  const staminaCost = 20;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Mata sepet kebanyakan natap layar! 😵\n\nStreaming butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Tidur dulu woi! 🛏️`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("🎥");
  await m.reply(`Halo guys, welcome back to my live stream! 🎮\nMari kita unjuk skill main game cacing... 😎`);
  await new Promise(r => setTimeout(r, 3500));

  const gacha = Math.random();

  if (gacha < 0.15) {
    const extraCooldown = 300;
    db.db.data.users[m.sender.split("@")[0]].lastStreamer = Date.now() + (extraCooldown * 1000);
    
    await m.react?.("🚫");
    return m.reply(`AKUN STREAMING KAMU DI-BANNED! 🚫😱\n\nAda viewers iseng yang ngereport akun kamu gara-gara afk terlalu lama!\nKamu tidak dapet donasi apa-apa dan **terkena penalti larangan streaming selama 5 menit ekstra**!\n\n⚡ Stamina tetap berkurang: -${staminaCost}\n\nSabar ya bang, coba ajuin banding... 😔`);
  }

  const earning = Math.floor(Math.random() * 30000) + 10000;
  let saweranPaus = 0;

  if (gacha > 0.85) {
    saweranPaus = Math.floor(Math.random() * 100000) + 50000;
  }

  const totalEarning = earning + saweranPaus;
  user.koin = (user.koin || 0) + totalEarning;
  const expGain = Math.floor(totalEarning / 30);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  let txt = `LIVE STREAMING SELESAI! 🎥✨\n\n💵 Pendapatan Iklan: *+Rp ${earning.toLocaleString("id-ID")}*\n`;
  if (saweranPaus > 0) txt += `🐳 SAWERAN SULTAN: *+Rp ${saweranPaus.toLocaleString("id-ID")}*\nWah, ada penonton sultan nyawer paus! 🐋🔥\n`;
  txt += `📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nMakasih yang udah nyawer! Lopyu pull! 💖`;
  
  m.reply(txt);
}

export default { config, handler };

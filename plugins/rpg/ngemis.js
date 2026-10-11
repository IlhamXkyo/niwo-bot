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
  name: "ngemis",
  alias: ["gembel"],
  category: "rpg",
  description: "Ngemis di jalanan dengan peluang dapat Nasi Bungkus (Tambah stamina)",
  usage: ".ngemis",
  example: ".ngemis",
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
  
  const staminaCost = 5;
  user.rpg.stamina = user.rpg.stamina ?? 100;

  if (user.rpg.stamina < staminaCost) {
    return m.reply(`Tenaga habis buat melas! 🥺\n\nNgemis butuh *${staminaCost} Stamina*, sisa stamina kamu *${user.rpg.stamina}*. Nggak kuat mangap lagi... 💔`);
  }

  user.rpg.stamina -= staminaCost;
  await m.react?.("🤲");
  await m.reply(`Pak, bu, minta sedekahnya sedikit... 🥺\nBerharap ada dermawan lewat di perempatan ini... 🚶‍♂️`);
  await new Promise(r => setTimeout(r, 3000));

  const gacha = Math.random();

  if (gacha < 0.3) {
    const heal = Math.floor(Math.random() * 20) + 10;
    user.rpg.stamina = Math.min(100, user.rpg.stamina + heal);
    await m.react?.("🍱");
    return m.reply(`ALHAMDULILLAH DIKASIH NASI PADANG! 🍱✨\n\nAda bapak-bapak baik hati yang ngasih kamu bungkus nasi sisa rapet!\n💖 Stamina bertambah: *+${heal}*\n💵 Uang didapat: 0\n\nWah, perut kenyang hati senang! 🥰`);
  }

  if (gacha > 0.9) {
    await m.react?.("💢");
    return m.reply(`DIUSIR PREMAN PASAR! 💢\n\n"Woi, ini lapak gue! Pergi lo!"\nKamu lari ketakutan tanpa dapet sepeser pun...\n⚡ Stamina: -${staminaCost}\n\nSusah banget nyari lahan ngemis jaman sekarang! 😭`);
  }

  const earning = Math.floor(Math.random() * 3000) + 500;
  user.koin = (user.koin || 0) + earning;
  const expGain = Math.floor(earning / 10);
  await addExpWithLevelCheck(sock, m, db, user, expGain);

  await m.react?.("✅");
  m.reply(`HASIL NGEMIS HARI INI! 🤲✨\n\n💵 Pendapatan Receh: *+Rp ${earning.toLocaleString("id-ID")}*\n📈 EXP: *+${expGain}*\n⚡ Stamina: -${staminaCost}\n\nBersyukur atas nikmat hari ini, walau receh yang penting halal! 🙏`);
}

export default { config, handler };

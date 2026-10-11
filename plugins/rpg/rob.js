import { getDatabase } from "../../src/lib/database.js";
import { WEAPONS } from "./blackmarket.js";
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

function getEquippedWeapon(user) {
  const key = user?.rpg?.equippedWeapon;
  if (!key || !WEAPONS[key]) return null;
  const owned = user?.inventory?.[`bm_${key}`] || 0;
  if (owned <= 0) return null;
  return { key, ...WEAPONS[key] };
}

function fmtRupiah(n) {
  return `Rp ${Math.max(0, Math.floor(n)).toLocaleString("id-ID")}`;
}

const config = {
  name: "rob",
  alias: ["rampok", "mug"],
  category: "rpg",
  description: "Rampok uang player lain, bisa bawa senjata dari black market (berisiko)",
  usage: ".rob @user",
  example: ".rob @user",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 600,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  installNiwoWM(m);
  const db = getDatabase();

  const target = m.mentionedJid?.[0] || m.quoted?.sender;

  if (!target) {
    return m.reply(`Hayo, mau malak siapa nih? 🦹‍♂️🔪\nTag target yang mau dirampok hartanya!\nContoh: \`.rob @user\``);
  }

  if (target === m.sender) {
    return m.reply(`Sakit jiwa lu? Masa ngerampok dompet sendiri! 😂❌`);
  }

  const robber = db.getUser(m.sender);
  const victim = db.getUser(target);

  if (!victim) {
    return m.reply(`Target buronanmu nggak ketemu di database! Kayaknya dia udah kabur duluan. 🏃💨`);
  }

  if (!robber.rpg) robber.rpg = {};
  robber.rpg.health = robber.rpg.health ?? 100;

  // Cek status "buron" / masih dalam pantauan polisi
  if (robber.rpg.jailUntil && robber.rpg.jailUntil > Date.now()) {
    const remain = Math.ceil((robber.rpg.jailUntil - Date.now()) / 60000);
    return m.reply(`🚔 Lu lagi masuk *daftar buronan polisi*! Ngumpet dulu sana, jangan macem-macem selama *${remain} menit* lagi.`);
  }

  if ((victim.koin || 0) < 1000) {
    return m.reply(`Yaelah, target lu miskin parah! Duitnya di bawah Rp 1.000, masa tega dirampok? Cari mangsa yang tajir dong! 😤`);
  }

  if (robber.rpg.health < 30) {
    return m.reply(`Woy bos, badan lu tinggal tulang gitu masih nekat ngerampok?! 🤒\nMinimal *30 HP*, darah lu cuma *${robber.rpg.health} HP*. Berobat sana!`);
  }

  const robberWeapon = getEquippedWeapon(robber);
  const victimWeapon = getEquippedWeapon(victim);
  const robberPower = robberWeapon?.power || 0;
  const victimPower = victimWeapon?.power || 0;

  const sneakLine = robberWeapon
    ? `*Sssstttt...* Bersembunyi di gang gelap sambil megang *${robberWeapon.name}*, nunggu target lewat... 🦹‍♂️`
    : `*Sssstttt...* Bersembunyi di gang gelap nunggu target lewat, modal nekat doang tanpa senjata... 🦹‍♂️`;

  await sendRpgPreview(sock, m.chat, sneakLine, "🦹 BEGAL", "Beraksi!", { quoted: m });
  await new Promise((r) => setTimeout(r, 2000));

  // === TAHAP 1: apakah korban melawan (cuma bisa kalau korban bawa senjata) ===
  if (victimWeapon) {
    const resistChance = Math.min(60, Math.max(10, 15 + victimPower * 0.3 - robberPower * 0.15));
    const victimResists = Math.random() * 100 < resistChance;

    if (victimResists) {
      await sendRpgPreview(
        sock,
        m.chat,
        `*"JANGAN HARAP LU DAPET DUIT GUA!"*\n\n@${target.split("@")[0]} ternyata bawa *${victimWeapon.name}* dan langsung melawan balik! 😱🔫`,
        "⚠️ PERLAWANAN!",
        null,
        { quoted: m }
      );
      await new Promise((r) => setTimeout(r, 2200));

      const robberRoll = (robberPower + 10) * (0.6 + Math.random() * 0.7);
      const victimRoll = (victimPower + 10) * (0.6 + Math.random() * 0.7);

      if (victimRoll >= robberRoll) {
        // Robber kalah baku hantam
        const healthLoss = 30 + Math.floor(Math.random() * 25);
        const fine = Math.floor((robber.koin || 0) * (0.1 + Math.random() * 0.15));
        robber.rpg.health = Math.max(1, robber.rpg.health - healthLoss);
        robber.koin = Math.max(0, (robber.koin || 0) - fine);

        // Baku tembak = rame, polisi hampir pasti dateng
        const policeCaught = Math.random() * 100 < 70;
        let jailTxt = "";
        if (policeCaught) {
          const jailMinutes = 15 + Math.floor(Math.random() * 20);
          robber.rpg.jailUntil = Date.now() + jailMinutes * 60000;
          jailTxt = `\n🚔 Suara ${robberWeapon ? "tembakan" : "keributan"} bikin warga lapor polisi! Lu masuk *daftar buronan* selama *${jailMinutes} menit*, gabisa ngerampok dulu!`;
        }

        db.save();

        let txt = `GAGAL TOTAL! LU YANG DIRAMPOK BALIK! 🩸😵\n\n`;
        txt += `@${target.split("@")[0]} lebih jago, lu malah babak belur dan kabur tunggang langgang!\n\n`;
        txt += `🤕 HP Lu: *-${healthLoss}* (sisa ${robber.rpg.health})\n`;
        txt += `💸 Duit Ngucur buat Berobat: *-${fmtRupiah(fine)}*`;
        txt += jailTxt;

        return m.reply(txt, { mentions: [target] });
      } else {
        await sendRpgPreview(sock, m.chat, `Untung refleks lu bagus, senjata korban berhasil lu tepis! Lanjut gasss...! 💪`, null, null, { quoted: m });
        await new Promise((r) => setTimeout(r, 1500));
        // lanjut ke roll sukses di bawah, dengan penalti kecil karena sempat baku hantam
      }
    }
  }

  // === TAHAP 2: roll sukses/gagal rampok ===
  const successRate = Math.min(0.85, Math.max(0.08, 0.4 + robberPower * 0.0035 - victimPower * 0.002));
  const isSuccess = Math.random() < successRate;

  if (isSuccess) {
    const maxSteal = Math.floor((victim.koin || 0) * 0.3);
    const stolen = Math.floor(Math.random() * maxSteal) + 1000;

    victim.koin = (victim.koin || 0) - stolen;
    robber.koin = (robber.koin || 0) + stolen;

    const expGain = robberWeapon ? 400 : 300;
    await addExpWithLevelCheck(sock, m, db, robber, expGain);

    // Resiko polisi habis beraksi, makin gede kalo bawa senjata makin mahal/gahar
    const policeRisk = robberWeapon ? robberWeapon.policeRisk : 6;
    const policeCaught = Math.random() * 100 < policeRisk;

    let txt = `MANTAP! TARGET BERHASIL DIPALAK! 🦹‍♂️💰\n\n`;
    txt += `Lu berhasil nakutin si @${target.split("@")[0]} sampai ngencing di celana!\n`;
    txt += `Uang hasil palakan: *+${fmtRupiah(stolen)}*\n`;
    txt += `Bonus EXP Begal: *+${expGain}*\n`;

    if (policeCaught) {
      const confiscated = Math.floor(stolen * (0.4 + Math.random() * 0.35));
      robber.koin = Math.max(0, robber.koin - confiscated);
      const jailMinutes = robberWeapon ? 10 + Math.floor(Math.random() * 15) : 5 + Math.floor(Math.random() * 10);
      robber.rpg.jailUntil = Date.now() + jailMinutes * 60000;

      txt += `\n\n🚨 *SIALAN, KETANGKEP POLISI PAS KABUR!*\n`;
      txt += `Duit hasil rampokan disita: *-${fmtRupiah(confiscated)}*\n`;
      txt += `🚔 Lu jadi buronan selama *${jailMinutes} menit*, gabisa ngerampok dulu!`;
    } else {
      txt += `\n*Buru kabur sebelum polis dateng!!!* 🚓💨`;
    }

    db.save();
    return m.reply(txt, { mentions: [target] });
  } else {
    const fine = Math.floor(Math.random() * 10000) + 5000;
    const actualFine = Math.min(fine, robber.koin || 0);
    const healthLoss = 25;

    robber.koin = Math.max(0, (robber.koin || 0) - actualFine);
    robber.rpg.health = Math.max(0, robber.rpg.health - healthLoss);

    let jailTxt = "";
    if (robberWeapon) {
      // Ketauan bawa senjata ilegal pas gagal = lebih parah
      const jailMinutes = 5 + Math.floor(Math.random() * 10);
      robber.rpg.jailUntil = Date.now() + jailMinutes * 60000;
      jailTxt = `\n🚔 Parah, lu ketauan bawa *${robberWeapon.name}* ilegal! Masuk daftar buronan *${jailMinutes} menit*.`;
    }

    db.save();

    let txt = `GOBLOK! KETAHUAN WARGA!! 🚨🤬\n\n`;
    txt += `Bukannya dapet duit, lu malah ketangkep basah terus *digebukin warga 1 RT*!\n`;
    txt += `💸 Duit lu disita RT: *-${fmtRupiah(actualFine)}*\n`;
    txt += `🤕 Badan Babak Belur: *-${healthLoss} HP*`;
    txt += jailTxt;
    txt += `\n\n*MAMPUS LU, makanya jangan main-main di mari!* 🤣`;

    return m.reply(txt);
  }
}

export default { config, handler };

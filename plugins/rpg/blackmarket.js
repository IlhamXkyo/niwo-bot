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

const config = {
  name: "blackmarket",
  alias: ["bm", "pasargelap", "darkmarket"],
  category: "rpg",
  description: "Pasar gelap tempat beli senjata api ilegal buat ngerampok",
  usage: ".blackmarket <buy/equip/inventory> <senjata>",
  example: ".blackmarket buy pistol",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

// Makin mahal & makin kuat -> makin gede juga resiko keincer polisi
export const WEAPONS = {
  clurit: { name: "🔪 Celurit Karatan", price: 3000, power: 8, policeRisk: 3, levelReq: 1, desc: "Modal nekat doang, tapi lumayan buat gertak" },
  knuckle: { name: "🥊 Kuningan Tangan", price: 8000, power: 15, policeRisk: 5, levelReq: 1, desc: "Buat mukul doang, lumayan bikin gentar" },
  airsoft: { name: "🔫 Airsoft Gun", price: 20000, power: 25, policeRisk: 8, levelReq: 3, desc: "Mirip asli, korban suka panik duluan" },
  revolver: { name: "🔫 Revolver Rakitan", price: 50000, power: 40, policeRisk: 15, levelReq: 5, desc: "Buatan lokal, sekali tembak jantungan" },
  pistol: { name: "🔫 Pistol Selundupan", price: 120000, power: 55, policeRisk: 25, levelReq: 8, desc: "Barang import, mahal tapi ampuh" },
  shotgun: { name: "💥 Sawed-off Shotgun", price: 300000, power: 75, policeRisk: 35, levelReq: 12, desc: "Sekali dor, target auto nurut" },
  smg: { name: "🔫 SMG Rakitan", price: 700000, power: 95, policeRisk: 50, levelReq: 18, desc: "Rapid fire, target ciut duluan" },
  ak47: { name: "🪖 AK-47 Black Market", price: 2000000, power: 130, policeRisk: 65, levelReq: 25, desc: "Paling gahar, tapi paling diincer polisi" },
};

function weaponList() {
  let txt = `🕶️ *PASAR GELAP* 🕶️\n\n`;
  txt += `_Psstt... jangan berisik, semua barang di sini ilegal._\n`;
  txt += `Makin gahar senjatanya, makin gede juga resiko keincer polisi pas dipake ngerampok!\n\n`;
  for (const [key, w] of Object.entries(WEAPONS)) {
    txt += `${w.name}\n`;
    txt += `  💰 Harga: *Rp ${w.price.toLocaleString("id-ID")}*\n`;
    txt += `  💪 Power: *${w.power}*  |  🚓 Resiko Polisi: *${w.policeRisk}%*\n`;
    txt += `  🔓 Min Level: *${w.levelReq}*\n`;
    txt += `  📝 ${w.desc}\n`;
    txt += `  → kode: \`${key}\`\n\n`;
  }
  txt += `*Cara pakai:*\n`;
  txt += `\`.blackmarket buy <kode>\` : beli senjata\n`;
  txt += `\`.blackmarket equip <kode>\` : pasang senjata buat dipake .rob\n`;
  txt += `\`.blackmarket inventory\` : lihat senjata yang kamu punya\n\n`;
  txt += `*Awas woy!* Bawa-bawa senjata di jalan itu resiko sendiri. Makin sering dipake rampok, makin gampang ketauan polisi. 🚨`;
  return txt;
}

async function handler(m) {
  installNiwoWM(m);
  const db = getDatabase();
  const user = db.getUser(m.sender);
  if (!user.rpg) user.rpg = {};
  if (!user.inventory) user.inventory = {};

  const args = m.args || [];
  const action = args[0]?.toLowerCase();

  if (!action || !["buy", "equip", "inventory", "list"].includes(action)) {
    return m.reply(weaponList());
  }

  if (action === "list") {
    return m.reply(weaponList());
  }

  if (action === "inventory") {
    const owned = Object.entries(WEAPONS).filter(([key]) => (user.inventory[`bm_${key}`] || 0) > 0);
    if (owned.length === 0) {
      return m.reply(`Tas kamu kosong melompong, ga ada senjata sama sekali. 😅\nMampir dulu ke \`.blackmarket\` buat belanja.`);
    }
    let txt = `🎒 *SENJATA KAMU* 🎒\n\n`;
    for (const [key, w] of owned) {
      const equipped = user.rpg.equippedWeapon === key ? " ✅ _(terpasang)_" : "";
      txt += `${w.name} x${user.inventory[`bm_${key}`]}${equipped}\n`;
    }
    if (!user.rpg.equippedWeapon) {
      txt += `\n⚠️ Kamu belum pasang senjata apapun! Ketik \`.blackmarket equip <kode>\` biar ada bekel pas ngerampok.`;
    }
    return m.reply(txt);
  }

  const weaponKey = args[1]?.toLowerCase();
  const weapon = WEAPONS[weaponKey];

  if (!weapon) {
    return m.reply(`Barang *${args[1] || "itu"}* ga ada di pasar gelap, gan. 🙅‍♂️\nKetik \`.blackmarket\` buat liat daftar lengkapnya.`);
  }

  if (action === "buy") {
    if ((user.level || 0) < weapon.levelReq) {
      return m.reply(`Masih bau kencur, level kamu *${user.level || 0}* padahal butuh minimal *Level ${weapon.levelReq}* buat pegang *${weapon.name}*. Naikin level dulu gan! 😤`);
    }

    if ((user.koin || 0) < weapon.price) {
      return m.reply(`Duit kamu kurang buat beli *${weapon.name}*! 💸\nHarga: *Rp ${weapon.price.toLocaleString("id-ID")}*\nSaldo kamu: *Rp ${(user.koin || 0).toLocaleString("id-ID")}*`);
    }

    user.koin -= weapon.price;
    user.inventory[`bm_${weaponKey}`] = (user.inventory[`bm_${weaponKey}`] || 0) + 1;
    db.save();

    return m.reply(
      `✅ *TRANSAKSI SUKSES, DIEM-DIEM AJA* 🕶️\n\n` +
        `Dapet: *${weapon.name}*\n` +
        `Bayar: *-Rp ${weapon.price.toLocaleString("id-ID")}*\n` +
        `Sisa saldo: *Rp ${user.koin.toLocaleString("id-ID")}*\n\n` +
        `Ketik \`.blackmarket equip ${weaponKey}\` biar bisa langsung dipake pas \`.rob\`!`
    );
  }

  if (action === "equip") {
    const owned = user.inventory[`bm_${weaponKey}`] || 0;
    if (owned <= 0) {
      return m.reply(`Kamu belum punya *${weapon.name}*. Beli dulu di \`.blackmarket buy ${weaponKey}\`.`);
    }
    user.rpg.equippedWeapon = weaponKey;
    db.save();
    return m.reply(`🔫 *${weapon.name}* udah terpasang!\nSiap-siap dipake pas \`.rob @target\`, tapi inget: makin gahar senjatanya makin gede resiko polisi datengin kamu.`);
  }
}

export default { config, handler };

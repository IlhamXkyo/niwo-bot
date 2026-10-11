import appConfig from "../../config.js";
import { getDatabase } from "../../src/lib/database.js";

const config = {
  name: "addowner",
  alias: ["addown", "delowner", "delown", "listowner", "listown"],
  category: "owner",
  description: "Mengelola owner tambahan melalui database",
  usage: ".addowner 628xxxxxxxxxx\n.delowner 628xxxxxxxxxx\n.listowner",
  example: ".addowner 628123456789",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

function normalizeNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function toJid(value) {
  if (!value) return null;

  const raw = String(value).trim();

  if (raw.includes("@")) {
    return raw;
  }

  let number = normalizeNumber(raw);

  if (!number) return null;

  if (number.startsWith("0")) {
    number = "62" + number.slice(1);
  }

  if (number.startsWith("8")) {
    number = "62" + number;
  }

  return `${number}@s.whatsapp.net`;
}

function getTarget(m) {
  // Dari reply pesan
  if (m.quoted?.sender) {
    return toJid(m.quoted.sender);
  }

  // Dari mention
  if (
    Array.isArray(m.mentionedJid) &&
    m.mentionedJid.length > 0
  ) {
    return toJid(m.mentionedJid[0]);
  }

  // Dari nomor setelah command
  const text = String(m.text || "").trim();

  if (text) {
    const firstArg = text.split(/\s+/)[0];
    return toJid(firstArg);
  }

  return null;
}

async function handler(m, { sock }) {
  const db = getDatabase();
  const command = String(m.command || "").toLowerCase();

  // =========================
  // ADD OWNER
  // =========================
  if (command === "addowner" || command === "addown") {
    const target = getTarget(m);

    if (!target) {
      return m.reply(
`〄 𝗔𝗗𝗗 𝗢𝗪𝗡𝗘𝗥

┌──────────────
│ 〄 Cara penggunaan:
│
│ 〄 ${m.prefix}addowner 628xxxxxxxxxx
│
│ 〄 Contoh:
│ 〄 ${m.prefix}addowner 628123456789
│
│ 〄 Bisa juga reply pesan
│ 〄 lalu ketik ${m.prefix}addowner
└──────────────`
      );
    }

    // Cek apakah sudah terdaftar
    if (db.isExtraOwner(target)) {
      return m.reply(
        `〄 Nomor @${target.split("@")[0]} sudah menjadi owner tambahan.`,
      );
    }

    // Simpan ke database
    const success = db.addOwner(target);

    if (!success) {
      return m.reply(
        "〄 Gagal menambahkan owner ke database."
      );
    }

    return sock.sendMessage(
      m.chat,
      {
        text:
`〄 𝗔𝗗𝗗 𝗢𝗪𝗡𝗘𝗥

┌──────────────
│ 〄 Nomor : @${target.split("@")[0]}
│ 〄 Status : Owner
│ 〄 Database : Tersimpan
│ 〄 Akses : Aktif
└──────────────

Owner berhasil ditambahkan.`,
        mentions: [target],
      },
      { quoted: m }
    );
  }

  // =========================
  // DELETE OWNER
  // =========================
  if (command === "delowner" || command === "delown") {
    const target = getTarget(m);

    if (!target) {
      return m.reply(
`〄 𝗗𝗘𝗟 𝗢𝗪𝗡𝗘𝗥

┌──────────────
│ 〄 Cara penggunaan:
│
│ 〄 ${m.prefix}delowner 628xxxxxxxxxx
│
│ 〄 Atau reply pesan
│ 〄 lalu ketik ${m.prefix}delowner
└──────────────`
      );
    }

    // Jangan hapus owner utama dari config
    const staticOwners = Array.isArray(appConfig.owner?.number)
      ? appConfig.owner.number.map(normalizeNumber)
      : [];

    const targetNumber = normalizeNumber(
      target.split("@")[0]
    );

    if (staticOwners.includes(targetNumber)) {
      return m.reply(
        "〄 Owner utama yang ada di config tidak bisa dihapus melalui command ini."
      );
    }

    if (!db.isExtraOwner(target)) {
      return m.reply(
        `〄 @${targetNumber} bukan owner tambahan.`,
      );
    }

    const success = db.removeOwner(target);

    if (!success) {
      return m.reply(
        "〄 Gagal menghapus owner dari database."
      );
    }

    return sock.sendMessage(
      m.chat,
      {
        text:
`〄 𝗗𝗘𝗟 𝗢𝗪𝗡𝗘𝗥

┌──────────────
│ 〄 Nomor : @${targetNumber}
│ 〄 Status : Dihapus
│ 〄 Database : Terhapus
└──────────────

Owner tambahan berhasil dihapus.`,
        mentions: [target],
      },
      { quoted: m }
    );
  }

  // =========================
  // LIST OWNER
  // =========================
  if (command === "listowner" || command === "listown") {
    const staticOwners = Array.isArray(appConfig.owner?.number)
      ? appConfig.owner.number
      : [];

    const extraOwners = db.getOwners();

    const mentions = [
      ...staticOwners.map(toJid).filter(Boolean),
      ...extraOwners.map(toJid).filter(Boolean),
    ];

    let text =
`〄 𝗗𝗔𝗙𝗧𝗔𝗥 𝗢𝗪𝗡𝗘𝗥

〄 𝗢𝗪𝗡𝗘𝗥 𝗧𝗘𝗧𝗔𝗣
┌──────────────
`;

    if (staticOwners.length > 0) {
      for (const owner of staticOwners) {
        const number = normalizeNumber(owner);
        text += `│ 〄 @${number}\n`;
      }
    } else {
      text += "│ 〄 Tidak ada\n";
    }

    text +=
`└──────────────

〄 𝗢𝗪𝗡𝗘𝗥 𝗧𝗔𝗠𝗕𝗔𝗛𝗔𝗡
┌──────────────
`;

    if (extraOwners.length > 0) {
      for (const owner of extraOwners) {
        const number = normalizeNumber(
          String(owner).split("@")[0]
        );

        text += `│ 〄 @${number}\n`;
      }
    } else {
      text += "│ 〄 Belum ada\n";
    }

    text +=
`└──────────────

〄 Total owner tambahan : ${extraOwners.length}`;

    return sock.sendMessage(
      m.chat,
      {
        text,
        mentions,
      },
      { quoted: m }
    );
  }

  return m.reply(
    `〄 Command tidak dikenali: ${command}`
  );
}

export default {
  config,
  handler,
};
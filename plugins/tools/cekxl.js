// plugins/tools/cekxl.js
// NIWO BOT : CEK XL / AXIS

import axios from "axios";

const config = {
  name: "cekxl",
  alias: ["checkxl", "xlcheck", "xlcek"],
  category: "tools",
  description:
    "Cek informasi paket dan kuota nomor XL/Axis secara detail",
  usage: ".cekxl <nomor>",
  example: ".cekxl 083150850721",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

function cleanNumber(phoneNumber) {
  let num = String(phoneNumber || "")
    .replace(/\D/g, "");

  if (num.startsWith("0")) {
    num = "62" + num.slice(1);
  }

  if (!num.startsWith("62")) {
    num = "62" + num;
  }

  return num;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return (
    (bytes / Math.pow(1024, index))
      .toFixed(2) +
    " " +
    units[index]
  );
}

async function handler(m, { sock }) {
  let input = "";

  if (Array.isArray(m.args) && m.args.length) {
    input = m.args[0];
  } else if (m.text) {
    input = String(m.text)
      .replace(/^\S+\s*/, "")
      .trim();
  }

  if (!input) {
    return m.reply(
      `📱 *ᴄᴇᴋ xʟ/ᴀxɪs*\n\n` +
      `> Fitur untuk mengecek informasi paket dan kuota nomor XL/Axis.\n\n` +
      `*Cara pakai:*\n` +
      `> \`${m.prefix}cekxl <nomor hp>\`\n\n` +
      `*Contoh:*\n` +
      `> \`${m.prefix}cekxl 083150850721\`\n` +
      `> \`${m.prefix}cekxl 6281234567890\`\n\n` +
      `_Format nomor: 08xx, 628xx, atau tanpa awalan._`
    );
  }

  const cleanNum =
    cleanNumber(input);

  if (
    cleanNum.length < 10 ||
    cleanNum.length > 15
  ) {
    return m.reply(
      `❌ *ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ*\n\n` +
      `> Pastikan nomor XL/Axis yang dimasukkan benar.`
    );
  }

  try {
    await m.react("🕕");

    const response = await axios.get(
      "https://xl-ku.my.id/end.php",
      {
        params: {
          check: "package",
          number: cleanNum,
          version: "2",
        },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw new Error(
        `API HTTP ${response.status}`
      );
    }

    const data = response.data;

    if (
      !data ||
      data.error ||
      data.status === false
    ) {
      await m.react("❌");

      return m.reply(
        `❌ *ɢᴀɢᴀʟ ᴍᴇɴɢᴇᴄᴇᴋ*\n\n` +
        `> Nomor *${cleanNum}* tidak dapat dicek.\n` +
        `> Pastikan nomor merupakan XL/Axis yang aktif.`
      );
    }

    let txt =
      `📱 *ɪɴғᴏʀᴍᴀsɪ xʟ/ᴀxɪs*\n\n`;

    txt +=
      `╭┈┈⬡「 📞 *ᴘᴇʟᴀɴɢɢᴀɴ* 」\n`;

    txt +=
      `┃ 📞 Nomor: *${cleanNum}*\n`;

    if (data.msisdn) {
      txt +=
        `┃ 🆔 MSISDN: *${data.msisdn}*\n`;
    }

    if (
      data.status &&
      typeof data.status !== "boolean"
    ) {
      txt +=
        `┃ 📊 Status: *${data.status}*\n`;
    }

    if (data.activeDate) {
      txt +=
        `┃ 📅 Aktif Sejak: *${data.activeDate}*\n`;
    }

    if (data.expireDate) {
      txt +=
        `┃ ⏰ Masa Aktif: *${data.expireDate}*\n`;
    }

    if (data.graceDate) {
      txt +=
        `┃ ⚠️ Masa Tenggang: *${data.graceDate}*\n`;
    }

    txt += `╰┈┈⬡\n`;

    /*
     * Paket aktif
     */
    if (
      Array.isArray(data.packages) &&
      data.packages.length > 0
    ) {
      txt +=
        `\n📦 *ᴘᴀᴋᴇᴛ ᴀᴋᴛɪғ*\n\n`;

      for (
        const pkg of data.packages
      ) {
        if (!pkg) continue;

        const name =
          pkg.name ||
          pkg.packageName ||
          "Paket";

        txt +=
          `╭─「 *${name}* 」\n`;

        if (
          pkg.remainingQuota ||
          pkg.quota
        ) {
          txt +=
            `│ 📊 Sisa Kuota: *${
              pkg.remainingQuota ||
              pkg.quota
            }*\n`;
        }

        if (pkg.totalQuota) {
          txt +=
            `│ 📦 Total Kuota: *${pkg.totalQuota}*\n`;
        }

        if (
          pkg.expireDate ||
          pkg.validUntil
        ) {
          txt +=
            `│ ⏰ Berlaku: *${
              pkg.expireDate ||
              pkg.validUntil
            }*\n`;
        }

        if (pkg.type) {
          txt +=
            `│ 🏷️ Tipe: *${pkg.type}*\n`;
        }

        txt += `╰────────────\n\n`;
      }
    }

    /*
     * Saldo / pulsa
     */
    if (
      data.balance != null ||
      data.pulsa != null
    ) {
      const balance =
        data.balance ??
        data.pulsa;

      txt +=
        `💰 *sᴀʟᴅᴏ*\n` +
        `> Pulsa: *${balance}*\n\n`;
    }

    /*
     * Result
     */
    if (
      data.result &&
      typeof data.result === "object"
    ) {
      const result =
        data.result;

      let hasResult = false;

      if (
        result.name ||
        result.quota ||
        result.masa_aktif ||
        result.status
      ) {
        txt +=
          `📋 *ᴅᴇᴛᴀɪʟ ᴘᴀᴋᴇᴛ*\n\n`;
      }

      if (result.name) {
        txt +=
          `> 👤 Nama Paket: *${result.name}*\n`;
        hasResult = true;
      }

      if (result.quota) {
        txt +=
          `> 📊 Kuota: *${result.quota}*\n`;
        hasResult = true;
      }

      if (result.masa_aktif) {
        txt +=
          `> 📅 Masa Aktif: *${result.masa_aktif}*\n`;
        hasResult = true;
      }

      if (result.status) {
        txt +=
          `> 📊 Status: *${result.status}*\n`;
        hasResult = true;
      }

      if (hasResult) {
        txt += `\n`;
      }
    }

    /*
     * Detail tambahan dari API
     */
    if (
      typeof data === "object" &&
      !Array.isArray(data) &&
      !data.packages &&
      !data.result
    ) {
      const skipKeys = [
        "error",
        "status",
        "msisdn",
        "activeDate",
        "expireDate",
        "graceDate",
        "balance",
        "pulsa",
      ];

      const extraKeys =
        Object.keys(data).filter(
          (key) =>
            !skipKeys.includes(key)
        );

      const simpleKeys =
        extraKeys.filter((key) => {
          const value =
            data[key];

          return (
            typeof value ===
              "string" ||
            typeof value ===
              "number"
          );
        });

      if (simpleKeys.length) {
        txt +=
          `📋 *ᴅᴇᴛᴀɪʟ ʟᴀɪɴɴʏᴀ*\n\n`;

        for (
          const key of simpleKeys
        ) {
          txt +=
            `> ${key}: *${data[key]}*\n`;
        }
      }
    }

    // Mencegah pesan terlalu panjang
    if (txt.length > 50000) {
      txt =
        txt.slice(0, 49500) +
        `\n\n... *hasil dipotong*`;
    }

    await m.react("✅");

    return m.reply(
      txt.trim()
    );

  } catch (error) {
    console.error(
      "[CEKXL] Error:",
      error?.response?.data ||
      error?.message ||
      error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ᴄᴇᴋ xʟ/ᴀxɪs ɢᴀɢᴀʟ*\n\n` +
      `> Gagal menghubungi server pengecekan.\n\n` +
      `> ${error?.message || "Terjadi kesalahan saat memproses permintaan."}`
    );
  }
}

export default {
  config,
  handler,
};
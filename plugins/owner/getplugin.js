import fs from "fs";
import path from "path";
import {
  getPluginByCommand
} from "../../src/lib/plugins.js";

const config = {
  name: "getplugin",
  alias: ["gp", "getplug"],
  category: "owner",

  description:
    "Mengambil source code plugin berdasarkan command",

  usage:
    ".getplugin <command>",

  example:
    ".getplugin ping",

  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 3,
  energi: 0,
  isEnabled: true
};


async function handler(m, { sock }) {

  const command =
    String(m.text || "")
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase();


  if (!command) {

    return m.reply(
`〄 𝗚𝗘𝗧 𝗣𝗟𝗨𝗚𝗜𝗡

┌──────────────
│ 〄 Cara penggunaan:
│
│ 〄 ${m.prefix}getplugin <command>
│
│ 〄 Contoh:
│ 〄 ${m.prefix}getplugin ping
└──────────────`
    );
  }


  // Cari plugin berdasarkan
  // command atau alias
  const plugin =
    getPluginByCommand(command);


  if (!plugin) {

    return m.reply(
`〄 𝗣𝗟𝗨𝗚𝗜𝗡 𝗧𝗜𝗗𝗔𝗞 𝗗𝗜𝗧𝗘𝗠𝗨𝗞𝗔𝗡

┌──────────────
│ 〄 Command : ${command}
│ 〄 Status  : Tidak ditemukan
└──────────────`
    );
  }


  const filePath =
    plugin.__file;


  if (
    !filePath ||
    !fs.existsSync(filePath)
  ) {

    return m.reply(
      "❌ File plugin tidak ditemukan di server."
    );
  }


  try {

    const source =
      fs.readFileSync(
        filePath,
        "utf8"
      );


    const fileName =
      path.basename(filePath);


    const pluginName =
      plugin.config?.name ||
      command;


    await sock.sendMessage(
      m.chat,
      {
        document:
          Buffer.from(source),

        fileName,

        mimetype:
          "application/javascript",

        caption:
`〄 𝗚𝗘𝗧 𝗣𝗟𝗨𝗚𝗜𝗡

┌──────────────
│ 〄 Name     : ${pluginName}
│ 〄 Category : ${plugin.config?.category || "-"}
│ 〄 File     : ${fileName}
│ 〄 Size     : ${Buffer.byteLength(source, "utf8")} bytes
└──────────────`
      },
      {
        quoted: m
      }
    );

  } catch (error) {

    console.error(
      "[getplugin]",
      error
    );

    return m.reply(
`❌ Gagal mengambil plugin.

${error.message}`
    );
  }
}


export default {
  config,
  handler
};
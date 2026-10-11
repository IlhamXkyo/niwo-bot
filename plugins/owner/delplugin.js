import fs from "fs"
import path from "path"
import { loadPlugins } from "../../src/lib/plugins.js"

const config = {
  name: "delplugin",

  alias: ["deleteplugin", "delpl", "rmplugin", "removeplugin"],

  category: "owner",

  description:
    "Menghapus plugin dari folder plugins",

  usage:
    ".delplugin <nama.js>",

  example:
    ".delplugin brat.js",

  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 0,
  energi: 0,
  isEnabled: true
}


// ======================================================
// PLUGIN DIRECTORY
// ======================================================

const PLUGIN_DIR =
  path.join(process.cwd(), "plugins")


// ======================================================
// CARI PLUGIN
// ======================================================

function findPlugin(filename) {

  const results = []

  function scan(directory) {

    if (!fs.existsSync(directory)) {
      return
    }

    const entries =
      fs.readdirSync(
        directory,
        { withFileTypes: true }
      )

    for (const entry of entries) {

      const fullPath =
        path.join(
          directory,
          entry.name
        )

      if (entry.isDirectory()) {

        scan(fullPath)

        continue
      }

      if (
        entry.isFile() &&
        entry.name.toLowerCase() ===
        filename.toLowerCase()
      ) {

        results.push(fullPath)
      }
    }
  }

  scan(PLUGIN_DIR)

  return results
}


// ======================================================
// HANDLER
// ======================================================

async function handler(m) {

  let filename =
    String(m.text || "").trim()


  // ====================================================
  // VALIDASI
  // ====================================================

  if (!filename) {

    return m.reply(
      `🗑️ *DELETE PLUGIN*\n\n` +

      `Cara penggunaan:\n` +
      `${m.prefix}delplugin <nama.js>\n\n` +

      `Contoh:\n` +
      `${m.prefix}delplugin brat.js`
    )
  }


  // ====================================================
  // TAMBAHKAN EXTENSION
  // ====================================================

  if (
    !filename.endsWith(".js") &&
    !filename.endsWith(".mjs")
  ) {
    filename += ".js"
  }


  // ====================================================
  // CEGAH PATH TRAVERSAL
  // ====================================================

  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {

    return m.reply(
      "❌ Nama plugin tidak valid.\n\n" +
      "Masukkan nama file saja, contoh:\n" +
      "`brat.js`"
    )
  }


  if (
    !/^[a-zA-Z0-9_-]+\.(js|mjs)$/.test(
      filename
    )
  ) {

    return m.reply(
      "❌ Nama file plugin tidak valid."
    )
  }


  // ====================================================
  // CARI PLUGIN
  // ====================================================

  const plugins =
    findPlugin(filename)


  if (!plugins.length) {

    return m.reply(
      `❌ Plugin *${filename}* tidak ditemukan.`
    )
  }


  // ====================================================
  // JIKA ADA LEBIH DARI SATU
  // ====================================================

  if (plugins.length > 1) {

    const list =
      plugins
        .map((file, index) => {

          const relative =
            path.relative(
              process.cwd(),
              file
            )

          return `${index + 1}. ${relative}`

        })
        .join("\n")

    return m.reply(
      `⚠️ Ditemukan lebih dari satu plugin dengan nama *${filename}*.\n\n` +
      `${list}\n\n` +
      `Gunakan nama file yang unik terlebih dahulu.`
    )
  }


  const pluginPath =
    plugins[0]


  // ====================================================
  // JANGAN HAPUS DIRINYA SENDIRI
  // ====================================================

  if (
    path.resolve(pluginPath) ===
    path.resolve(
      process.cwd(),
      "plugins",
      "owner",
      "delplugin.js"
    )
  ) {

    return m.reply(
      "❌ Plugin `delplugin.js` tidak boleh dihapus melalui command ini."
    )
  }


  // ====================================================
  // HAPUS
  // ====================================================

  try {

    const relativePath =
      path.relative(
        process.cwd(),
        pluginPath
      )


    fs.unlinkSync(
      pluginPath
    )


    // ==================================================
    // RELOAD PLUGIN
    // ==================================================

    try {

      await loadPlugins({
        watch: false
      })

    } catch (reloadError) {

      console.error(
        "[DELPLUGIN RELOAD ERROR]",
        reloadError
      )

      return m.reply(
        `✅ Plugin *${filename}* berhasil dihapus.\n\n` +
        `⚠️ Plugin loader gagal melakukan reload otomatis.\n` +
        `Silakan restart bot jika command masih muncul.`
      )
    }


    // ==================================================
    // SUCCESS
    // ==================================================

    return m.reply(
      `╭─「 🗑️ DEL PLUGIN 」\n` +
      `│\n` +
      `│ 📄 File : ${filename}\n` +
      `│ 📂 Path : ${relativePath}\n` +
      `│\n` +
      `│ ✅ Plugin berhasil dihapus.\n` +
      `│ 🔄 Plugin berhasil direload.\n` +
      `│\n` +
      `╰──────────────`
    )

  } catch (error) {

    console.error(
      "[DELPLUGIN ERROR]",
      error
    )

    return m.reply(
      `❌ Gagal menghapus plugin.\n\n` +
      `${error?.message || error}`
    )
  }
}


// ======================================================
// EXPORT
// ======================================================

export default {
  config,
  handler
}
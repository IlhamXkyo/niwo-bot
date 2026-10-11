/**
 * addplugin.js
 * Owner-only: save a new plugin file by replying to the message that
 * contains its code, then hot-reload it into the running bot.
 *
 * Usage:
 *   .addplugin <filename>.js   (reply to a text message or .js document
 *                                containing the plugin's source code)
 *
 * Category/folder is auto-detected from the code itself (looks for
 * `category: "..."` inside the plugin's config object). Falls back to
 * "tools" if nothing is found.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { loadPlugins } from "../../src/lib/plugins.js";

const PLUGIN_DIR = path.join(process.cwd(), "plugins");

const FOLDER_ALIASES = {
  main: "main", owner: "owner", group: "group",
  download: "download", downloader: "download",
  tools: "tools", tool: "tools",
  ai: "ai", artificial: "ai",
  user: "user", users: "user",
  game: "game", games: "game",
  fun: "fun", funny: "fun",
  search: "search", searching: "search",
  sticker: "sticker", stickers: "sticker",
  info: "info", information: "info",
  convert: "convert", converter: "convert",
  maker: "maker", create: "maker",
};

function detectCategory(code) {
  const catMatch = code.match(/category\s*:\s*["'`]([a-zA-Z0-9_-]+)["'`]/);
  if (catMatch) {
    const cat = catMatch[1].toLowerCase();
    return FOLDER_ALIASES[cat] || cat;
  }
  return "tools";
}

function detectName(code) {
  const nameMatch = code.match(/name\s*:\s*["'`]([a-zA-Z0-9_-]+)["'`]/);
  return nameMatch ? nameMatch[1] : null;
}

function detectAlias(code) {
  const aliasMatch = code.match(/alias\s*:\s*\[([^\]]*)\]/);
  if (!aliasMatch) return [];
  return aliasMatch[1]
    .split(",")
    .map((a) => a.trim().replace(/['"`]/g, ""))
    .filter(Boolean);
}

function looksLikePlugin(code) {
  return /export\s+default\s*\{[\s\S]*config[\s\S]*handler[\s\S]*\}/.test(code)
    && /async function handler|const handler\s*=|function handler/.test(code);
}

const config = {
  name: "addplugin",
  alias: ["saveplugin", "sv", "svp"],
  category: "owner",
  description: "Simpan plugin baru dari kode yang di-reply, auto-detect kategori & hot-reload",
  usage: ".addplugin <namafile.js>",
  example: ".addplugin ping2.js",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const prefix = m.prefix || ".";

  if (!m.text || !m.quoted) {
    return m.reply(
      `💾 *Save Plugin*\n\n` +
      `Cara pakai:\n` +
      `${prefix}addplugin <namafile.js>\n` +
      `(reply ke pesan yang isinya kode plugin, atau reply file .js)\n\n` +
      `Contoh:\n${prefix}addplugin ping2.js`
    );
  }

  const filename = m.text.trim();
  if (!/\.(js|mjs)$/.test(filename)) {
    return m.reply("⚠️ Nama file harus diakhiri .js atau .mjs");
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return m.reply("⚠️ Nama file nggak boleh mengandung path (`/`, `\\`, `..`).");
  }

  // Ambil kode dari pesan yang di-reply (text) atau dokumen .js.
  let code = m.quoted.text || "";
  if (!code && m.quoted.type === "documentMessage") {
    try {
      const buffer = await sock.downloadMediaMessage(m.quoted);
      code = buffer.toString("utf-8");
    } catch (err) {
      return m.reply(`❌ Gagal baca file: ${err.message}`);
    }
  }

  if (!code) {
    return m.reply("⚠️ Reply pesan yang berisi kode plugin, atau reply file .js.");
  }
  if (!looksLikePlugin(code)) {
    return m.reply(
      "⚠️ Kode itu kelihatannya bukan format plugin yang valid.\n" +
      "Harus ada `export default { config, handler }` dan fungsi `handler`."
    );
  }

  const category = detectCategory(code);
  const detectedName = detectName(code);
  const alias = detectAlias(code);
  const folderPath = path.join(PLUGIN_DIR, category);
  const filePath = path.join(folderPath, filename);

  if (fs.existsSync(filePath)) {
    return m.reply(`⚠️ File \`${category}/${filename}\` udah ada. Pakai nama lain atau hapus dulu manual.`);
  }

  try {
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(filePath, code, "utf-8");

    // Validasi: coba import file yang baru ditulis. Kalau syntax-nya
    // rusak, hapus lagi biar nggak nyangkut jadi plugin setengah jadi.
    try {
      await import(`${pathToFileURL(filePath).href}?check=${Date.now()}`);
    } catch (importErr) {
      fs.unlinkSync(filePath);
      return m.reply(`❌ Plugin gagal di-load (dihapus lagi):\n${importErr.message}`);
    }

    // Hot-reload semua plugin biar langsung aktif tanpa restart bot.
    await loadPlugins({ watch: false });

    await m.reply(
      `✅ *Plugin tersimpan!*\n\n` +
      `📛 File     : ${filename}\n` +
      `📂 Kategori : ${category}\n` +
      `🔧 Command  : ${detectedName || "(auto dari file)"}${alias.length ? `, ${alias.join(", ")}` : ""}\n` +
      `📍 Path     : plugins/${category}/${filename}\n\n` +
      `Langsung bisa dipakai, nggak perlu restart bot.`
    );
  } catch (err) {
    await m.reply(`❌ Gagal simpan plugin: ${err.message}`);
  }
}

export default { config, handler };

import fs from "fs";
import path from "path";

const config = {
  name: "delscraper",
  alias: ["deletescraper", "rmscraper", "removescraper"],
  category: "owner",
  description: "Menghapus scraper atau plugin scraper secara otomatis",
  usage: ".delscraper <nama>",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true
};

const ROOT = process.cwd();

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/^[@.#/$!]+/, "")
    .replace(/\.js$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase()
    .slice(0, 80);
}

function getRawText(m, ctx = {}) {
  return String(
    ctx.text ??
    m?.text ??
    m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    ""
  ).trim();
}

function getName(m, ctx = {}) {
  const commandNames = new Set([
    "delscraper",
    "deletescraper",
    "rmscraper",
    "removescraper"
  ]);

  const args = Array.isArray(ctx.args)
    ? ctx.args.map(String).filter(Boolean)
    : Array.isArray(m?.args)
      ? m.args.map(String).filter(Boolean)
      : getRawText(m, ctx).split(/\s+/).filter(Boolean);

  for (const arg of args) {
    const name = cleanName(arg);
    if (name && !commandNames.has(name)) return name;
  }

  const parts = getRawText(m, ctx).split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return cleanName(parts[1]);
  }

  return "";
}

function walk(dir, result = []) {
  if (!fs.existsSync(dir)) return result;

  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name.startsWith(".")
    ) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, result);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".js")
    ) {
      result.push(full);
    }
  }

  return result;
}

function isSafePath(file) {
  const root = path.resolve(ROOT) + path.sep;
  const target = path.resolve(file);

  return target.startsWith(root);
}

function findScrapers(name) {
  const targets = [
    path.join(ROOT, "src", "lib"),
    path.join(ROOT, "plugins")
  ];

  const files = [];

  for (const dir of targets) {
    walk(dir, files);
  }

  const exact = [];
  const related = [];

  for (const file of files) {
    if (!isSafePath(file)) continue;

    const base = path
      .basename(file, ".js")
      .toLowerCase();

    const normalized = base.replace(
      /[^a-z0-9_-]/g,
      ""
    );

    if (
      base === name ||
      normalized === name
    ) {
      exact.push(file);
      continue;
    }

    const relative = path
      .relative(ROOT, file)
      .replace(/\\/g, "/")
      .toLowerCase();

    if (
      relative.includes("/scraper/") &&
      (
        base.includes(name) ||
        name.includes(base)
      )
    ) {
      related.push(file);
    }
  }

  return [...exact, ...related];
}

function removeFile(file) {
  try {
    if (!fs.existsSync(file)) return false;

    fs.unlinkSync(file);
    return true;
  } catch (e) {
    console.error(
      "[DELSCRAPER] gagal hapus:",
      file,
      e
    );

    return false;
  }
}

function removeEmptyDirs(startDir) {
  if (!fs.existsSync(startDir)) return;

  let entries;

  try {
    entries = fs.readdirSync(startDir, {
      withFileTypes: true
    });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name === "node_modules"
    ) continue;

    const full = path.join(
      startDir,
      entry.name
    );

    removeEmptyDirs(full);

    try {
      if (fs.readdirSync(full).length === 0) {
        fs.rmdirSync(full);
      }
    } catch {}
  }
}

async function handler(m, ctx = {}) {
  try {
    const name = getName(m, ctx);

    if (!name) {
      return m?.reply?.(
        "❌ Nama scraper belum diisi.\n\n" +
        "Contoh:\n" +
        ".delscraper loklok\n\n" +
        "Alias:\n" +
        ".deletescraper loklok\n" +
        ".rmscraper loklok\n" +
        ".removescraper loklok"
      );
    }

    const matches = findScrapers(name);

    if (!matches.length) {
      return m?.reply?.(
        `❌ Scraper/plugin *${name}* tidak ditemukan.\n\n` +
        "〄 Pencarian:\n" +
        "• src/lib/**\n" +
        "• plugins/**"
      );
    }

    const removed = [];
    const failed = [];

    for (const file of matches) {
      if (removeFile(file)) {
        removed.push(file);
      } else {
        failed.push(file);
      }
    }

    removeEmptyDirs(
      path.join(ROOT, "src", "lib")
    );

    removeEmptyDirs(
      path.join(ROOT, "plugins")
    );

    if (!removed.length) {
      return m?.reply?.(
        `❌ Gagal menghapus scraper *${name}*.`
      );
    }

    let text =
      "✅ *DELSCRAPER BERHASIL*\n\n" +
      `〄 Nama: ${name}\n` +
      `〄 Berhasil dihapus: ${removed.length}\n`;

    if (failed.length) {
      text += `〄 Gagal dihapus: ${failed.length}\n`;
    }

    text += "\n〄 File:\n";

    for (const file of removed) {
      text +=
        `• ${path.relative(ROOT, file).replace(/\\/g, "/")}\n`;
    }

    text +=
      "\nScraper/plugin sudah dihapus dari bot.";

    return m?.reply?.(text);
  } catch (e) {
    console.error("[DELSCRAPER]", e);

    return m?.reply?.(
      "❌ Gagal menghapus scraper.\n\n" +
      String(e?.message || e)
    );
  }
}

export default { config, handler };
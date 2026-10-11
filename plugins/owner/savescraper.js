import fs from "fs";
import path from "path";

const config = {
  name: "addscraper",
  alias: ["savescraper", "createscraper"],
  category: "owner",
  description: "Menyimpan dan mengonversi scraper secara otomatis",
  usage: ".addscraper <nama> (reply kode)",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true
};

const ROOT = process.cwd();
const SAFE_CATEGORIES = new Set([
  "main","owner","utility","tools","fun","game","download","downloader",
  "search","sticker","media","ai","group","religi","islamic","info","cek",
  "economy","user","canvas","random","premium","ephoto","jpm","pushkontak",
  "anime","asupan","clan","convert","berita","rpg","nsfw","linode","primbon",
  "cecan","stalker","tts","vps","panel","store","fake","other","lainnya"
]);

function cleanName(value) {
  return String(value || "")
    .trim()
    .replace(/\.js$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function textOf(m, ctx = {}) {
  return String(
    ctx.text ??
    m?.text ??
    m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    ""
  ).trim();
}

function getArgs(m, ctx = {}) {
  if (Array.isArray(ctx.args)) return ctx.args.map(String).filter(Boolean);
  if (Array.isArray(m?.args)) return m.args.map(String).filter(Boolean);
  const text = textOf(m, ctx);
  return text.split(/\s+/).filter(Boolean);
}

function getQuoted(m) {
  return m?.quoted ||
    m?.msg?.quoted ||
    m?.quotedMessage ||
    m?.msg?.contextInfo?.quotedMessage ||
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    null;
}

async function getQuotedSource(m) {
  const q = getQuoted(m);
  if (!q) return "";

  const direct = [
    q.text,
    q.body,
    q.msg?.text,
    q.msg?.body,
    q.message?.conversation,
    q.message?.extendedTextMessage?.text,
    q.msg?.conversation,
    q.msg?.extendedTextMessage?.text,
    q.message?.documentMessage?.caption,
    q.msg?.documentMessage?.caption
  ].find(v => typeof v === "string" && v.trim());

  if (direct) {
    const value = direct.trim();
    if (value.includes("import ") || value.includes("require(") ||
        value.includes("function ") || value.includes("const ") ||
        value.includes("module.exports") || value.includes("export ")) {
      return stripFence(value);
    }
  }

  try {
    if (typeof q.download === "function") {
      const data = await q.download();
      if (data) return stripFence(Buffer.from(data).toString("utf8"));
    }
    if (typeof q.msg?.download === "function") {
      const data = await q.msg.download();
      if (data) return stripFence(Buffer.from(data).toString("utf8"));
    }
  } catch {}

  return "";
}

function stripFence(src) {
  return String(src || "")
    .replace(/^```(?:js|javascript|ts|typescript)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function findMatchingBrace(src, openIndex) {
  let depth = 0;
  let quote = null;
  let template = false;
  let comment = null;

  for (let i = openIndex; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];

    if (comment === "line") {
      if (c === "\n") comment = null;
      continue;
    }
    if (comment === "block") {
      if (c === "*" && n === "/") {
        comment = null;
        i++;
      }
      continue;
    }

    if (!quote && !template && c === "/" && n === "/") {
      comment = "line";
      i++;
      continue;
    }
    if (!quote && !template && c === "/" && n === "*") {
      comment = "block";
      i++;
      continue;
    }

    if (quote) {
      if (c === "\\" ) {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }

    if (template) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "`") template = false;
      continue;
    }

    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === "`") {
      template = true;
      continue;
    }

    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractConfigValue(src, key) {
  const re = new RegExp(
    "(?:const|let|var)\\s+(?:config|pluginConfig)\\s*=\\s*\\{[\\s\\S]*?\\b" +
    key +
    "\\s*:\\s*[\"'`]([^\"'`]+)[\"'`]",
    "i"
  );
  const m = src.match(re);
  if (m?.[1]) return m[1];

  const direct = src.match(
    new RegExp("\\b" + key + "\\s*:\\s*[\"'`]([^\"'`]+)[\"'`]", "i")
  );
  return direct?.[1] || "";
}

function extractArray(src, key) {
  const m = src.match(
    new RegExp("\\b" + key + "\\s*:\\s*\\[([\\s\\S]*?)\\]", "i")
  );
  if (!m) return [];
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map(x => x[1]);
}

function detectBool(src, key, fallback = false) {
  const m = src.match(new RegExp("\\b" + key + "\\s*:\\s*(true|false)", "i"));
  return m ? m[1].toLowerCase() === "true" : fallback;
}

function detectNumber(src, key, fallback = 0) {
  const m = src.match(new RegExp("\\b" + key + "\\s*:\\s*(-?\\d+(?:\\.\\d+)?)", "i"));
  return m ? Number(m[1]) : fallback;
}

function detectCategory(src) {
  const explicit = extractConfigValue(src, "category").toLowerCase();
  if (explicit) return SAFE_CATEGORIES.has(explicit) ? explicit : "lainnya";

  const pluginPath = src.match(/plugins[\\/](?:[^'"`\s]+[\\/])?([^'"`/\s]+)[\\/]/i);
  if (pluginPath?.[1]) {
    const cat = cleanName(pluginPath[1]);
    if (SAFE_CATEGORIES.has(cat)) return cat;
  }

  if (/\b(image|video|audio|sticker|media)\b/i.test(src)) return "media";
  if (/\b(search|query|google|youtube|pinterest)\b/i.test(src)) return "search";
  if (/\bdownload|downloader|mediafire|tiktok|instagram|spotify\b/i.test(src)) return "downloader";
  if (/\bgroupParticipantsUpdate|groupMetadata|isGroup\b/i.test(src)) return "group";
  if (/\bcanvas|napi-rs\/canvas|sharp\b/i.test(src)) return "canvas";
  if (/\bai|gemini|openai|chatgpt|generative\b/i.test(src)) return "ai";
  return "tools";
}

function isPluginSource(src) {
  return (
    /\basync\s+function\s+handler\s*\(/.test(src) ||
    /\bfunction\s+handler\s*\(/.test(src) ||
    /\bexport\s+default\s*\{[\s\S]*\bhandler\b/.test(src) ||
    /\bpluginConfig\s*=/.test(src) ||
    /\bconfig\s*=\s*\{[\s\S]*\bcategory\s*:/.test(src) ||
    /\bmodule\.exports\s*=/.test(src)
  );
}

function normalizeImports(src) {
  return src
    .replace(/from\s+["']baileys["']/g, 'from "@itsliaaa/baileys"')
    .replace(/from\s+["']@whiskeysockets\/baileys["']/g, 'from "@itsliaaa/baileys"')
    .replace(/from\s+["']@whebshocket\/baileys["']/g, 'from "@itsliaaa/baileys"')
    .replace(/from\s+["']@dekzy\/baileys["']/g, 'from "@itsliaaa/baileys"');
}

function removeOldExports(src) {
  return src
    .replace(/^\s*export\s+default\s+[\s\S]*?;\s*$/gm, "")
    .replace(/^\s*module\.exports\s*=\s*[\s\S]*?;\s*$/gm, "")
    .replace(/^\s*exports\.[^=]+\s*=\s*.*?;\s*$/gm, "");
}

function findHandler(src) {
  const patterns = [
    /async\s+function\s+handler\s*\([^)]*\)\s*\{/,
    /function\s+handler\s*\([^)]*\)\s*\{/,
    /(?:const|let|var)\s+handler\s*=\s*async\s*\([^)]*\)\s*=>\s*\{/,
    /(?:const|let|var)\s+handler\s*=\s*\([^)]*\)\s*=>\s*\{/
  ];
  for (const re of patterns) {
    const m = re.exec(src);
    if (m) return m;
  }
  return null;
}

function convertPlugin(source, name) {
  let src = normalizeImports(stripFence(source).replace(/\r/g, ""));
  const oldHandler = findHandler(src);
  let body = "";

  if (oldHandler) {
    const open = src.indexOf("{", oldHandler.index);
    const close = findMatchingBrace(src, open);
    if (open >= 0 && close >= 0) {
      body = src.slice(open + 1, close);
      src = src.slice(0, oldHandler.index) + src.slice(close + 1);
    }
  }

  src = src
    .replace(/const\s+pluginConfig\s*=\s*\{[\s\S]*?\};?/m, "")
    .replace(/const\s+config\s*=\s*\{[\s\S]*?\};?/m, "")
    .replace(/^\s*export\s+default[\s\S]*$/gm, "");

  if (!body) {
    const before = /async\s+function\s+before\s*\([^)]*\)\s*\{/.exec(src);
    if (before) {
      const open = src.indexOf("{", before.index);
      const close = findMatchingBrace(src, open);
      if (open >= 0 && close >= 0) {
        body = src.slice(open + 1, close);
        src = src.slice(0, before.index) + src.slice(close + 1);
      }
    }
  }

  if (!body) throw new Error("Handler tidak ditemukan.");

  const oldName = extractConfigValue(source, "name");
  const aliases = extractArray(source, "alias")
    .filter(x => x.toLowerCase() !== name.toLowerCase());

  if (oldName && oldName.toLowerCase() !== name.toLowerCase()) aliases.push(oldName);

  const category = detectCategory(source);
  const description = extractConfigValue(source, "description") || `Plugin ${name} untuk Niwo Bot.`;
  const usage = extractConfigValue(source, "usage") || `.${name}`;

  const header = `// Auto generated by addscraper
${src.trim()}

const config = {
  name: ${JSON.stringify(name)},
  alias: ${JSON.stringify([...new Set(aliases)])},
  category: ${JSON.stringify(category)},
  description: ${JSON.stringify(description)},
  usage: ${JSON.stringify(usage)},
  isOwner: ${detectBool(source, "isOwner", detectBool(source, "owner", false))},
  isPremium: ${detectBool(source, "isPremium", false)},
  isGroup: ${detectBool(source, "isGroup", false)},
  isPrivate: ${detectBool(source, "isPrivate", false)},
  cooldown: ${detectNumber(source, "cooldown", 3)},
  energi: ${detectNumber(source, "energi", 0)},
  isEnabled: true
};

async function handler(m, ctx = {}) {
  const {
    sock,
    db,
    uptime,
    isOwner,
    isPremium,
    isAdmin,
    isBotAdmin,
    isGroup,
    isPrivate,
    text,
    args,
    command,
    prefix
  } = ctx;
${body}
}

export default { config, handler };
`;

  return { code: header, category };
}

function cleanLibrarySource(source, name) {
  let src = normalizeImports(stripFence(source).replace(/\r/g, ""));
  src = removeOldExports(src);

  if (!/\bexport\s+(?:async\s+)?function\b|\bexport\s+(?:const|let|var)\b|\bexport\s*\{/.test(src)) {
    const functions = [...src.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]);
    const classes = [...src.matchAll(/class\s+([A-Za-z_$][\w$]*)\b/g)].map(x => x[1]);
    const names = [...new Set([...functions, ...classes])];
    if (names.length) src += `\n\nexport { ${names.join(", ")} };`;
  }

  return `// Auto generated by addscraper
// Scraper: ${name}

${src.trim()}
`;
}

function detectDestination(source, requestedName) {
  const name = cleanName(requestedName || extractConfigValue(source, "name") || "scraper");

  if (isPluginSource(source)) {
    const category = detectCategory(source);
    return {
      type: "plugin",
      category: SAFE_CATEGORIES.has(category) ? category : "lainnya",
      name
    };
  }

  const libMatch = source.match(
    /(?:from|require\s*\()\s*["'](?:\.\.?\/)*.*?(?:src\/)?lib\/([^"'`]+)["']/i
  );
  if (libMatch) {
    const clean = libMatch[1].replace(/\\/g, "/").replace(/^\//, "");
    return {
      type: "library",
      subdir: clean.split("/").slice(0, -1).join("/") || "scraper",
      name
    };
  }

  return {
    type: "library",
    subdir: "scraper",
    name
  };
}

async function reloadPlugin(file) {
  try {
    const mod = await import(
      `${pathToFileURL(file).href}?update=${Date.now()}`
    );
    return !!mod?.default?.config?.name && typeof mod?.default?.handler === "function";
  } catch {
    return false;
  }
}

function pathToFileURL(file) {
  let resolved = path.resolve(file).replace(/\\/g, "/");
  if (!resolved.startsWith("/")) resolved = "/" + resolved;
  return { href: `file://${resolved}` };
}

async function handler(m, ctx = {}) {
  try {
    const args = getArgs(m, ctx);
    const raw = textOf(m, ctx);
    let name = "";

    if (Array.isArray(ctx.args) && ctx.args.length) {
      name = cleanName(
        ctx.args.find(x => !/^(\.|\!|#|\/)?(?:addscraper|savescraper|createscraper|savescrape)$/i.test(String(x)))
      );
    }

    if (!name && Array.isArray(m?.args) && m.args.length) {
      name = cleanName(
        m.args.find(x => !/^(\.|\!|#|\/)?(?:addscraper|savescraper|createscraper|savescrape)$/i.test(String(x)))
      );
    }

    if (!name) {
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) name = cleanName(parts[1]);
      else if (parts.length === 1 && !/^(?:\.|\!|#|\/)?(?:addscraper|savescraper|createscraper|savescrape)$/i.test(parts[0])) {
        name = cleanName(parts[0]);
      }
    }

    const source = await getQuotedSource(m);

    if (!name) {
      const q = getQuoted(m);
      const fileName = String(q?.fileName || q?.msg?.fileName || q?.message?.documentMessage?.fileName || "").trim();
      if (fileName) name = cleanName(path.basename(fileName, path.extname(fileName)));
    }

    if (!source) {
      return m?.reply?.(
        "❌ Kode scraper tidak ditemukan.\n\n" +
        "Reply kode/file `.js` lalu gunakan:\n" +
        ".addscraper loklok"
      );
    }

    if (!name) {
      return m?.reply?.(
        "❌ Nama scraper belum ditemukan.\n\n" +
        "Contoh:\n.addscraper loklok\n\n" +
        "Lalu reply kode scraper."
      );
    }

    if (source.length > 2_000_000) {
      return m?.reply?.("❌ Source terlalu besar. Maksimal 2 MB.");
    }

    const dest = detectDestination(source, name);
    let output;
    let file;

    if (dest.type === "plugin") {
      const dir = path.join(ROOT, "plugins", dest.category);
      fs.mkdirSync(dir, { recursive: true });
      file = path.join(dir, `${dest.name}.js`);
      output = convertPlugin(source, dest.name).code;
    } else {
      const dir = path.join(ROOT, "src", "lib", dest.subdir || "scraper");
      fs.mkdirSync(dir, { recursive: true });
      file = path.join(dir, `${dest.name}.js`);
      output = cleanLibrarySource(source, dest.name);
    }

    fs.writeFileSync(file, output, "utf8");

    let loaded = false;
    if (dest.type === "plugin") loaded = await reloadPlugin(file);

    let msg =
      "✅ *ADDSCRAPER BERHASIL*\n\n" +
      `〄 Nama: ${dest.name}\n` +
      `〄 Tipe: ${dest.type === "plugin" ? "Plugin" : "Library Scraper"}\n` +
      `〄 Lokasi: ${path.relative(ROOT, file).replace(/\\/g, "/")}\n`;

    if (dest.type === "plugin") {
      msg += `〄 Category: ${dest.category}\n`;
      msg += `〄 Auto Load: ${loaded ? "Berhasil" : "Gagal, cek console"}\n`;
    }

    msg += "\nSource otomatis disesuaikan untuk bot.";

    return m?.reply?.(msg);
  } catch (e) {
    console.error("[ADDSCRAPER]", e);
    return m?.reply?.(
      `❌ Gagal menyimpan scraper.\n\n${String(e?.message || e)}`
    );
  }
}

export default { config, handler };
// plugins/cjs2esm.js
const pluginConfig = {
  name: "cjs2esm",
  alias: ['toesm', 'c2e'],
  category: "tools",
  description: "Konversi kode CommonJS (require/module.exports) menjadi ESM (import/export)",
  usage: ".cjs2esm <kode>  |  .cjs2esm (reply kode/file)",
  example: ".cjs2esm const fs = require('fs')\nmodule.exports = { fs }",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

/* =========================================================
 *  UTIL: ambil ctx dengan aman
 * ========================================================= */
function resolveCtx(m, ctx) {
  ctx = ctx || {};

  const conn =
    ctx.conn || ctx.client || ctx.sock || ctx.socket ||
    m?.conn || m?.client || m?.sock || m?.socket;

  const prefix =
    ctx.usedPrefix ?? ctx.prefix ?? ctx.p ??
    m?.prefix ?? m?.usedPrefix ??
    ".";

  const rawText =
    ctx.text ?? ctx.body ?? ctx.args?.join?.(" ") ??
    m?.text ?? m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    "";

  let command =
    ctx.command ?? ctx.cmd ?? ctx.cmdName ??
    m?.command ?? m?.cmd;

  if (!command) {
    const trimmed = String(rawText).trim();
    if (trimmed.startsWith(prefix)) {
      command = trimmed.slice(prefix.length).split(/\s+/)[0].toLowerCase();
    } else {
      command = (trimmed.split(/\s+/)[0] || "cjs2esm").toLowerCase();
    }
  }

  const text = String(rawText).trim();

  return { conn, prefix, command, text };
}

/* =========================================================
 *  KONVERTER CJS -> ESM
 * ========================================================= */
function splitTopLevel(str) {
  const out = [];
  let depth = 0, cur = "", inStr = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i], prev = str[i - 1];
    if (inStr) {
      cur += ch;
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; cur += ch; continue; }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function convertCjsToEsm(code) {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Kode kosong atau tidak valid.");
  }

  let src = code.replace(/\r\n/g, "\n");
  const stats = {
    requires: 0,
    defaultImports: 0,
    namedImports: 0,
    dynamicImports: 0,
    exports: 0,
    warnings: [],
  };

  // 1. require destructuring
  src = src.replace(
    /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\s*;?/g,
    (_, names, _q, mod) => {
      stats.requires++; stats.namedImports++;
      const cleaned = names.split(",").map((n) => {
        const t = n.trim();
        if (!t) return null;
        const mm = t.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/);
        return mm ? `${mm[1]} as ${mm[2]}` : t;
      }).filter(Boolean).join(", ");
      return `import { ${cleaned} } from '${mod}';`;
    }
  );

  // 2. require default
  src = src.replace(
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\s*;?/g,
    (_, name, _q, mod) => {
      stats.requires++; stats.defaultImports++;
      return `import ${name} from '${mod}';`;
    }
  );

  // 3. bare require
  src = src.replace(
    /^\s*require\(\s*(['"])([^'"]+)\1\s*\)\s*;?\s*$/gm,
    (_, _q, mod) => { stats.requires++; return `import '${mod}';`; }
  );

  // 4. dynamic require
  src = src.replace(
    /(?<![.\w])require\(\s*(['"])([^'"]+)\1\s*\)/g,
    (_, _q, mod) => {
      stats.requires++; stats.dynamicImports++;
      stats.warnings.push(`require('${mod}') dinamis ➜ import('${mod}') (butuh await).`);
      return `import('${mod}')`;
    }
  );

  // 5. module.exports = { ... }
  src = src.replace(
    /module\.exports\s*=\s*\{([\s\S]*?)\}\s*;?/g,
    (_, body) => {
      stats.exports++;
      const trimmed = body.trim();
      if (!trimmed) return "export default {};";
      const items = splitTopLevel(trimmed);
      const names = [];
      let onlyShorthand = true;
      for (const it of items) {
        const t = it.trim();
        if (!t) continue;
        const mShort = t.match(/^([A-Za-z_$][\w$]*)$/);
        const mKey = t.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/);
        if (mShort) names.push(mShort[1]);
        else if (mKey && mKey[1] === mKey[2]) names.push(mKey[1]);
        else { onlyShorthand = false; break; }
      }
      if (onlyShorthand && names.length) {
        return `export { ${names.join(", ")} };\nexport default { ${names.join(", ")} };`;
      }
      return `export default { ${trimmed} };`;
    }
  );

  // 6. module.exports = ident
  src = src.replace(
    /module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?/g,
    (_, name) => { stats.exports++; return `export default ${name};`; }
  );

  // 7. exports.foo = ...
  src = src.replace(
    /exports\.([A-Za-z_$][\w$]*)\s*=\s*/g,
    (_, name) => { stats.exports++; return `export const ${name} = `; }
  );

  // 8. __dirname / __filename
  const needsMeta =
    /\b__dirname\b/.test(src) || /\b__filename\b/.test(src) || /\brequire\.main\b/.test(src);
  if (needsMeta) {
    const metaImport =
      `import { fileURLToPath } from 'url';\n` +
      `import { dirname } from 'path';\n` +
      `const __filename = fileURLToPath(import.meta.url);\n` +
      `const __dirname = dirname(__filename);\n`;
    const lines = src.split("\n");
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*import\s/.test(l) || /^\s*\/\//.test(l) || l.trim() === "") insertAt = i + 1;
      else break;
    }
    lines.splice(insertAt, 0, metaImport.trimEnd());
    src = lines.join("\n");
  }

  // 9. hapus 'use strict'
  src = src.replace(/^\s*['"]use strict['"]\s*;?\s*\n?/m, "");

  src = src.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { result: src, stats };
}

/* =========================================================
 *  HELPER: ambil quoted message universal
 * ========================================================= */
function getQuoted(m) {
  return (
    m?.quoted ||
    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    null
  );
}

/* =========================================================
 *  HANDLER
 * ========================================================= */
async function handler(m, ctx = {}) {
  const { conn, prefix, command, text } = resolveCtx(m, ctx);

  try {
    let input = text;

    // Kalau tidak ada teks -> coba dari reply
    if (!input) {
      const quoted = getQuoted(m);

      if (quoted) {
        // Reply teks
        input =
          quoted.text ||
          quoted.body ||
          quoted.message?.conversation ||
          quoted.message?.extendedTextMessage?.text ||
          quoted.message?.imageMessage?.caption ||
          quoted.message?.videoMessage?.caption ||
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          "";

        // Reply dokumen
        const docMsg =
          quoted.message?.documentMessage ||
          quoted.documentMessage ||
          quoted.documentWithCaptionMessage?.message?.documentMessage;

        if (!input && docMsg && typeof conn?.downloadMediaMessage === "function") {
          try {
            const buffer = await conn.downloadMediaMessage(
              quoted.message ? quoted : { message: quoted }
            );
            if (buffer) {
              input = Buffer.isBuffer(buffer)
                ? buffer.toString("utf-8")
                : String(buffer);
            }
          } catch (_) { /* lanjut */ }
        }
      }
    }

    if (!input) {
      return m.reply(
        `⚠️ *Cara pakai:*\n\n` +
          `• ${prefix}${command} <kode CJS>\n` +
          `• Reply sebuah pesan berisi kode CJS dengan ${prefix}${command}\n` +
          `• Reply file .js/.cjs dengan ${prefix}${command}\n\n` +
          `*Contoh:*\n` +
          `${prefix}${command} const fs = require('fs')\nmodule.exports = { fs }`
      );
    }

    const { result, stats } = convertCjsToEsm(input);

    const summary =
      `*✅ Konversi CJS ➜ ESM berhasil*\n\n` +
      `• require        : ${stats.requires}\n` +
      `• default import : ${stats.defaultImports}\n` +
      `• named import   : ${stats.namedImports}\n` +
      `• dynamic import : ${stats.dynamicImports}\n` +
      `• exports        : ${stats.exports}\n` +
      (stats.warnings.length
        ? `\n⚠️ *Catatan:*\n${stats.warnings.map((w) => `• ${w}`).join("\n")}\n`
        : "");

    const body = `${summary}\n\`\`\`js\n${result}\n\`\`\``;

    if (body.length > 3500 && typeof conn?.sendMessage === "function") {
      await conn.sendMessage(
        m.chat,
        {
          document: Buffer.from(result, "utf-8"),
          fileName: "converted.mjs",
          mimetype: "application/javascript",
          caption: summary,
        },
        { quoted: m }
      );
    } else {
      await m.reply(body);
    }
  } catch (err) {
    console.error("[cjs2esm] error:", err);
    try {
      await m.reply(`❌ Gagal konversi:\n${err.message || err}`);
    } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
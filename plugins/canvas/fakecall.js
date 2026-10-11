// plugins/fakecall.js
const pluginConfig = {
  name: "fakecall",
  alias: ['fc', 'panggilanpalsu'],
  category: "canvas",
  description: "Membuat screenshot panggilan WhatsApp masuk (have fun only)",
  usage: ".fakecall <nama> | <waktu> | <url_pp>",
  example: ".fakecall Ayank | 00:00 | https://c.top4top.io/p_3815w0ycy1.jpg",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/canvas/fakecall";
const API_KEY = "FREE";

const DISCLAIMER = "\n\n⚠️ _Have fun / prank only._";

/* ========== FETCH IMAGE UNIVERSAL ========== */
async function fetchImage(url, maxRetry = 3) {
  let lastErr;
  for (let i = 1; i <= maxRetry; i++) {
    try {
      const res = await fetch(url);
      console.log(`[fake] try ${i} status:`, res.status);

      if (res.status >= 500) {
        const body = await res.text().catch(() => "");
        throw new Error(`API HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();

      if (ct.includes("json")) {
        const raw = await res.text();
        let json;
        try { json = JSON.parse(raw); } catch { json = null; }

        if (json) {
          const imgUrl = findImageUrl(json);
          if (!imgUrl) throw new Error(`JSON tanpa URL gambar: ${raw.slice(0, 200)}`);
          return await downloadFromUrl(imgUrl);
        }
        if (/^https?:\/\//.test(raw.trim())) return await downloadFromUrl(raw.trim());
        throw new Error(`Response tak dikenal: ${raw.slice(0, 200)}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error("Response kosong (0 bytes).");
      return buf;
    } catch (e) {
      lastErr = e;
      console.log(`[fake] err try ${i}:`, e.message);
      if (i < maxRetry) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

function findImageUrl(obj) {
  if (!obj) return null;
  if (typeof obj === "string") return /^https?:\/\//.test(obj) ? obj : null;
  if (Array.isArray(obj)) {
    for (const it of obj) { const f = findImageUrl(it); if (f) return f; }
    return null;
  }
  if (typeof obj === "object") {
    for (const k of ["url", "image", "img", "link", "result", "data", "output", "file", "photo"]) {
      if (obj[k] !== undefined) { const f = findImageUrl(obj[k]); if (f) return f; }
    }
    for (const v of Object.values(obj)) { const f = findImageUrl(v); if (f) return f; }
  }
  return null;
}

async function downloadFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal unduh gambar: HTTP ${res.status}`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("json")) {
    const json = await res.json();
    const nested = findImageUrl(json);
    if (nested && nested !== url) return await downloadFromUrl(nested);
    throw new Error("Nested JSON tanpa gambar.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Gambar kosong saat diunduh.");
  return buf;
}

/* ========== HANDLER ========== */
async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "fakecall";

  try {
    let text = (ctx.text ?? m?.text ?? m?.body ?? "").trim();
    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text) {
      return m.reply(
        `📞 *Fake Call Screenshot*\n\n` +
        `*Format:*\n` +
        `${usedPrefix}${command} <nama> | <waktu> | <url_pp>\n\n` +
        `*Contoh:*\n` +
        `${usedPrefix}${command} Ayank | 00:00 | https://c.top4top.io/p_3815w0ycy1.jpg\n\n` +
        `_⚠️ Semua field wajib diisi._`
      );
    }

    const v = text.split("|").map((s) => s.trim());

    // Validasi ketat: semua field wajib
    if (v.length < 3 || !v[0] || !v[1] || !v[2]) {
      return m.reply(
        `⚠️ *Semua field wajib diisi!*\n\n` +
        `Format: ${usedPrefix}${command} <nama> | <waktu> | <url_pp>\n` +
        `Contoh: ${usedPrefix}${command} Ayank | 00:00 | https://c.top4top.io/p_3815w0ycy1.jpg`
      );
    }

    const [name, time, pp] = v;

    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      return m.reply(`⚠️ Format waktu salah: \`${time}\`\nGunakan HH:MM (contoh *00:00*)`);
    }
    if (!/^https?:\/\/.+/.test(pp)) {
      return m.reply(`⚠️ URL pp tidak valid: \`${pp}\``);
    }

    await m.reply("📞 Membuat screenshot fake call...");

    const url =
      `${API_BASE}?name=${encodeURIComponent(name)}` +
      `&time=${encodeURIComponent(time)}` +
      `&pp=${encodeURIComponent(pp)}` +
      `&apikey=${API_KEY}`;

    const buffer = await fetchImage(url);

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: `📞 *Fake Call*\n👤 ${name}\n⏱️ ${time}${DISCLAIMER}`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[fakecall] ERROR:", err);
    try { await m.reply(`❌ Gagal:\n${err.message || err}`); } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
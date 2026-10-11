// plugins/iqc.js
const pluginConfig = {
  name: "iqc",
  alias: ['iphonechat', 'iqchat'],
  category: "canvas",
  description: "Membuat screenshot chat gaya iPhone (iQC)",
  usage: ".iqc <teks> | <waktu> | <baterai> | <operator> | <wifi>",
  example: ".iqc Halo! Namaku Niwo 🤪 | 09:41 | 80 | tampilkan | tampilkan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/canvas/iqc";
const API_KEY = "FREE";

/* ========== FETCH IMAGE UNIVERSAL ========== */
async function fetchImage(url, maxRetry = 3) {
  let lastErr;
  for (let i = 1; i <= maxRetry; i++) {
    try {
      const res = await fetch(url);
      console.log(`[iqc] try ${i} status:`, res.status);

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
      console.log(`[iqc] err try ${i}:`, e.message);
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
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "iqc";

  try {
    let text = (ctx.text ?? m?.text ?? m?.body ?? "").trim();
    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text) {
      return m.reply(
        `📱 *iPhone Chat (iQC) Screenshot*\n\n` +
        `*Format:*\n` +
        `${usedPrefix}${command} <teks> | <waktu> | <baterai> | <operator> | <wifi>\n\n` +
        `*Keterangan:*\n` +
        `• waktu → HH:MM (contoh 09:41)\n` +
        `• baterai → 0-100\n` +
        `• operator → tampilkan / sembunyikan\n` +
        `• wifi → tampilkan / sembunyikan\n\n` +
        `*Contoh:*\n` +
        `${usedPrefix}${command} Halo! Namaku Niwo 🤪 | 09:41 | 80 | tampilkan | tampilkan\n\n` +
        `_Field 3, 4, 5 opsional (default: 80 | tampilkan | tampilkan)._`
      );
    }

    const v = text.split("|").map((s) => s.trim());

    // Field 1 (teks) & 2 (waktu) wajib
    if (!v[0]) {
      return m.reply(`⚠️ Teks wajib diisi.`);
    }

    const teks = v[0];
    const time = v[1] || "09:41";
    const baterai = v[2] || "80";
    const operator = v[3] || "tampilkan";
    const wifi = v[4] || "tampilkan";

    // Validasi format waktu
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      return m.reply(`⚠️ Format waktu salah: \`${time}\`\nGunakan HH:MM, contoh *09:41*`);
    }

    // Validasi baterai
    const batNum = parseInt(baterai, 10);
    if (isNaN(batNum) || batNum < 0 || batNum > 100) {
      return m.reply(`⚠️ Baterai harus angka 0-100. Diterima: \`${baterai}\``);
    }

    // Validasi operator & wifi (tampilkan / sembunyikan)
    const validToggle = ["tampilkan", "sembunyikan"];
    if (!validToggle.includes(operator.toLowerCase())) {
      return m.reply(`⚠️ Operator harus *tampilkan* atau *sembunyikan*.`);
    }
    if (!validToggle.includes(wifi.toLowerCase())) {
      return m.reply(`⚠️ Wifi harus *tampilkan* atau *sembunyikan*.`);
    }

    await m.reply("📱 Membuat screenshot iPhone chat...");

    const url =
      `${API_BASE}?text=${encodeURIComponent(teks)}` +
      `&time=${encodeURIComponent(time)}` +
      `&baterai=${encodeURIComponent(batNum)}` +
      `&operator=${encodeURIComponent(operator.toLowerCase())}` +
      `&wifi=${encodeURIComponent(wifi.toLowerCase())}` +
      `&apikey=${API_KEY}`;

    const buffer = await fetchImage(url);

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption: `📱 *iPhone Chat*\n\n_"${teks}"_`,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[iqc] ERROR:", err);
    try { await m.reply(`❌ Gagal:\n${err.message || err}`); } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
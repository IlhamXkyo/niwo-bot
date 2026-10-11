// plugins/fakeovo.js
const pluginConfig = {
  name: "fakeovo",
  alias: ['fovo', 'ovofake'],
  category: "canvas",
  description: "Membuat screenshot saldo OVO palsu (have fun only)",
  usage: ".fakeovo <amount>",
  example: ".fakeovo 5000002828",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/canvas/fake-ovo";
const API_KEY = "FREE";

const DISCLAIMER =
  "\n\n⚠️ _Ini hasil editan untuk have fun / prank saja. " +
  "Dilarang digunakan untuk penipuan atau tindakan ilegal._";

async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "fakeovo";

  try {
    let text =
      (ctx.text ?? ctx.body ?? m?.text ?? m?.body ?? "").trim() ||
      (ctx.args ? ctx.args.join(" ") : "");

    if (text.startsWith(usedPrefix)) text = text.slice(usedPrefix.length);
    const parts = text.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    text = parts.join(" ").trim();

    if (!text) {
      return m.reply(
        `💜 *Fake OVO Screenshot*\n\n` +
        `*Cara pakai:*\n` +
        `${usedPrefix}${command} <amount>\n\n` +
        `*Contoh:*\n` +
        `${usedPrefix}${command} 5000002828`
      );
    }

    const amount = text.replace(/[^0-9]/g, "");
    if (!amount) {
      return m.reply(`⚠️ Amount tidak valid. Contoh: *${usedPrefix}${command} 5000002828*`);
    }

    await m.reply("💜 Membuat screenshot OVO...");

    const url = `${API_BASE}?amount=${encodeURIComponent(amount)}&apikey=${API_KEY}`;
    const buffer = await fetchImage(url);

    await conn.sendMessage(
      m.chat,
      {
        image: buffer,
        caption:
          `💜 *Fake OVO*\n\n` +
          `💰 Amount: Rp ${Number(amount).toLocaleString("id-ID")}` +
          DISCLAIMER,
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("[fakeovo] error:", err);
    try { await m.reply(`❌ Gagal: ${err.message || err}`); } catch (_) {}
  }
}

async function fetchImage(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const json = await res.json();
    const imgUrl = json?.result?.url || json?.result || json?.url || json?.data?.url || json?.data;
    if (typeof imgUrl !== "string" || !/^https?:\/\//.test(imgUrl)) {
      throw new Error("Response JSON tidak mengandung URL gambar.");
    }
    const r2 = await fetch(imgUrl);
    if (!r2.ok) throw new Error(`Gagal unduh gambar: ${r2.status}`);
    return Buffer.from(await r2.arrayBuffer());
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("Response kosong.");
  return buf;
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
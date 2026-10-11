const config = {
  name: "turnstile",
  alias: ["cfbypass", "cloudflarebypass", "turnstilebypass"],
  category: "tools",

  description: "Bypass Cloudflare Turnstile / CAPTCHA",
  usage: ".turnstile <url> <sitekey>",
  example: ".turnstile https://example.com 0x4AAAAAAA...",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 3,
  isEnabled: true
};

async function handler(m, { sock }) {
  const args = String(m.text || "").trim().split(/\s+/);

  // ── Cek parameter ─────────────────────────
  if (args.length < 2) {
    return m.reply(
      "〄 *TURNSTILE BYPASS*\n\n" +
      "┌──────────────\n" +
      "│ 〄 Bypass Cloudflare Turnstile\n" +
      "│\n" +
      "│ 〄 *Cara Penggunaan:*\n" +
      `│ ${m.prefix}turnstile <url> <sitekey>\n` +
      "│\n" +
      "│ 〄 *Contoh:*\n" +
      `│ ${m.prefix}turnstile https://example.com 0x4AAAAAAA...\n` +
      "│\n" +
      "│ 〄 *Parameter:*\n" +
      "│ • url : Target website\n" +
      "│ • sitekey : Kunci Turnstile\n" +
      "└──────────────"
    );
  }

  const url = args[0];
  const sitekey = args[1];

  // ── Validasi URL ─────────────────────────
  try {
    new URL(url);
  } catch {
    return m.reply(
      "〄 *URL TIDAK VALID*\n\n" +
      "〄 Pastikan URL yang dimasukkan benar\n" +
      "〄 Contoh: https://example.com"
    );
  }

  // ── Validasi sitekey ─────────────────────
  if (!sitekey || sitekey.length < 10) {
    return m.reply(
      "〄 *SITEKEY TIDAK VALID*\n\n" +
      "〄 Sitekey harus berupa string yang valid\n" +
      "〄 Biasanya dimulai dengan '0x4' atau '0x'"
    );
  }

  try {
    await m.react("🕐");
    await m.reply(
      "〄 *PROSES BYPASS*\n\n" +
      "〄 🔄 Sedang memproses Turnstile...\n" +
      "〄 ⏳ Mohon tunggu sebentar\n\n" +
      `〄 URL : ${url}\n` +
      `〄 Sitekey : ${sitekey.substring(0, 15)}...`
    );

    // ── API Turnstile Bypass ──────────────
    const apiUrl = `https://api.ikyyxd.my.id/bypass/turnstile-cf-min?url=${encodeURIComponent(url)}&sitekey=${encodeURIComponent(sitekey)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API mengembalikan status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.status === false) {
      throw new Error(data.message || "Gagal melakukan bypass");
    }

    // ── Format hasil ──────────────────────
    let resultMessage = 
      "〄 *TURNSTILE BYPASS*\n\n" +
      "┌──────────────\n" +
      "│ ✅ *Status : Berhasil*\n" +
      `│ 📍 URL : ${url}\n`;

    if (data.token) {
      resultMessage += `│ 🔑 Token : ${data.token.substring(0, 50)}...\n`;
    }

    if (data.user_agent) {
      resultMessage += `│ 🤖 User-Agent : ${data.user_agent}\n`;
    }

    if (data.cookies && Object.keys(data.cookies).length > 0) {
      resultMessage += "│ 🍪 Cookies :\n";
      for (const [key, value] of Object.entries(data.cookies)) {
        resultMessage += `│   • ${key}: ${value.substring(0, 30)}...\n`;
      }
    }

    if (data.headers) {
      resultMessage += "│ 📋 Headers :\n";
      for (const [key, value] of Object.entries(data.headers)) {
        resultMessage += `│   • ${key}: ${String(value).substring(0, 30)}...\n`;
      }
    }

    resultMessage += 
      `│ ⏱ Waktu : ${new Date().toLocaleString('id-ID')}\n` +
      "└──────────────\n\n";

    if (data.token) {
      resultMessage += 
        "〄 *Token Siap Digunakan*\n" +
        "〄 Token dapat digunakan untuk bypass\n" +
        "〄 Gunakan pada header atau form data";
    }

    // ── Kirim hasil ──────────────────────
    await sock.sendMessage(
      m.chat,
      {
        text: resultMessage
      },
      {
        quoted: m.verifiedQuoted || m
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error("[TURNSTILE BYPASS ERROR]", error);

    await m.react("❌");

    return m.reply(
      "〄 *GAGAL BYPASS*\n\n" +
      `〄 Error : ${error.message}\n\n` +
      "〄 *Solusi:*\n" +
      "〄 • Periksa URL website\n" +
      "〄 • Pastikan sitekey valid\n" +
      "〄 • Coba beberapa saat lagi\n" +
      "〄 • Periksa koneksi internet\n\n" +
      "〄 *Catatan:*\n" +
      "〄 • API mungkin membutuhkan waktu\n" +
      "〄 • Tidak semua Turnstile bisa di-bypass"
    );
  }
}

export default {
  config,
  handler
};
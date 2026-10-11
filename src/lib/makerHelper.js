/**
 * makerHelper.js
 * Helper bersama untuk plugin kategori "maker".
 *
 * Semua plugin maker polanya sama: ambil teks -> panggil API -> kirim media.
 * Daripada menyalin blok fetch + error handling ke tiap file, semuanya
 * dipusatkan di sini.
 *
 * Penyedia API: RanggaCode (https://api.ranggacode.my.id/docs)
 * Endpoint efek teks ada di /api/ephoto/<style>?text=...&apikey=...
 */

import sharp from "sharp";
import config from "../../config.js";

const API_BASE = config?.api?.baseUrl || "https://api.ranggacode.my.id";
const API_KEY = config?.api?.apikey || "NIWO-BOT";

/**
 * Susun URL endpoint RanggaCode lengkap dengan apikey.
 *
 * @param {string} path   contoh: "/api/ephoto/gradienttext"
 * @param {object} params query string tambahan
 */
function buildApiUrl(path, params = {}) {
  const url = new URL(path, API_BASE);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("apikey", API_KEY);

  return url.toString();
}

/** Shortcut untuk endpoint efek teks (ephoto) RanggaCode. */
function ephotoUrl(style, text, extra = {}) {
  return buildApiUrl(`/api/ephoto/${style}`, { text, ...extra });
}

/**
 * Ambil gambar dari sebuah URL API. Menangani dua bentuk respons:
 * - JSON yang berisi URL gambar di salah satu field umum
 * - Binary langsung (image/png, image/jpeg, dst)
 *
 * RanggaCode membalas binary image/jpeg untuk endpoint ephoto, dan JSON
 * berisi { status: false, message } saat gagal (termasuk saat HTTP 500).
 *
 * @returns {Promise<Buffer|{url: string}>} sumber gambar siap kirim
 */
async function fetchImage(url, { timeout = 10_000, retries = 1 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const contentType = response.headers.get("content-type") || "";

      // Error dari RanggaCode selalu JSON, jadi dicek sebelum response.ok.
      if (contentType.includes("application/json")) {
        const data = await response.json();

        if (data?.status === false || data?.success === false) {
          throw new Error(data?.message || "API menolak permintaan");
        }

        const image =
          data?.result?.url ||
          data?.result?.image ||
          (typeof data?.result === "string" ? data.result : null) ||
          data?.url ||
          data?.image ||
          data?.data?.url;

        if (!image) {
          throw new Error("URL gambar tidak ditemukan dari API");
        }

        return { url: image };
      }

      if (!response.ok) {
        throw new Error(`API HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (!buffer.length) {
        throw new Error("Gambar kosong");
      }

      return buffer;
    } catch (err) {
      lastError =
        err?.name === "AbortError"
          ? new Error("API timeout, coba lagi nanti")
          : err;

      // Layak diulang: timeout, koneksi putus, dan gangguan sementara di
      // server upstream ephoto360 (DNS EAI_AGAIN / form data gagal) yang
      // sering sembuh sendiri pada percobaan berikutnya.
      const message = String(err?.message || "");
      const retryable =
        err?.name === "AbortError" ||
        message === "fetch failed" ||
        /EAI_AGAIN|ETIMEDOUT|ECONNRESET|socket hang up|Gagal memproses form data/i.test(
          message
        );

      if (!retryable || attempt === retries) break;

      // Jeda bertingkat supaya upstream punya waktu pulih.
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/** Ubah buffer/URL gambar menjadi WEBP siap dikirim sebagai sticker. */
async function toStickerWebp(input, size = 512) {
  const buffer = Buffer.isBuffer(input)
    ? input
    : Buffer.from(await (await fetch(input.url)).arrayBuffer());

  return sharp(buffer)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer();
}

/**
 * Pembungkus lengkap satu command maker berbasis teks.
 * Menangani validasi input, reaksi loading, kirim gambar, dan error.
 *
 * @param {object} m         objek pesan hasil serialize
 * @param {object} sock      socket Baileys
 * @param {object} opts
 * @param {string} opts.title    judul yang tampil di pesan bantuan
 * @param {string} opts.name     nama command (untuk contoh penggunaan)
 * @param {string} opts.example  contoh argumen
 * @param {(text: string) => string} opts.buildUrl  builder URL API
 * @param {number}  [opts.minWords]  minimal jumlah bagian dipisah "|"
 * @param {boolean} [opts.asSticker] kirim hasil sebagai sticker, bukan gambar
 */
async function runTextMaker(m, sock, opts) {
  const {
    title,
    name,
    example,
    buildUrl,
    minWords = 1,
    asSticker = false,
  } = opts;

  const text = String(m.text || "").trim();

  if (!text) {
    return m.reply(
      `〄 *${title}*\n\n` +
        `┌──────────────\n` +
        `│ 〄 Masukkan teks\n` +
        `│\n` +
        `│ 〄 Contoh:\n` +
        `│ ${m.prefix}${name} ${example}\n` +
        `└──────────────`
    );
  }

  if (minWords > 1 && text.split("|").length < minWords) {
    return m.reply(
      `❌ Format kurang lengkap.\n\n` +
        `Gunakan pemisah "|".\n\n` +
        `Contoh:\n${m.prefix}${name} ${example}`
    );
  }

  try {
    await m.react("🕐");

    const image = await fetchImage(buildUrl(text));

    if (asSticker) {
      const sticker = await toStickerWebp(image);
      await sock.sendMessage(m.chat, { sticker }, { quoted: m });
    } else {
      await sock.sendMessage(m.chat, { image }, { quoted: m });
    }

    await m.react("✅");
  } catch (error) {
    console.error(`[${name}]`, error);
    await m.react("❌");

    return m.reply(`❌ *Gagal membuat ${title}!*\n\n> ${error.message}`);
  }
}

export { fetchImage, runTextMaker, buildApiUrl, ephotoUrl, toStickerWebp };

// plugins/fake/fakeffduo.js

const config = {
  name: "fakeffduo",
  alias: ["ffduo", "fakeff"],
  category: "fake",
  description: "Membuat Fake Free Fire Duo",
  usage: ".fakeffduo <nickname1|nickname2>",
  example: ".fakeffduo Rafa|Dekzy",
  cooldown: 10,
  energi: 1
};

async function handler(m, { sock }) {
  try {
    const text =
      m.text?.trim() ||
      m.body?.trim() ||
      "";

    if (!text) {
      return m.reply(
        `❌ *NICKNAME TIDAK BOLEH KOSONG*\n\n` +
        `Format:\n` +
        `.fakeffduo nickname1|nickname2`
      );
    }

    const args = text.split("|");

    if (args.length < 2) {
      return m.reply(
        `❌ *FORMAT SALAH*\n\n` +
        `Gunakan:\n` +
        `.fakeffduo nickname1|nickname2`
      );
    }

    const nickname1 = args[0].trim();
    const nickname2 = args.slice(1).join("|").trim();

    if (!nickname1 || !nickname2) {
      return m.reply(
        "❌ Kedua nickname wajib diisi."
      );
    }

    if (
      nickname1.length > 30 ||
      nickname2.length > 30
    ) {
      return m.reply(
        "❌ Maksimal 30 karakter untuk setiap nickname."
      );
    }

    await m.reply(
      "⏳ Sedang membuat Fake FF Duo..."
    );

    const apiUrl =
      `https://apii.nexadev.my.id/fakeffduo` +
      `?nickname1=${encodeURIComponent(nickname1)}` +
      `&nickname2=${encodeURIComponent(nickname2)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/*"
      },
      signal: AbortSignal.timeout(60000)
    });

    const contentType =
      response.headers.get("content-type") || "";

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!response.ok) {
      let errorText = "";

      try {
        errorText = buffer.toString("utf8");
      } catch {}

      const error = new Error(
        errorText ||
        `API gagal (HTTP ${response.status})`
      );

      error.status = response.status;
      throw error;
    }

    if (!buffer.length) {
      return m.reply(
        "❌ API tidak mengembalikan gambar."
      );
    }

    if (!contentType.toLowerCase().startsWith("image/")) {
      let errorText;

      try {
        errorText =
          buffer.toString("utf8");
      } catch {
        errorText =
          "Response API bukan gambar.";
      }

      return m.reply(
        `❌ *GAGAL MEMBUAT FAKE FF DUO*\n\n` +
        errorText.substring(0, 1000)
      );
    }

    await sock.sendMessage(
      m.chat,
      {
        image: buffer,
        caption:
          `🎮 *FAKE FREE FIRE DUO*\n\n` +
          `👤 Player 1: ${nickname1}\n` +
          `👤 Player 2: ${nickname2}`
      },
      {
        quoted: m
      }
    );

  } catch (e) {
    console.error(
      "FAKEFFDUO ERROR:",
      e
    );

    let errorMessage =
      e?.message ||
      "Terjadi kesalahan tidak diketahui.";

    if (
      e?.name === "TimeoutError" ||
      e?.code === "ETIMEDOUT" ||
      e?.code === "ECONNABORTED"
    ) {
      errorMessage =
        "Request API timeout. Silakan coba lagi.";
    }

    if (e?.status === 404) {
      errorMessage =
        "Endpoint Fake FF Duo tidak ditemukan (404).";
    }

    if (e?.status === 429) {
      errorMessage =
        "Terlalu banyak request. Tunggu beberapa saat.";
    }

    return m.reply(
      `❌ *FAKE FF DUO ERROR*\n\n` +
      errorMessage
    );
  }
}

export default {
  config,
  handler
};
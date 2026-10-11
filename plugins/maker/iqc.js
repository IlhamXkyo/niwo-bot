const config = {
  name: "iqcmaker",
  alias: ["iqcimg", "iqcimage"],
  category: "maker",

  description: "Membuat gambar IQC dari teks",
  usage: ".iqc <text>",
  example: ".iqc twss",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 1,
  isEnabled: true
};

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();

  // ── Cek teks ─────────────────────────────
  if (!text) {
    return m.reply(
      "〄 *IQC MAKER*\n\n" +
      "┌──────────────\n" +
      "│ 〄 Masukkan teks IQC\n" +
      "│\n" +
      "│ 〄 Contoh:\n" +
      `│ ${m.prefix}iqc twss\n` +
      "└──────────────"
    );
  }

  try {
    await m.react("🕐");

    // ── API AZBRY ───────────────────────────
    const apiUrl =
      `https://api.azbry.com/api/maker/iqc?text=${encodeURIComponent(text)}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(
        `API mengembalikan status ${response.status}`
      );
    }

    // ── Pastikan response berupa gambar ─────
    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      const errorText = await response.text();

      console.error("[IQC API RESPONSE]", errorText);

      throw new Error(
        "API tidak mengembalikan gambar."
      );
    }

    // ── Ambil buffer gambar ─────────────────
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    if (!imageBuffer.length) {
      throw new Error("Buffer gambar kosong.");
    }

    // ── Kirim gambar ────────────────────────
    await sock.sendMessage(
      m.chat,
      {
        image: imageBuffer,
        caption:
          "〄 *IQC MAKER*\n\n" +
          `〄 Text : ${text}`
      },
      {
        quoted: m.verifiedQuoted || m
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error("[IQC ERROR]", error);

    await m.react("❌");

    return m.reply(
      "〄 *GAGAL MEMBUAT IQC*\n\n" +
      `Error : ${error.message}`
    );
  }
}

export default {
  config,
  handler
};
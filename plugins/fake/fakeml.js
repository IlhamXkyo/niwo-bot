// plugins/fake/fakeml.js

const config = {
  name: "fakeml",
  alias: ["fakemlobby", "fakelobyml"],
  category: "fake",
  description: "Membuat Fake Lobby Mobile Legends",
  usage: ".fakeml <nickname>",
  example: ".fakeml dekzyy",
  cooldown: 10,
  energi: 1
};

function getQuotedMime(quoted) {
  return (
    quoted?.msg?.mimetype ||
    quoted?.mimetype ||
    quoted?.message?.imageMessage?.mimetype ||
    quoted?.msg?.message?.imageMessage?.mimetype ||
    ""
  );
}

function isImageMessage(quoted) {
  const mime = getQuotedMime(quoted);

  if (/^image\//i.test(mime)) return true;

  if (quoted?.imageMessage) return true;
  if (quoted?.msg?.imageMessage) return true;
  if (quoted?.message?.imageMessage) return true;

  return false;
}

async function uploadAvatar(buffer) {
  const form = new FormData();

  form.append(
    "file",
    new Blob([buffer], { type: "image/jpeg" }),
    "fakeml.jpg"
  );

  form.append("ttl", "");

  const response = await fetch(
    "https://api.nexray.eu.cc/upload",
    {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60000)
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.msg ||
      `Upload gagal (HTTP ${response.status})`
    );
  }

  const avatar = data?.result?.url;

  if (!data?.status || !avatar) {
    throw new Error("Gagal mendapatkan URL avatar dari API");
  }

  return avatar;
}

async function createFakeLobby(avatar, nickname) {
  const apiUrl =
    `https://api.nexray.eu.cc/maker/fakelobyml` +
    `?avatar=${encodeURIComponent(avatar)}` +
    `&nickname=${encodeURIComponent(nickname)}`;

  const response = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "image/*"
    },
    signal: AbortSignal.timeout(120000)
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
    throw new Error(
      "API tidak mengembalikan hasil gambar"
    );
  }

  if (!contentType.toLowerCase().includes("image")) {
    throw new Error(
      buffer.toString("utf8").substring(0, 1000) ||
      "Response API bukan gambar"
    );
  }

  return buffer;
}

async function handler(m, { sock }) {
  const text =
    m.text?.trim() ||
    m.body?.trim() ||
    "";

  if (!text) {
    return m.reply(
      `❌ Nickname belum diisi\n\n` +
      `Contoh:\n.fakeml RafaXMods`
    );
  }

  const nickname = text;

  if (nickname.length > 30) {
    return m.reply(
      "❌ Nickname maksimal 30 karakter"
    );
  }

  /*
   * Prioritas:
   * 1. Foto yang di-reply
   * 2. Foto yang dikirim bersama command
   */
  const quoted = m.quoted;

  let media = null;

  if (quoted && isImageMessage(quoted)) {
    media = quoted;
  } else if (isImageMessage(m)) {
    media = m;
  }

  if (!media) {
    return m.reply(
      `❌ Reply/kirim foto terlebih dahulu\n\n` +
      `Contoh:\n` +
      `1. Reply foto\n` +
      `2. Ketik: .fakeml RafaXMods`
    );
  }

  try {
    const bufferPhoto = await media.download();

    if (
      !bufferPhoto ||
      !Buffer.isBuffer(bufferPhoto) ||
      !bufferPhoto.length
    ) {
      throw new Error(
        "Gagal mengambil buffer foto"
      );
    }

    await m.reply(
      "⏳ Mengupload avatar..."
    );

    const avatar =
      await uploadAvatar(bufferPhoto);

    await m.reply(
      "⏳ Sedang membuat Fake Lobby ML..."
    );

    const result =
      await createFakeLobby(
        avatar,
        nickname
      );

    await sock.sendMessage(
      m.chat,
      {
        image: result,
        caption:
          `👤 *Nickname:*\n${nickname}\n\n` +
          `✨ Fake Lobby ML berhasil dibuat`
      },
      {
        quoted: m
      }
    );
  } catch (e) {
    console.error(
      "FAKEML ERROR:",
      e
    );

    let errorMessage =
      e?.message ||
      "Terjadi kesalahan tidak diketahui";

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
        "Endpoint Fake Lobby ML tidak ditemukan.";
    }

    if (e?.status === 429) {
      errorMessage =
        "Terlalu banyak request. Silakan tunggu beberapa saat.";
    }

    return m.reply(
      `❌ *FAKE LOBBY ML ERROR*\n\n${errorMessage}`
    );
  }
}

export default {
  config,
  handler
};
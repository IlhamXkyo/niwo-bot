import axios from "axios";
import FormData from "form-data";
import crypto from "node:crypto";

const config = {
  name: "upscale",
  alias: ["hd", "upscaler", "imagehd"],
  category: "maker",
  description: "Meningkatkan resolusi gambar hingga 2x/4x.",
  usage: ".upscale <reply gambar> [2/4]",
  example: ".upscale 4",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 15,
  energi: 0,
  isEnabled: true
};

const SERVERS = [
  "api1g", "api2g", "api3g", "api8g", "api9g",
  "api10g", "api11g", "api12g", "api13g",
  "api14g", "api15g", "api16g", "api17g",
  "api18g", "api19g", "api20g", "api21g",
  "api22g", "api24g", "api25g"
];

const TASK =
  "r68zl88mq72xq94j2d5p66bn2z9lrbx20njsbw2qsAvgmzr11lvfhAx9kl87pp6yqgx7c8vg7sfbqnrr42qb16v0gj8jl5s0kq1kgp26mdyjjspd8c5A2wk8b4Adbm6vf5tpwbqlqdr8A9tfn7vbqvy28ylphlxdl379psxpd8r70nzs3sk1";


/* =========================
 * GET TOKEN + CSRF
 * ========================= */

async function getToken() {
  const response = await axios.get(
    "https://www.iloveimg.com/upscale-image",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
      },
      timeout: 30000
    }
  );

  const html = String(response.data);

  /*
   * Ambil:
   * ilovepdfConfig = {...};
   */

  const configMatch = html.match(
    /ilovepdfConfig\s*=\s*(\{[\s\S]*?\});/
  );

  if (!configMatch) {
    throw new Error(
      "Config iLoveIMG tidak ditemukan."
    );
  }

  let json;

  try {
    json = JSON.parse(configMatch[1]);
  } catch {
    throw new Error(
      "Config iLoveIMG gagal diparse."
    );
  }

  /*
   * Ambil CSRF dari:
   * <meta name="csrf-token" content="...">
   */

  const csrfMatch = html.match(
    /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );

  /*
   * Beberapa halaman bisa menaruh
   * content sebelum name.
   */

  const csrfMatchAlt = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["'][^>]*>/i
  );

  const csrf =
    csrfMatch?.[1] ||
    csrfMatchAlt?.[1];

  if (!json?.token) {
    throw new Error(
      "Token iLoveIMG tidak ditemukan."
    );
  }

  if (!csrf) {
    throw new Error(
      "CSRF token tidak ditemukan."
    );
  }

  return {
    token: json.token,
    csrf
  };
}


/* =========================
 * UPLOAD
 * ========================= */

async function uploadImage(
  server,
  headers,
  buffer
) {
  const form =
    new FormData();

  form.append(
    "name",
    "image.jpg"
  );

  form.append(
    "chunk",
    "0"
  );

  form.append(
    "chunks",
    "1"
  );

  form.append(
    "task",
    TASK
  );

  form.append(
    "preview",
    "1"
  );

  form.append(
    "file",
    buffer,
    {
      filename: "image.jpg",
      contentType: "image/jpeg"
    }
  );

  const response =
    await axios.post(
      `https://${server}.iloveimg.com/v1/upload`,
      form,
      {
        headers: {
          ...headers,
          ...form.getHeaders()
        },
        timeout: 60000,
        maxContentLength:
          Infinity,
        maxBodyLength:
          Infinity
      }
    );

  return response.data;
}


/* =========================
 * UPSCALE
 * ========================= */

async function imageHD(
  buffer,
  scale = 4
) {
  if (
    scale !== 2 &&
    scale !== 4
  ) {
    throw new Error(
      "Scale hanya boleh 2 atau 4."
    );
  }

  const {
    token,
    csrf
  } = await getToken();

  const server =
    SERVERS[
      Math.floor(
        Math.random() *
          SERVERS.length
      )
    ];

  const headers = {
    Authorization:
      `Bearer ${token}`,

    Origin:
      "https://www.iloveimg.com",

    Referer:
      "https://www.iloveimg.com/",

    Cookie:
      `_csrf=${csrf}`,

    "User-Agent":
      "Mozilla/5.0"
  };

  const upload =
    await uploadImage(
      server,
      headers,
      buffer
    );

  if (
    !upload?.server_filename
  ) {
    throw new Error(
      "Upload gambar gagal."
    );
  }

  const form =
    new FormData();

  form.append(
    "task",
    TASK
  );

  form.append(
    "server_filename",
    upload.server_filename
  );

  form.append(
    "scale",
    String(scale)
  );

  const response =
    await axios.post(
      `https://${server}.iloveimg.com/v1/upscale`,
      form,
      {
        headers: {
          ...headers,
          ...form.getHeaders()
        },

        responseType:
          "arraybuffer",

        timeout:
          180000,

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity
      }
    );

  return Buffer.from(
    response.data
  );
}


/* =========================
 * GET MIME
 * ========================= */

function getMime(target) {
  return (
    target?.mimetype ||
    target?.msg?.mimetype ||
    target?.message?.imageMessage
      ?.mimetype ||
    target?.message
      ?.documentMessage
      ?.mimetype ||
    ""
  );
}


/* =========================
 * GET QUOTED
 * ========================= */

function getQuoted(m) {
  return (
    m?.quoted ||
    m?.msg?.contextInfo
      ?.quotedMessage ||
    null
  );
}


/* =========================
 * DOWNLOAD MEDIA
 * ========================= */

async function downloadMedia(
  target,
  sock
) {
  /*
   * Bot biasanya menyediakan
   * quoted.download()
   */

  if (
    typeof target?.download ===
    "function"
  ) {
    const result =
      await target.download();

    if (result) {
      return Buffer.isBuffer(
        result
      )
        ? result
        : Buffer.from(result);
    }
  }

  /*
   * Fallback Baileys.
   */

  if (
    sock?.downloadMediaMessage
  ) {
    try {
      const result =
        await sock.downloadMediaMessage(
          target
        );

      if (result) {
        return Buffer.isBuffer(
          result
        )
          ? result
          : Buffer.from(result);
      }
    } catch {}
  }

  return null;
}


/* =========================
 * GET COMMAND TEXT
 * ========================= */

function getText(m) {
  return String(
    m?.text ||
    m?.body ||
    m?.message
      ?.conversation ||
    m?.message
      ?.extendedTextMessage
      ?.text ||
    ""
  ).trim();
}


/* =========================
 * GET SCALE
 * ========================= */

function getScale(m) {
  const text =
    getText(m);

  const match =
    text.match(
      /(?:^|\s)([24])(?:\s|$)/
    );

  return match
    ? Number(match[1])
    : 4;
}


/* =========================
 * RANDOM FILENAME
 * ========================= */

function randomFilename() {
  return (
    "upscale-" +
    crypto
      .randomBytes(8)
      .toString("hex") +
    ".jpg"
  );
}


/* =========================
 * HANDLER
 * ========================= */

async function handler(
  m,
  { sock } = {}
) {
  try {
    if (
      !sock?.sendMessage
    ) {
      return m.reply?.(
        "〄 Client bot tidak memiliki sendMessage()."
      );
    }

    const quoted =
      getQuoted(m);

    const target =
      quoted || m;

    const mime =
      getMime(target);

    if (
      !mime ||
      !/^image\//i.test(mime)
    ) {
      return m.reply?.(
        "〄 *Cara penggunaan:*\n\n" +
        "Reply/kirim gambar lalu ketik:\n" +
        "`.upscale`\n\n" +
        "Atau pilih scale:\n" +
        "`.upscale 2`\n" +
        "`.upscale 4`\n\n" +
        "〄 Default: 4x"
      );
    }

    const scale =
      getScale(m);

    if (
      scale !== 2 &&
      scale !== 4
    ) {
      return m.reply?.(
        "〄 Scale hanya tersedia 2x atau 4x."
      );
    }

    await m.reply?.(
      `〄 *Upscale ${scale}x sedang diproses...*\n` +
      "〄 Tunggu sebentar."
    );

    const buffer =
      await downloadMedia(
        target,
        sock
      );

    if (
      !buffer ||
      !buffer.length
    ) {
      throw new Error(
        "Gagal mengambil gambar."
      );
    }

    const result =
      await imageHD(
        buffer,
        scale
      );

    if (
      !result ||
      !result.length
    ) {
      throw new Error(
        "Server tidak mengembalikan hasil gambar."
      );
    }

    const chat =
      m.chat ||
      m.key?.remoteJid;

    if (!chat) {
      throw new Error(
        "Chat ID tidak ditemukan."
      );
    }

    await sock.sendMessage(
      chat,
      {
        image:
          result,

        mimetype:
          "image/jpeg",

        fileName:
          randomFilename(),

        caption:
          `〄 *UPSCALER BERHASIL*\n\n` +
          `〄 Scale : ${scale}x\n` +
          "〄 Gambar berhasil ditingkatkan."
      },
      {
        quoted: m
      }
    );

  } catch (error) {
    console.error(
      "[IMAGEHD ERROR]",
      error
    );

    let detail =
      error?.message ||
      "Terjadi kesalahan.";

    /*
     * Jangan tampilkan response
     * terlalu panjang ke chat.
     */

    if (
      detail.length > 500
    ) {
      detail =
        detail.slice(0, 500) +
        "...";
    }

    await m.reply?.(
      "〄 *Upscale gagal.*\n\n" +
      `〄 ${detail}`
    );
  }
}


/* =========================
 * Niwo EXPORT
 * ========================= */

export default {
  config,
  handler
};
import axios from "axios";
import FormData from "form-data";
import sharp from "sharp";

const config = {
  name: "removebg",
  alias: ["rbg", "nobg", "remove-bg"],
  category: "tools",

  description: "Menghapus background dari gambar.",
  usage: ".removebg",
  example: ".removebg",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 0,
  isEnabled: true
};

// ======================================================
// PHOTO ROOM TOKEN
// ======================================================

let idToken = null;
let tokenExpiry = 0;

let refreshToken =
  process.env.PHOTOROOM_REFRESH_TOKEN || "AMf-vBwpudXTnY1FgobhqhDbSVE1ysyhrUQZaxHVNPeViBXZTC8q3f-yawGwDvRNqlokG848eNS8k4SgLCLGp_rb6MUEz0HXoxu-G54TtFismWggMLfimC8nhGUE6PRj0vjplcNhGDN7OPujzDENzuvDDuZLkRBuqyF4kaNYUqAZI_Q_hjYvHJwaWQqJGdKWOGXkv8tNGn_M";

async function getValidIdToken() {
  const now = Date.now();

  if (
    idToken &&
    tokenExpiry - now > 5 * 60 * 1000
  ) {
    return idToken;
  }

  if (!refreshToken) {
    throw new Error(
      "PHOTOROOM_REFRESH_TOKEN belum dipasang."
    );
  }

  try {
    const res = await axios.post(
      "https://securetoken.googleapis.com/v1/token",
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken
      },
      {
        params: {
          key:
            "AIzaSyAJGrgbFGB_-h8V2oJLr4b-_ipetqM0duU"
        },

        headers: {
          "Content-Type":
            "application/json",

          "X-Android-Package":
            "com.photoroom.app",

          "X-Android-Cert":
            "0424A4898A4B33940D8BF16E44251B876E97F8D0",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; U; Android 14; sdk_gphone64_x86_64 Build/UE1A.230829.036.A4)"
        },

        timeout: 30000
      }
    );

    idToken = res.data.id_token;

    if (res.data.refresh_token) {
      refreshToken =
        res.data.refresh_token;
    }

    tokenExpiry =
      Date.now() +
      Number(res.data.expires_in || 3600) *
        1000;

    return idToken;

  } catch (err) {
    const detail =
      err?.response?.data?.error?.message ||
      err?.response?.data ||
      err?.message ||
      "Unknown error";

    throw new Error(
      "Token PhotoRoom gagal: " +
        String(detail)
    );
  }
}

// ======================================================
// CARI IMAGE MESSAGE
// ======================================================

function getImageMessage(msg) {
  if (!msg) return null;

  // Langsung imageMessage
  if (msg.imageMessage) {
    return msg.imageMessage;
  }

  // wrapper message
  if (msg.message?.imageMessage) {
    return msg.message.imageMessage;
  }

  // ephemeral
  if (
    msg.message?.ephemeralMessage
      ?.message?.imageMessage
  ) {
    return (
      msg.message.ephemeralMessage
        .message.imageMessage
    );
  }

  // view once
  if (
    msg.message?.viewOnceMessage
      ?.message?.imageMessage
  ) {
    return (
      msg.message.viewOnceMessage
        .message.imageMessage
    );
  }

  if (
    msg.message?.viewOnceMessageV2
      ?.message?.imageMessage
  ) {
    return (
      msg.message.viewOnceMessageV2
        .message.imageMessage
    );
  }

  return null;
}

// ======================================================
// CEK APAKAH PESAN GAMBAR
// ======================================================

function isImageMessage(msg) {
  if (!msg) return false;

  const image =
    getImageMessage(msg);

  if (image) return true;

  const mime =
    msg.mimetype ||
    msg.msg?.mimetype ||
    msg.message?.imageMessage
      ?.mimetype;

  return /^image\//i.test(
    String(mime || "")
  );
}

// ======================================================
// AMBIL PESAN TARGET
// ======================================================

function getTargetMessage(m) {
  if (!m) return null;

  // Reply gambar
  if (m.quoted) {
    if (isImageMessage(m.quoted)) {
      return m.quoted;
    }

    if (
      m.quoted.message ||
      m.quoted.msg
    ) {
      return m.quoted;
    }
  }

  // Gambar langsung
  if (isImageMessage(m)) {
    return m;
  }

  return null;
}

// ======================================================
// DOWNLOAD IMAGE
// ======================================================

async function downloadTarget(
  target,
  sock
) {
  // ----------------------------------------
  // Niwo wrapper
  // ----------------------------------------

  if (
    target &&
    typeof target.download ===
      "function"
  ) {
    try {
      const buffer =
        await target.download();

      if (
        buffer &&
        Buffer.isBuffer(buffer)
      ) {
        return buffer;
      }
    } catch {}
  }

  // ----------------------------------------
  // Pesan utama
  // ----------------------------------------

  if (
    target?.msg &&
    typeof target.msg.download ===
      "function"
  ) {
    try {
      const buffer =
        await target.msg.download();

      if (
        buffer &&
        Buffer.isBuffer(buffer)
      ) {
        return buffer;
      }
    } catch {}
  }

  // ----------------------------------------
  // Baileys fallback
  // ----------------------------------------

  if (
    sock &&
    typeof sock.downloadMediaMessage ===
      "function"
  ) {
    try {
      const buffer =
        await sock.downloadMediaMessage(
          target
        );

      if (
        buffer &&
        Buffer.isBuffer(buffer)
      ) {
        return buffer;
      }
    } catch {}
  }

  throw new Error(
    "Gagal mendownload gambar dari pesan."
  );
}

// ======================================================
// HANDLER
// ======================================================

async function handler(
  m,
  { sock } = {}
) {
  try {
    if (!sock) {
      return m.reply?.(
        "〄 Socket bot tidak ditemukan."
      );
    }

    // ----------------------------------------
    // Cari gambar
    // ----------------------------------------

    const target =
      getTargetMessage(m);

    if (!target) {
      return m.reply?.(
        "〄 Kirim gambar dengan caption *.removebg* atau reply gambar lalu ketik *.removebg*"
      );
    }

    // ----------------------------------------
    // Status
    // ----------------------------------------

    await m.reply?.(
      "〄 Sedang menghapus background..."
    );

    // ----------------------------------------
    // Token
    // ----------------------------------------

    const authToken =
      await getValidIdToken();

    // ----------------------------------------
    // Download
    // ----------------------------------------

    const image =
      await downloadTarget(
        target,
        sock
      );

    if (
      !image ||
      !Buffer.isBuffer(image)
    ) {
      throw new Error(
        "Data gambar tidak valid."
      );
    }

    // ----------------------------------------
    // Pastikan gambar valid
    // ----------------------------------------

    const inputMeta =
      await sharp(image).metadata();

    if (
      !inputMeta.width ||
      !inputMeta.height
    ) {
      throw new Error(
        "File bukan gambar yang valid."
      );
    }

    // ----------------------------------------
    // FormData
    // ----------------------------------------

    const form =
      new FormData();

    form.append(
      "sourceImage",
      image,
      {
        filename: "source.jpg",
        contentType:
          "image/jpeg"
      }
    );

    form.append(
      "user_id",
      "48acFOd8fTfvyjU0nI4oaqKB7512"
    );

    form.append(
      "resize_mask",
      "false"
    );

    form.append(
      "model_type",
      "free"
    );

    form.append(
      "experiment_flag",
      "default"
    );

    // ----------------------------------------
    // PhotoRoom
    // ----------------------------------------

    const response =
      await axios.post(
        "https://segmentation-inference.photoroom.com/v1/mask",
        form,
        {
          headers: {
            ...form.getHeaders(),

            "User-Agent":
              "okhttp/5.3.2",

            authorization:
              authToken,

            "pr-app-version":
              "2026.07.02 (2274)",

            "pr-platform":
              "android"
          },

          timeout: 60000,

          maxContentLength:
            Infinity,

          maxBodyLength:
            Infinity
        }
      );

    // ----------------------------------------
    // Ambil mask
    // ----------------------------------------

    const base64Mask =
      response?.data?.b64_mask;

    if (!base64Mask) {
      throw new Error(
        "PhotoRoom tidak mengembalikan mask."
      );
    }

    const mask =
      Buffer.from(
        base64Mask,
        "base64"
      );

    const maskMeta =
      await sharp(mask)
        .metadata();

    if (
      !maskMeta.width ||
      !maskMeta.height
    ) {
      throw new Error(
        "Mask PhotoRoom tidak valid."
      );
    }

    // ----------------------------------------
    // Buat PNG transparan
    // ----------------------------------------

    const result =
      await sharp(image)
        .resize(
          maskMeta.width,
          maskMeta.height
        )
        .removeAlpha()
        .joinChannel(mask)
        .png()
        .toBuffer();

    // ----------------------------------------
    // Kirim hasil
    // ----------------------------------------

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
        image: result,
        mimetype:
          "image/png",
        fileName:
          "removebg.png",
        caption:
          "〄 Background berhasil dihapus."
      },
      {
        quoted: m
      }
    );

  } catch (err) {
    console.error(
      "[REMOVEBG ERROR]",
      err
    );

    let detail =
      err?.message ||
      String(err);

    if (
      err?.response?.data
    ) {
      const data =
        err.response.data;

      if (
        typeof data ===
        "string"
      ) {
        detail = data;
      } else {
        try {
          detail =
            JSON.stringify(
              data,
              null,
              2
            );
        } catch {}
      }
    }

    return m.reply?.(
      "〄 *REMOVE BG ERROR*\n\n" +
      detail.slice(0, 3000)
    );
  }
}

export default {
  config,
  handler
};
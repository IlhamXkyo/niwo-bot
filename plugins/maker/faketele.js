import {
  createCanvas,
  loadImage,
  GlobalFonts
} from "@napi-rs/canvas";

import {
  writeFile,
  mkdir
} from "node:fs/promises";

import {
  existsSync,
  unlinkSync
} from "node:fs";

import {
  join
} from "node:path";

import axios from "axios";

const config = {
  name: "faketele",
  alias: ["faketelegram", "fake-tele", "fakeprofile"],

  category: "maker",

  description:
    "Membuat fake Telegram profile dari foto dan data yang diberikan.",

  usage:
    ".faketele Nama | Nomor HP | Bio | Username",

  example:
    ".faketele Rin | 628123456789 | Hello World | rinimup",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 0,
  isEnabled: true
};

// ======================================================
// CACHE FONT
// ======================================================

let fontBufferCache = null;
let fontRegistered = false;

const FONT_NAME = "TeleRobotoMono";

// ======================================================
// AMBIL TEXT COMMAND
// ======================================================

function getCommandText(m) {
  let text =
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    "";

  text = String(text).trim();

  // Buang command di awal.
  // Support:
  // .faketele Nama | Nomor | Bio | Username
  // !faketele ...
  // #faketele ...

  text = text.replace(
    /^[.!#/]?(?:faketele|faketelegram|fake-tele|fakeprofile)\s*/i,
    ""
  );

  return text.trim();
}

// ======================================================
// CARI IMAGE MESSAGE
// ======================================================

function getImageMessage(msg) {
  if (!msg) return null;

  if (msg.imageMessage) {
    return msg.imageMessage;
  }

  if (msg.message?.imageMessage) {
    return msg.message.imageMessage;
  }

  if (
    msg.message?.ephemeralMessage
      ?.message?.imageMessage
  ) {
    return (
      msg.message.ephemeralMessage
        .message.imageMessage
    );
  }

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
// CEK GAMBAR
// ======================================================

function isImage(msg) {
  if (!msg) return false;

  if (getImageMessage(msg)) {
    return true;
  }

  const mime =
    msg?.mimetype ||
    msg?.msg?.mimetype ||
    msg?.message?.imageMessage?.mimetype ||
    "";

  return /^image\//i.test(
    String(mime)
  );
}

// ======================================================
// TARGET IMAGE
// ======================================================

function getTarget(m) {
  if (m?.quoted) {
    if (isImage(m.quoted)) {
      return m.quoted;
    }

    if (
      m.quoted.message ||
      m.quoted.msg
    ) {
      return m.quoted;
    }
  }

  if (isImage(m)) {
    return m;
  }

  return null;
}

// ======================================================
// DOWNLOAD IMAGE
// ======================================================

async function downloadImage(
  target,
  sock
) {
  // Niwo wrapper
  if (
    typeof target?.download ===
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

  // msg wrapper
  if (
    typeof target?.msg?.download ===
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

  // Baileys fallback
  if (
    typeof sock?.downloadMediaMessage ===
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
    "Gagal mengunduh foto."
  );
}

// ======================================================
// HANDLER
// ======================================================

async function handler(
  m,
  { sock } = {}
) {
  let outPath = null;

  try {
    if (!sock?.sendMessage) {
      return m.reply?.(
        "〄 Client bot tidak memiliki sendMessage()."
      );
    }

    // --------------------------------------------------
    // Cari gambar
    // --------------------------------------------------

    const target =
      getTarget(m);

    if (!target) {
      return m.reply?.(
        "〄 *Format Salah!*\n\n" +
        "Reply/kirim gambar untuk Foto Profil (PP), " +
        "lalu gunakan format:\n\n" +
        "*.faketele Nama | Nomor HP | Bio | Username*\n\n" +
        "Contoh:\n" +
        "*.faketele Rin | 628123456789 | Hello World | rinimup*"
      );
    }

    // --------------------------------------------------
    // Ambil teks
    // --------------------------------------------------

    const text =
      getCommandText(m);

    if (!text) {
      return m.reply?.(
        "〄 *Format Teks Kosong!*\n\n" +
        "Contoh:\n" +
        "*.faketele Nama | Nomor HP | Bio | Username*"
      );
    }

    // --------------------------------------------------
    // Parse input
    // --------------------------------------------------

    const parts =
      text
        .split("|")
        .map(v =>
          v
            ? v.trim()
            : ""
        );

    const namaInput =
      parts[0] || "";

    const ponselInput =
      parts[1] || "";

    const bioInput =
      parts[2] || "";

    const userInput =
      parts.slice(3)
        .join("|")
        .trim();

    if (
      !namaInput ||
      !ponselInput ||
      !bioInput ||
      !userInput
    ) {
      return m.reply?.(
        "〄 *Semua Input Wajib Diisi!*\n\n" +
        "Format:\n" +
        "*.faketele Nama | Nomor HP | Bio | Username*\n\n" +
        "Contoh:\n" +
        "*.faketele Rin | 628123456789 | Hello World | rinimup*"
      );
    }

    await m.reply?.(
      "〄 Memproses Fake Telegram Profile..."
    );

    // --------------------------------------------------
    // Download PP
    // --------------------------------------------------

    const ppBuffer =
      await downloadImage(
        target,
        sock
      );

    // --------------------------------------------------
    // Folder
    // --------------------------------------------------

    const ASSETS_DIR =
      join(
        process.cwd(),
        "assets",
        "faketele"
      );

    const BG_LOCAL =
      join(
        ASSETS_DIR,
        "bg_tele.png"
      );

    const TMP_DIR =
      join(
        process.cwd(),
        "tmp"
      );

    await mkdir(
      ASSETS_DIR,
      {
        recursive: true
      }
    );

    await mkdir(
      TMP_DIR,
      {
        recursive: true
      }
    );

    // --------------------------------------------------
    // URL asset
    // --------------------------------------------------

    const TTF_URL =
      "https://cdn.jsdelivr.net/fontsource/fonts/roboto-mono@latest/latin-700-normal.ttf";

    const BG_URL =
      "https://raw.githubusercontent.com/ryyntwx/Image-rinn/refs/heads/main/c8ac4ffc-618c-411c-b36c-45c06c7e5a5e.png";

    // --------------------------------------------------
    // Register font
    // --------------------------------------------------

    if (!fontRegistered) {
      try {
        if (!fontBufferCache) {
          const fontRes =
            await axios.get(
              TTF_URL,
              {
                responseType:
                  "arraybuffer",
                headers: {
                  "User-Agent":
                    "Mozilla/5.0"
                },
                timeout: 30000
              }
            );

          fontBufferCache =
            Buffer.from(
              fontRes.data
            );
        }

        fontRegistered =
          GlobalFonts.register(
            fontBufferCache,
            FONT_NAME
          );

      } catch (errFont) {
        console.error(
          "[FAKETELE FONT]",
          errFont?.message ||
          errFont
        );
      }
    }

    const fontFamily =
      fontRegistered
        ? FONT_NAME
        : "sans-serif";

    // --------------------------------------------------
    // Download background
    // --------------------------------------------------

    if (!existsSync(BG_LOCAL)) {
      const bgRes =
        await axios.get(
          BG_URL,
          {
            responseType:
              "arraybuffer",

            headers: {
              "User-Agent":
                "Mozilla/5.0"
            },

            timeout: 30000
          }
        );

      await writeFile(
        BG_LOCAL,
        Buffer.from(
          bgRes.data
        )
      );
    }

    // --------------------------------------------------
    // Load image
    // --------------------------------------------------

    const bgImg =
      await loadImage(
        BG_LOCAL
      );

    const ppImg =
      await loadImage(
        ppBuffer
      );

    // --------------------------------------------------
    // Canvas
    // --------------------------------------------------

    const canvas =
      createCanvas(
        bgImg.width,
        bgImg.height
      );

    const ctx =
      canvas.getContext(
        "2d"
      );

    // Background
    ctx.drawImage(
      bgImg,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // --------------------------------------------------
    // Data
    // --------------------------------------------------

    const nama =
      namaInput;

    const ponsel =
      ponselInput;

    const bio =
      bioInput;

    const username =
      userInput.startsWith("@")
        ? userInput
        : "@" + userInput;

    // --------------------------------------------------
    // Layout
    // --------------------------------------------------

    const layout = {
      pp: {
        x: 571,
        y: 244,
        r: 137
      },

      nama: {
        y: 448,
        size: 50
      },

      ponsel: {
        x: 80,
        y: 883,
        size: 35
      },

      bio: {
        x: 83,
        y: 996,
        size: 36
      },

      username: {
        x: 83,
        y: 1143,
        size: 38
      }
    };

    // --------------------------------------------------
    // Profile picture
    // --------------------------------------------------

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      layout.pp.x,
      layout.pp.y,
      layout.pp.r,
      0,
      Math.PI * 2,
      true
    );

    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      ppImg,
      layout.pp.x -
        layout.pp.r,

      layout.pp.y -
        layout.pp.r,

      layout.pp.r * 2,
      layout.pp.r * 2
    );

    ctx.restore();

    // --------------------------------------------------
    // Text
    // --------------------------------------------------

    ctx.fillStyle =
      "#FFFFFF";

    // Nama
    ctx.font =
      `bold ${layout.nama.size}px ${fontFamily}`;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      nama,
      canvas.width / 2,
      layout.nama.y
    );

    // Nomor HP
    ctx.textAlign =
      "left";

    ctx.font =
      `${layout.ponsel.size}px ${fontFamily}`;

    ctx.fillText(
      ponsel,
      layout.ponsel.x,
      layout.ponsel.y
    );

    // Bio
    ctx.font =
      `${layout.bio.size}px ${fontFamily}`;

    ctx.fillText(
      bio,
      layout.bio.x,
      layout.bio.y
    );

    // Username
    ctx.font =
      `${layout.username.size}px ${fontFamily}`;

    ctx.fillText(
      username,
      layout.username.x,
      layout.username.y
    );

    // --------------------------------------------------
    // Save PNG
    // --------------------------------------------------

    outPath =
      join(
        TMP_DIR,
        `faketele-${Date.now()}.png`
      );

    const png =
      await canvas.encode(
        "png"
      );

    await writeFile(
      outPath,
      png
    );

    // --------------------------------------------------
    // Kirim
    // --------------------------------------------------

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
        image: png,

        mimetype:
          "image/png",

        fileName:
          "faketele.png",

        caption:
          "〄 *FAKE TELEGRAM PROFILE*\n\n" +
          "〄 *Nama:* " +
          nama +
          "\n" +
          "〄 *Ponsel:* " +
          ponsel +
          "\n" +
          "〄 *Bio:* " +
          bio +
          "\n" +
          "〄 *User:* " +
          username
      },
      {
        quoted: m
      }
    );

  } catch (e) {
    console.error(
      "[FAKETELE ERROR]",
      e
    );

    await m.reply?.(
      "〄 *Gagal membuat Fake Telegram Profile*\n\n" +
      (e?.message ||
        String(e))
    );

  } finally {
    // --------------------------------------------------
    // Hapus temporary file
    // --------------------------------------------------

    try {
      if (
        outPath &&
        existsSync(outPath)
      ) {
        unlinkSync(
          outPath
        );
      }
    } catch {}
  }
}

export default {
  config,
  handler
};
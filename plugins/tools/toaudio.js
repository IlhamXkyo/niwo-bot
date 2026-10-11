// plugins/tools/toaudio.js
// NIWO BOT : VIDEO/VN TO AUDIO MP3

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const config = {
  name: "toaudio",
  alias: ["tomp3", "videotoaudio", "extractaudio"],
  category: "tools",
  description: "Mengubah video/voice note menjadi audio MP3",
  usage: ".toaudio (reply/caption video/vn)",
  example: ".toaudio",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function runFFmpeg(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "192k",
    outputPath,
  ]);
}

async function handler(m, { sock }) {
  let mediaSource = null;
  let downloadFn = null;
  let isVideo = false;
  let isPtt = false;

  // =========================
  // MEDIA PESAN SENDIRI
  // =========================

  const selfIsVideo =
    m.isVideo ||
    m.type === "videoMessage" ||
    !!m.message?.videoMessage;

  const selfIsAudio =
    m.isAudio ||
    m.type === "audioMessage" ||
    !!m.message?.audioMessage;

  const selfIsPtt =
    m.message?.audioMessage?.ptt === true;

  // =========================
  // MEDIA QUOTED
  // =========================

  const quotedIsVideo =
    m.quoted &&
    (
      m.quoted.isVideo ||
      m.quoted.type === "videoMessage" ||
      m.quoted.mtype === "videoMessage" ||
      !!m.quoted.message?.videoMessage
    );

  const quotedIsAudio =
    m.quoted &&
    (
      m.quoted.isAudio ||
      m.quoted.type === "audioMessage" ||
      m.quoted.mtype === "audioMessage" ||
      !!m.quoted.message?.audioMessage
    );

  const quotedIsPtt =
    m.quoted?.message?.audioMessage?.ptt === true;

  // =========================
  // TENTUKAN MEDIA
  // =========================

  if (selfIsVideo) {
    mediaSource = "self";
    downloadFn = m.download.bind(m);
    isVideo = true;
  } else if (selfIsAudio && selfIsPtt) {
    mediaSource = "self";
    downloadFn = m.download.bind(m);
    isPtt = true;
  } else if (quotedIsVideo) {
    mediaSource = "quoted";
    downloadFn = m.quoted.download.bind(m.quoted);
    isVideo = true;
  } else if (quotedIsAudio) {
    mediaSource = "quoted";
    downloadFn = m.quoted.download.bind(m.quoted);
    isPtt = quotedIsPtt;
  }

  // =========================
  // TIDAK ADA MEDIA
  // =========================

  if (!mediaSource) {
    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> Tidak ada video/voice note yang terdeteksi!\n\n` +
      `*Cara penggunaan:*\n` +
      `> 1. Kirim video + caption \`${m.prefix}toaudio\`\n` +
      `> 2. Reply video/VN dengan \`${m.prefix}toaudio\``
    );
  }

  // =========================
  // AUDIO BIASA
  // =========================

  if (!isVideo && !isPtt) {
    return m.reply(
      `⚠️ *sᴜᴅᴀʜ ᴀᴜᴅɪᴏ*\n\n` +
      `> Media ini sudah dalam format audio.\n` +
      `> Gunakan \`${m.prefix}tovn\` jika ingin mengubah ke voice note.`
    );
  }

  await m.react("🕕");

  await m.reply(
    `🕕 *ᴍᴇᴍᴘʀᴏsᴇs...*\n\n` +
    `> Mengekstrak audio dari media...`
  );

  // =========================
  // TEMP DIRECTORY
  // =========================

  const tempDir = path.join(
    process.cwd(),
    "temp"
  );

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, {
      recursive: true,
    });
  }

  const timestamp = Date.now();

  const ext = isVideo
    ? "mp4"
    : "ogg";

  const inputPath = path.join(
    tempDir,
    `toaudio_input_${timestamp}.${ext}`
  );

  const outputPath = path.join(
    tempDir,
    `toaudio_output_${timestamp}.mp3`
  );

  try {
    // =========================
    // DOWNLOAD MEDIA
    // =========================

    const buffer = await downloadFn();

    if (!buffer || !buffer.length) {
      throw new Error(
        "Media tidak dapat diunduh."
      );
    }

    fs.writeFileSync(
      inputPath,
      buffer
    );

    // =========================
    // FFMPEG
    // =========================

    await runFFmpeg(
      inputPath,
      outputPath
    );

    // =========================
    // CEK OUTPUT
    // =========================

    if (
      !fs.existsSync(outputPath) ||
      fs.statSync(outputPath).size === 0
    ) {
      throw new Error(
        "File audio hasil konversi kosong."
      );
    }

    const audioBuffer =
      fs.readFileSync(outputPath);

    // =========================
    // KIRIM AUDIO
    // =========================

    await sock.sendMessage(
      m.chat,
      {
        audio: audioBuffer,
        mimetype: "audio/mpeg",
        fileName: "audio.mp3",
      },
      {
        quoted: m,
      }
    );

    await m.react("✅");

  } catch (error) {
    console.error(
      "[TOAUDIO] Error:",
      error?.message || error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ᴋᴏɴᴠᴇʀsɪ ɢᴀɢᴀʟ*\n\n` +
      `> Gagal mengubah media menjadi MP3.\n` +
      `> Pastikan FFmpeg sudah terinstall di server.\n\n` +
      `> Error: ${error?.message || "Unknown error"}`
    );

  } finally {
    // =========================
    // HAPUS FILE TEMP
    // =========================

    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch {}

    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch {}
  }
}

export default {
  config,
  handler,
};
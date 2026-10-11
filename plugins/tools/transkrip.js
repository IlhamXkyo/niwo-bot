// plugins/tools/transkrip.js
// NIWO BOT : SPEECH TO TEXT / TRANSKRIPSI

import FormData from "form-data";
import axios from "axios";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import appConfig from "../../config.js";

const execFileAsync = promisify(execFile);

const config = {
  name: "transkrip",
  alias: ["stt", "speechtotext", "transcribe"],
  category: "tools",
  description:
    "Konversi voice note / audio ke teks (Speech-to-Text)",
  usage: ".transkrip (reply voice note)",
  example: ".transkrip",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

async function convertToWav(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-f",
    "wav",
    outputPath,
  ]);
}

async function transcribeWithGroq(
  audioBuffer,
  apiKey
) {
  const form = new FormData();

  form.append(
    "file",
    audioBuffer,
    {
      filename: "audio.wav",
      contentType: "audio/wav",
    }
  );

  form.append(
    "model",
    "whisper-large-v3"
  );

  form.append(
    "language",
    "id"
  );

  form.append(
    "response_format",
    "json"
  );

  const response = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${apiKey}`,
      },

      timeout: 60000,

      maxContentLength: Infinity,
      maxBodyLength: Infinity,

      validateStatus: () => true,
    }
  );

  if (
    response.status < 200 ||
    response.status >= 300
  ) {
    const error = new Error(
      response.data?.error?.message ||
      `Groq API HTTP ${response.status}`
    );

    error.response = response;

    throw error;
  }

  return response.data?.text || "";
}

async function handler(m, { sock }) {
  const quoted = m.quoted || m;

  const isAudio =
    quoted?.isAudio ||
    quoted?.type === "audioMessage" ||
    quoted?.mtype === "audioMessage" ||
    !!quoted?.message?.audioMessage ||
    /audio/i.test(
      quoted?.mimetype || ""
    );

  if (!isAudio) {
    return m.reply(
      `🎤 *ᴛʀᴀɴsᴋʀɪᴘ*\n\n` +
      `> Reply voice note atau audio untuk mengonversi ke teks.\n\n` +
      `> Contoh:\n` +
      `> Reply VN → ketik \`${m.prefix}transkrip\``
    );
  }

  /*
   * Support beberapa kemungkinan struktur
   * config.js milik Niwo.
   */
  const groqKey =
    appConfig?.APIkey?.groq ||
    appConfig?.apikey?.groq ||
    appConfig?.apiKey?.groq ||
    process.env.GROQ_API_KEY;

  if (!groqKey) {
    return m.reply(
      `❌ *ɢᴀɢᴀʟ*\n\n` +
      `> API Key Groq belum diatur.\n\n` +
      `> Tambahkan ke config.js:\n` +
      `> \`APIkey.groq\`\n\n` +
      `> Atau gunakan environment:\n` +
      `> \`GROQ_API_KEY\``
    );
  }

  const tmpDir = path.join(
    process.cwd(),
    "tmp"
  );

  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {
      recursive: true,
    });
  }

  const timestamp =
    `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  const inputFile = path.join(
    tmpDir,
    `transkrip_${timestamp}.ogg`
  );

  const wavFile = path.join(
    tmpDir,
    `transkrip_${timestamp}.wav`
  );

  try {
    await m.react("🎤");

    if (
      typeof quoted.download !==
      "function"
    ) {
      throw new Error(
        "Fungsi download media tidak tersedia."
      );
    }

    const buffer =
      await quoted.download();

    if (
      !buffer ||
      buffer.length < 1000
    ) {
      throw new Error(
        "Audio terlalu kecil atau gagal diunduh."
      );
    }

    fs.writeFileSync(
      inputFile,
      buffer
    );

    // Audio → WAV 16 kHz mono
    await convertToWav(
      inputFile,
      wavFile
    );

    if (
      !fs.existsSync(wavFile) ||
      fs.statSync(wavFile).size < 100
    ) {
      throw new Error(
        "Gagal membuat file WAV."
      );
    }

    const wavBuffer =
      fs.readFileSync(wavFile);

    // WAV → Groq Whisper
    const text =
      await transcribeWithGroq(
        wavBuffer,
        groqKey
      );

    if (
      !text ||
      !text.trim()
    ) {
      throw new Error(
        "Tidak dapat mendeteksi suara."
      );
    }

    await m.reply(
      `🎤 *ᴛʀᴀɴsᴋʀɪᴘ*\n\n` +
      `╭┈┈⬡「 📝 *ʜᴀsɪʟ* 」\n` +
      `┃\n` +
      `┃ ${text.trim()}\n` +
      `┃\n` +
      `╰┈┈⬡\n\n` +
      `> 🤖 Model: Whisper Large V3\n` +
      `> 🌐 Bahasa: Indonesia\n` +
      `> 📊 Ukuran: ${(buffer.length / 1024).toFixed(1)} KB`
    );

    await m.react("✅");

  } catch (error) {
    console.error(
      "[TRANSKRIP] Error:",
      error?.response?.data ||
      error?.message ||
      error
    );

    try {
      await m.react("❌");
    } catch {}

    const status =
      error?.response?.status;

    if (status === 401) {
      return m.reply(
        `❌ *API KEY GROQ INVALID*\n\n` +
        `> Periksa kembali:\n` +
        `> \`config.js → APIkey.groq\``
      );
    }

    if (status === 429) {
      return m.reply(
        `❌ *RATE LIMIT GROQ*\n\n` +
        `> Batas penggunaan API Groq sedang tercapai.\n` +
        `> Silakan coba lagi nanti.`
      );
    }

    if (
      error?.code ===
      "ENOENT"
    ) {
      return m.reply(
        `❌ *FFMPEG TIDAK DITEMUKAN*\n\n` +
        `> FFmpeg belum tersedia di server.\n` +
        `> Install FFmpeg terlebih dahulu.`
      );
    }

    return m.reply(
      `❌ *ᴛʀᴀɴsᴋʀɪᴘ ɢᴀɢᴀʟ*\n\n` +
      `> ${error?.message || "Terjadi kesalahan saat memproses audio."}`
    );

  } finally {
    for (const file of [
      inputFile,
      wavFile,
    ]) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }
  }
}

export default {
  config,
  handler,
};
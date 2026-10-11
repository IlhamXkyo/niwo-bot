// plugins/tools/videotranscribe.js
// NIWO BOT : VIDEO TRANSCRIBE

import crypto from "crypto";

const config = {
  name: "videotranscribe",
  alias: ["video-transcribe", "transkripvideo"],
  category: "tools",
  description:
    "Transkrip video dari URL menjadi teks (YouTube, MP4, dll)",
  usage: ".video-transcribe <url> [lang]",
  example:
    ".video-transcribe https://youtu.be/xxxxx\n" +
    ".video-transcribe https://youtu.be/xxxxx id",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 30,
  energi: 2,
  isEnabled: true,
};

const ENDPOINT =
  "https://api.proactor.ai:7788/v1/tourists/files/transcription";

const DEFAULT_LANG = "en";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  origin: "https://videotranscriber.ai",
  referer: "https://videotranscriber.ai/",
  "user-agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
};

function makeTrackId() {
  return `${crypto.randomUUID()}_${Date.now()}`;
}

function msToTime(ms = 0) {
  const total = Math.max(
    0,
    Math.floor(Number(ms) / 1000)
  );

  const minute = Math.floor(total / 60);
  const second = total % 60;

  return (
    `${String(minute).padStart(2, "0")}:` +
    `${String(second).padStart(2, "0")}`
  );
}

function joinTranscript(items = []) {
  return items
    .map((item) => item?.text || "")
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanResult(json) {
  const data =
    Array.isArray(json?.data)
      ? json.data
      : [];

  if (
    json?.code !== 200 ||
    data.length === 0
  ) {
    return {
      status: false,
      code: json?.code || 500,
      message:
        json?.msg ||
        json?.message ||
        "Transcript tidak ditemukan",
    };
  }

  const title =
    data.find(
      (item) => item?.videoTitle
    )?.videoTitle ||
    "No title";

  const segments = data.map(
    (item, index) => ({
      index: index + 1,
      startMs:
        item?.duration ?? null,
      start: msToTime(
        item?.duration || 0
      ),
      text: item?.text || "",
    })
  );

  return {
    status: true,
    title,
    total: segments.length,
    transcript:
      joinTranscript(data),
    segments,
  };
}

async function transcriber(
  url,
  language = DEFAULT_LANG
) {
  const cleanUrl =
    String(url || "").trim();

  if (
    !cleanUrl ||
    !/^https?:\/\//i.test(cleanUrl)
  ) {
    throw new Error(
      "URL kosong atau tidak valid."
    );
  }

  const body = {
    track_id: makeTrackId(),
    fileUrl: cleanUrl,
    language:
      String(language || DEFAULT_LANG)
        .trim()
        .toLowerCase(),
  };

  const response = await fetch(
    ENDPOINT,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    }
  );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `API HTTP ${response.status}: ` +
      responseText.slice(0, 300)
    );
  }

  let json;

  try {
    json = JSON.parse(
      responseText
    );
  } catch {
    throw new Error(
      "Response API bukan JSON: " +
      responseText.slice(0, 200)
    );
  }

  const result =
    cleanResult(json);

  if (!result.status) {
    throw new Error(
      result.message
    );
  }

  return result;
}

async function handler(m, { sock }) {
  const args = Array.isArray(m.args)
    ? m.args
    : [];

  const url = args[0];
  const lang =
    args[1] || DEFAULT_LANG;

  if (!url) {
    return m.reply(
      `📝 *ᴠɪᴅᴇᴏ ᴛʀᴀɴsᴄʀɪʙᴇ*\n\n` +
      `> Transkrip video dari URL menjadi teks.\n\n` +
      `*Format:*\n` +
      `\`${m.prefix}video-transcribe <url> [bahasa]\`\n\n` +
      `*Contoh:*\n` +
      `\`${m.prefix}video-transcribe https://youtu.be/xxxxx id\``
    );
  }

  if (
    !/^https?:\/\//i.test(
      String(url)
    )
  ) {
    return m.reply(
      `❌ *URL TIDAK VALID*\n\n` +
      `> URL harus diawali dengan \`http://\` atau \`https://\`.\n\n` +
      `Contoh:\n` +
      `\`${m.prefix}video-transcribe https://youtu.be/xxxxx id\``
    );
  }

  try {
    await m.react("🕕");

    const result =
      await transcriber(
        url,
        lang
      );

    if (
      !result.transcript ||
      !result.transcript.trim()
    ) {
      throw new Error(
        "Transcript kosong."
      );
    }

    const maxLength = 2500;

    let transcript =
      result.transcript;

    if (
      transcript.length >
      maxLength
    ) {
      transcript =
        transcript.substring(
          0,
          maxLength
        ) +
        "\n\n... *(teks terlalu panjang)*";
    }

    const info =
      `📝 *ᴠɪᴅᴇᴏ ᴛʀᴀɴsᴄʀɪʙᴇ*\n\n` +
      `╭┈┈⬡「 🎬 *ɪɴғᴏ* 」\n` +
      `┃ 🎬 Title: ${result.title}\n` +
      `┃ 🗣️ Language: ${String(lang).toUpperCase()}\n` +
      `┃ 🔢 Segments: ${result.total}\n` +
      `╰┈┈⬡\n\n` +
      `📜 *Transcript:*\n` +
      `${transcript}`;

    await m.reply(info);

    await m.react("✅");

  } catch (error) {
    console.error(
      "[VIDEOTRANSCRIBE]",
      error?.message || error
    );

    try {
      await m.react("❌");
    } catch {}

    return m.reply(
      `❌ *ᴠɪᴅᴇᴏ ᴛʀᴀɴsᴄʀɪʙᴇ ɢᴀɢᴀʟ*\n\n` +
      `> ${error?.message || "Gagal memproses video."}`
    );
  }
}

export default {
  config,
  handler,
};
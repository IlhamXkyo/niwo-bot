import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import {
  writeFileSync,
  existsSync,
  readFileSync,
  mkdtempSync,
  rmSync
} from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import axios from "axios";

const execFileAsync = promisify(execFile);

const config = {
  name: "bratvid",
  alias: ["bratgif"],
  category: "maker",
  description: "Membuat video/GIF BRAT animasi dari teks.",
  usage: ".bratvid <teks> atau .bratgif <teks>",
  example: ".brat BIG MONEY NEVER COMES CLEAN",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true
};

const SIZE = 1000;
const MARGIN = 70;
const PADDING = 40;
const BOX = 860;
const GAP = 15;

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/Napoleon-Fibonacci/assets@main/font/impact.ttf";

const EMOJI_URL =
  "https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json";

const DIR = path.join(process.cwd(), "assets", "brat");
const FONT = path.join(DIR, "impact.ttf");
const EMOJI = path.join(DIR, "emoji-apple.json");

const THEMES = {
  black: { bg: "#000000", text: "#ffffff" },
  white: { bg: "#ffffff", text: "#000000" },
  green: { bg: "#8ace00", text: "#000000" }
};

let emojiMap = null;
let fontReady = false;
const emojiCache = new Map();

const EMOJI_REGEX =
  /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

async function download(url, dest) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 30000
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Gagal download asset (${response.status})`);
  }

  const buffer = Buffer.from(response.data);
  writeFileSync(dest, buffer);
  return buffer;
}

async function prepareAssets() {
  await mkdir(DIR, { recursive: true });

  if (!existsSync(FONT)) {
    await download(FONT_URL, FONT);
  }

  if (!fontReady) {
    fontReady = GlobalFonts.registerFromPath(FONT, "Impact");
  }
}

function emojiCode(emoji) {
  return [...emoji]
    .map(char =>
      char.codePointAt(0).toString(16).padStart(4, "0")
    )
    .join("-");
}

async function loadEmojiMap() {
  if (emojiMap) return emojiMap;

  await mkdir(DIR, { recursive: true });

  if (!existsSync(EMOJI)) {
    await download(EMOJI_URL, EMOJI);
  }

  emojiMap = JSON.parse(readFileSync(EMOJI, "utf8"));
  return emojiMap;
}

async function getEmojiImage(emoji) {
  if (emojiCache.has(emoji)) {
    return emojiCache.get(emoji);
  }

  const map = await loadEmojiMap();
  const base = emojiCode(emoji);

  const variants = [
    base,
    base.replace(/-fe0f/gi, ""),
    `${base.replace(/-fe0f/gi, "")}-fe0f`,
    base.toUpperCase(),
    base.replace(/-fe0f/gi, "").toUpperCase()
  ];

  let base64 = null;

  for (const variant of variants) {
    if (map[variant]) {
      base64 = map[variant];
      break;
    }
  }

  if (!base64) return null;

  const image = await loadImage(Buffer.from(base64, "base64"));
  emojiCache.set(emoji, image);
  return image;
}

function measureTextCustom(ctx, text, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let width = 0;

  for (const part of parts) {
    if (!part) continue;

    EMOJI_REGEX.lastIndex = 0;

    if (EMOJI_REGEX.test(part)) {
      width += fontSize;
    } else {
      width += ctx.measureText(part).width;
    }

    EMOJI_REGEX.lastIndex = 0;
  }

  return width;
}

async function drawTextWithEmojis(ctx, text, x, y, fontSize) {
  const parts = text.split(EMOJI_REGEX);
  let currentX = x;

  for (const part of parts) {
    if (!part) continue;

    EMOJI_REGEX.lastIndex = 0;

    if (EMOJI_REGEX.test(part)) {
      const image = await getEmojiImage(part);

      if (image) {
        ctx.drawImage(image, currentX, y, fontSize, fontSize);
      } else {
        ctx.fillText(part, currentX, y);
      }

      currentX += fontSize;
    } else {
      ctx.fillText(part, currentX, y);
      currentX += ctx.measureText(part).width;
    }

    EMOJI_REGEX.lastIndex = 0;
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `${fontSize}px Impact`;

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (
      measureTextCustom(ctx, test, fontSize) > maxWidth &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function findBestFontSize(ctx, text, maxWidth, maxHeight, lineGap) {
  let low = 10;
  let high = 700;
  let best = 10;

  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    const lines = wrapText(ctx, text, maxWidth, size);

    const words = text.split(/\s+/).filter(Boolean);

    const longestWord = words.length
      ? Math.max(
          ...words.map(word =>
            measureTextCustom(ctx, word, size)
          )
        )
      : 0;

    const totalHeight =
      lines.length * (size + lineGap) - lineGap;

    const fits =
      longestWord <= maxWidth &&
      totalHeight <= maxHeight;

    if (fits) {
      best = size;
      low = size + 1;
    } else {
      high = size - 1;
    }
  }

  return best;
}

function easeOutBack(x) {
  const c1 = 1.4;
  const c3 = c1 + 1;

  return (
    1 +
    c3 * Math.pow(x - 1, 3) +
    c1 * Math.pow(x - 1, 2)
  );
}

function calculateWordLayout(ctx, text) {
  const maxWidth = BOX - PADDING * 2;
  const maxHeight = BOX - PADDING * 2;

  const fontSize = findBestFontSize(
    ctx,
    text,
    maxWidth,
    maxHeight,
    GAP
  );

  ctx.font = `${fontSize}px Impact`;

  const lines = wrapText(
    ctx,
    text,
    maxWidth,
    fontSize
  );

  const totalHeight =
    lines.length * (fontSize + GAP) - GAP;

  const startY =
    MARGIN + (BOX - totalHeight) / 2;

  const words = [];
  let currentY = startY;

  for (const line of lines) {
    const lineWords = line.split(/\s+/).filter(Boolean);

    const totalWordsWidth = lineWords.reduce(
      (sum, word) =>
        sum + measureTextCustom(ctx, word, fontSize),
      0
    );

    const spaceWidth =
      lineWords.length > 1
        ? (maxWidth - totalWordsWidth) /
          (lineWords.length - 1)
        : ctx.measureText(" ").width;

    let currentX = MARGIN + PADDING;

    for (const word of lineWords) {
      const wordWidth = measureTextCustom(
        ctx,
        word,
        fontSize
      );

      words.push({
        text: word,
        x: currentX,
        y: currentY,
        w: wordWidth,
        h: fontSize
      });

      currentX += wordWidth + spaceWidth;
    }

    currentY += fontSize + GAP;
  }

  return { fontSize, words };
}

async function renderCanvas({
  words,
  fontSize,
  states,
  theme,
  highlight = 0
}) {
  const selectedTheme = THEMES[theme] || THEMES.white;

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = selectedTheme.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.rect(MARGIN, MARGIN, BOX, BOX);
  ctx.clip();

  ctx.fillStyle = selectedTheme.text;
  ctx.font = `${fontSize}px Impact`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  for (let i = 0; i < words.length; i++) {
    const state = states[i];

    if (!state || !state.visible) continue;

    const word = words[i];

    const centerX = word.x + word.w / 2;
    const centerY = word.y + fontSize / 2;

    ctx.save();

    ctx.globalAlpha = Math.max(
      0,
      Math.min(1, state.alpha)
    );

    if (state.scale !== 1) {
      ctx.translate(centerX, centerY);
      ctx.scale(state.scale, state.scale);
      ctx.translate(-centerX, -centerY);
    }

    await drawTextWithEmojis(
      ctx,
      word.text,
      word.x,
      word.y,
      fontSize
    );

    ctx.restore();
  }

  if (highlight > 0 && highlight <= 1) {
    const distance = BOX * 2.8;
    const current =
      MARGIN - BOX + highlight * distance;

    const sweepWidth = BOX * 0.95;

    const gradient = ctx.createLinearGradient(
      current,
      current,
      current + sweepWidth,
      current + sweepWidth
    );

    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.38, "rgba(255,255,255,0.35)");
    gradient.addColorStop(0.75, "rgba(255,255,255,0.95)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(MARGIN, MARGIN, BOX, BOX);
  }

  ctx.restore();

  return canvas;
}

async function generateBratVideo({
  text,
  theme = "white",
  format = "mp4",
  holdDuration = 1.5,
  fastProgress = true
} = {}) {
  text = String(text || "").trim();

  if (!text) {
    throw new Error("Teks kosong.");
  }

  format = format === "gif" ? "gif" : "mp4";

  await prepareAssets();
  await loadEmojiMap();

  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), "brat-")
  );

  try {
    const FPS = 60;
    const FRAME_TIME = 1 / FPS;

    const dummyCanvas = createCanvas(SIZE, SIZE);
    const dummyCtx = dummyCanvas.getContext("2d");

    const { fontSize, words } =
      calculateWordLayout(dummyCtx, text);

    const tasks = [];

    tasks.push({
      states: words.map(() => ({
        scale: 0,
        alpha: 0,
        visible: false
      })),
      highlight: 0,
      duration: 0.15
    });

    const staggerFrames = 5;
    const bounceFrames = 28;

    const totalBounce = Math.max(
      1,
      (words.length - 1) * staggerFrames +
        bounceFrames
    );

    for (let frame = 0; frame < totalBounce; frame++) {
      const states = words.map((_, index) => {
        const start = index * staggerFrames;
        const current = frame - start;

        if (current < 0) {
          return {
            scale: 0,
            alpha: 0,
            visible: false
          };
        }

        if (current >= bounceFrames) {
          return {
            scale: 1,
            alpha: 1,
            visible: true
          };
        }

        const progress =
          current / (bounceFrames - 1);

        const eased = easeOutBack(progress);

        return {
          scale: 0.2 + 0.8 * eased,
          alpha: Math.min(1, progress * 1.8),
          visible: true
        };
      });

      tasks.push({
        states,
        highlight: (frame + 1) / totalBounce,
        duration: FRAME_TIME
      });
    }

    const highlightFrames = 38;

    const allVisible = words.map(() => ({
      scale: 1,
      alpha: 1,
      visible: true
    }));

    for (let frame = 0; frame < highlightFrames; frame++) {
      tasks.push({
        states: allVisible,
        highlight: (frame + 1) / highlightFrames,
        duration: FRAME_TIME
      });
    }

    tasks.push({
      states: allVisible,
      highlight: 0,
      duration: Math.max(
        0.1,
        Number(holdDuration) || 1.5
      )
    });

    const renderFrame = async (task, index) => {
      const canvas = await renderCanvas({
        words,
        fontSize,
        states: task.states,
        theme,
        highlight: task.highlight
      });

      const buffer = await canvas.encode("png");

      const framePath = path.join(
        tempDir,
        `frame-${String(index + 1).padStart(5, "0")}.png`
      );

      writeFileSync(framePath, buffer);

      return {
        path: framePath,
        duration: task.duration
      };
    };

    let frames;

    if (fastProgress) {
      frames = await Promise.all(
        tasks.map(renderFrame)
      );
    } else {
      frames = [];

      for (let i = 0; i < tasks.length; i++) {
        frames.push(
          await renderFrame(tasks[i], i)
        );
      }
    }

    if (!frames.length) {
      throw new Error(
        "Frame tidak berhasil dibuat."
      );
    }

    const manifest = [];

    for (const frame of frames) {
      const safePath = frame.path.replace(
        /'/g,
        "'\\''"
      );

      manifest.push(`file '${safePath}'`);
      manifest.push(`duration ${frame.duration}`);
    }

    const lastFrame =
      frames[frames.length - 1].path.replace(
        /'/g,
        "'\\''"
      );

    manifest.push(`file '${lastFrame}'`);

    const concatPath = path.join(
      tempDir,
      "concat.txt"
    );

    writeFileSync(
      concatPath,
      manifest.join("\n")
    );

    const outputPath = path.join(
      tempDir,
      `brat.${format}`
    );

    if (format === "gif") {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatPath,
          "-vf",
          "fps=60,scale=1000:1000:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer",
          "-loop",
          "0",
          outputPath
        ]
      );
    } else {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatPath,
          "-vf",
          "fps=60,scale=1000:1000",
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          outputPath
        ]
      );
    }

    return {
      buffer: readFileSync(outputPath),
      format,
      filename: `brat-${Date.now()}.${format}`
    };
  } finally {
    rmSync(tempDir, {
      recursive: true,
      force: true
    });
  }
}

function getMessageText(m) {
  const candidates = [
    m?.text,
    m?.body,
    m?.message?.conversation,
    m?.message?.extendedTextMessage?.text,
    m?.message?.ephemeralMessage?.message?.conversation,
    m?.message?.ephemeralMessage?.message?.extendedTextMessage?.text,
    m?.msg?.conversation,
    m?.msg?.extendedTextMessage?.text,
    m?.msg?.ephemeralMessage?.message?.conversation,
    m?.msg?.ephemeralMessage?.message?.extendedTextMessage?.text
  ];

  return candidates.find(v => typeof v === "string" && v.trim())?.trim() || "";
}

function extractBratText(m) {
  const candidates = [
    m?.text,
    m?.body,
    m?.message?.conversation,
    m?.message?.extendedTextMessage?.text,
    m?.message?.ephemeralMessage?.message?.conversation,
    m?.message?.ephemeralMessage?.message?.extendedTextMessage?.text,
    m?.msg?.conversation,
    m?.msg?.extendedTextMessage?.text,
    m?.msg?.ephemeralMessage?.message?.conversation,
    m?.msg?.ephemeralMessage?.message?.extendedTextMessage?.text
  ].filter(v => typeof v === "string" && v.trim());

  const commandRe = /^[.!#/]?(bratvid|bratgif)\b\s*([\s\S]*)$/i;

  // Niwo versions can expose either the complete command or only its arguments.
  // Try the complete-command form first.
  for (const value of candidates) {
    const match = value.trim().match(commandRe);
    if (match) {
      return {
        command: match[1].toLowerCase(),
        text: (match[2] || "").trim()
      };
    }
  }

  // If the loader already stripped the command, the remaining m.text is the text itself.
  // Never fall back to the old `.brat` command.
  const fallback = candidates[0]?.trim() || "";
  return {
    command: "bratvid",
    text: fallback
  };
}

async function handler(m, { sock } = {}) {
  try {
    if (!sock?.sendMessage) {
      return m.reply?.(
        "〄 Client bot tidak memiliki sendMessage()."
      );
    }

    const { command, text } = extractBratText(m);

    if (!text) {
      return m.reply?.(
        "〄 *Teks kosong.*\n\n" +
        "Gunakan:\n" +
        "`.bratvid teks kamu`\n" +
        "`.bratgif teks kamu`\n\n" +
        "Contoh:\n" +
        "`.bratvid BIG MONEY NEVER COMES CLEAN`"
      );
    }

    const isGif = command === "bratgif";

    await m.reply?.(
      `〄 Membuat ${isGif ? "GIF" : "video"} BRAT 60 FPS...\n` +
      "〄 Tunggu sebentar."
    );

    const result = await generateBratVideo({
      text,
      theme: "white",
      format: isGif ? "gif" : "mp4",
      holdDuration: 1.5,
      fastProgress: true
    });

    const chat = m.chat || m.key?.remoteJid;
    if (!chat) throw new Error("Chat ID tidak ditemukan.");

    if (result.format === "gif") {
      await sock.sendMessage(
        chat,
        {
          document: result.buffer,
          mimetype: "image/gif",
          fileName: result.filename,
          caption: "〄 BRAT GIF berhasil dibuat."
        },
        { quoted: m }
      );
    } else {
      await sock.sendMessage(
        chat,
        {
          video: result.buffer,
          mimetype: "video/mp4",
          fileName: result.filename,
          caption: "〄 BRAT Video 60 FPS berhasil dibuat.",
          gifPlayback: false
        },
        { quoted: m }
      );
    }
  } catch (error) {
    console.error("[BRAT ERROR]", error);
    await m.reply?.(
      "〄 *Gagal membuat BRAT.*\n\n" +
      (error?.message || String(error))
    );
  }
}

export default {
  config,
  handler
};

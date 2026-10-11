import {
  createCanvas,
  loadImage,
  GlobalFonts
} from "@napi-rs/canvas";

import {
  writeFile,
  readFile,
  mkdir
} from "node:fs/promises";

import {
  existsSync
} from "node:fs";

import {
  join
} from "node:path";

import axios from "axios";

// ======================================================
// NIWO CONFIG
// ======================================================

const config = {
  name: "quote",
  alias: ["quotes", "kutipan"],

  category: "maker",

  description:
    "Membuat gambar quote dengan efek 3D bulge.",

  usage:
    ".quote teks quote",

  example:
    ".quote Hidup itu harus terus bergerak maju.",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 5,
  energi: 0,
  isEnabled: true
};

// ======================================================
// CONFIG
// ======================================================

const WIDTH = 720;
const HEIGHT = 1280;

const BULGE_RADIUS = 580;
const BULGE_STRENGTH = 0.12;

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tinos/Tinos-Regular.ttf";

const EMOJI_JSON_URL =
  "https://media.githubusercontent.com/media/Ditzzx-vibecoder/entahlah/main/emoji-apple.json";

const ASSET_DIR =
  join(
    process.cwd(),
    "assets",
    "quote"
  );

const FONT_PATH =
  join(
    ASSET_DIR,
    "QuoteFont.ttf"
  );

const EMOJI_JSON_PATH =
  join(
    ASSET_DIR,
    "emoji-apple.json"
  );

const THEMES = {
  quote: {
    bg: "#ffffff",
    text: "#9e0a1b"
  }
};

// ======================================================
// CACHE
// ======================================================

let fontRegistered = false;
let emojiMap = null;

const emojiImageCache =
  new Map();

// ======================================================
// DOWNLOAD FILE
// ======================================================

async function downloadFile(
  url,
  destination
) {
  const res =
    await axios.get(
      url,
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

  if (
    res.status < 200 ||
    res.status >= 300
  ) {
    throw new Error(
      `Gagal download ${url} (${res.status})`
    );
  }

  const buffer =
    Buffer.from(
      res.data
    );

  await writeFile(
    destination,
    buffer
  );

  return buffer;
}

// ======================================================
// FONT
// ======================================================

async function ensureFonts() {
  await mkdir(
    ASSET_DIR,
    {
      recursive: true
    }
  );

  if (
    !existsSync(FONT_PATH)
  ) {
    await downloadFile(
      FONT_URL,
      FONT_PATH
    );
  }

  if (!fontRegistered) {
    fontRegistered =
      GlobalFonts.registerFromPath(
        FONT_PATH,
        "QuoteFont"
      );
  }
}

// ======================================================
// EMOJI
// ======================================================

function emojiToUnicode(
  emoji
) {
  return [
    ...emoji
  ]
    .map(c =>
      c.codePointAt(0)
        .toString(16)
        .padStart(4, "0")
    )
    .join("-");
}

async function loadEmojiMap() {
  if (emojiMap) {
    return emojiMap;
  }

  await mkdir(
    ASSET_DIR,
    {
      recursive: true
    }
  );

  if (
    !existsSync(
      EMOJI_JSON_PATH
    )
  ) {
    await downloadFile(
      EMOJI_JSON_URL,
      EMOJI_JSON_PATH
    );
  }

  const raw =
    await readFile(
      EMOJI_JSON_PATH,
      "utf8"
    );

  emojiMap =
    JSON.parse(raw);

  return emojiMap;
}

async function getEmojiImage(
  emoji
) {
  if (
    emojiImageCache.has(emoji)
  ) {
    return emojiImageCache.get(
      emoji
    );
  }

  const map =
    await loadEmojiMap();

  const base =
    emojiToUnicode(
      emoji
    );

  const variants = [
    base,

    base.replace(
      /-fe0f/gi,
      ""
    ),

    `${base.replace(
      /-fe0f/gi,
      ""
    )}-fe0f`,

    base.toUpperCase(),

    base
      .replace(
        /-fe0f/gi,
        ""
      )
      .toUpperCase(),

    base
      .replace(
        /-fe0f/gi,
        ""
      )
      .toUpperCase() +
      "-FE0F"
  ];

  let b64 = null;

  for (
    const variant of variants
  ) {
    if (map[variant]) {
      b64 =
        map[variant];

      break;
    }
  }

  if (!b64) {
    return null;
  }

  const img =
    await loadImage(
      Buffer.from(
        b64,
        "base64"
      )
    );

  emojiImageCache.set(
    emoji,
    img
  );

  return img;
}

// ======================================================
// EMOJI REGEX
// ======================================================

const EMOJI_REGEX =
  /(\p{Emoji_Modifier_Base}\p{Emoji_Modifier}|\p{Emoji_Presentation}\uFE0F?|\p{Emoji}\uFE0F|[\u{1F1E0}-\u{1F1FF}]{2}|\p{Extended_Pictographic}\uFE0F?)/gu;

// ======================================================
// TOKENIZE
// ======================================================

function tokenize(
  rawText
) {
  const chunks =
    rawText.split(
      EMOJI_REGEX
    );

  const tokens = [];

  for (
    const chunk of chunks
  ) {
    if (!chunk) {
      continue;
    }

    EMOJI_REGEX.lastIndex = 0;

    if (
      EMOJI_REGEX.test(
        chunk
      )
    ) {
      tokens.push({
        type: "emoji",
        text: chunk
      });

      EMOJI_REGEX.lastIndex = 0;

      continue;
    }

    const parts =
      chunk.split(
        /(\*[^*]+\*)/g
      );

    for (
      const part of parts
    ) {
      if (!part) {
        continue;
      }

      if (
        part.startsWith("*") &&
        part.endsWith("*") &&
        part.length > 2
      ) {
        splitWords(
          part.slice(
            1,
            -1
          ),
          "italic",
          tokens
        );
      } else {
        splitWords(
          part,
          "auto",
          tokens
        );
      }
    }
  }

  return tokens;
}

// ======================================================
// SPLIT WORDS
// ======================================================

function splitWords(
  text,
  forcedStyle,
  tokens
) {
  const words =
    text.split(
      /(\s+)/
    );

  for (
    const word of words
  ) {
    if (word === "") {
      continue;
    }

    if (
      /^\s+$/.test(word)
    ) {
      tokens.push({
        type: "space",
        text: word
      });

      continue;
    }

    let style =
      forcedStyle;

    if (
      forcedStyle === "auto"
    ) {
      const letters =
        word.replace(
          /[^a-zA-Z]/g,
          ""
        );

      style =
        letters.length > 1 &&
        letters ===
          letters.toUpperCase()
          ? "bold"
          : "regular";
    }

    tokens.push({
      type: "word",
      text: word,
      style
    });
  }
}

// ======================================================
// FONT STYLE
// ======================================================

function fontForStyle(
  style,
  size
) {
  if (
    style === "bold"
  ) {
    return `bold ${size}px QuoteFont`;
  }

  if (
    style === "italic"
  ) {
    return `italic ${size}px QuoteFont`;
  }

  return `${size}px QuoteFont`;
}

// ======================================================
// EXPAND CHARACTERS
// ======================================================

function expandToChars(
  tokens
) {
  const chars = [];

  for (
    const token of tokens
  ) {
    if (
      token.type === "emoji"
    ) {
      chars.push({
        type: "emoji",
        text: token.text
      });

      continue;
    }

    if (
      token.type === "space"
    ) {
      chars.push({
        type: "char",
        text: " ",
        style: "regular"
      });

      continue;
    }

    for (
      const ch of token.text
    ) {
      chars.push({
        type: "char",
        text: ch,
        style: token.style
      });
    }
  }

  return chars;
}

// ======================================================
// LAYOUT LINES
// ======================================================

function layoutLines(
  ctx,
  tokens,
  fontSize,
  maxWidth
) {
  const lines = [];

  let current = [];
  let currentWidth = 0;

  function widthOf(token) {
    if (
      token.type === "emoji"
    ) {
      return fontSize;
    }

    ctx.font =
      fontForStyle(
        token.style,
        fontSize
      );

    return ctx.measureText(
      token.text
    ).width;
  }

  for (
    const token of tokens
  ) {
    if (
      token.type === "space"
    ) {
      ctx.font =
        `${fontSize}px QuoteFont`;

      const spaceWidth =
        ctx.measureText(
          " "
        ).width;

      if (
        current.length === 0
      ) {
        continue;
      }

      current.push({
        ...token,
        width: spaceWidth
      });

      currentWidth +=
        spaceWidth;

      continue;
    }

    const width =
      widthOf(token);

    if (
      currentWidth + width >
        maxWidth &&
      current.length > 0
    ) {
      while (
        current.length &&
        current[
          current.length - 1
        ].type === "space"
      ) {
        current.pop();
      }

      lines.push(
        current
      );

      current = [];
      currentWidth = 0;
    }

    current.push({
      ...token,
      width
    });

    currentWidth +=
      width;
  }

  if (
    current.length
  ) {
    while (
      current.length &&
      current[
        current.length - 1
      ].type === "space"
    ) {
      current.pop();
    }

    lines.push(
      current
    );
  }

  return lines;
}

// ======================================================
// LINE WIDTH
// ======================================================

function totalLineWidth(
  line
) {
  return line.reduce(
    (sum, token) =>
      sum + token.width,
    0
  );
}

// ======================================================
// BEST FONT SIZE
// ======================================================

function findBestFontSize(
  ctx,
  tokens,
  maxWidth,
  maxHeight
) {
  let lo = 10;
  let hi = 80;
  let best = lo;

  while (
    lo <= hi
  ) {
    const mid =
      Math.floor(
        (lo + hi) / 2
      );

    const lineGap =
      Math.floor(
        mid * 0.2
      );

    const lines =
      layoutLines(
        ctx,
        tokens,
        mid,
        maxWidth
      );

    const totalHeight =
      lines.length *
        (mid + lineGap) -
      lineGap;

    const fits =
      totalHeight <=
        maxHeight &&
      lines.every(
        line =>
          totalLineWidth(
            line
          ) <= maxWidth
      );

    if (fits) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

// ======================================================
// DRAW EMOJI
// ======================================================

async function drawEmojiToken(
  ctx,
  emoji,
  x,
  y,
  size
) {
  const img =
    await getEmojiImage(
      emoji
    );

  if (!img) {
    ctx.font =
      `${size}px QuoteFont`;

    ctx.fillText(
      emoji,
      x,
      y
    );

    return;
  }

  ctx.drawImage(
    img,
    x,
    y,
    size,
    size
  );
}

// ======================================================
// DRAW TEXT
// ======================================================

async function drawFlatLines(
  ctx,
  lines,
  centerX,
  startY,
  fontSize,
  lineGap
) {
  let y = startY;

  for (
    const line of lines
  ) {
    const charTokens =
      expandToChars(
        line
      );

    const widths =
      charTokens.map(
        character => {
          if (
            character.type ===
            "emoji"
          ) {
            return fontSize;
          }

          ctx.font =
            fontForStyle(
              character.style,
              fontSize
            );

          return ctx.measureText(
            character.text
          ).width;
        }
      );

    const lineWidth =
      widths.reduce(
        (a, b) =>
          a + b,
        0
      );

    let x =
      centerX -
      lineWidth / 2;

    for (
      let i = 0;
      i < charTokens.length;
      i++
    ) {
      const character =
        charTokens[i];

      const width =
        widths[i];

      if (
        character.type ===
        "emoji"
      ) {
        await drawEmojiToken(
          ctx,
          character.text,
          x,
          y,
          fontSize
        );
      } else if (
        character.text !== " "
      ) {
        ctx.font =
          fontForStyle(
            character.style,
            fontSize
          );

        ctx.fillText(
          character.text,
          x,
          y
        );
      }

      x += width;
    }

    y +=
      fontSize +
      lineGap;
  }
}

// ======================================================
// BULGE DISTORTION
// ======================================================

function applyBulgeDistortion(
  srcCtx,
  dstCtx,
  width,
  height,
  radius,
  strength
) {
  const srcData =
    srcCtx.getImageData(
      0,
      0,
      width,
      height
    );

  const dstData =
    dstCtx.createImageData(
      width,
      height
    );

  const src =
    srcData.data;

  const dst =
    dstData.data;

  const cx =
    width / 2;

  const cy =
    height / 2;

  for (
    let y = 0;
    y < height;
    y++
  ) {
    const dy =
      y - cy;

    for (
      let x = 0;
      x < width;
      x++
    ) {
      const dx =
        x - cx;

      const dist =
        Math.sqrt(
          dx * dx +
          dy * dy
        );

      let sx = x;
      let sy = y;

      if (
        dist < radius &&
        dist > 0
      ) {
        const norm =
          dist / radius;

        const exponent =
          1 + strength;

        const newDist =
          radius *
          Math.pow(
            norm,
            exponent
          );

        const ratio =
          newDist / dist;

        sx =
          cx +
          dx * ratio;

        sy =
          cy +
          dy * ratio;
      }

      const dstIdx =
        (y * width + x) *
        4;

      if (
        sx >= 0 &&
        sx < width - 1 &&
        sy >= 0 &&
        sy < height - 1
      ) {
        const x1 =
          Math.floor(sx);

        const y1 =
          Math.floor(sy);

        const x2 =
          x1 + 1;

        const y2 =
          y1 + 1;

        const wx =
          sx - x1;

        const wy =
          sy - y1;

        const i11 =
          (y1 * width + x1) *
          4;

        const i21 =
          (y1 * width + x2) *
          4;

        const i12 =
          (y2 * width + x1) *
          4;

        const i22 =
          (y2 * width + x2) *
          4;

        for (
          let c = 0;
          c < 4;
          c++
        ) {
          const top =
            src[i11 + c] *
              (1 - wx) +
            src[i21 + c] *
              wx;

          const bottom =
            src[i12 + c] *
              (1 - wx) +
            src[i22 + c] *
              wx;

          dst[
            dstIdx + c
          ] =
            Math.round(
              top *
                (1 - wy) +
              bottom * wy
            );
        }
      } else {
        dst[dstIdx] = 255;
        dst[dstIdx + 1] = 255;
        dst[dstIdx + 2] = 255;
        dst[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(
    dstData,
    0,
    0
  );
}

// ======================================================
// GENERATE QUOTE
// ======================================================

async function generateQuote({
  text,
  theme = "quote",
  bulgeRadius =
    BULGE_RADIUS,
  bulgeStrength =
    BULGE_STRENGTH
} = {}) {
  const selectedTheme =
    THEMES[theme] ||
    THEMES.quote;

  const padding = 140;

  const maxWidth =
    WIDTH -
    padding * 2;

  await ensureFonts();
  await loadEmojiMap();

  // Canvas pertama
  const offCanvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const offCtx =
    offCanvas.getContext(
      "2d"
    );

  offCtx.fillStyle =
    selectedTheme.bg;

  offCtx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT
  );

  // Token
  const tokens =
    tokenize(text);

  offCtx.textAlign =
    "left";

  offCtx.textBaseline =
    "top";

  // Font otomatis
  const fontSize =
    findBestFontSize(
      offCtx,
      tokens,
      maxWidth,
      HEIGHT * 0.45
    );

  const lineGap =
    Math.floor(
      fontSize * 0.2
    );

  const lines =
    layoutLines(
      offCtx,
      tokens,
      fontSize,
      maxWidth
    );

  const totalTextHeight =
    lines.length *
      (fontSize + lineGap) -
    lineGap;

  offCtx.fillStyle =
    selectedTheme.text;

  const startY =
    (HEIGHT -
      totalTextHeight) /
    2;

  const centerX =
    WIDTH / 2;

  await drawFlatLines(
    offCtx,
    lines,
    centerX,
    startY,
    fontSize,
    lineGap
  );

  // Canvas final
  const canvas =
    createCanvas(
      WIDTH,
      HEIGHT
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  applyBulgeDistortion(
    offCtx,
    ctx,
    WIDTH,
    HEIGHT,
    bulgeRadius,
    bulgeStrength
  );

  return await canvas.encode(
    "png"
  );
}

// ======================================================
// Niwo HANDLER
// ======================================================

async function handler(
  m,
  { sock } = {}
) {
  try {
    const text =
      String(
        m?.text ||
        m?.body ||
        m?.message
          ?.conversation ||
        m?.message
          ?.extendedTextMessage
          ?.text ||
        ""
      )
      .replace(
        /^[.!#/]?(?:quote|quotes|kutipan)\s*/i,
        ""
      )
      .trim();

    if (!text) {
      return m.reply?.(
        "〄 *Teks quote kosong!*\n\n" +
        "Gunakan:\n" +
        "*.quote teks quote*\n\n" +
        "Contoh:\n" +
        "*.quote Hidup itu seperti mengendarai sepeda.*\n\n" +
        "Gunakan tanda `*teks*` untuk italic."
      );
    }

    await m.reply?.(
      "〄 Membuat quote..."
    );

    const buffer =
      await generateQuote({
        text
      });

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
        image: buffer,
        mimetype:
          "image/png",
        fileName:
          "quote.png",
        caption:
          "〄 Quote berhasil dibuat."
      },
      {
        quoted: m
      }
    );

  } catch (error) {
    console.error(
      "[QUOTE ERROR]",
      error
    );

    await m.reply?.(
      "〄 *Gagal membuat quote*\n\n" +
      (error?.message ||
        String(error))
    );
  }
}

// ======================================================
// EXPORT NIWO
// ======================================================

export default {
  config,
  handler
};
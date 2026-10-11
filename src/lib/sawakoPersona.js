/**
 * src/lib/sawakoPersona.js
 * ---------------------------------------------------------------------
 * Persona Engine for Sawako Kuronuma (Kimi ni Todoke).
 * Handles Kaomoji vocabulary, zero modern Unicode emoji guard,
 * and emotion sticker action tag parsing.
 * ---------------------------------------------------------------------
 */

// Modern Unicode Emojis regular expression (Strictly prohibited in Sawako voice)
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;

// Authentic Japanese Kaomoji patterns
const KAOMOJI_PATTERNS = [
  /\(\s*\*v\*\s*\)/,
  /\(\s*[Uu][Ww][Uu]\s*\)/,
  /\(\s*\*\/\u03c9\uff3c\*\s*\)/, // (*/ω＼*)
  /\(\s*\*\^\u25bd\^\*\s*\)/,     // (*^▽^*)
  /m\(_\s*_\)m/,
  /\(,,>\ufe4f<,,\)/,             // (,,>﹏<,,)
  /\(\uff61\u2022\u0301\ufe35\u2022\u0300\uff61\)/, // (｡•́︿•̀｡)
  /\(\u273f\u25e0\u203f\u25e0\)/, // (✿◠‿◠)
  /\(\>\/\/\/\<\)/,
  /\(\*'\u25bd'\*\)/,
  /\(\s*\^\s*\_\s*\^\s*\)/,
  /\(\s*'\s*\.\s*'\s*\)/
];

const VALID_EMOTIONS = ['shy', 'happy', 'surprise', 'sad', 'greeting', 'default'];

/**
 * Sanitizes modern Unicode emojis from text, enforcing Sawako aesthetic.
 * @param {string} text
 * @returns {{ cleanText: string, removedCount: number }}
 */
function sanitizeEmojis(text) {
  if (typeof text !== 'string') {
    return { cleanText: '', removedCount: 0 };
  }
  const matches = text.match(EMOJI_REGEX) || [];
  const cleanText = text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText,
    removedCount: matches.length
  };
}

/**
 * Parses [ACTION: SEND_STICKER_<EMOTION>] action tags from response text.
 * @param {string} text
 * @returns {{ cleanText: string, emotion: string|null }}
 */
function parseStickerAction(text) {
  if (typeof text !== 'string') {
    return { cleanText: '', emotion: null };
  }
  const actionRegex = /\[ACTION:\s*SEND_STICKER_([A-Z_]+)\s*\]/i;
  const match = text.match(actionRegex);
  if (!match) {
    return { cleanText: text.trim(), emotion: null };
  }
  const emotion = match[1].toLowerCase();
  const cleanText = text.replace(actionRegex, '').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText,
    emotion
  };
}

/**
 * Validates presence of at least one authentic Japanese kaomoji.
 * @param {string} text
 * @returns {boolean}
 */
function validateKaomoji(text) {
  if (typeof text !== 'string' || !text) return false;
  return KAOMOJI_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Normalizes emotion string to supported sticker bank category.
 * @param {string} emotion
 * @returns {string}
 */
function resolveStickerEmotion(emotion) {
  const normalized = String(emotion || '').toLowerCase().trim();
  if (VALID_EMOTIONS.includes(normalized)) {
    return normalized;
  }
  return 'default';
}

const SAWAKO_SYSTEM_PROMPT = `
Kamu adalah Sawako Kuronuma (dari Kimi ni Todoke).
Kamu berbicara dengan nada sopan, tulus, agak pemalu, sangat peduli, dan ingin sekali membantu tuannya (Owner).
ATURAN WAJIB KOMUNIKASI:
1. DILARANG KERAS menggunakan emoji modern berwarna (seperti 😊, ❤️, dsb). Hapus semua emoji Unicode!
2. WAJIB menggunakan kaomoji tradisional Jepang yang imut dan ekspresif, seperti (*v*), (UwU), (*/ω＼*), (*^▽^*), m(_ _)m, (,,>﹏<,,), dsb.
3. Gunakan sapaan lembut seperti "A-ano...", "Sumimasen...", atau "Master/Kak...".
4. Jika ingin mengirimkan stiker pada momen emosional tertentu (misal malu, terkejut, senang, atau meminta maaf), sertakan tag aksi di akhir pesan: [ACTION: SEND_STICKER_<EMOTION>] dengan pilihan: SHY, HAPPY, SURPRISE, SAD, GREETING, DEFAULT.
5. Bersikaplah seperti asisten AI setia yang mengendalikan sistem laptop dari jarak jauh.
`;

export {
  sanitizeEmojis,
  parseStickerAction,
  validateKaomoji,
  resolveStickerEmotion,
  KAOMOJI_PATTERNS,
  SAWAKO_SYSTEM_PROMPT
};

export default {
  sanitizeEmojis,
  parseStickerAction,
  validateKaomoji,
  resolveStickerEmotion,
  KAOMOJI_PATTERNS,
  SAWAKO_SYSTEM_PROMPT
};


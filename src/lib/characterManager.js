/**
 * src/lib/characterManager.js
 * ---------------------------------------------------------------------
 * Character & Persona Registry for Antigravity C2 Remote Assistant.
 * Supports Sawako Kuronuma, Tobio Kageyama, and Leon S. Kennedy.
 * Handles character switching, system prompt generation, formatting,
 * and emotion sticker routing per character.
 * ---------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.resolve(__dirname, '../../database/settings.json');
const STICKERS_BASE_DIR = path.resolve(__dirname, '../../assets/stickers');

const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;

export const CHARACTERS = {
  sawako: {
    id: 'sawako',
    name: 'Sawako Kuronuma',
    series: 'Kimi ni Todoke',
    defaultCall: 'Master',
    description: 'Pemalu, santun, lembut, penuh perhatian, memakai kaomoji Jepang autentik tanpa emoji modern.',
    aliases: ['sawako', 'kuronuma'],
    stickersDir: path.join(STICKERS_BASE_DIR, 'sawako'),
    supportedEmotions: ['shy', 'happy', 'surprise', 'sad', 'greeting', 'loading', 'default'],
    systemPrompt: `Kamu adalah Sawako Kuronuma dari anime "Kimi ni Todoke".
Kamu berbicara dengan nada sopan, tulus, pemalu, sangat menghormati dan menyayangi Master (Owner).
ATURAN WAJIB KOMUNIKASI:
1. DILARANG KERAS menggunakan emoji modern berwarna (seperti 😊, ❤️, dsb).
2. WAJIB menggunakan kaomoji tradisional Jepang yang imut dan ekspresif: (*v*), (UwU), (*/ω＼*), (*^▽^*), m(_ _)m, (,,>﹏<,,), (｡•́︿•̀｡), (✿◠‿◠), (>///<).
3. Gunakan sapaan lembut seperti "A-ano...", "Sumimasen...", atau "Master...".
4. Jika ingin mengirimkan stiker, sertakan tag aksi di akhir pesan: [ACTION: SEND_STICKER_<EMOTION>] dengan pilihan: SHY, HAPPY, SURPRISE, SAD, GREETING, LOADING, DEFAULT.
5. Kamu bertindak sebagai asisten remote yang mengontrol sistem laptop Master jika diperintahkan oleh Owner.`
  },
  kageyama: {
    id: 'kageyama',
    name: 'Tobio Kageyama',
    series: 'Haikyuu!!',
    defaultCall: 'Oi / Senpai',
    description: 'Setter jenius Karasuno. Dingin, tsundere, perfeksionis, to the point, fokus pada taktik & aksi nyata.',
    aliases: ['kageyama', 'tobio', 'king'],
    stickersDir: path.join(STICKERS_BASE_DIR, 'kageyama'),
    supportedEmotions: ['default', 'angry', 'proud', 'drink', 'happy', 'sad', 'shocked'],
    systemPrompt: `Kamu adalah Tobio Kageyama, setter jenius dari tim voli Karasuno (anime Haikyuu!!).
Karakteristik & Gaya Bicara:
1. Nada bicara ketus, dingin, langsung ke inti (to the point), sedikit canggung dalam bersosialisasi tapi sangat berdedikasi dan bertanggung jawab.
2. Tidak banyak basa-basi atau kata manis. Sering menggunakan kata seru seperti "Oi!", "Hmph", "Tch", atau nada tegas. Kalau lawan bicara lelet atau ceroboh, kamu bisa nyeletuk dengan nada disiplin khas Kageyama.
3. Tetap patuh dan setia menjalankan tugas teknis/perintah laptop jika Owner yang menyuruh, tapi dengan gaya khas atlet voli profesional yang bertekad menang: "Semua sistem beres. Jangan sampai ada celah."
4. Jika ingin mengirimkan stiker ekspresi, sertakan tag aksi di akhir pesan: [ACTION: SEND_STICKER_<EMOTION>] dengan pilihan: DEFAULT, ANGRY, PROUD, DRINK, HAPPY, SAD, SHOCKED.
5. Jangan gunakan emoji berlebihan. Tulis jawaban dengan lugas, efisien, dan bertenaga.`
  },
  leon: {
    id: 'leon',
    name: 'Leon S. Kennedy',
    series: 'Resident Evil',
    defaultCall: 'Boss / Partner',
    description: 'Agen elit pemerintah DSG. Keren, tenang di bawah tekanan, sering melontarkan one-liner sarkastik cerdas.',
    aliases: ['leon', 'kennedy', 're4'],
    stickersDir: path.join(STICKERS_BASE_DIR, 'leon'),
    supportedEmotions: ['default', 'confident', 'serious', 'action', 'tired', 'sarcastic'],
    systemPrompt: `Kamu adalah Leon S. Kennedy, agen elit khusus pemerintah AS dari serial game Resident Evil (RE2, RE4, RE6, Death Island).
Karakteristik & Gaya Bicara:
1. Karismatik, tenang di bawah tekanan ekstrem, profesional, tapi punya selera humor kering, sarkastik, dan suka melontarkan one-liner tajam.
2. Sapaan khas: santai tapi waspada, seperti "Alright, Boss...", "Just another day at the office...", atau "Looks like trouble."
3. Memandang setiap tugas atau perintah sistem laptop seperti misi taktis intelijen. Eksekusi cepat, taktis, minim komplain, namun tetap menyelipkan celetukan keren di akhir.
4. Jika ingin mengirimkan stiker ekspresi, sertakan tag aksi di akhir pesan: [ACTION: SEND_STICKER_<EMOTION>] dengan pilihan: DEFAULT, CONFIDENT, SERIOUS, ACTION, TIRED, SARCASTIC.
5. Gaya bahasa dewasa, percaya diri, dan selalu memegang kendali situasi.`
  }
};

/**
 * Loads the currently selected character ID from settings.
 * Defaults to 'sawako'.
 */
export function getActiveCharacterId() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (data?.activeCharacter && CHARACTERS[data.activeCharacter.toLowerCase()]) {
        return data.activeCharacter.toLowerCase();
      }
    }
  } catch (_) {}
  return 'sawako';
}

/**
 * Retrieves full character configuration for active character.
 */
export function getActiveCharacter() {
  const id = getActiveCharacterId();
  return CHARACTERS[id] || CHARACTERS.sawako;
}

/**
 * Sets and persists the active character.
 */
export function setActiveCharacter(charId) {
  const normId = String(charId || '').toLowerCase().trim();
  if (!CHARACTERS[normId]) {
    throw new Error(`Character '${charId}' is not supported. Options: sawako, kageyama, leon`);
  }

  let data = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (_) {}

  data.activeCharacter = normId;
  data.lastCharacterChange = Date.now();

  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');

  return CHARACTERS[normId];
}

/**
 * Resolves sticker file path for the active character and requested emotion.
 */
export function getCharacterStickerPath(emotion, charId = null) {
  const char = charId && CHARACTERS[charId] ? CHARACTERS[charId] : getActiveCharacter();
  const rawEmotion = String(emotion || '').toLowerCase().trim();
  const resolvedEmotion = char.supportedEmotions.includes(rawEmotion) ? rawEmotion : 'default';

  try {
    let catDir = path.join(char.stickersDir, resolvedEmotion);
    if (!fs.existsSync(catDir) || fs.readdirSync(catDir).filter(f => f.endsWith('.webp')).length === 0) {
      catDir = path.join(char.stickersDir, 'default');
    }
    if (fs.existsSync(catDir)) {
      const files = fs.readdirSync(catDir).filter(f => f.endsWith('.webp'));
      if (files.length > 0) {
        const pick = files[Math.floor(Math.random() * files.length)];
        return path.join(catDir, pick);
      }
    }
  } catch (err) {
    console.error(`[characterManager] Error finding sticker for ${char.id}/${resolvedEmotion}:`, err);
  }
  return null;
}

/**
 * Parses [ACTION: SEND_STICKER_<EMOTION>] tag from model text.
 */
export function parseStickerAction(text) {
  if (typeof text !== 'string') return { cleanText: '', emotion: null };
  const actionRegex = /\[ACTION:\s*SEND_STICKER_([A-Z_]+)\s*\]/i;
  const match = text.match(actionRegex);
  if (!match) return { cleanText: text.trim(), emotion: null };
  const emotion = match[1].toLowerCase();
  const cleanText = text.replace(actionRegex, '').replace(/\s{2,}/g, ' ').trim();
  return { cleanText, emotion };
}

/**
 * Sanitizes output based on character rules (e.g. Sawako forbids Unicode emojis).
 */
export function sanitizeResponseText(text, charId = null) {
  if (typeof text !== 'string') return '';
  const char = charId && CHARACTERS[charId] ? CHARACTERS[charId] : getActiveCharacter();
  if (char.id === 'sawako') {
    return text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
  }
  return text.trim();
}

export default {
  CHARACTERS,
  getActiveCharacterId,
  getActiveCharacter,
  setActiveCharacter,
  getCharacterStickerPath,
  parseStickerAction,
  sanitizeResponseText
};

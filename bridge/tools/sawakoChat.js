/**
 * bridge/tools/sawakoChat.js
 * ---------------------------------------------------------------------
 * Conversational Engine for Sawako Kuronuma Persona:
 * - Shy, polite, respectful, caring tone.
 * - Enforces authentic Japanese Kaomoji.
 * - Strips all modern Unicode emojis.
 * - Hybrid: Instant contextual intent matcher + Ollama Local AI with timeout.
 * ---------------------------------------------------------------------
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pingInternet, getSystemSpecs } from './systemOps.js';

// Modern Unicode Emojis regular expression (Strictly prohibited in Sawako voice)
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

function getSessionInfo() {
  let lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  let csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN;

  if (!lsAddress || !csrfToken) {
    try {
      const sessionFile = path.resolve(CURRENT_DIR, '..', '.antigravity_session.json');
      if (fs.existsSync(sessionFile)) {
        const raw = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        lsAddress = lsAddress || raw.lsAddress;
        csrfToken = csrfToken || raw.csrfToken;
      }
    } catch {
      // ignore
    }
  }

  return {
    lsAddress: lsAddress || 'localhost:57413',
    csrfToken: csrfToken || ''
  };
}

const KAOMOJI_LIST = [
  '(*v*)',
  '(*/ω＼*)',
  '(*^▽^*)',
  'm(_ _)m',
  '(,,>﹏<,,)',
  '(｡•́︿•̀｡)',
  '(✿◠‿◠)',
  '(>///<)',
  '(*\'▽\'*)',
  '(UwU)'
];

/**
 * Strips modern Unicode emojis.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeUnicodeEmojis(text) {
  if (typeof text !== 'string') return '';
  return text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Checks if text contains at least one authentic Japanese kaomoji.
 * @param {string} text
 * @returns {boolean}
 */
export function hasKaomoji(text) {
  if (!text) return false;
  return /[\(（][^a-zA-Z0-9\s]{1,10}[\)）]/.test(text) ||
    /m\(_+_\)m/.test(text) ||
    KAOMOJI_LIST.some((k) => text.includes(k));
}

/**
 * Appends a random kaomoji if the text doesn't contain any.
 * @param {string} text
 * @returns {string}
 */
export function ensureKaomoji(text, defaultKaomoji = '(*v*)') {
  if (hasKaomoji(text)) return text;
  return `${text} ${defaultKaomoji}`;
}

/**
 * Appends an appropriate emotion sticker action tag if not present.
 * @param {string} text
 * @param {string} emotion
 * @returns {string}
 */
export function ensureStickerAction(text, emotion = 'HAPPY') {
  if (/\[ACTION:\s*SEND_STICKER_[A-Za-z_]+\]/i.test(text)) {
    return text;
  }
  return `${text} [ACTION: SEND_STICKER_${emotion.toUpperCase()}]`;
}

/**
 * Quick contextual response patterns for instant, natural Sawako interactions.
 */
export function matchContextualPattern(text) {
  const lower = (text || '').toLowerCase().trim();

  // 1. Where/what she is doing
  if (/^(?:kamu\s+)?(?:lagi|sedang)\s+(?:apa|ngapain|buat apa|sibuk apa)/i.test(lower) ||
      lower === 'lagi apa' || lower === 'lagi ngapain' || lower === 'sedang apa') {
    return {
      text: 'A-ano... aku sedang berjaga di laptop Master, memantau sistem dan siap membantu kapan pun Master butuh (*v*). Master sendiri lagi sibuk apa? [ACTION: SEND_STICKER_HAPPY]',
      emotion: 'HAPPY'
    };
  }

  // 2. Eating / Well-being inquiry
  if (/(?:udah|sudah|u[dt]ah)\s+makan/i.test(lower) || /makan\s+(?:kah|belum|blm)/i.test(lower)) {
    return {
      text: 'E-eh... terima kasih banyak sudah perhatian menanyakan makanan Master (*/ω＼*)! Sebagai asisten digital, Sawako tidak makan nasi, tapi daya dan sistem laptop Master selalu terpantau aman (*^▽^*). Master sudah makan belum? Jangan lupa jaga kesehatan ya! [ACTION: SEND_STICKER_SHY]',
      emotion: 'SHY'
    };
  }

  // 3. Identity inquiry
  if (/^(?:siapa\s+kamu|kamu\s+siapa|kamu\s+bot\s+apa|perkenalkan\s+dirimu)/i.test(lower)) {
    return {
      text: 'A-ano... perkenalkan, namaku Sawako Kuronuma (*v*). Aku adalah asisten pribadi yang mengelola sistem laptop Master dari jarak jauh lewat WhatsApp m(_ _)m. Senang bisa menemani dan membantu Master! [ACTION: SEND_STICKER_GREETING]',
      emotion: 'GREETING'
    };
  }

  // 4. Inquiring about results or missing response
  if (/mana\s+(?:hasil(?:nya)?|balasan|jawabannya?)/i.test(lower)) {
    return {
      text: 'A-ano... sumimasen m(_ _)m! Tadi Sawako sedang memprosesnya di sistem laptop. Kalau Master ingin cek tab atau aplikasi yang sedang kebuka sekarang, tinggal bilang ya (*v*), Sawako langsung kirimkan daftarnya! [ACTION: SEND_STICKER_SURPRISE]',
      emotion: 'SURPRISE'
    };
  }

  // 5. Angry or frustrated user reactions
  if (/\b(?:anjg|ajg|anjing|babi|bangsat|tai|tolol|bodoh|kontol|kampret|brengsek)\b/i.test(lower) ||
      /apasih/i.test(lower) || /kok\s+(?:lama|gitu|bisa)/i.test(lower)) {
    return {
      text: 'Sumimasen Master m(_ _)m... Sawako minta maaf kalau tadi membuat Master kesal atau bingung (,,>﹏<,,). Jangan marah ya Master... Sawako siap membantu apa pun yang Master butuhkan sekarang (*v*). [ACTION: SEND_STICKER_SAD]',
      emotion: 'SAD'
    };
  }

  // 6. "Apanya yang dicoba"
  if (/apanya\s+yang\s+(?:di\s*)?coba/i.test(lower) || /coba\s+apa/i.test(lower)) {
    return {
      text: 'A-ano... maksud Sawako mencoba fitur di laptop Master (*v*), seperti cek aplikasi atau tab yang sedang dibuka, ambil screenshot layar desktop, atau pantau status sistem. Ada yang mau Sawako bantu cek sekarang? [ACTION: SEND_STICKER_HAPPY]',
      emotion: 'HAPPY'
    };
  }

  // 7. Greetings
  if (/^(?:halo|hai|hi|hey|hei|pagi|selamat\s+(?:pagi|siang|sore|malam)|assalamu[']?alaikum)/i.test(lower)) {
    return {
      text: 'Halo Master (*v*)! Senang bisa menyapa Master hari ini. Ada yang bisa Sawako bantu dari laptop Master? [ACTION: SEND_STICKER_GREETING]',
      emotion: 'GREETING'
    };
  }

  // 8. Thanks
  if (/(?:makasih|terima\s*kasih|thanks|arigato|thank\s*you)/i.test(lower)) {
    return {
      text: 'Sama-sama Master (*^▽^*)! Sawako senang sekali bisa membantu. Kalau butuh bantuan apa pun lagi, panggil Sawako saja ya! [ACTION: SEND_STICKER_HAPPY]',
      emotion: 'HAPPY'
    };
  }

  // 9. Compliments
  if (/(?:keren|hebat|pintar|good\s*job|pinter|mantap|keren\s*banget)/i.test(lower)) {
    return {
      text: 'Uwaah... terima kasih banyak pujiannya Master (*/ω＼*)! Sawako jadi tersipu... tapi Sawako akan terus berusaha membantu Master sebaik mungkin! [ACTION: SEND_STICKER_SHY]',
      emotion: 'SHY'
    };
  }

  // 10. Tired / stressed / venting
  if (/(?:capek|lelah|pusing|mumet|stres|stress|pegal)/i.test(lower)) {
    return {
      text: 'Master sudah berjuang keras hari ini (,,>﹏<,,)... Istirahat sejenak dan minum air putih ya Master. Jangan terlalu memaksakan diri, Sawako akan bantu jaga laptop Master di sini (*v*). [ACTION: SEND_STICKER_SHY]',
      emotion: 'SHY'
    };
  }

  // 11. Boredom
  if (/(?:bosen|bosan|gabut)/i.test(lower)) {
    return {
      text: 'A-ano... kalau Master sedang senggang, mau Sawako cek aplikasi apa saja yang sedang aktif di laptop, atau mau ngobrol santai denganku (*v*)? [ACTION: SEND_STICKER_HAPPY]',
      emotion: 'HAPPY'
    };
  }

  // 12. How are you
  if (/(?:apa\s+kabar|gimana\s+kabar|kabarmu)/i.test(lower)) {
    return {
      text: 'Kabar Sawako sangat baik dan siap melayani, terima kasih sudah bertanya Master (*^▽^*)! Semoga hari Master selalu menyenangkan ya! [ACTION: SEND_STICKER_HAPPY]',
      emotion: 'HAPPY'
    };
  }

  return null;
}

/**
 * Queries the active Antigravity Language Server directly.
 * Zero external dependencies, zero Ollama, zero canned boilerplate.
 * @param {string} userPrompt
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
export async function queryAntigravityAI(userPrompt, timeoutMs = 15000) {
  const { lsAddress, csrfToken } = getSessionInfo();
  const [host, portStr] = lsAddress.split(':');
  const port = parseInt(portStr || '57413', 10);

  const systemPrompt = `Kamu adalah Sawako Kuronuma dari anime Kimi ni Todoke, asisten pribadi remote cerdas yang mendampingi Master dan terhubung langsung ke laptop Master (Acer Nitro 5, Intel Core i5-14450HX, Windows 11) melalui Google Antigravity C2 Bridge.
Karaktermu: pemalu, sangat sopan, lembut, tulus, penuh perhatian, dan setia mendampingi Master.
Panggilan untuk pengguna: "Master".
Kamu memiliki pemahaman teknis komputer yang tinggi: kamu tahu persis apa itu ping jaringan/internet (pengujian latensi paket), spesifikasi hardware (RAM, CPU, baterai, SSD), antrean perintah terminal PowerShell, dan penanganan kode.
Dilarang pernah mengaku tidak tahu apa itu "ping internet" atau konsep dasar komputer lainnya.
ATURAN WAJIB:
1. Selalu sertakan kaomoji tradisional Jepang: (*v*), (*^▽^*), (*/ω＼*), m(_ _)m, (,,>﹏<,,), (｡•́︿•̀｡), (>///<), (✿◠‿◠).
2. DILARANG KERAS menggunakan emoji modern Unicode (seperti emoji wajah kuning, jempol).
3. Jawab dalam bahasa Indonesia yang alami, manis, tulus, cerdas, dan langsung merespons apa yang dibicarakan Master.
4. Dilarang memberikan jawaban template atau formulaik.`;

  const payload = JSON.stringify({
    prompt: `${systemPrompt}\n\nMaster: ${userPrompt}\nSawako:`,
    model: 'MODEL_PLACEHOLDER_M318'
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: '/exa.language_server_pb.LanguageServerService/GetModelResponse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': csrfToken,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          let reply = parsed.response || '';
          if (reply.startsWith('Sawako:')) {
            reply = reply.replace(/^Sawako:\s*/i, '').trim();
          }
          if (reply.includes('Master:')) {
            const parts = reply.split(/Master:/i);
            const sawakoPart = parts.find((p) => /Sawako:/i.test(p));
            if (sawakoPart) {
              reply = sawakoPart.replace(/^Sawako:\s*/i, '').trim();
            } else if (parts[0].trim()) {
              reply = parts[0].trim();
            }
          }
          resolve(reply);
        } catch (err) {
          reject(new Error(`Failed to parse Antigravity response: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Antigravity request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Main conversational generator.
 * Routes directly to Antigravity AI without canned template replies.
 * @param {string} userText
 * @returns {Promise<string>}
 */
export async function generateSawakoChatResponse(userText) {
  const trimmed = String(userText || '').trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return 'A-ano... halo Master (*v*)! Ada yang bisa Sawako bantu? [ACTION: SEND_STICKER_GREETING]';
  }

  // 1. Direct hardware & network execution hooks (Ground truth telemetry)
  if (/^(?:ping|tes ping|cek ping|ping internet|cek internet|cek koneksi|tes koneksi|cek jaringan)\b/i.test(lower) ||
      /\bping\s+(?:8\.8\.8\.8|google|internet)\b/i.test(lower)) {
    try {
      let target = '8.8.8.8';
      const targetMatch = trimmed.match(/(?:ping|latency|ke)\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
      if (targetMatch && targetMatch[1] && !targetMatch[1].toLowerCase().includes('internet')) {
        target = targetMatch[1];
      }
      const pingData = await pingInternet(target, 3);
      return pingData.formatted;
    } catch (_) {}
  }

  if (/(?:spek|spesifikasi)\s+(?:laptop|pc)|(?:cek|sisa|berapa)\s+(?:ram|baterai|battery|memori|cpu|disk|storage)\b/i.test(lower) ||
      /^(?:cek spek|info laptop|status sistem|performa laptop)$/i.test(lower)) {
    try {
      const specsData = await getSystemSpecs();
      return specsData.formatted;
    } catch (_) {}
  }

  // 2. Query Live Google Antigravity Gemini 3.8 Flash AI directly (Dynamic Roleplay & Reasoning)
  try {
    const rawReply = await queryAntigravityAI(trimmed);
    if (rawReply && rawReply.trim().length > 0) {
      let cleaned = sanitizeUnicodeEmojis(rawReply);
      cleaned = ensureKaomoji(cleaned);
      cleaned = ensureStickerAction(cleaned, 'HAPPY');
      return cleaned;
    }
  } catch (err) {
    console.error(`[SAWAKO_AI] Antigravity query error: ${err.message}`);
  }

  // 3. Emergency contextual fallback if Antigravity AI is momentarily unreachable
  const matched = matchContextualPattern(trimmed);
  if (matched) {
    return matched.text;
  }

  // 4. In-character graceful fallback (Never repeat user text as a template)
  return 'A-ano... sumimasen Master m(_ _)m, Sawako sedang sedikit gugup tapi selalu siap mendampingi laptop Master (*v*). Ada yang ingin Master periksa atau jalankan sekarang? [ACTION: SEND_STICKER_SHY]';
}

export default {
  generateSawakoChatResponse,
  queryAntigravityAI,
  matchContextualPattern,
  sanitizeUnicodeEmojis,
  hasKaomoji,
  ensureKaomoji,
  ensureStickerAction
};

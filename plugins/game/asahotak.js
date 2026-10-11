// plugins/asahotak.js
const pluginConfig = {
  name: "asahotak",
  alias: ['ao', 'kuis'],
  category: "game",
  description: "Game asah otak : jawab pertanyaan dari API",
  usage: ".asahotak",
  example: ".asahotak",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/games/asah-otak";
const API_KEY = "FREE";

// Simpan sesi game per chat: { chatId: { soal, jawaban, timeout, pengirim } }
const sessions = new Map();

const TIMEOUT_MS = 60_000; // 60 detik

/* ========== AMBIL SOAL ========== */
async function fetchSoal() {
  const url = `${API_BASE}?apikey=${API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Response bukan JSON: ${raw.slice(0, 200)}`);
  }

  // Cari field soal & jawaban di berbagai kemungkinan struktur
  const data = json.result || json.data || json;

  const soal =
    data.soal ||
    data.pertanyaan ||
    data.question ||
    data.quiz ||
    data.text ||
    (typeof data === "string" ? data : null);

  const jawaban =
    data.jawaban ||
    data.answer ||
    data.correct ||
    data.kunci ||
    data.correctAnswer ||
    null;

  const pilihan =
    data.pilihan ||
    data.options ||
    data.choices ||
    data.opsi ||
    null;

  if (!soal) {
    throw new Error(
      `Struktur response tidak dikenali:\n${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return { soal, jawaban, pilihan };
}

/* ========== NORMALISASI JAWABAN ========== */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/* ========== HANDLER ========== */
async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "asahotak";
  const chatId = m.chat || m.key?.remoteJid;

  try {
    const sender = m.sender || m.key?.participant || m.key?.remoteJid;

    // ==== CEK JAWABAN DULU (kalau ada sesi aktif) ====
    if (sessions.has(chatId)) {
      const sesi = sessions.get(chatId);
      const jawabanUser = normalize(ctx.text ?? m?.text ?? m?.body ?? "");

      if (jawabanUser) {
        // Hentikan timer
        clearTimeout(sesi.timeout);
        sessions.delete(chatId);

        const jawabanBenar = normalize(sesi.jawaban);

        // Cek apakah cocok
        const benar =
          jawabanUser === jawabanBenar ||
          (sesi.pilihan &&
            Array.isArray(sesi.pilihan) &&
            normalize(sesi.pilihan[jawabanUser.charCodeAt(0) - 97]) ===
              jawabanBenar);

        if (benar) {
          return m.reply(
            `✅ *BENAR!*\n\n` +
            `🎯 Jawaban: *${sesi.jawaban}*\n\n` +
            `_Ketik *${usedPrefix}${command}* untuk soal baru._`
          );
        } else {
          return m.reply(
            `❌ *SALAH!*\n\n` +
            `👤 Jawabanmu: *${ctx.text || m?.text || m?.body}*\n` +
            `✅ Jawaban benar: *${sesi.jawaban}*\n\n` +
            `_Ketik *${usedPrefix}${command}* untuk soal baru._`
          );
        }
      }
    }

    // ==== MULAI GAME BARU ====
    await m.reply("🧠 Mengambil soal...");

    let soalData;
    try {
      soalData = await fetchSoal();
    } catch (e) {
      return m.reply(`❌ Gagal mengambil soal:\n${e.message}`);
    }

    const { soal, jawaban, pilihan } = soalData;

    // Format pesan soal
    let pesan = `🧠 *ASAH OTAK*\n\n`;
    pesan += `❓ *${soal}*\n\n`;

    if (pilihan && Array.isArray(pilihan) && pilihan.length) {
      const abjad = "ABCDEFGHIJ";
      pilihan.forEach((p, i) => {
        pesan += `*${abjad[i]}.* ${p}\n`;
      });
      pesan += `\n`;
    }

    pesan +=
      `⏱️ *Waktu: 60 detik*\n` +
      `💬 Reply pesan ini dengan jawabanmu.\n\n` +
      `_Ketik *${usedPrefix}${command}* lagi untuk skip._`;

    // Kirim soal
    const sent = await conn.sendMessage(
      chatId,
      { text: pesan },
      { quoted: m }
    );

    // Set timeout
    const timeout = setTimeout(() => {
      if (sessions.has(chatId)) {
        sessions.delete(chatId);
        conn
          .sendMessage(chatId, {
            text:
              `⏰ *Waktu habis!*\n\n` +
              `✅ Jawaban: *${jawaban}*\n\n` +
              `_Ketik *${usedPrefix}${command}* untuk soal baru._`,
          })
          .catch(() => {});
      }
    }, TIMEOUT_MS);

    // Simpan sesi
    sessions.set(chatId, {
      soal,
      jawaban,
      pilihan,
      timeout,
      pengirim: sender,
      pesanId: sent?.key?.id,
    });
  } catch (err) {
    console.error("[asahotak] ERROR:", err);
    try {
      await m.reply(`❌ Error:\n${err.message || err}`);
    } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
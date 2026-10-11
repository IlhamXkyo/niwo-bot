// plugins/susunkata.js
const pluginConfig = {
  name: "susunkata",
  alias: ['sk', 'scramble'],
  category: "game",
  description: "Game susun kata : susun huruf acak menjadi kata yang benar",
  usage: ".susunkata",
  example: ".susunkata",
  isOwner: false,
  isPremium: false,
  isGroup: true,
  isPrivate: true,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

const API_BASE = "https://api.synoxcloud.xyz/games/susun-kata";
const API_KEY = "FREE";

// Sesi game per chat: Map<chatId, { soal, jawaban, timeout, hint }>
const sessions = new Map();

// Skor per user: Map<jid, poin>
const skor = new Map();

const TIMEOUT_MS = 60_000;   // 60 detik
const POIN_BENAR = 15;
const POIN_SALAH = -3;

/* ========== AMBIL SOAL ========== */
async function fetchSoal() {
  const url = `${API_BASE}?apikey=${API_KEY}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json?.status || !json?.result) {
    throw new Error(`Response tidak valid: ${JSON.stringify(json).slice(0, 200)}`);
  }

  const d = json.result;

  // Deteksi field soal (huruf acak) & jawaban dari berbagai kemungkinan
  const soal =
    d.soal || d.scramble || d.kata_acak || d.acak ||
    d.pertanyaan || d.question || d.huruf || d.challenge || null;

  const jawaban =
    d.jawaban || d.answer || d.kata || d.kunci ||
    d.answerKey || d.correct || d.word || null;

  const hint =
    d.hint || d.petunjuk || d.deskripsi || d.description || d.clue || null;

  if (!soal || !jawaban) {
    throw new Error(
      `Struktur response tidak dikenali:\n${JSON.stringify(json).slice(0, 300)}`
    );
  }

  return {
    soal: String(soal).toUpperCase().trim(),
    jawaban: String(jawaban).toLowerCase().trim(),
    hint: hint ? String(hint).trim() : null,
  };
}

/* ========== NORMALISASI ========== */
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ========== HANDLER ========== */
async function handler(m, ctx = {}) {
  const conn = ctx.conn || ctx.client || ctx.sock || m?.conn || m?.client;
  const usedPrefix = ctx.usedPrefix ?? ctx.prefix ?? m?.prefix ?? ".";
  const command = ctx.command ?? ctx.cmd ?? m?.command ?? "susunkata";
  const chatId = m.chat || m.key?.remoteJid;
  const isGroup = chatId?.endsWith("@g.us");

  try {
    const sender = m.sender || m.key?.participant || m.key?.remoteJid;
    const teks = String(ctx.text ?? m?.text ?? m?.body ?? "").trim();

    // Buang prefix + command dari awal
    let arg = teks;
    if (arg.startsWith(usedPrefix)) arg = arg.slice(usedPrefix.length);
    const parts = arg.split(/\s+/);
    if (parts[0]?.toLowerCase() === command.toLowerCase()) parts.shift();
    arg = parts.join(" ").trim();

    /* ====== SUB-COMMAND ====== */
    if (arg === "skor" || arg === "score" || arg === "leaderboard") {
      if (!skor.size) return m.reply("📊 Belum ada skor.");
      const sorted = [...skor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      let txt = `🏆 *Top 10 Skor Susun Kata*\n\n`;
      sorted.forEach(([jid, p], i) => {
        txt += `${i + 1}. @${jid.split("@")[0]} : *${p}* poin\n`;
      });
      return conn.sendMessage(
        chatId,
        { text: txt, mentions: sorted.map(([jid]) => jid) },
        { quoted: m }
      );
    }

    if (arg === "reset" && skor.size) {
      skor.clear();
      return m.reply("♻️ Semua skor direset.");
    }

    if (arg === "nyerah" || arg === "skip" || arg === "menyerah") {
      if (!sessions.has(chatId)) return m.reply("❌ Tidak ada soal aktif.");
      const sesi = sessions.get(chatId);
      clearTimeout(sesi.timeout);
      sessions.delete(chatId);
      return m.reply(
        `🏳️ *Menyerah!*\n\n` +
        `📝 Soal: *${sesi.soal}*\n` +
        `✅ Jawaban: *${sesi.jawaban}*\n\n` +
        `_Ketik *${usedPrefix}${command}* untuk soal baru._`
      );
    }

    /* ====== CEK JAWABAN USER ====== */
    if (sessions.has(chatId) && arg) {
      const sesi = sessions.get(chatId);
      const jawabanUser = normalize(arg);
      const jawabanBenar = normalize(sesi.jawaban);

      if (jawabanUser === jawabanBenar) {
        clearTimeout(sesi.timeout);
        sessions.delete(chatId);

        const poinBaru = (skor.get(sender) || 0) + POIN_BENAR;
        skor.set(sender, poinBaru);

        return conn.sendMessage(
          chatId,
          {
            text:
              `✅ *BENAR!*\n\n` +
              `📝 Soal: *${sesi.soal}*\n` +
              `🎯 Jawaban: *${sesi.jawaban}*\n` +
              `🎉 +${POIN_BENAR} poin\n` +
              `📊 Total: *${poinBaru}* poin\n\n` +
              `_Ketik *${usedPrefix}${command}* untuk soal berikutnya._`,
            mentions: [sender],
          },
          { quoted: m }
        );
      } else {
        // Salah tapi soal tetap aktif (bisa coba lagi)
        const poinBaru = (skor.get(sender) || 0) + POIN_SALAH;
        skor.set(sender, poinBaru);

        return conn.sendMessage(
          chatId,
          {
            text:
              `❌ *Salah!* Coba lagi.\n\n` +
              `💧 ${POIN_SALAH} poin\n` +
              `📊 Total: *${poinBaru}* poin\n` +
              `⏱️ Sisa waktu: ${Math.ceil((sesi.startAt + TIMEOUT_MS - Date.now()) / 1000)} detik\n\n` +
              `_Atau ketik *${usedPrefix}${command} nyerah* untuk skip._`,
            mentions: [sender],
          },
          { quoted: m }
        );
      }
    }

    /* ====== MULAI SOAL BARU ====== */
    // Bersihkan sesi lama
    if (sessions.has(chatId)) {
      clearTimeout(sessions.get(chatId).timeout);
      sessions.delete(chatId);
    }

    await m.reply("🔤 Mengambil soal...");

    let soal;
    try {
      soal = await fetchSoal();
    } catch (e) {
      return m.reply(`❌ Gagal mengambil soal:\n${e.message}`);
    }

    // Format pesan
    let pesan = `🔤 *SUSUN KATA*\n\n`;
    pesan += `📝 Huruf: \`${soal.soal.split("").join(" ")}\`\n\n`;
    if (soal.hint) pesan += `💡 Petunjuk: _${soal.hint}_\n\n`;
    pesan += `⏱️ Waktu: *60 detik*\n`;
    pesan += `🏆 Benar: +${POIN_BENAR} | Salah: ${POIN_SALAH}\n\n`;
    pesan += `💬 Ketik jawabanmu langsung di chat.\n`;
    pesan += `_Ketik *${usedPrefix}${command} nyerah* untuk skip._`;

    await conn.sendMessage(chatId, { text: pesan }, { quoted: m });

    // Timer
    const timeout = setTimeout(() => {
      if (sessions.has(chatId)) {
        sessions.delete(chatId);
        conn
          .sendMessage(chatId, {
            text:
              `⏰ *Waktu habis!*\n\n` +
              `📝 Soal: *${soal.soal}*\n` +
              `✅ Jawaban: *${soal.jawaban}*\n\n` +
              `_Ketik *${usedPrefix}${command}* untuk soal baru._`,
          })
          .catch(() => {});
      }
    }, TIMEOUT_MS);

    sessions.set(chatId, {
      soal: soal.soal,
      jawaban: soal.jawaban,
      hint: soal.hint,
      timeout,
      startAt: Date.now(),
    });
  } catch (err) {
    console.error("[susunkata] ERROR:", err);
    try {
      await m.reply(`❌ Error:\n${err.message || err}`);
    } catch (_) {}
  }
}

export { pluginConfig as config, handler };
export default { config: pluginConfig, handler };
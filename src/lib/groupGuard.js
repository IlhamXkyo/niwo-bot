/**
 * groupGuard.js
 * Middleware proteksi & event grup.
 *
 * File ini yang benar-benar MENJALANKAN fitur yang cuma disimpan sebagai
 * flag di database oleh plugin (antilink, antitoxic, welcome, afk, mute).
 * Tanpa ini, toggle di plugin tidak berefek apa pun.
 */

import { jidToNumber, isParticipantAdmin } from "./groupHelper.js";

const LINK_PATTERN = /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i;
const ANY_LINK_PATTERN = /(https?:\/\/|www\.)\S+/i;
const VIRTEX_LIMIT = 3000;

// ── ANTI SPAM: berapa pesan dalam berapa ms dianggap flood.
// Disimpan in-memory (bukan DB) karena cuma perlu bertahan selama proses jalan.
const SPAM_WINDOW_MS = 8000;
const SPAM_LIMIT = 6;
const spamTracker = new Map(); // key: "groupJid:senderJid" -> { count, windowStart }

// Daftar kata kasar dasar. Sengaja dibuat ringkas & bisa ditambah sendiri.
const BADWORDS = [
  "anjing", "bangsat", "kontol", "memek", "ngentot",
  "pepek", "jancok", "asu", "babi", "goblok", "tolol",
];

/**
 * Jalankan semua proteksi untuk satu pesan masuk.
 *
 * @returns {Promise<boolean>} true kalau pesan HARUS dihentikan
 *                             (jangan diproses sebagai command lagi)
 */
async function runGroupGuard(m, { sock, db }) {
  if (!m.isGroup) return false;

  const group = db.getGroup(m.chat);

  // ── AFK: sapa balik yang sudah kembali, dan ingatkan yang menyebut orang AFK
  await handleAfk(m, { db, group });

  // Admin & owner kebal dari semua proteksi di bawah ini.
  if (m.isAdmin || m.isOwner) return false;

  // ── MUTE: bot diam total untuk member biasa
  if (group.mute && m.isCommand) {
    return true;
  }

  const body = String(m.body || "");

  // ── ANTI VIRTEX
  if (group.antivirtex && body.length > VIRTEX_LIMIT) {
    await safeDelete(m, sock);
    await m.reply(
      `🧨 Pesan virtex terdeteksi dan dihapus.\n@${jidToNumber(m.sender)} jangan kirim pesan sepanjang itu.`,
      { mentions: [m.sender] }
    );
    return true;
  }

  // ── ANTI LINK
  const hitLink = group.antilinkAll
    ? ANY_LINK_PATTERN.test(body)
    : LINK_PATTERN.test(body);

  if (group.antilink && hitLink) {
    await safeDelete(m, sock);

    if (!m.isBotAdmin) {
      await m.reply(
        `🔗 Link terdeteksi dari @${jidToNumber(m.sender)}.\n` +
          `⚠️ Bot bukan admin, jadi tidak bisa mengeluarkan.`,
        { mentions: [m.sender] }
      );
      return true;
    }

    try {
      await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
      await m.reply(
        `🔗 @${jidToNumber(m.sender)} dikeluarkan karena mengirim link.`,
        { mentions: [m.sender] }
      );
    } catch {
      await m.reply(
        `🔗 Link terdeteksi tapi gagal mengeluarkan @${jidToNumber(m.sender)}.`,
        { mentions: [m.sender] }
      );
    }

    return true;
  }

  // ── ANTI SPAM (flood pesan beruntun)
  if (group.antispam) {
    const key = `${m.chat}:${m.sender}`;
    const now = Date.now();
    const entry = spamTracker.get(key) || { count: 0, windowStart: now };

    if (now - entry.windowStart > SPAM_WINDOW_MS) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    spamTracker.set(key, entry);

    if (entry.count > SPAM_LIMIT) {
      spamTracker.delete(key);
      await safeDelete(m, sock);
      await addWarning(m, { db, group, reason: "mengirim pesan terlalu cepat (flood)", sock });
      return true;
    }
  }

  // ── ANTI TOXIC
  if (group.antitoxic) {
    const lower = body.toLowerCase();
    const found = BADWORDS.find((w) =>
      new RegExp(`\\b${w}\\b`, "i").test(lower)
    );

    if (found) {
      await safeDelete(m, sock);
      await addWarning(m, { db, group, reason: `kata kasar: ${found}`, sock });
      return true;
    }
  }

  // ── ANTI STICKER
  if (group.antisticker && m.isSticker) {
    await safeDelete(m, sock);
    await m.reply(
      `🚫 Stiker tidak diizinkan di grup ini, @${jidToNumber(m.sender)}.`,
      { mentions: [m.sender] }
    );
    return true;
  }

  return false;
}

/** Hapus pesan tanpa melempar error kalau bot bukan admin. */
async function safeDelete(m, sock) {
  try {
    await sock.sendMessage(m.chat, { delete: m.key });
  } catch {
    /* bot bukan admin atau pesan sudah hilang : abaikan */
  }
}

/** Tambah peringatan otomatis dari proteksi, auto-kick bila melebihi batas. */
async function addWarning(m, { db, group, reason, sock }) {
  const warnings = { ...(group.warnings || {}) };
  const limit = group.warnLimit || 3;
  const count = (warnings[m.sender] || 0) + 1;

  if (count >= limit) {
    delete warnings[m.sender];
    db.setGroup(m.chat, { warnings });

    try {
      await sock.groupParticipantsUpdate(m.chat, [m.sender], "remove");
      await m.reply(
        `🚫 @${jidToNumber(m.sender)} dikeluarkan (${reason}).\nPeringatan mencapai ${limit}/${limit}.`,
        { mentions: [m.sender] }
      );
      return;
    } catch {
      /* lanjut ke pesan peringatan biasa */
    }
  }

  warnings[m.sender] = count;
  db.setGroup(m.chat, { warnings });

  await m.reply(
    `⚠️ Peringatan ${count}/${limit} untuk @${jidToNumber(m.sender)}\n📝 ${reason}`,
    { mentions: [m.sender] }
  );
}

/** Tangani status AFK: kembali aktif & notifikasi saat disebut. */
async function handleAfk(m, { db, group }) {
  const afk = { ...(group.afk || {}) };
  let changed = false;

  // Pengirim yang tadinya AFK otomatis kembali aktif.
  if (afk[m.sender]) {
    const since = afk[m.sender].since || Date.now();
    const mins = Math.floor((Date.now() - since) / 60000);

    delete afk[m.sender];
    changed = true;

    await m.reply(
      `👋 Selamat datang kembali, ${m.pushName || "kamu"}!\n⏱️ Kamu AFK selama ${mins} menit.`
    );
  }

  // Beri tahu kalau yang di-mention sedang AFK.
  const mentioned = (m.mentionedJid || []).filter((jid) => afk[jid]);

  if (mentioned.length) {
    const info = mentioned
      .map((jid) => {
        const data = afk[jid];
        const mins = Math.floor((Date.now() - (data.since || Date.now())) / 60000);
        return `😴 @${jidToNumber(jid)} sedang AFK\n📝 ${data.reason}\n⏱️ ${mins} menit lalu`;
      })
      .join("\n\n");

    await m.reply(info, { mentions: mentioned });
  }

  if (changed) db.setGroup(m.chat, { afk });
}

/** Susun teks sambutan/perpisahan dengan placeholder yang sudah diganti. */
function buildGreeting(template, { fallback, jid, meta, count }) {
  const text = template || fallback;

  return text
    .replace(/@user/g, `@${jidToNumber(jid)}`)
    .replace(/@group/g, meta?.subject || "grup ini")
    .replace(/@desc/g, meta?.desc || "-")
    .replace(/@count/g, String(count));
}

/**
 * Pasang listener event keluar/masuk grup untuk welcome & goodbye.
 * Dipanggil sekali dari index.js tiap kali socket dibuat.
 */
function registerGroupEvents(sock, db) {
  sock.ev.on("group-participants.update", async (event) => {
    try {
      const { id, participants, action } = event;

      const group = db.getGroup(id);
      if (!group.welcome) return;

      const meta = await sock.groupMetadata(id).catch(() => null);
      const count = meta?.participants?.length || 0;

      for (const jid of participants) {
        let text = null;

        if (action === "add") {
          text = buildGreeting(group.welcomeText, {
            fallback:
              "👋 Selamat datang @user di *@group*!\n\n" +
              "📜 Baca deskripsi grup dan patuhi aturan ya.\n" +
              "👥 Kamu adalah member ke-@count.",
            jid,
            meta,
            count,
          });
        } else if (action === "remove") {
          text = buildGreeting(group.goodbyeText, {
            fallback: "👋 @user telah keluar dari grup.\nSisa @count member.",
            jid,
            meta,
            count,
          });
        }

        if (text) {
          await sock.sendMessage(id, { text, mentions: [jid] });
        }
      }
    } catch (err) {
      console.error("[groupGuard] group-participants.update:", err?.message || err);
    }
  });
}

export { runGroupGuard, registerGroupEvents };

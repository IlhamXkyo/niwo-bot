/**
 * groupHelper.js
 * Helper bersama untuk semua plugin di kategori "group".
 *
 * Tujuannya supaya tiap plugin group tidak menulis ulang logika yang sama:
 * validasi admin, resolve target user, normalisasi nomor, dsb.
 */

/** Ambil hanya digit dari sebuah nilai. */
function normalizeNumber(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

/** Ubah nomor/teks apa pun jadi JID WhatsApp yang valid. */
function toJid(value) {
  if (!value) return null;

  const raw = String(value).trim();
  if (raw.includes("@")) return raw;

  let number = normalizeNumber(raw);
  if (!number) return null;

  if (number.startsWith("0")) {
    number = "62" + number.slice(1);
  }

  return `${number}@s.whatsapp.net`;
}

/** Ambil nomor saja dari JID (buat ditampilkan). */
function jidToNumber(jid) {
  return String(jid || "").split("@")[0].split(":")[0];
}

/**
 * Tentukan target user dari sebuah pesan, dengan urutan prioritas:
 * reply > mention > teks manual.
 */
function resolveTarget(m) {
  if (m.quoted?.sender) return toJid(m.quoted.sender);

  if (Array.isArray(m.mentionedJid) && m.mentionedJid.length) {
    return toJid(m.mentionedJid[0]);
  }

  const text = String(m.text || "").trim();
  return text ? toJid(text) : null;
}

/** Ambil SEMUA target (buat command massal seperti kick banyak orang). */
function resolveTargets(m) {
  const out = new Set();

  if (m.quoted?.sender) out.add(toJid(m.quoted.sender));

  for (const jid of m.mentionedJid || []) {
    const resolved = toJid(jid);
    if (resolved) out.add(resolved);
  }

  if (!out.size) {
    for (const part of String(m.text || "").split(/[\s,]+/)) {
      const resolved = toJid(part);
      if (resolved) out.add(resolved);
    }
  }

  return [...out].filter(Boolean);
}

/**
 * Gerbang standar untuk command group: pastikan admin (dan bot admin).
 * Balikin true kalau LOLOS, false kalau sudah dibalas pesan penolakan.
 */
async function requireAdmin(m, { botAdmin = true, ownerBypass = true } = {}) {
  if (!m.isGroup) {
    await m.reply("👥 Perintah ini hanya bisa dipakai di dalam grup.");
    return false;
  }

  if (!m.isAdmin && !(ownerBypass && m.isOwner)) {
    await m.reply("🚫 Perintah ini khusus admin grup.");
    return false;
  }

  if (botAdmin && !m.isBotAdmin) {
    await m.reply("⚠️ Jadikan bot sebagai admin dulu untuk memakai perintah ini.");
    return false;
  }

  return true;
}

/** Cek apakah sebuah JID adalah admin di grup ini. */
function isParticipantAdmin(m, jid) {
  const num = jidToNumber(jid);

  return (m.groupMembers || []).some((p) => {
    const pNum = jidToNumber(p.id || p.jid);
    return pNum === num && (p.admin === "admin" || p.admin === "superadmin");
  });
}

/** Daftar JID semua member grup. */
function allMemberJids(m) {
  return (m.groupMembers || []).map((p) => p.id || p.jid).filter(Boolean);
}

/** Format daftar bernomor untuk output yang rapi. */
function numberedList(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

export {
  normalizeNumber,
  toJid,
  jidToNumber,
  resolveTarget,
  resolveTargets,
  requireAdmin,
  isParticipantAdmin,
  allMemberJids,
  numberedList,
};

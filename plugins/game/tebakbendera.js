// Game tebak bendera. Dibikin pakai pola "command dua langkah"
// (.tebakbendera buat mulai, .tebakbendera <jawaban> buat jawab)
// karena bot belum punya sistem "tunggu pesan balasan" generik
// buat game : jadi ini sengaja self-contained, gak perlu ubah index.js.

const config = {
  name: "tebakbendera",
  alias: ["tebakflag", "guessflag"],
  category: "game",
  description: "Tebak nama negara dari bendera",
  usage: ".tebakbendera lalu jawab dengan .tebakbendera <nama negara>",
  example: ".tebakbendera",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

// cc = kode ISO 3166-1 alpha-2 (dipakai flagcdn.com), aliases = jawaban yang diterima.
const FLAGS = [
  { cc: "id", name: "Indonesia", aliases: ["indonesia"] },
  { cc: "jp", name: "Jepang", aliases: ["jepang", "japan"] },
  { cc: "kr", name: "Korea Selatan", aliases: ["korea selatan", "korsel", "south korea"] },
  { cc: "us", name: "Amerika Serikat", aliases: ["amerika", "amerika serikat", "usa", "united states"] },
  { cc: "gb", name: "Inggris", aliases: ["inggris", "britania", "uk", "united kingdom"] },
  { cc: "fr", name: "Prancis", aliases: ["prancis", "france", "perancis"] },
  { cc: "de", name: "Jerman", aliases: ["jerman", "germany"] },
  { cc: "br", name: "Brasil", aliases: ["brasil", "brazil"] },
  { cc: "cn", name: "China", aliases: ["china", "tiongkok"] },
  { cc: "in", name: "India", aliases: ["india"] },
  { cc: "sa", name: "Arab Saudi", aliases: ["arab saudi", "saudi arabia", "saudi"] },
  { cc: "eg", name: "Mesir", aliases: ["mesir", "egypt"] },
  { cc: "au", name: "Australia", aliases: ["australia"] },
  { cc: "ca", name: "Kanada", aliases: ["kanada", "canada"] },
  { cc: "mx", name: "Meksiko", aliases: ["meksiko", "mexico"] },
  { cc: "ru", name: "Rusia", aliases: ["rusia", "russia"] },
  { cc: "it", name: "Italia", aliases: ["italia", "italy"] },
  { cc: "es", name: "Spanyol", aliases: ["spanyol", "spain"] },
  { cc: "my", name: "Malaysia", aliases: ["malaysia"] },
  { cc: "th", name: "Thailand", aliases: ["thailand"] },
  { cc: "vn", name: "Vietnam", aliases: ["vietnam"] },
  { cc: "ph", name: "Filipina", aliases: ["filipina", "philippines"] },
  { cc: "sg", name: "Singapura", aliases: ["singapura", "singapore"] },
  { cc: "tr", name: "Turki", aliases: ["turki", "turkey", "turkiye"] },
  { cc: "za", name: "Afrika Selatan", aliases: ["afrika selatan", "south africa"] },
];

const ROUND_TTL_MS = 90_000;
const rounds = new Map(); // key: chat jid -> { flag, startedAt }

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

async function handler(m) {
  const answer = normalize(m.text);
  const active = rounds.get(m.chat);
  const expired = active && Date.now() - active.startedAt > ROUND_TTL_MS;

  // ── Mode jawab: ada round aktif & user kasih argumen
  if (active && !expired && answer) {
    const correct = active.flag.aliases.includes(answer) || normalize(active.flag.name) === answer;

    if (correct) {
      rounds.delete(m.chat);
      return m.reply(`✅ Benar! Itu bendera *${active.flag.name}*. Ketik ${m.prefix}tebakbendera buat main lagi.`);
    }

    return m.reply(`❌ Salah, coba lagi. Ketik ${m.prefix}tebakbendera <nama negara>.`);
  }

  // Round lama expired -> kasih tau jawabannya sebelum mulai baru
  if (active && expired) {
    rounds.delete(m.chat);
    await m.reply(`⏱️ Waktu habis! Jawaban ronde sebelumnya: *${active.flag.name}*.`);
  }

  // Kalau masih ada round aktif (belum expired) tapi dipanggil tanpa jawaban -> tampilkan ulang
  if (rounds.has(m.chat)) {
    const flag = rounds.get(m.chat).flag;
    return m.replyImage(
      `https://flagcdn.com/w320/${flag.cc}.png`,
      `🏳️ *TEBAK BENDERA*\n\nBendera negara apa ini?\nJawab: ${m.prefix}tebakbendera <nama negara>`,
    );
  }

  // ── Mulai round baru
  const flag = FLAGS[Math.floor(Math.random() * FLAGS.length)];
  rounds.set(m.chat, { flag, startedAt: Date.now() });

  return m.replyImage(
    `https://flagcdn.com/w320/${flag.cc}.png`,
    `🏳️ *TEBAK BENDERA*\n\nBendera negara apa ini?\nJawab: ${m.prefix}tebakbendera <nama negara>\n⏱️ Waktu: 90 detik`,
  );
}

export default { config, handler };

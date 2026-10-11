const config = {
  name: "doa",
  alias: ["doaharian"],
  category: "islamic",
  description: "Kumpulan doa harian umum",
  usage: ".doa untuk daftar, atau .doa <nama> buat lihat isinya",
  example: ".doa makan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

// Data lokal (bukan hasil scrape API luar) biar selalu bisa diakses.
const DOA = {
  makan: {
    judul: "Doa Sebelum Makan",
    arab: "اَللّٰهُمَّ بَارِكْ لَنَا فِيْمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّار",
    latin: "Allahumma barik lana fima razaqtana wa qina 'adzaban nar",
    arti: "Ya Allah, berkahilah kami pada apa yang telah Engkau rezekikan kepada kami, dan peliharalah kami dari siksa api neraka.",
  },
  sesudahmakan: {
    judul: "Doa Sesudah Makan",
    arab: "اَلْحَمْدُ لِلّٰهِ الَّذِيْ اَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِيْن",
    latin: "Alhamdulillahilladzi ath'amana wa saqana wa ja'alana muslimin",
    arti: "Segala puji bagi Allah yang telah memberi kami makan dan minum, serta menjadikan kami sebagai orang-orang muslim.",
  },
  tidur: {
    judul: "Doa Sebelum Tidur",
    arab: "بِاسْمِكَ اللّٰهُمَّ اَحْيَا وَاَمُوْت",
    latin: "Bismika Allahumma ahya wa amut",
    arti: "Dengan nama-Mu ya Allah aku hidup dan aku mati.",
  },
  bangun: {
    judul: "Doa Bangun Tidur",
    arab: "اَلْحَمْدُ لِلّٰهِ الَّذِيْ اَحْيَانَا بَعْدَ مَا اَمَاتَنَا وَاِلَيْهِ النُّشُوْر",
    latin: "Alhamdulillahilladzi ahyana ba'da ma amatana wa ilaihin nusyur",
    arti: "Segala puji bagi Allah yang telah menghidupkan kami setelah mematikan kami, dan hanya kepada-Nya kami kembali.",
  },
  keluarrumah: {
    judul: "Doa Keluar Rumah",
    arab: "بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ وَلَا حَوْلَ وَلَا قُوَّةَ اِلَّا بِاللّٰه",
    latin: "Bismillahi tawakkaltu 'alallahi wa la haula wa la quwwata illa billah",
    arti: "Dengan nama Allah, aku bertawakal kepada Allah, tiada daya dan kekuatan kecuali dengan pertolongan Allah.",
  },
  masukrumah: {
    judul: "Doa Masuk Rumah",
    arab: "اَللّٰهُمَّ اِنِّيْ اَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ",
    latin: "Allahumma inni as-aluka khairal maulaji wa khairal makhraji",
    arti: "Ya Allah, aku memohon kepada-Mu kebaikan saat masuk dan kebaikan saat keluar.",
  },
  belajar: {
    judul: "Doa Sebelum Belajar",
    arab: "رَبِّ زِدْنِيْ عِلْمًا وَارْزُقْنِيْ فَهْمًا",
    latin: "Rabbi zidni 'ilma warzuqni fahma",
    arti: "Ya Tuhanku, tambahkanlah ilmu kepadaku dan berilah aku pemahaman yang baik.",
  },
  bepergian: {
    judul: "Doa Naik Kendaraan / Bepergian",
    arab: "سُبْحَانَ الَّذِيْ سَخَّرَ لَنَا هٰذَا وَمَا كُنَّا لَهٗ مُقْرِنِيْنَ وَاِنَّآ اِلٰى رَبِّنَا لَمُنْقَلِبُوْن",
    latin: "Subhanalladzi sakhkhara lana hadza wa ma kunna lahu muqrinin wa inna ila rabbina lamunqalibun",
    arti: "Maha Suci Allah yang telah menundukkan kendaraan ini untuk kami, padahal kami sebelumnya tidak mampu menguasainya, dan sesungguhnya kami akan kembali kepada Tuhan kami.",
  },
};

function listText(prefix) {
  const names = Object.keys(DOA).map((k) => `〄 ${prefix}doa ${k}`).join("\n");
  return `📿 *DAFTAR DOA HARIAN*\n\n${names}\n\nContoh: ${prefix}doa makan`;
}

async function handler(m) {
  const key = String(m.text || "").trim().toLowerCase().replace(/\s+/g, "");

  if (!key) {
    return m.reply(listText(m.prefix));
  }

  const doa = DOA[key];
  if (!doa) {
    return m.reply(`❌ Doa "${m.text}" tidak ada di daftar.\n\n${listText(m.prefix)}`);
  }

  const text = [
    `📿 *${doa.judul}*`,
    "",
    doa.arab,
    "",
    `_${doa.latin}_`,
    "",
    `Artinya: ${doa.arti}`,
  ].join("\n");

  return m.reply(text);
}

export default { config, handler };

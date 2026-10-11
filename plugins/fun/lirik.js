const config = {
  name: "lirik",
  alias: ["lyrics", "lyric", "lagu"],
  category: "fun", // <-- Kategori fun

  description: "Mencari lirik lagu dengan dukungan timestamp (synced)",
  usage: ".lirik <judul> <artis>",
  example: ".lirik lonely akon",

  isOwner: false, isPremium: false, isGroup: false, isPrivate: false,
  cooldown: 15, energi: 3, isEnabled: true
};

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();
  const args = text.split(" ");
  if (!text) return m.reply("🎵 *LIRIK LAGU*\n\nMasukkan judul lagu dan artis.\n\nContoh:\n`.lirik lonely akon`");

  const artist = args[args.length - 1] || "";
  const query = artist ? args.slice(0, -1).join(" ") : text;
  const isSynced = args[args.length - 1]?.toLowerCase() === "synced";
  const cleanQuery = isSynced ? args.slice(0, -1).join(" ") : query;
  const cleanArtist = isSynced ? "" : artist;

  try {
    await m.react("🕐");
    const params = new URLSearchParams({ q: cleanQuery, artist: cleanArtist, synced: isSynced ? "true" : "false" });
    const response = await fetch(`https://api.azbry.com/api/fun/lirik?${params.toString()}`);
    const data = await response.json();
    if (data && data.status === false) throw new Error(data.message || "Lirik tidak ditemukan");

    const lyrics = data.result || data.data?.result || data.lyrics || data.lirik || data.data?.lyrics || data.data?.lirik;
    const title = data.title || data.judul || data.data?.title || cleanQuery;
    const artistName = data.artist || data.artis || data.data?.artist || cleanArtist || "Unknown";
    if (!lyrics) throw new Error("Lirik tidak ditemukan di respons API");

    await m.react("✅");
    return m.reply(`🎵 *LIRIK LAGU*\n\n🎤 *Judul:* ${title}\n🎧 *Artis:* ${artistName}\n⏱️ *Synced:* ${isSynced ? "Ya (Timestamp)" : "Tidak"}\n\n━━━━━━━━━━━━━━━\n\n${lyrics}`);
  } catch (error) {
    await m.react("❌");
    return m.reply(`〄 *GAGAL MENCARI LIRIK*\n\n❌ Error: ${error.message}`);
  }
}

export default { config, handler };
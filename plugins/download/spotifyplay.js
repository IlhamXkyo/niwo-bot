// plugins/downloader/spotifyplay.js
const config = {
  name: "spotifyplay",
  alias: ["spotify", "sfplay"],
  category: "downloader",
  description: "Mencari dan mengirim lagu dari Spotify",
  usage: ".spotifyplay <judul lagu>",
  example: ".spotifyplay sesi potret",
  cooldown: 5,
  energi: 1
};

async function handler(m, { sock }) {
  const text = String(m.text || m.body || "").trim();
  const args = text.split(/\s+/);
  args.shift();
  const query = args.join(" ").trim();

  if (!query) return m.reply("Contoh penggunaan:\n.spotifyplay sesi potret");

  await m.reply("⏳ Sedang mencari lagu di Spotify...");

  try {
    const api = `https://api.nexadev.my.id/api/spotifyplay?q=${encodeURIComponent(query)}`;
    const res = await fetch(api);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data?.status || !data?.result) return m.reply("❌ Lagu tidak ditemukan.");

    const result = data.result;
    const title = result.title || query;
    const caption = `*🎵 SPOTIFY PLAY*\n\n*📀 Judul :* ${title}\n*🎤 Artist :* ${result.artist || "-"}\n*💽 Album :* ${result.album || "-"}\n*⏱ Durasi :* ${result.duration || "-"}\n*⭐ Popularity :* ${result.popularity || "-"}\n*📅 Release :* ${result.release_at || "-"}\n\n*🔗 Spotify :*\n${result.url || "-"}\n\n⏳ Mengirim audio...`;

    if (result.thumbnail) {
      await sock.sendMessage(m.chat, {
        image: { url: result.thumbnail },
        caption
      }, { quoted: m });
    } else {
      await m.reply(caption);
    }

    if (!result.download_url) return m.reply("❌ Link audio tidak tersedia.");

    await sock.sendMessage(m.chat, {
      audio: { url: result.download_url },
      mimetype: "audio/mpeg",
      fileName: `${title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`,
      ptt: false
    }, { quoted: m });

  } catch (e) {
    console.error("[SPOTIFYPLAY]", e);
    await m.reply("❌ Terjadi kesalahan saat mengambil lagu Spotify.");
  }
}

export default { config, handler };
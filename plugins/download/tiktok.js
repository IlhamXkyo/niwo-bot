import axios from "axios";

const config = {
  name: "tiktok",
  alias: ["tt", "ttdl"],
  category: "download",
  description: "Download video/foto TikTok tanpa watermark",
  usage: ".tiktok <link/kata kunci>",
  example: ".tiktok https://vt.tiktok.com/xxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function searchTikTok(query) {
  const { data } = await axios.get("https://tikwm.com/api/feed/search", {
    params: { keywords: query, count: 1 },
    timeout: 20000,
  });

  if (!data || data.code !== 0 || !data.data?.videos?.length) {
    throw new Error("Video tidak ditemukan");
  }

  const v = data.data.videos[0];
  return `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`;
}

async function getTikTok(url) {
  const { data } = await axios.get("https://tikwm.com/api/", {
    params: { url, hd: 1 },
    timeout: 20000,
  });

  if (!data || data.code !== 0) {
    throw new Error("Gagal mengambil data TikTok, coba lagi nanti");
  }

  return data.data;
}

function formatNumber(num = 0) {
  return Number(num || 0).toLocaleString("id-ID");
}

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function handler(m, { sock }) {
  const input = String(m.text || "").trim();

  if (!input) {
    return m.reply(
      `〄 *TIKTOK DOWNLOADER*\n\n` +
        `〄 ${m.prefix}tiktok https://vt.tiktok.com/xxxxx\n` +
        `〄 ${m.prefix}tiktok elaina edit`
    );
  }

  try {
    await m.react("🕐");

    const url = /^https?:\/\//i.test(input) ? input : await searchTikTok(input);
    const res = await getTikTok(url);

    const title = String(res.title || "-").replace(/\s+/g, " ").trim();
    const uploader = res.author?.nickname || res.author?.unique_id || "-";
    const duration = formatDuration(res.duration);
    const views = formatNumber(res.play_count || res.play || res.views || 0);

    const caption = [
      ": DOWNLOADER TIKTOK :",
      "",
      `❀ Judul   : ${title.length > 80 ? title.slice(0, 80) + "..." : title}`,
      `❀ Uploader: ${uploader}`,
      `❀ Durasi  : ${duration}`,
      `❀ Views   : ${views}`,
    ].join("\n");

    // Slideshow foto (bukan video)
    if (Array.isArray(res.images) && res.images.length > 0) {
      for (let i = 0; i < res.images.length; i++) {
        await sock.sendMessage(
          m.chat,
          { image: { url: res.images[i] }, caption: i === 0 ? caption : "" },
          { quoted: m.raw || m },
        );
      }
      if (res.music) {
        await sock.sendMessage(m.chat, { audio: { url: res.music }, mimetype: "audio/mpeg" }, { quoted: m.raw || m });
      }
      await m.react("✅");
      return;
    }

    if (res.play) {
      await sock.sendMessage(m.chat, { video: { url: res.play }, caption }, { quoted: m.raw || m });
    }

    await m.react("✅");
  } catch (error) {
    await m.react("❌");
    console.error("[tiktok] gagal:", error?.message || error);
    await m.reply(`❌ ${error?.message || "Gagal download video TikTok."}`);
  }
}

export default { config, handler };

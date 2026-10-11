import axios from "axios";

const config = {
  name: "facebook",
  alias: ["fb"],
  category: "downloader",
  description: "Download video Facebook",
  usage: ".fb <link>",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  limit: true,
  isEnabled: true
};

async function getToken() {
  const url = "https://fbdownloader.to/id";

  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    },
    timeout: 30000
  });

  const regex = /k_exp="([^"]+)".*?k_token="([^"]+)"/s;
  const match = html.match(regex);

  if (!match) {
    throw new Error("Token tidak ditemukan");
  }

  return {
    k_exp: match[1],
    k_token: match[2]
  };
}

async function fbDownloader(fbUrl) {
  const { k_exp, k_token } = await getToken();

  const payload = new URLSearchParams({
    k_exp,
    k_token,
    p: "home",
    q: fbUrl,
    lang: "id",
    v: "v2",
    W: ""
  });

  const { data } = await axios.post(
    "https://fbdownloader.to/api/ajaxSearch",
    payload,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://fbdownloader.to",
        "Referer": "https://fbdownloader.to/id"
      },
      timeout: 30000
    }
  );

  if (!data || !data.data) {
    throw new Error("Gagal mengambil data video");
  }

  const html = data.data;
  const results = [];

  const rowRegex = /<td class="video-quality">([\s\S]*?)<\/td>[\s\S]*?(?:href="([^"]+)"|data-videourl="([^"]+)")/gi;

  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const quality = match[1].replace(/<[^>]+>/g, "").trim();
    const url = match[2] || match[3];

    if (quality && url) {
      results.push({
        quality,
        url
      });
    }
  }

  return results;
}

function getText(m, ctx = {}) {
  if (ctx.text) return String(ctx.text).trim();

  if (Array.isArray(ctx.args) && ctx.args.length) {
    return ctx.args.join(" ").trim();
  }

  if (Array.isArray(m?.args) && m.args.length) {
    return m.args.join(" ").trim();
  }

  return String(
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    ""
  ).trim();
}

async function handler(m, ctx = {}) {
  const text = getText(m, ctx);

  if (!text) {
    return m.reply(
      "❀ *Cara penggunaan:*\n\n" +
      ".fb <link Facebook>\n\n" +
      "Contoh:\n" +
      ".fb https://facebook.com/..."
    );
  }

  const fbUrl = text.split(/\s+/)[0];

  if (!/^https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\//i.test(fbUrl)) {
    return m.reply(
      "❌ Link Facebook tidak valid.\n\n" +
      "Contoh:\n" +
      ".fb https://facebook.com/..."
    );
  }

  try {
    await m.reply("⏳ *Sedang mengambil video Facebook...*");

    const results = await fbDownloader(fbUrl);

    if (!results.length) {
      return m.reply("❌ Tidak ada video ditemukan.");
    }

    const videoUrl = results[0].url;

    const { data: buffer } = await axios.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const tanggal = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });

    const pushName =
      m.pushName ||
      m.senderName ||
      "User";

    const caption =
      `F A C E B O O K   D O W N L O A D E R\n\n` +
      `Resolusi: ${results[0].quality}\n` +
      `Status: ✓ success\n\n` +
      `Request by: ${pushName}\n` +
      `Tanggal: ${tanggal}`;

    const sock = ctx.sock || ctx.conn;

    if (!sock) {
      throw new Error("Socket WhatsApp tidak tersedia");
    }

    await sock.sendMessage(
      m.chat,
      {
        video: buffer,
        caption
      },
      {
        quoted: m
      }
    );
  } catch (e) {
    console.error("[FACEBOOK]", e);

    return m.reply(
      "❌ Gagal mengunduh video:\n" +
      String(e?.message || e)
    );
  }
}

export default {
  config,
  handler
};
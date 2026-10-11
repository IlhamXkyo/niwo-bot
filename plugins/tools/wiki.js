import axios from "axios";

const config = {
  name: "wiki",
  alias: ["wikipedia"],
  category: "search",
  description: "Cari ringkasan artikel di Wikipedia Indonesia",
  usage: ".wiki <kata kunci>",
  example: ".wiki Kabupaten Lampung",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

async function handler(m) {
  const query = String(m.text || "").trim();
  if (!query) {
    return m.reply(`〄 *WIKI*\n\n〄 ${m.prefix}wiki <kata kunci>\n〄 ${m.prefix}wiki Kabupaten Lampung`);
  }

  try {
    await m.react("🕐");

    // 1. cari judul artikel yang paling cocok
    const search = await axios.get("https://id.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: query,
        format: "json",
        srlimit: 1,
      },
      timeout: 15000,
    });

    const hit = search.data?.query?.search?.[0];
    if (!hit) {
      await m.react("❌");
      return m.reply(`❌ Artikel "${query}" tidak ditemukan di Wikipedia.`);
    }

    // 2. ambil ringkasannya
    const summary = await axios.get(
      `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
      { timeout: 15000 },
    );

    const data = summary.data;
    const extract = data?.extract || "Tidak ada ringkasan tersedia.";
    const pageUrl = data?.content_urls?.desktop?.page || `https://id.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`;
    const thumb = data?.thumbnail?.source;

    const text = [
      `📖 *${data?.title || hit.title}*`,
      "",
      extract,
      "",
      `🔗 ${pageUrl}`,
    ].join("\n");

    if (thumb) {
      await m.replyImage(thumb, text);
    } else {
      await m.reply(text);
    }

    await m.react("✅");
  } catch (error) {
    await m.react("❌");
    console.error("[wiki] gagal:", error?.message || error);
    await m.reply("❌ Gagal mengambil data Wikipedia, coba lagi nanti.");
  }
}

export default { config, handler };

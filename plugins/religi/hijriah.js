// plugins/religi/hijriyah.js

const config = {
  name: "hijriyah",
  alias: ["hijri", "hijriah", "tanggalhijriyah", "khgt"],
  category: "religi",
  description: "Mengambil konversi tanggal Kalender Hijriah Global Tunggal (KHGT) hari ini secara real-time",
  usage: ".hijriyah",
  example: ".hijriyah",
  isOwner: false,
  isPremium: false,
  cooldown: 5,
  energi: 0
};

async function getTodayHijriyah() {
  try {
    const url = "https://khgt.muhammadiyah.or.id/";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      return {
        status: false,
        message: `HTTP Error ${res.status}`
      };
    }

    const html = await res.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();

    const match = text.match(
      /([a-zA-Z]+),\s*(\d+)\s+([a-zA-Z]+)\s+(\d{4})\s*H\s*\/\s*(\d+\s+[a-zA-Z]+\s+\d{4})/i
    );

    if (!match) {
      const fallback = text.match(
        /(\d+)\s+([a-zA-Z]+)\s+(\d{4})\s*H/i
      );

      if (fallback) {
        return {
          status: true,
          source: "khgt.muhammadiyah.or.id",
          data: {
            hijriyah: `${fallback[1]} ${fallback[2]} ${fallback[3]} H`,
            tanggal: parseInt(fallback[1]),
            bulan: fallback[2],
            tahun: parseInt(fallback[3])
          }
        };
      }

      return {
        status: false,
        message: "Gagal mengekstrak tanggal Hijriyah dari halaman web."
      };
    }

    const [, hari, tglHijri, bulanHijri, thnHijri, masehiFull] = match;

    return {
      status: true,
      source: "khgt.muhammadiyah.or.id",
      data: {
        lengkap: match[0].trim(),
        hari: hari.trim(),
        hijriyah: {
          tanggal: parseInt(tglHijri),
          bulan: bulanHijri.trim(),
          tahun: parseInt(thnHijri),
          formatted: `${tglHijri.trim()} ${bulanHijri.trim()} ${thnHijri} H`
        },
        masehi: {
          formatted: masehiFull.trim()
        }
      }
    };
  } catch (err) {
    return {
      status: false,
      message: err?.message || "Terjadi kesalahan."
    };
  }
}

async function handler(m, { sock, config: botConfig }) {
  try {
    const result = await getTodayHijriyah();

    if (!result.status) {
      return m.reply(
        `❌ Gagal mengambil tanggal Hijriyah.\n\n${result.message}`
      );
    }

    const data = result.data;

    let text = `🌙 *Tanggal Hijriyah Hari Ini*\n\n`;

    if (data.hari) {
      text += `📅 Hari : ${data.hari}\n`;
    }

    if (data.hijriyah?.formatted) {
      text += `🌙 Hijriyah : ${data.hijriyah.formatted}\n`;
    } else if (data.hijriyah) {
      text += `🌙 Hijriyah : ${data.hijriyah}\n`;
    }

    if (data.masehi?.formatted) {
      text += `☀️ Masehi : ${data.masehi.formatted}\n`;
    }

    text += `\n🌐 Sumber : KHGT Muhammadiyah`;
    text += `\n\n❀ NIWO BOT ❀`;

    return m.reply(text);
  } catch (err) {
    console.error("[HIJRIYAH]", err);

    return m.reply(
      `❌ Terjadi kesalahan saat mengambil tanggal Hijriyah.\n\n${err?.message || "Unknown error"}`
    );
  }
}

export default {
  config,
  handler
};
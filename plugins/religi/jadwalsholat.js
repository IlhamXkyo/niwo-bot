// plugins/religi/jadwalsholat.js

const BASE_URL = "https://jadwalsholat.org";
const MONTHLY_URL = `${BASE_URL}/jadwal-sholat/monthly.php`;

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
};

const config = {
  name: "jadwalsholat",
  alias: ["sholat", "jadwalshalat", "shalat", "waktusholat", "prayer"],
  category: "religi",
  description: "Menampilkan jadwal sholat berdasarkan kota",
  usage: ".jadwalsholat [kota]",
  example: ".jadwalsholat Pringsewu",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

const MONTH_NAMES = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

let cityCache = null;

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(html) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function getTodayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  return {
    year: Number(parts.find(x => x.type === "year")?.value),
    month: Number(parts.find(x => x.type === "month")?.value),
    day: Number(parts.find(x => x.type === "day")?.value)
  };
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function getCities() {
  if (cityCache?.length) return cityCache;

  const html = await fetchHtml(MONTHLY_URL);
  const cities = [];
  const regex = /<option\b[^>]*value\s*=\s*["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const id = Number(match[1]);
    const name = stripHtml(match[2]);

    if (!id || !name) continue;
    if (/pilih|select/i.test(name)) continue;

    if (!cities.some(city => city.id === id)) {
      cities.push({
        id,
        name
      });
    }
  }

  if (!cities.length) {
    throw new Error("Daftar kota tidak ditemukan dari jadwalsholat.org");
  }

  cityCache = cities;
  return cities;
}

async function searchCities(query) {
  const cities = await getCities();
  const keyword = String(query || "").trim().toLowerCase();

  if (!keyword) return [];

  return cities.filter(city =>
    city.name.toLowerCase().includes(keyword)
  );
}

async function resolveCity(query) {
  const cities = await getCities();
  const value = String(query || "").trim().toLowerCase();

  if (!value) {
    return (
      cities.find(city => city.name.toLowerCase() === "jakarta pusat") ||
      cities.find(city => city.name.toLowerCase().includes("jakarta")) ||
      cities[0]
    );
  }

  if (/^\d+$/.test(value)) {
    const city = cities.find(item => item.id === Number(value));

    if (city) return city;

    throw new Error(`ID kota ${value} tidak ditemukan.`);
  }

  const exact = cities.find(
    city => city.name.toLowerCase() === value
  );

  if (exact) return exact;

  const starts = cities.find(
    city => city.name.toLowerCase().startsWith(value)
  );

  if (starts) return starts;

  const contains = cities.find(
    city => city.name.toLowerCase().includes(value)
  );

  if (contains) return contains;

  throw new Error(`Kota "${query}" tidak ditemukan.`);
}

function extractCells(rowHtml) {
  const cells = [];
  const regex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let match;

  while ((match = regex.exec(rowHtml)) !== null) {
    cells.push(stripHtml(match[1]));
  }

  return cells;
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);

  if (!match) return null;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractTableRows(html) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const cells = extractCells(match[1]);

    if (cells.length < 8) continue;

    let dateIndex = -1;

    for (let i = 0; i < Math.min(cells.length, 3); i++) {
      if (/^\s*\d{1,2}\s*$/.test(cells[i])) {
        dateIndex = i;
        break;
      }
    }

    if (dateIndex === -1) continue;

    const date = Number(cells[dateIndex]);

    if (date < 1 || date > 31) continue;

    const timeValues = [];

    for (let i = dateIndex + 1; i < cells.length; i++) {
      const time = normalizeTime(cells[i]);

      if (time) {
        timeValues.push(time);
      }
    }

    if (timeValues.length < 5) continue;

    while (timeValues.length < 8) {
      timeValues.push("-");
    }

    rows.push({
      tanggal: String(date),
      imsyak: timeValues[0] || "-",
      shubuh: timeValues[1] || "-",
      terbit: timeValues[2] || "-",
      dhuha: timeValues[3] || "-",
      dzuhur: timeValues[4] || "-",
      ashr: timeValues[5] || "-",
      maghrib: timeValues[6] || "-",
      isya: timeValues[7] || "-",
      isToday: false
    });
  }

  const unique = new Map();

  for (const row of rows) {
    if (!unique.has(row.tanggal)) {
      unique.set(row.tanggal, row);
    }
  }

  return [...unique.values()].sort(
    (a, b) => Number(a.tanggal) - Number(b.tanggal)
  );
}

function extractCityInfo(html, fallbackCity) {
  const text = stripHtml(html);

  let cityName = fallbackCity;
  let timezone = "GMT +7";

  const titlePatterns = [
    /Jadwal\s+Sholat\s+(?:untuk\s+)?(.+?)(?:\s*\||\s*,|\s+-)\s*(GMT\s*[+-]\s*\d+)/i,
    /Jadwal\s+Sholat\s+(?:untuk\s+)?([A-Za-zÀ-ÿ0-9 .'-]+?)\s+(GMT\s*[+-]\s*\d+)/i
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);

    if (match) {
      cityName = match[1].trim();
      timezone = match[2].replace(/\s+/g, " ").trim();
      break;
    }
  }

  return {
    name: cityName,
    timezone
  };
}

function extractQibla(html) {
  const text = stripHtml(html);

  const result = {
    direction: "",
    distance: ""
  };

  const directionPatterns = [
    /arah\s+kiblat\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*°/i,
    /kiblat\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*°/i,
    /direction\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*°/i
  ];

  for (const pattern of directionPatterns) {
    const match = text.match(pattern);

    if (match) {
      result.direction = `${match[1]}°`;
      break;
    }
  }

  const distancePatterns = [
    /jarak\s+(?:ke\s+)?(?:mekah|makkah|ka'bah|kabah)\s*[:\-]?\s*([0-9.,]+)\s*km/i,
    /distance\s*[:\-]?\s*([0-9.,]+)\s*km/i
  ];

  for (const pattern of distancePatterns) {
    const match = text.match(pattern);

    if (match) {
      result.distance = `${match[1]} km`;
      break;
    }
  }

  return result;
}

async function getMonthlySchedule(cityQuery, month, year) {
  const city = await resolveCity(cityQuery);
  const current = getTodayDate();

  month = Number(month) || current.month;
  year = Number(year) || current.year;

  if (month < 1 || month > 12) {
    throw new Error("Bulan harus 1 sampai 12.");
  }

  if (year < 2000 || year > 2100) {
    throw new Error("Tahun tidak valid.");
  }

  const urls = [
    `${MONTHLY_URL}?id=${city.id}&m=${month}&type=2&y=${year}`,
    `${MONTHLY_URL}?id=${city.id}&m=${month}&y=${year}`,
    `${MONTHLY_URL}?id=${city.id}&month=${month}&year=${year}`
  ];

  let html = "";
  let lastError = null;

  for (const url of urls) {
    try {
      const result = await fetchHtml(url);

      if (result && result.length > 1000) {
        html = result;

        if (extractTableRows(html).length) {
          break;
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!html) {
    throw lastError || new Error("Halaman jadwal tidak dapat diakses.");
  }

  const data = extractTableRows(html);

  if (!data.length) {
    throw new Error("Tabel jadwal sholat tidak ditemukan.");
  }

  const cityInfo = extractCityInfo(html, city.name);
  const qibla = extractQibla(html);

  for (const item of data) {
    item.isToday =
      Number(item.tanggal) === current.day &&
      month === current.month &&
      year === current.year;
  }

  return {
    city: {
      id: city.id,
      name: cityInfo.name || city.name,
      timezone: cityInfo.timezone || "GMT +7"
    },
    period: {
      month,
      monthName: MONTH_NAMES[month],
      year
    },
    qibla,
    data
  };
}

async function getTodaySchedule(cityQuery) {
  const current = getTodayDate();

  const result = await getMonthlySchedule(
    cityQuery,
    current.month,
    current.year
  );

  const today = result.data.find(
    item => Number(item.tanggal) === current.day
  );

  if (!today) {
    throw new Error(
      `Data tanggal ${current.day} ${MONTH_NAMES[current.month]} ${current.year} tidak tersedia.`
    );
  }

  today.isToday = true;

  return {
    city: result.city,
    date: `${current.day} ${MONTH_NAMES[current.month]} ${current.year}`,
    qibla: result.qibla,
    schedule: today
  };
}

function formatToday(result) {
  const s = result.schedule;
  const q = result.qibla;

  return [
    "┌─「 🕌 JADWAL SHOLAT 」",
    `│ 📍 Kota : ${result.city.name}`,
    `│ 🌐 Zona : ${result.city.timezone}`,
    `│ 📅 Tanggal : ${result.date}`,
    "├────────────────────",
    `│ 🌙 Imsyak  : ${s.imsyak || "-"}`,
    `│ 🌅 Shubuh  : ${s.shubuh || "-"}`,
    `│ ☀️ Terbit  : ${s.terbit || "-"}`,
    `│ 🌤️ Dhuha   : ${s.dhuha || "-"}`,
    `│ ☀️ Dzuhur  : ${s.dzuhur || "-"}`,
    `│ 🌇 Ashr    : ${s.ashr || "-"}`,
    `│ 🌆 Maghrib : ${s.maghrib || "-"}`,
    `│ 🌙 Isya    : ${s.isya || "-"}`,
    "├────────────────────",
    `│ 🧭 Arah Kiblat : ${q.direction || "-"}`,
    `│ 📏 Jarak Mekah : ${q.distance || "-"}`,
    "└────────────────────",
    "",
    "❀ NIWO BOT ❀"
  ].join("\n");
}

function formatSearch(results) {
  if (!results.length) {
    return "❌ Kota tidak ditemukan.";
  }

  const lines = [
    "┌─「 🔎 HASIL PENCARIAN 」",
    ""
  ];

  results.slice(0, 20).forEach((city, index) => {
    lines.push(`${index + 1}. ${city.name}`);
    lines.push(`   ID: ${city.id}`);
  });

  lines.push("");
  lines.push("Gunakan:");
  lines.push(".jadwalsholat Nama Kota");
  lines.push("└────────────────────");

  return lines.join("\n");
}

function formatMonthly(result) {
  if (!result.data.length) {
    return "❌ Data jadwal bulan tersebut kosong.";
  }

  const lines = [
    "┌─「 🕌 JADWAL SHOLAT BULANAN 」",
    `│ 📍 ${result.city.name}`,
    `│ 📅 ${result.period.monthName} ${result.period.year}`,
    "├────────────────────",
    "│ TGL | Subuh | Dzuhur | Ashr | Maghrib | Isya",
    "├────────────────────"
  ];

  for (const item of result.data) {
    lines.push(
      `│ ${String(item.tanggal).padStart(2, "0")} | ${item.shubuh} | ${item.dzuhur} | ${item.ashr} | ${item.maghrib} | ${item.isya}`
    );
  }

  lines.push("└────────────────────");

  return lines.join("\n");
}

async function handler(m, { sock }) {
  const args = Array.isArray(m.args)
    ? m.args
    : String(m.text || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

  const first = String(args[0] || "").toLowerCase();

  try {
    if (first === "cari" || first === "search") {
      const query = args.slice(1).join(" ").trim();

      if (!query) {
        return m.reply(
          "❌ Masukkan nama kota.\n\nContoh:\n.jadwalsholat cari Pringsewu"
        );
      }

      await m.reply("🔎 Mencari kota...");

      const results = await searchCities(query);

      return m.reply(formatSearch(results));
    }

    if (first === "bulan" || first === "monthly") {
      const city = args.slice(1).filter(Boolean).join(" ") || "Jakarta Pusat";
      const current = getTodayDate();

      let month = current.month;
      let year = current.year;

      const numericArgs = args.slice(1).filter(x => /^\d+$/.test(x));

      if (numericArgs.length >= 1) {
        month = Number(numericArgs[0]);
      }

      if (numericArgs.length >= 2) {
        year = Number(numericArgs[1]);
      }

      const cityParts = args.slice(1).filter(
        x => !/^\d+$/.test(x)
      );

      const selectedCity =
        cityParts.join(" ").trim() || "Jakarta Pusat";

      await m.reply("⏳ Mengambil jadwal bulanan...");

      const result = await getMonthlySchedule(
        selectedCity,
        month,
        year
      );

      return m.reply(formatMonthly(result));
    }

    const city = args.join(" ").trim() || "Jakarta Pusat";

    await m.reply("⏳ Mengambil jadwal sholat hari ini...");

    const result = await getTodaySchedule(city);

    return m.reply(formatToday(result));
  } catch (error) {
    console.error("[jadwalsholat]", error);

    return m.reply(
      [
        "❌ Gagal mengambil jadwal sholat.",
        "",
        `Detail: ${error?.message || "Unknown error"}`,
        "",
        "Contoh:",
        ".jadwalsholat Jakarta Pusat",
        ".jadwalsholat Pringsewu"
      ].join("\n")
    );
  }
}

export default {
  config,
  handler
};
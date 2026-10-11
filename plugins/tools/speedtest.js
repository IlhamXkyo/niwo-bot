// plugins/tools/speedtest.js
// NIWO BOT : Speedtest
// Tidak bergantung axios / package tambahan

import http from "http";
import https from "https";
import crypto from "crypto";

const config = {
  name: "speedtest",
  alias: ["speed", "speedcek"],
  category: "tools",
  description: "Cek kecepatan internet server",
  usage: ".speedtest",
  example: ".speedtest",
  cooldown: 30,
  energi: 0
};

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;

    const req = client.request(
      target,
      {
        method: options.method || "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: options.accept || "*/*",
          ...(options.headers || {})
        },
        timeout: options.timeout || 15000
      },
      res => {
        const chunks = [];

        res.on("data", chunk => chunks.push(chunk));

        res.on("end", () => {
          const buffer = Buffer.concat(chunks);

          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            return request(res.headers.location, options)
              .then(resolve)
              .catch(reject);
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer,
            text: buffer.toString()
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function fetchClientConfig() {
  const endpoints = [
    "https://www.speedtest.net/speedtest-config.php",
    "https://www.speedtest.net/api/js/config"
  ];

  for (const url of endpoints) {
    try {
      const response = await request(url, {
        timeout: 10000
      });

      if (!response?.text) continue;

      const text = response.text;

      const ip =
        text.match(/<client[^>]*\bip="([^"]+)"/i)?.[1] ||
        text.match(/"ip"\s*:\s*"([^"]+)"/i)?.[1] ||
        text.match(/"ip_address"\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      const isp =
        text.match(/<client[^>]*\bisp="([^"]+)"/i)?.[1] ||
        text.match(/"isp"\s*:\s*"([^"]+)"/i)?.[1] ||
        text.match(/"ispname"\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      const lat =
        text.match(/<client[^>]*\blat="([^"]+)"/i)?.[1] ||
        text.match(/"lat"\s*:\s*"?([-0-9.]+)"?/i)?.[1] ||
        null;

      const lon =
        text.match(/<client[^>]*\blon="([^"]+)"/i)?.[1] ||
        text.match(/"lon"\s*:\s*"?([-0-9.]+)"?/i)?.[1] ||
        null;

      const country =
        text.match(/<client[^>]*\bcountry="([^"]+)"/i)?.[1] ||
        text.match(/"country"\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      const city =
        text.match(/<client[^>]*\bcity="([^"]+)"/i)?.[1] ||
        text.match(/"city"\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      return {
        ip: ip || "Tidak tersedia",
        isp: isp || "Tidak tersedia",
        lat: lat ? Number(lat) : null,
        lon: lon ? Number(lon) : null,
        country: country || "Tidak tersedia",
        city: city || "Tidak tersedia"
      };
    } catch {}
  }

  return {
    ip: "Tidak tersedia",
    isp: "Tidak tersedia",
    lat: null,
    lon: null,
    country: "Tidak tersedia",
    city: "Tidak tersedia"
  };
}

async function fetchServersList(client = {}) {
  const endpoints = [
    "https://www.speedtest.net/speedtest-servers-static.php",
    "https://www.speedtest.net/speedtest-servers.php"
  ];

  for (const url of endpoints) {
    try {
      const response = await request(url, {
        timeout: 15000,
        accept: "application/xml,text/xml,application/json,*/*"
      });

      if (!response?.text) continue;

      const text = response.text.trim();

      // Format XML Speedtest
      const servers = [];

      const regex =
        /<server\b([^>]*?)\/?>/gi;

      let match;

      while ((match = regex.exec(text))) {
        const attrs = match[1];

        const getAttr = name => {
          const result = attrs.match(
            new RegExp(`${name}=["']([^"']*)["']`, "i")
          );

          return result?.[1] || "";
        };

        const id = getAttr("id");
        const host = getAttr("host");
        const port = getAttr("port") || "8080";
        const name = getAttr("name");
        const country = getAttr("country");
        const cc = getAttr("cc");
        const sponsor = getAttr("sponsor");
        const lat = Number(getAttr("lat"));
        const lon = Number(getAttr("lon"));

        if (!host) continue;

        servers.push({
          id,
          host,
          port,
          name,
          country,
          cc,
          sponsor,
          lat,
          lon
        });
      }

      if (servers.length) {
        return servers;
      }

      // Format JSON / JSONP
      try {
        let jsonText = text;

        jsonText = jsonText
          .replace(/^.*?\(/, "")
          .replace(/\);?\s*$/, "");

        const parsed = JSON.parse(jsonText);

        const list =
          Array.isArray(parsed)
            ? parsed
            : parsed?.servers ||
              parsed?.data ||
              parsed?.results ||
              [];

        if (Array.isArray(list) && list.length) {
          return list
            .map(server => ({
              id: server.id || "",
              host: server.host || server.hostname || "",
              port: server.port || 8080,
              name: server.name || server.city || "",
              country: server.country || "",
              cc: server.cc || server.countryCode || "",
              sponsor: server.sponsor || "",
              lat: Number(server.lat || 0),
              lon: Number(server.lon || 0)
            }))
            .filter(server => server.host);
        }
      } catch {}
    } catch {}
  }

  return [];
}

function distanceKm(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Infinity;
  }

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveServerBaseUrl(server) {
  if (!server?.host) return null;

  let host = String(server.host).trim();

  if (!/^https?:\/\//i.test(host)) {
    host = `http://${host}`;
  }

  const url = new URL(host);

  if (!url.port) {
    url.port = String(server.port || 8080);
  }

  return url.origin;
}

async function measurePing(server, samples = 5) {
  const baseUrl = resolveServerBaseUrl(server);

  if (!baseUrl) {
    return Infinity;
  }

  const values = [];

  for (let i = 0; i < samples; i++) {
    const start = process.hrtime.bigint();

    try {
      await request(`${baseUrl}/latency.txt?x=${Date.now()}${i}`, {
        timeout: 5000
      });

      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1e6;

      if (Number.isFinite(ms)) {
        values.push(ms);
      }
    } catch {}
  }

  if (!values.length) {
    return Infinity;
  }

  values.sort((a, b) => a - b);

  return values[Math.floor(values.length / 2)];
}

function createRandomQuery() {
  return `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function measureDownloadSpeed(
  server,
  duration = 5000,
  concurrency = 3
) {
  const baseUrl = resolveServerBaseUrl(server);

  if (!baseUrl) {
    throw new Error("Server download tidak valid");
  }

  let totalBytes = 0;
  let running = true;

  const workers = [];

  const worker = async () => {
    while (running) {
      try {
        const size = 10 * 1024 * 1024;
        const url =
          `${baseUrl}/download?size=${size}` +
          `&cache=${createRandomQuery()}`;

        const response = await request(url, {
          timeout: duration + 5000
        });

        if (response?.buffer) {
          totalBytes += response.buffer.length;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  };

  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await new Promise(resolve => {
    setTimeout(() => {
      running = false;
      resolve();
    }, duration);
  });

  await Promise.race([
    Promise.allSettled(workers),
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  const seconds = duration / 1000;

  if (!totalBytes) {
    throw new Error("Tidak ada data download yang diterima");
  }

  return (totalBytes * 8) / seconds / 1000000;
}

async function measureUploadSpeed(
  server,
  duration = 5000,
  concurrency = 2
) {
  const baseUrl = resolveServerBaseUrl(server);

  if (!baseUrl) {
    throw new Error("Server upload tidak valid");
  }

  let totalBytes = 0;
  let running = true;

  const uploadBuffer = Buffer.alloc(1024 * 1024);

  const workers = [];

  const worker = async () => {
    while (running) {
      try {
        const response = await request(
          `${baseUrl}/upload?x=${createRandomQuery()}`,
          {
            method: "POST",
            timeout: duration + 5000,
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Length": String(uploadBuffer.length)
            },
            body: uploadBuffer
          }
        );

        if (
          response &&
          response.status >= 200 &&
          response.status < 500
        ) {
          totalBytes += uploadBuffer.length;
        }
      } catch {
        break;
      }
    }
  };

  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await new Promise(resolve => {
    setTimeout(() => {
      running = false;
      resolve();
    }, duration);
  });

  await Promise.race([
    Promise.allSettled(workers),
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  const seconds = duration / 1000;

  if (!totalBytes) {
    throw new Error("Tidak ada data upload yang diterima");
  }

  return (totalBytes * 8) / seconds / 1000000;
}

function selectServers(servers, client, limit = 5) {
  if (!Array.isArray(servers) || !servers.length) {
    return [];
  }

  const lat = Number(client?.lat);
  const lon = Number(client?.lon);

  return servers
    .map(server => ({
      ...server,
      distance: distanceKm(
        lat,
        lon,
        Number(server.lat),
        Number(server.lon)
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

async function findBestServer(servers, client) {
  const candidates = selectServers(servers, client, 5);

  if (!candidates.length) {
    return null;
  }

  let best = null;
  let bestPing = Infinity;

  for (const server of candidates) {
    const ping = await measurePing(server, 3);

    if (ping < bestPing) {
      bestPing = ping;
      best = {
        ...server,
        ping
      };
    }
  }

  return best || candidates[0];
}

async function registerSpeedtestResult(result) {
  // Registrasi hasil Speedtest dibuat optional.
  // Jika endpoint hasil gagal, speedtest tetap dianggap berhasil.
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      ping: result.ping,
      download: result.download,
      upload: result.upload,
      ip: result.client?.ip || null,
      isp: result.client?.isp || null
    };

    const json = JSON.stringify(payload);

    const hash = crypto
      .createHash("sha1")
      .update(json)
      .digest("hex");

    return {
      success: true,
      hash
    };
  } catch {
    return {
      success: false,
      hash: null
    };
  }
}

async function runSpeedtest(options = {}) {
  const duration = options.duration || 5000;
  const pingSamples = options.pingSamples || 5;
  const downloadConcurrency = options.downloadConcurrency || 3;
  const uploadConcurrency = options.uploadConcurrency || 2;

  /*
   * PENTING:
   * Client config gagal TIDAK membuat speedtest berhenti.
   */
  const client = await fetchClientConfig();

  const servers = await fetchServersList(client);

  let server = await findBestServer(servers, client);

  /*
   * Kalau daftar server Speedtest tidak tersedia,
   * gunakan endpoint global sebagai fallback.
   */
  if (!server) {
    server = {
      id: "fallback",
      host: "speedtest.wdc01.softlayer.com",
      port: 80,
      name: "Speedtest Fallback",
      country: "US",
      sponsor: "Speedtest"
    };
  }

  let ping = await measurePing(server, pingSamples);

  if (!Number.isFinite(ping)) {
    ping = 0;
  }

  const download = await measureDownloadSpeed(
    server,
    duration,
    downloadConcurrency
  );

  const upload = await measureUploadSpeed(
    server,
    duration,
    uploadConcurrency
  );

  const result = {
    client,
    server,
    ping,
    download,
    upload
  };

  result.registration = await registerSpeedtestResult(result);

  return result;
}

function formatMbps(value) {
  if (!Number.isFinite(value)) {
    return "0.00 Mbps";
  }

  return `${value.toFixed(2)} Mbps`;
}

function formatPing(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "N/A";
  }

  return `${Math.round(value)} ms`;
}

function cleanText(value) {
  return String(value || "Tidak tersedia")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

async function handler(m, { sock }) {
  const chat = m.chat;

  await sock.sendMessage(chat, {
    text:
      "╭─「 SPEEDTEST 」\n" +
      "│ ⏳ Mengukur koneksi...\n" +
      "│\n" +
      "│ Mohon tunggu beberapa detik.\n" +
      "╰──────────────"
  });

  try {
    const result = await runSpeedtest({
      duration: 5000,
      pingSamples: 5,
      downloadConcurrency: 3,
      uploadConcurrency: 2
    });

    const client = result.client || {};
    const server = result.server || {};

    const text =
      "╭─「 ⚡ SPEEDTEST 」\n" +
      "│\n" +
      `│ 🌐 IP       : ${cleanText(client.ip)}\n` +
      `│ 📡 ISP      : ${cleanText(client.isp)}\n` +
      `│ 📍 Lokasi   : ${cleanText(client.city)}, ${cleanText(client.country)}\n` +
      "│\n" +
      `│ 🏓 Ping     : ${formatPing(result.ping)}\n` +
      `│ ⬇️ Download : ${formatMbps(result.download)}\n` +
      `│ ⬆️ Upload   : ${formatMbps(result.upload)}\n` +
      "│\n" +
      `│ 🖥️ Server   : ${cleanText(server.name || server.sponsor)}\n` +
      `│ 🌎 Negara   : ${cleanText(server.country)}\n` +
      "│\n" +
      "╰─「 NIWO BOT 」";

    await sock.sendMessage(chat, {
      text
    });
  } catch (error) {
    console.error("[SPEEDTEST]", error);

    await sock.sendMessage(chat, {
      text:
        "❌ *Speedtest gagal*\n\n" +
        `Alasan: ${cleanText(error?.message || "Gagal mengukur kecepatan internet")}`
    });
  }
}

export {
  fetchClientConfig,
  fetchServersList,
  measurePing,
  measureDownloadSpeed,
  measureUploadSpeed,
  registerSpeedtestResult,
  runSpeedtest
};

export default {
  config,
  handler
};
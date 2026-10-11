import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const config = {
  name: "rednote",
  alias: ["xiaohongshu", "xhs", "rednotedl"],
  category: "downloader",
  description: "Download video atau foto dari RedNote/Xiaohongshu",
  usage: ".rednote <url>",
  example: ".rednote https://www.xiaohongshu.com/...",
  cooldown: 10,
  energi: 1
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SID_FILE = path.join(__dirname, ".rednote_sid.txt");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const BASE = "https://dy.kukutool.com";
const PAGE = "/rednote-downloader";
const RESP_KEY = "12345678901234567890123456789013";

const hdr = {
  "Content-Type": "application/json",
  "User-Agent": UA,
  Origin: BASE,
  Referer: BASE + PAGE,
  Accept: "*/*",
  Cookie: "NEXT_LOCALE=en"
};

function loadSid() {
  try {
    return fs.readFileSync(SID_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

function saveSid(sid) {
  if (!sid) return;
  try {
    fs.writeFileSync(SID_FILE, sid);
  } catch {}
}

function mapB64(e) {
  return e.split("").map(c => {
    const t = "ZYXABCDEFGHIJKLMNOPQRSTUVWzyxabcdefghijklmnopqrstuvw9876543210-_".indexOf(c);
    return t === -1
      ? c
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[t];
  }).join("");
}

function revBlocks(e, size = 8) {
  let r = "";
  for (let i = 0; i < e.length; i += size) {
    r += e.slice(i, i + size).split("").reverse().join("");
  }
  return r;
}

function xorEach(e, n = 90) {
  let r = "";
  for (let i = 0; i < e.length; i++) {
    r += String.fromCharCode(e.charCodeAt(i) ^ n);
  }
  return r;
}

function decryptResponse(data, iv) {
  let d = xorEach(data);
  let p = xorEach(iv);

  d = revBlocks(d);
  p = revBlocks(p);

  d = mapB64(d);
  p = mapB64(p);

  const key = crypto
    .createHash("sha256")
    .update(RESP_KEY)
    .digest();

  const dec = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    Buffer.from(p, "base64")
  );

  const out = Buffer.concat([
    dec.update(Buffer.from(d, "base64")),
    dec.final()
  ]);

  return JSON.parse(out.toString("utf8"));
}

async function buildPayload(plaintext, authKey, authSeed) {
  const iv = crypto.randomBytes(12);

  const key = crypto
    .createHash("sha256")
    .update(`${authKey}:${authSeed}`)
    .digest();

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag()
  ]);

  return {
    payload: ct.toString("base64"),
    iv: iv.toString("base64")
  };
}

async function getAuthTicket(rawInput) {
  const sid = loadSid();

  const res = await fetch(
    BASE + "/api/auth-970b03",
    {
      method: "POST",
      headers: {
        ...hdr,
        Cookie: sid
          ? hdr.Cookie + "; " + sid
          : hdr.Cookie
      },
      body: JSON.stringify({
        requestURL: rawInput,
        pagePath: PAGE,
        mode: "single"
      }),
      signal: AbortSignal.timeout(30000)
    }
  );

  if (!res.ok) {
    throw new Error(
      `Auth HTTP ${res.status}`
    );
  }

  const data = await res.json();

  if (!data?.k_970b03 || !data?.s_970b03) {
    throw new Error(
      "Auth ticket kosong: " +
      JSON.stringify(data).slice(0, 300)
    );
  }

  let fresh = "";

  try {
    if (typeof res.headers.getSetCookie === "function") {
      fresh = res.headers
        .getSetCookie()
        .map(c => c.split(";")[0])
        .find(c => c.startsWith("parse_sid=")) || "";
    }
  } catch {}

  if (fresh) {
    saveSid(fresh);
  }

  return {
    authKey: data.k_970b03,
    authSeed: data.s_970b03,
    parseSid: fresh || sid
  };
}

async function parseWithTicket(
  rawInput,
  ticket,
  parseSid
) {
  const plaintext = JSON.stringify({
    requestURL: rawInput,
    captchaKey: "",
    captchaInput: "",
    totalSuccessCount: "0",
    successCount: "0",
    firstSuccessDate: "",
    pagePath: PAGE,
    isMobile: "false",
    geoipIp: "",
    confirmPurchased: false,
    country_code: null
  });

  const {
    payload,
    iv
  } = await buildPayload(
    plaintext,
    ticket.authKey,
    ticket.authSeed
  );

  const res = await fetch(
    BASE + "/api/parse",
    {
      method: "POST",
      headers: {
        ...hdr,
        Cookie:
          hdr.Cookie +
          (parseSid
            ? "; " + parseSid
            : "")
      },
      body: JSON.stringify({
        version: 3,
        k_970b03: ticket.authKey,
        p_970b03: payload,
        r_970b03: 1,
        i_970b03: iv
      }),
      signal: AbortSignal.timeout(45000)
    }
  );

  if (!res.ok) {
    throw new Error(
      `Parse HTTP ${res.status}`
    );
  }

  return res.json();
}

async function attempt(rawInput) {
  const ticket =
    await getAuthTicket(rawInput);

  const res =
    await parseWithTicket(
      rawInput,
      ticket,
      ticket.parseSid
    );

  const data =
    res?.encrypt &&
    res?.data &&
    res?.iv
      ? decryptResponse(
          res.data,
          res.iv
        )
      : res;

  if (
    res?.status !== 0 ||
    !data
  ) {
    return {
      ok: false,
      code: res?.status ?? 200,
      message:
        res?.message || ""
    };
  }

  const links = [];

  if (data.type === "video") {
    const vids =
      data.videos?.[0]?.video_fullinfo?.length
        ? data.videos[0].video_fullinfo
        : [
            {
              url:
                data.url ||
                data.videos?.[0]?.url
            }
          ];

    for (const v of vids) {
      if (!v?.url) continue;

      links.push({
        type: "video",
        quality: v.type || "",
        size: v.size ?? 0,
        url: v.url
      });
    }
  } else {
    for (const p of data.pics || []) {
      if (!p) continue;

      links.push({
        type: "picture",
        quality: "",
        size: 0,
        url: p
      });
    }
  }

  if (!links.length) {
    return {
      ok: false,
      code: 200,
      message: "links kosong"
    };
  }

  return {
    ok: true,
    result: {
      title: data.title ?? "",
      type: data.type ?? "",
      cover: data.cover ?? "",
      links
    }
  };
}

async function run(rawInput) {
  rawInput = String(rawInput || "").trim();

  if (!/https?:\/\/\S+/i.test(rawInput)) {
    return {
      status: false,
      code: 400,
      input: rawInput || null,
      result: null
    };
  }

  for (let n = 1; n <= 2; n++) {
    try {
      const result =
        await attempt(rawInput);

      if (result.ok) {
        return {
          status: true,
          code: 200,
          input: rawInput,
          result: result.result
        };
      }

      if (n === 2) {
        return {
          status: false,
          code: result.code,
          input: rawInput,
          message: result.message,
          result: null
        };
      }

      console.error(
        `[REDNOTE] Percobaan ${n} gagal: ${result.message}, retry...`
      );

      await new Promise(
        resolve =>
          setTimeout(resolve, 2000)
      );
    } catch (err) {
      if (n === 2) {
        console.error(
          "[REDNOTE]",
          err?.stack || err
        );

        return {
          status: false,
          code: 500,
          input: rawInput,
          message:
            err?.message || "Request gagal",
          result: null
        };
      }

      console.error(
        `[REDNOTE] Percobaan ${n} error: ${err?.message}, retry...`
      );

      await new Promise(
        resolve =>
          setTimeout(resolve, 2000)
      );
    }
  }

  return {
    status: false,
    code: 500,
    input: rawInput,
    result: null
  };
}

function getCommandText(m) {
  return String(
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    ""
  ).trim();
}

function getUrl(m) {
  const text =
    getCommandText(m);

  if (!text) return "";

  const match =
    text.match(
      /https?:\/\/[^\s]+/i
    );

  return match
    ? match[0].replace(
        /[)>.,]+$/,
        ""
      )
    : "";
}

function formatSize(bytes) {
  const n =
    Number(bytes) || 0;

  if (!n) return "";

  if (n >= 1024 * 1024) {
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  }

  if (n >= 1024) {
    return `${(n / 1024).toFixed(2)} KB`;
  }

  return `${n} B`;
}

async function sendVideo(
  sock,
  chat,
  url,
  caption,
  quoted
) {
  await sock.sendMessage(
    chat,
    {
      video: {
        url
      },
      caption,
      mimetype: "video/mp4"
    },
    {
      quoted
    }
  );
}

async function sendImage(
  sock,
  chat,
  url,
  caption,
  quoted
) {
  await sock.sendMessage(
    chat,
    {
      image: {
        url
      },
      caption
    },
    {
      quoted
    }
  );
}

async function handler(
  m,
  {
    sock
  } = {}
) {
  const url =
    getUrl(m);

  if (!url) {
    return m.reply(
      `❌ *URL RedNote tidak ditemukan.*\n\n` +
      `Contoh:\n` +
      `.rednote https://www.xiaohongshu.com/...`
    );
  }

  await m.react?.("⏳");

  try {
    const data =
      await run(url);

    if (
      !data?.status ||
      !data?.result?.links?.length
    ) {
      await m.react?.("❌");

      return m.reply(
        `❌ *Gagal mengambil media RedNote.*\n\n` +
        `${data?.message || "Link media tidak ditemukan."}`
      );
    }

    const result =
      data.result;

    const title =
      result.title ||
      "RedNote";

    const links =
      result.links;

    const caption =
      `*REDNOTE DOWNLOADER*\n\n` +
      `> *Judul:* ${title}\n` +
      `> *Tipe:* ${result.type || "-"}\n` +
      `> *Media:* ${links.length}\n\n` +
      `> *Source:* RedNote`;

    await m.react?.("📥");

    if (result.cover) {
      try {
        await sendImage(
          sock,
          m.chat,
          result.cover,
          caption,
          m
        );
      } catch (e) {
        console.error(
          "[REDNOTE COVER]",
          e?.message || e
        );
      }
    }

    for (
      let i = 0;
      i < links.length;
      i++
    ) {
      const item =
        links[i];

      const mediaCaption =
        links.length > 1
          ? `${caption}\n\n> *Media:* ${i + 1}/${links.length}` +
            (item.quality
              ? `\n> *Quality:* ${item.quality}`
              : "") +
            (item.size
              ? `\n> *Size:* ${formatSize(item.size)}`
              : "")
          : caption;

      try {
        if (
          item.type === "video"
        ) {
          await sendVideo(
            sock,
            m.chat,
            item.url,
            mediaCaption,
            m
          );
        } else {
          await sendImage(
            sock,
            m.chat,
            item.url,
            mediaCaption,
            m
          );
        }
      } catch (err) {
        console.error(
          "[REDNOTE SEND]",
          err?.stack || err
        );

        try {
          await m.reply(
            `⚠️ Media ${i + 1} gagal dikirim.\n\n` +
            `${item.url}`
          );
        } catch {}
      }

      if (
        i < links.length - 1
      ) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              800
            )
        );
      }
    }

    await m.react?.("✅");
  } catch (error) {
    console.error(
      "[REDNOTE]",
      error?.stack || error
    );

    await m.react?.("❌");

    return m.reply(
      `❌ *Terjadi kesalahan saat download RedNote.*\n\n` +
      `> ${error?.message || "Unknown error"}`
    );
  }
}

export {
  run
};

export default {
  config,
  handler
};
// plugins/owner/deploy.js
// NIWO BOT : DEPLOY HTML KE VERCEL

import axios from "axios";
import appConfig from "../../config.js";

const config = {
  name: "deploy",
  alias: ["vercel"],
  category: "owner",
  description: "Deploy HTML ke Vercel (reply code / file)",
  usage: ".deploy <namawebsite>",
  example: ".deploy mysite",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 60,
  energi: 1,
  isEnabled: true,
};

function getArgs(m) {
  if (Array.isArray(m?.args)) {
    return m.args.map(String).filter(Boolean);
  }

  const text = String(
    m?.text ||
    m?.body ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    ""
  ).trim();

  if (!text) return [];

  const prefix = String(m?.prefix || ".");
  const command = String(m?.command || "deploy");

  const regex = new RegExp(
    `^${escapeRegex(prefix)}${escapeRegex(command)}(?:\\s+|$)`,
    "i"
  );

  const cleaned = text.replace(regex, "").trim();

  return cleaned
    ? cleaned.split(/\s+/).filter(Boolean)
    : [];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanProjectName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function isHtml(content) {
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(
    String(content || "")
  );
}

function getVercelToken() {
  return (
    appConfig?.vercel?.token ||
    appConfig?.vercelToken ||
    process.env.VERCEL_TOKEN ||
    ""
  );
}

async function getQuotedHtml(m) {
  const quoted = m?.quoted;

  if (!quoted) return null;

  // Reply teks HTML
  const quotedText =
    quoted?.text ||
    quoted?.body ||
    quoted?.message?.conversation ||
    quoted?.message?.extendedTextMessage?.text;

  if (quotedText && isHtml(quotedText)) {
    return String(quotedText);
  }

  // Reply file HTML
  const mimetype = String(
    quoted?.mimetype ||
    quoted?.msg?.mimetype ||
    quoted?.message?.documentMessage?.mimetype ||
    ""
  ).toLowerCase();

  const filename = String(
    quoted?.filename ||
    quoted?.msg?.fileName ||
    quoted?.message?.documentMessage?.fileName ||
    ""
  ).toLowerCase();

  const isHtmlFile =
    mimetype === "text/html" ||
    filename.endsWith(".html") ||
    filename.endsWith(".htm");

  if (!isHtmlFile) {
    return null;
  }

  if (typeof quoted.download !== "function") {
    throw new Error("Method download() pada quoted tidak tersedia.");
  }

  const buffer = await quoted.download();

  if (!buffer) {
    throw new Error("Gagal mengunduh file HTML.");
  }

  return Buffer.from(buffer).toString("utf8");
}

async function handler(m, { sock }) {
  const args = getArgs(m);
  const inputName = args[0];

  if (!inputName) {
    return m.reply(
      `🚀 *DEPLOY*\n\n` +
      `> Masukkan nama website\n` +
      `> Reply kode HTML atau file .html\n\n` +
      `Contoh:\n` +
      `${m.prefix || "."}deploy mysite`
    );
  }

  const name = cleanProjectName(inputName);

  if (!name) {
    return m.reply("❌ Nama website tidak valid.");
  }

  if (!m?.quoted) {
    return m.reply(
      `❌ *HTML TIDAK DITEMUKAN*\n\n` +
      `> Reply pesan berisi HTML\n` +
      `> atau reply file .html`
    );
  }

  const token = getVercelToken();

  if (!token) {
    return m.reply(
      `❌ *VERCEL TOKEN BELUM DISET*\n\n` +
      `Tambahkan token Vercel pada config atau environment:\n\n` +
      `VERCEL_TOKEN=xxxx`
    );
  }

  await m.react("🚀").catch(() => {});

  try {
    const htmlContent = await getQuotedHtml(m);

    if (!htmlContent) {
      await m.react("❌").catch(() => {});

      return m.reply(
        `❌ *FORMAT TIDAK DIDUKUNG*\n\n` +
        `> Reply teks HTML\n` +
        `> atau file .html`
      );
    }

    if (!htmlContent.trim()) {
      await m.react("❌").catch(() => {});
      return m.reply("❌ File/kode HTML kosong.");
    }

    if (!isHtml(htmlContent)) {
      await m.react("❌").catch(() => {});

      return m.reply(
        `❌ *BUKAN HTML VALID*\n\n` +
        `> Pastikan kode memiliki struktur HTML seperti:\n` +
        `> <!DOCTYPE html>\n` +
        `> <html>\n` +
        `> <head>\n` +
        `> <body>`
      );
    }

    await m.reply(
      `⏳ *DEPLOYING...*\n\n` +
      `> 🌐 Project : *${name}*\n` +
      `> ☁️ Platform : *Vercel*\n` +
      `> 📄 Type : *Static HTML*\n\n` +
      `Mohon tunggu...`
    );

    const payload = {
      name,
      project: name,
      target: "production",

      files: [
        {
          file: "index.html",
          data: htmlContent,
        },
      ],

      projectSettings: {
        framework: null,
      },
    };

    const deployRes = await axios.post(
      "https://api.vercel.com/v13/deployments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
        validateStatus: () => true,
      }
    );

    if (
      deployRes.status < 200 ||
      deployRes.status >= 300
    ) {
      const apiError =
        deployRes?.data?.error?.message ||
        deployRes?.data?.message ||
        `HTTP ${deployRes.status}`;

      throw new Error(apiError);
    }

    const deployment = deployRes.data || {};

    /*
     * Vercel biasanya mengembalikan alias/URL
     * pada response deployment.
     */
    let domain =
      deployment?.alias?.[0] ||
      deployment?.url ||
      `${name}.vercel.app`;

    domain = String(domain)
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");

    /*
     * Coba ambil domain project.
     * Kalau gagal, tetap gunakan domain deployment.
     */
    try {
      const domainsRes = await axios.get(
        `https://api.vercel.com/v9/projects/${encodeURIComponent(
          name
        )}/domains`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
          validateStatus: () => true,
        }
      );

      if (
        domainsRes.status >= 200 &&
        domainsRes.status < 300
      ) {
        const domains = Array.isArray(
          domainsRes?.data?.domains
        )
          ? domainsRes.data.domains
          : [];

        const customDomain = domains.find(
          (d) =>
            d?.name &&
            !String(d.name).endsWith(".vercel.app")
        );

        const vercelDomain = domains.find(
          (d) =>
            d?.name &&
            String(d.name).endsWith(".vercel.app")
        );

        domain =
          customDomain?.name ||
          vercelDomain?.name ||
          domain;
      }
    } catch {
      // Pakai domain dari deployment.
    }

    /*
     * Jika response hanya memberi URL tanpa protocol.
     */
    const finalUrl = /^https?:\/\//i.test(domain)
      ? domain
      : `https://${domain}`;

    await m.react("✅").catch(() => {});

    return m.reply(
      `╭──「 *DEPLOY SUCCESS* 」\n` +
      `│\n` +
      `│ 🌐 Nama     : ${name}\n` +
      `│ ☁️ Platform : Vercel\n` +
      `│ 📄 Type     : Static HTML\n` +
      `│ ⚙️ Status   : Production\n` +
      `│\n` +
      `│ 🔗 URL\n` +
      `│ ${finalUrl}\n` +
      `│\n` +
      `╰────────────────`
    );
  } catch (error) {
    await m.react("❌").catch(() => {});

    const err =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      "Terjadi kesalahan saat deploy.";

    console.error(
      "[Deploy] Error:",
      error?.response?.data || error
    );

    return m.reply(
      `╭──「 *DEPLOY FAILED* 」\n` +
      `│\n` +
      `│ ❌ ${String(err).slice(0, 1000)}\n` +
      `│\n` +
      `╰────────────────`
    );
  }
}

export default {
  config,
  handler,
};
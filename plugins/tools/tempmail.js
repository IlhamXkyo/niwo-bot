// plugins/tools/tempmail.js

const config = {
  name: "tempmail",
  alias: ["tmpmail", "mailtemp", "tempemail"],
  category: "tools",
  description: "Generator email temporary dan pengecekan inbox via TempMail Plus",
  usage: ".tempmail [generate|inbox|read|delete|destroy|poll]",
  example: ".tempmail generate",
  isOwner: false,
  isPremium: false,
  cooldown: 5,
  energi: 0
};

const BASE_URL = "https://tempmail.plus";

const AVAILABLE_DOMAINS = [
  "mailto.plus",
  "fexpost.com",
  "fexbox.org",
  "mailbox.in.ua",
  "rover.info",
  "chitthi.in",
  "fextemp.com",
  "any.pink",
  "merepost.com"
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/`
};

function generateRandomName() {
  const len = 5 + Math.floor(Math.random() * 3);
  let word = "";
  const sets = ["aeouy", "bcdfghkmnpqstvwxz"];
  let type = Math.floor(Math.random() * 2);
  let prob = type ? 5 : 7;

  for (let i = 0; i < len; i++) {
    word += sets[type].charAt(
      Math.floor(Math.random() * sets[type].length)
    );

    if (Math.floor(Math.random() * prob) > 1) {
      type = 1 - type;
      prob = type ? 5 : 10;
    }
  }

  return word;
}

function generateEmail(username, domain = "mailto.plus") {
  const selectedDomain = AVAILABLE_DOMAINS.includes(domain)
    ? domain
    : AVAILABLE_DOMAINS[0];

  const pre =
    username &&
    /^[A-Za-z0-9]+([.\-_][A-Za-z0-9]+)*$/.test(username)
      ? username
      : generateRandomName();

  return {
    status: true,
    email: `${pre}@${selectedDomain}`,
    username: pre,
    domain: selectedDomain
  };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeout || 15000
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...HEADERS,
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Response tidak valid dari TempMail Plus (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.err?.msg || `HTTP Error ${response.status}`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getInbox(email, options = {}) {
  if (!email || typeof email !== "string") {
    throw new Error("Alamat email harus diisi.");
  }

  const params = new URLSearchParams();

  params.set("email", email.trim());
  params.set("limit", String(options.limit || 20));

  if (options.first_id) {
    params.set("first_id", String(options.first_id));
  }

  params.set("epin", options.epin || "");

  const data = await requestJson(
    `${BASE_URL}/api/mails?${params.toString()}`
  );

  if (!data || data.result === false) {
    throw new Error(
      data?.err?.msg || "Gagal mengambil kotak masuk email."
    );
  }

  const mailList = Array.isArray(data.mail_list)
    ? data.mail_list.map(mail => ({
        mail_id: mail.mail_id,
        from: mail.from_name
          ? `${mail.from_name} <${mail.from_mail}>`
          : mail.from_mail,
        from_mail: mail.from_mail,
        from_name: mail.from_name || "",
        subject: mail.subject || "",
        time: mail.time,
        is_new: Boolean(mail.is_new),
        attachments_count: mail.attachment_count || 0
      }))
    : [];

  return {
    status: true,
    email: email.trim(),
    count: mailList.length,
    first_id: data.first_id || null,
    last_id: data.last_id || null,
    has_more: Boolean(data.more),
    messages: mailList
  };
}

async function getMail(email, mailId, epin = "") {
  if (!email || !mailId) {
    throw new Error("Parameter email dan mail_id harus diisi.");
  }

  const params = new URLSearchParams();

  params.set("email", email.trim());
  params.set("epin", epin || "");

  const data = await requestJson(
    `${BASE_URL}/api/mails/${encodeURIComponent(mailId)}?${params.toString()}`
  );

  if (!data || data.result === false) {
    throw new Error(
      data?.err?.msg || "Gagal mengambil detail email."
    );
  }

  const attachments = Array.isArray(data.attachments)
    ? data.attachments.map(att => ({
        attachment_id: att.attachment_id,
        name: att.name,
        size: att.size,
        download_url:
          `${BASE_URL}/api/mails/${encodeURIComponent(mailId)}/attachments/` +
          `${encodeURIComponent(att.attachment_id)}` +
          `?email=${encodeURIComponent(email.trim())}` +
          `&epin=${encodeURIComponent(epin || "")}`
      }))
    : [];

  return {
    status: true,
    mail_id: data.mail_id || mailId,
    from: data.from || data.from_mail,
    from_mail: data.from_mail,
    from_name: data.from_name || "",
    to: data.to,
    subject: data.subject || "",
    date: data.date,
    is_tls: Boolean(data.is_tls),
    text: data.text || "",
    html: data.html || "",
    attachments_count: attachments.length,
    attachments
  };
}

async function deleteMail(email, mailId, epin = "") {
  if (!email || !mailId) {
    throw new Error("Parameter email dan mail_id harus diisi.");
  }

  const params = new URLSearchParams();

  params.set("email", email.trim());
  params.set("epin", epin || "");

  const data = await requestJson(
    `${BASE_URL}/api/mails/${encodeURIComponent(mailId)}?${params.toString()}`,
    {
      method: "DELETE"
    }
  );

  return {
    status: true,
    result: Boolean(data?.result)
  };
}

async function destroyInbox(email, firstId = "", epin = "") {
  if (!email) {
    throw new Error("Parameter email harus diisi.");
  }

  const params = new URLSearchParams();

  params.set("email", email.trim());
  params.set("first_id", firstId || "");
  params.set("epin", epin || "");

  const data = await requestJson(
    `${BASE_URL}/api/mails/?${params.toString()}`,
    {
      method: "DELETE"
    }
  );

  return {
    status: true,
    result: Boolean(data?.result)
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForMail(email, options = {}) {
  if (!email || typeof email !== "string") {
    throw new Error("Alamat email harus diisi.");
  }

  const timeoutMs = options.timeoutMs || 60000;
  const intervalMs = options.intervalMs || 3000;
  const autoRead = options.autoRead !== false;
  const epin = options.epin || "";

  const initialInbox = await getInbox(email, { epin });

  const knownIds = new Set(
    (initialInbox.messages || []).map(mail =>
      String(mail.mail_id)
    )
  );

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    await delay(intervalMs);

    try {
      const currentInbox = await getInbox(email, { epin });

      const newMessages = (currentInbox.messages || [])
        .filter(mail =>
          !knownIds.has(String(mail.mail_id))
        );

      if (newMessages.length > 0) {
        let fullMails = newMessages;

        if (autoRead) {
          fullMails = await Promise.all(
            newMessages.map(async mail => {
              try {
                return await getMail(
                  email,
                  mail.mail_id,
                  epin
                );
              } catch {
                return mail;
              }
            })
          );
        }

        return {
          status: true,
          email: email.trim(),
          new_count: fullMails.length,
          messages: fullMails,
          elapsed_sec: Number(
            ((Date.now() - startTime) / 1000).toFixed(1)
          )
        };
      }
    } catch {}
  }

  return {
    status: false,
    email: email.trim(),
    timeout: true,
    message:
      `Tidak ada email baru masuk setelah ${timeoutMs / 1000} detik.`,
    elapsed_sec: Number(
      ((Date.now() - startTime) / 1000).toFixed(1)
    )
  };
}

function formatMail(mail, index = 1) {
  return [
    `📩 *Email ${index}*`,
    ``,
    `🆔 ID : ${mail.mail_id}`,
    `👤 Dari : ${mail.from || "-"}`,
    `📌 Subject : ${mail.subject || "-"}`,
    `🕐 Waktu : ${mail.time || mail.date || "-"}`,
    `📎 Lampiran : ${mail.attachments_count || 0}`
  ].join("\n");
}

async function handler(m, { sock, config: botConfig }) {
  const args = m.args || [];
  const command = (args[0] || "generate").toLowerCase();

  try {
    if (command === "generate" || command === "buat") {
      const username = args[1];
      const domain = args[2];

      const result = generateEmail(username, domain);

      const text = [
        `📧 *TEMPMAIL PLUS*`,
        ``,
        `✉️ Email : *${result.email}*`,
        `👤 Username : ${result.username}`,
        `🌐 Domain : ${result.domain}`,
        ``,
        `Gunakan:`,
        `• .tempmail inbox ${result.email}`,
        `• .tempmail poll ${result.email}`,
        ``,
        `❀ NIWO BOT ❀`
      ].join("\n");

      return m.reply(text);
    }

    if (command === "inbox") {
      const email = args[1];

      if (!email) {
        return m.reply(
          `❌ Masukkan alamat email.\n\nContoh:\n.tempmail inbox nama@mailto.plus`
        );
      }

      const result = await getInbox(email);

      if (!result.messages.length) {
        return m.reply(
          `📭 Inbox kosong.\n\n📧 ${result.email}`
        );
      }

      const mails = result.messages
        .slice(0, 10)
        .map((mail, i) => formatMail(mail, i + 1))
        .join("\n\n");

      return m.reply(
        `📬 *INBOX TEMPMAIL*\n\n` +
        `📧 ${result.email}\n` +
        `📨 Total : ${result.count}\n\n` +
        `${mails}\n\n` +
        `Untuk membaca email:\n` +
        `.tempmail read ${result.email} <mail_id>`
      );
    }

    if (command === "read" || command === "baca") {
      const email = args[1];
      const mailId = args[2];

      if (!email || !mailId) {
        return m.reply(
          `❌ Format:\n.tempmail read <email> <mail_id>`
        );
      }

      const mail = await getMail(email, mailId);

      let text = [
        `📨 *DETAIL EMAIL*`,
        ``,
        `🆔 ID : ${mail.mail_id}`,
        `👤 Dari : ${mail.from || "-"}`,
        `📧 Kepada : ${mail.to || "-"}`,
        `📌 Subject : ${mail.subject || "-"}`,
        `🕐 Tanggal : ${mail.date || "-"}`,
        ``,
        `📝 *Isi Email:*`,
        mail.text || "(Tidak ada teks)"
      ].join("\n");

      if (mail.attachments_count > 0) {
        text += `\n\n📎 Lampiran : ${mail.attachments_count}`;

        for (const attachment of mail.attachments) {
          text += `\n• ${attachment.name || "file"}`;
        }
      }

      return m.reply(text);
    }

    if (command === "delete" || command === "hapus") {
      const email = args[1];
      const mailId = args[2];

      if (!email || !mailId) {
        return m.reply(
          `❌ Format:\n.tempmail delete <email> <mail_id>`
        );
      }

      const result = await deleteMail(email, mailId);

      return m.reply(
        result.result
          ? `✅ Email berhasil dihapus.`
          : `❌ Email gagal dihapus.`
      );
    }

    if (command === "destroy" || command === "clear") {
      const email = args[1];

      if (!email) {
        return m.reply(
          `❌ Masukkan alamat email.\n\nContoh:\n.tempmail destroy nama@mailto.plus`
        );
      }

      const result = await destroyInbox(email);

      return m.reply(
        result.result
          ? `✅ Inbox berhasil dibersihkan.\n\n📧 ${email}`
          : `❌ Inbox gagal dibersihkan.`
      );
    }

    if (command === "poll" || command === "wait") {
      const email = args[1];

      if (!email) {
        return m.reply(
          `❌ Masukkan alamat email.\n\nContoh:\n.tempmail poll nama@mailto.plus`
        );
      }

      const timeoutArg = args.find(arg =>
        arg.startsWith("--timeout=")
      );

      const timeoutSec = timeoutArg
        ? parseInt(timeoutArg.split("=")[1], 10)
        : 30;

      if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
        return m.reply(`❌ Timeout tidak valid.`);
      }

      await m.reply(
        `⏳ Menunggu email masuk...\n\n` +
        `📧 ${email}\n` +
        `⏱️ Timeout : ${timeoutSec} detik`
      );

      const result = await waitForMail(email, {
        timeoutMs: timeoutSec * 1000
      });

      if (!result.status) {
        return m.reply(
          `⌛ *TIMEOUT*\n\n` +
          `📧 ${result.email}\n` +
          `${result.message}`
        );
      }

      const mails = result.messages
        .map((mail, i) => formatMail(mail, i + 1))
        .join("\n\n");

      return m.reply(
        `📬 *EMAIL BARU MASUK!*\n\n` +
        `📧 ${result.email}\n` +
        `📨 Email baru : ${result.new_count}\n` +
        `⏱️ ${result.elapsed_sec} detik\n\n` +
        `${mails}`
      );
    }

    return m.reply(
      `📧 *TEMPMAIL PLUS*\n\n` +
      `• .tempmail generate\n` +
      `• .tempmail inbox <email>\n` +
      `• .tempmail read <email> <mail_id>\n` +
      `• .tempmail delete <email> <mail_id>\n` +
      `• .tempmail destroy <email>\n` +
      `• .tempmail poll <email> --timeout=30`
    );
  } catch (err) {
    console.error("[TEMPMAIL]", err);

    return m.reply(
      `❌ *TempMail Error*\n\n${err?.message || "Terjadi kesalahan."}`
    );
  }
}

export default {
  config,
  handler
};
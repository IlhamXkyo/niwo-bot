// plugins/owner/swgcv2all.js
// NIWO BOT : GROUP STATUS V2 ALL
// Baileys: @itsliaaa/baileys

import fileType from "file-type";
const fileTypeFromBuffer = fileType.fromBuffer || fileType;
import { generateWAMessage } from "@itsliaaa/baileys";

const config = {
  name: "swgcv2all",
  alias: ["statusgrupv2all"],
  category: "owner",
  description: "Post Group Status V2 ke semua grup",
  usage: ".swgcv2all <teks> atau reply media",
  example: ".swgcv2all Halo semua grup!",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true,
};

/**
 * Membuat raw message untuk Group Status V2.
 */
function buildSyntheticSwGcRawMessage(
  sock,
  remoteJid,
  innerMessage,
  messageId
) {
  const rawBotJid = String(sock?.user?.id || "").split(":")[0];

  const botJid = rawBotJid
    ? rawBotJid.includes("@")
      ? rawBotJid
      : `${rawBotJid}@s.whatsapp.net`
    : undefined;

  return {
    key: {
      remoteJid,
      fromMe: true,
      id: messageId,
      ...(botJid ? { participant: botJid } : {}),
    },
    message: {
      groupStatusMessageV2: {
        message: innerMessage,
      },
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Ambil text setelah command.
 */
function getCommandText(m) {
  const text = String(
    m?.text ??
      m?.body ??
      m?.message?.conversation ??
      m?.message?.extendedTextMessage?.text ??
      ""
  ).trim();

  if (!text) return "";

  const prefix = String(m?.prefix || ".");

  const commands = [
    "swgcv2all",
    "statusgrupv2all",
  ];

  for (const command of commands) {
    const regex = new RegExp(
      `^${escapeRegex(prefix)}${escapeRegex(command)}(?:\\s+|$)`,
      "i"
    );

    if (regex.test(text)) {
      return text.replace(regex, "").trim();
    }
  }

  // Fallback jika prefix dari Niwo berbeda.
  return text
    .replace(
      /^[.!#$%+/\\-](?:swgcv2all|statusgrupv2all)(?:\s+|$)/i,
      ""
    )
    .trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Download media dengan kompatibilitas beberapa bentuk message Niwo.
 */
async function downloadMedia(m) {
  try {
    if (m?.quoted?.isMedia && typeof m.quoted.download === "function") {
      return await m.quoted.download();
    }
  } catch {}

  try {
    if (m?.isMedia && typeof m.download === "function") {
      return await m.download();
    }
  } catch {}

  return null;
}

/**
 * Deteksi apakah pesan berupa media.
 */
function hasMedia(m) {
  return Boolean(
    m?.isMedia ||
      m?.quoted?.isMedia ||
      m?.message?.imageMessage ||
      m?.message?.videoMessage ||
      m?.message?.audioMessage ||
      m?.message?.stickerMessage
  );
}

/**
 * Tentukan apakah quoted audio merupakan PTT.
 */
function isPTT(m) {
  return Boolean(
    m?.quoted?.ptt ||
      m?.quoted?.message?.audioMessage?.ptt ||
      m?.message?.audioMessage?.ptt ||
      false
  );
}

/**
 * Delay sederhana supaya broadcast tidak terlalu burst.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Membuat inner message dari hasil generateWAMessage().
 */
function extractInnerMessage(genMsg, rawContent) {
  const message = genMsg?.message || {};

  /*
   * Text dari generateWAMessage biasanya berbentuk:
   * { conversation: "..." }
   */
  if (message.conversation) {
    return {
      conversation: message.conversation,
    };
  }

  /*
   * Extended text.
   */
  if (message.extendedTextMessage) {
    return {
      extendedTextMessage: message.extendedTextMessage,
    };
  }

  /*
   * Cari tipe message normal.
   */
  const ignored = new Set([
    "senderKeyDistributionMessage",
    "messageContextInfo",
    "protocolMessage",
    "ephemeralMessage",
  ]);

  const msgType = Object.keys(message).find((key) => {
    return (
      !ignored.has(key) &&
      key.endsWith("Message")
    );
  });

  if (msgType) {
    return {
      [msgType]: message[msgType],
    };
  }

  /*
   * Fallback langsung dari rawContent.
   * Ini terutama untuk kasus text.
   */
  if (rawContent?.text) {
    return {
      conversation: rawContent.text,
    };
  }

  return {};
}

/**
 * Tambahkan metadata Group Status V2.
 */
function addStatusContext(innerMessage, rawContent) {
  const type = Object.keys(innerMessage)[0];

  if (!type || !innerMessage[type]) {
    return innerMessage;
  }

  /*
   * Untuk conversation/extendedTextMessage,
   * contextInfo tidak selalu tersedia.
   */
  if (
    type === "conversation" ||
    type === "extendedTextMessage"
  ) {
    if (type === "extendedTextMessage") {
      innerMessage[type].contextInfo = {
        ...(innerMessage[type].contextInfo || {}),
        ...buildStatusContext(rawContent),
      };
    }

    return innerMessage;
  }

  const content = innerMessage[type];

  if (typeof content === "object") {
    content.contextInfo = {
      ...(content.contextInfo || {}),
      ...buildStatusContext(rawContent),
    };
  }

  return innerMessage;
}

function buildStatusContext(rawContent) {
  let statusSourceType = 4;

  if (rawContent?.audio) {
    statusSourceType = 3;
  } else if (rawContent?.video) {
    statusSourceType = 1;
  } else if (rawContent?.image) {
    statusSourceType = 0;
  } else if (rawContent?.text) {
    statusSourceType = 4;
  }

  return {
    isGroupStatus: true,

    statusSourceType,

    featureEligibilities: {
      canBeReshared: true,
      canBeSentToParticipants: true,
    },

    statusAttributions: [
      {
        type: 10,
      },
    ],

    statusAudienceMetadata: {
      audienceType: 1,
    },
  };
}

/**
 * Buat content yang akan diproses generateWAMessage().
 */
async function createRawContent(m, text) {
  if (!hasMedia(m)) {
    if (!text) return null;

    return {
      text,
    };
  }

  const buffer = await downloadMedia(m);

  if (!buffer) {
    throw new Error("Gagal mengunduh media.");
  }

  const detected = await fileTypeFromBuffer(buffer).catch(() => null);

  const mime =
    detected?.mime ||
    m?.quoted?.mimetype ||
    m?.mimetype ||
    "application/octet-stream";

  if (mime.startsWith("image/")) {
    return {
      image: buffer,
      caption: text || "",
    };
  }

  if (mime.startsWith("video/")) {
    return {
      video: buffer,
      caption: text || "",
    };
  }

  if (mime.startsWith("audio/")) {
    return {
      audio: buffer,
      mimetype: mime || "audio/mpeg",
      ptt: isPTT(m),
    };
  }

  throw new Error(
    `Format media tidak didukung.\nMIME: ${mime}`
  );
}

async function handler(m, { sock }) {
  const text = getCommandText(m);

  /*
   * Jika tidak ada teks/media, tampilkan bantuan.
   */
  if (!text && !hasMedia(m)) {
    return m.reply(
      `👋 *sᴡɢᴄᴠ2 ᴀʟʟ ɢʟᴏʙᴀʟ*\n\n` +
        `> Kirim pesan *Status Grup V2* ke SEMUA grup sekaligus.\n\n` +
        `╭┈┈⬡「 📋 *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ* 」\n` +
        `┃ ${m.prefix}swgcv2all Halo semua!\n` +
        `┃\n` +
        `┃ Reply gambar/video/audio\n` +
        `┃ dengan caption:\n` +
        `┃ ${m.prefix}swgcv2all\n` +
        `╰┈┈┈┈┈┈┈┈⬡`
    );
  }

  await m.react("🕕");

  try {
    /*
     * Buat content sekali.
     * Buffer bisa dipakai ulang untuk semua grup.
     */
    const rawContent = await createRawContent(m, text);

    if (!rawContent) {
      await m.react("❌");
      return m.reply("❌ Tidak ada konten yang bisa dikirim.");
    }

    /*
     * Ambil seluruh grup tempat bot berada.
     */
    const groups = await sock.groupFetchAllParticipating();

    const groupIds = Object.keys(groups || {}).filter((jid) =>
      jid.endsWith("@g.us")
    );

    if (groupIds.length === 0) {
      await m.react("❌");
      return m.reply("❌ Bot tidak berada di grup manapun.");
    }

    await m.reply(
      `⏳ *Memulai Broadcast Status Grup V2...*\n\n` +
        `> Target: *${groupIds.length} grup*\n` +
        `> Mohon tunggu sampai proses selesai.`
    );

    let successCount = 0;
    let failCount = 0;

    /*
     * Delay default 500ms antar grup.
     * Bisa diubah:
     * SWGCV2_DELAY=1000
     */
    const delayMs = Math.max(
      0,
      Number(process.env.SWGCV2_DELAY || 500)
    );

    for (let i = 0; i < groupIds.length; i++) {
      const targetGroupId = groupIds[i];

      try {
        /*
         * Buat content baru supaya generateWAMessage
         * tidak memodifikasi object yang sama.
         */
        let baseContent;

        if (rawContent.image) {
          baseContent = {
            image: rawContent.image,
            caption: rawContent.caption || "",
          };
        } else if (rawContent.video) {
          baseContent = {
            video: rawContent.video,
            caption: rawContent.caption || "",
          };
        } else if (rawContent.audio) {
          baseContent = {
            audio: rawContent.audio,
            mimetype: rawContent.mimetype || "audio/mpeg",
            ptt: Boolean(rawContent.ptt),
          };
        } else if (rawContent.text) {
          baseContent = {
            text: rawContent.text,
          };
        } else {
          throw new Error("Content kosong.");
        }

        /*
         * Generate message menggunakan Baileys fork
         * yang dipakai Niwo.
         */
        const genMsg = await generateWAMessage(
          targetGroupId,
          baseContent,
          {
            userJid: sock?.user?.id,
            upload: sock?.waUploadToServer,
          }
        );

        /*
         * Ambil message sebenarnya.
         */
        let innerMessage = extractInnerMessage(
          genMsg,
          rawContent
        );

        if (!Object.keys(innerMessage).length) {
          throw new Error("Inner message kosong.");
        }

        /*
         * Tambahkan metadata Group Status V2.
         */
        innerMessage = addStatusContext(
          innerMessage,
          rawContent
        );

        /*
         * Gunakan ID hasil generateWAMessage.
         * Kalau fork tidak memberikan ID, buat sendiri.
         */
        const messageId =
          genMsg?.key?.id ||
          `SWGCV2-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`;

        /*
         * Bungkus menjadi groupStatusMessageV2.
         */
        const finalMessage =
          buildSyntheticSwGcRawMessage(
            sock,
            targetGroupId,
            innerMessage,
            messageId
          );

        /*
         * Relay Group Status V2.
         */
        await sock.relayMessage(
          targetGroupId,
          finalMessage.message,
          {
            messageId,
          }
        );

        successCount++;

        /*
         * Jangan burst terlalu cepat.
         */
        if (delayMs > 0 && i < groupIds.length - 1) {
          await sleep(delayMs);
        }
      } catch (err) {
        failCount++;

        console.error(
          `[SwgcV2All] Gagal ${targetGroupId}:`,
          err?.message || err
        );

        /*
         * Lanjut ke grup berikutnya.
         */
        if (delayMs > 0 && i < groupIds.length - 1) {
          await sleep(delayMs);
        }
      }
    }

    await m.react(
      successCount > 0 ? "✅" : "❌"
    );

    await m.reply(
      `✅ *sᴡɢᴄᴠ2 ᴀʟʟ sᴇʟᴇsᴀɪ*\n\n` +
        `╭┈┈⬡「 📊 *ʀᴇsᴜʟᴛ* 」\n` +
        `┃ 🌐 Total Grup : *${groupIds.length}*\n` +
        `┃ ✅ Sukses     : *${successCount}*\n` +
        `┃ ❌ Gagal      : *${failCount}*\n` +
        `╰┈┈┈┈┈┈┈┈⬡\n\n` +
        `> Broadcast Status Grup V2 selesai diproses.`
    );
  } catch (error) {
    console.error(
      "[SwgcV2All] Error:",
      error?.stack || error
    );

    await m.react("❌").catch(() => {});

    await m.reply(
      `❌ *SW GC V2 ERROR*\n\n` +
        `> ${error?.message || "Terjadi kesalahan."}`
    );
  }
}

export default {
  config,
  handler,
};
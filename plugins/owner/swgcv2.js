import fs from "node:fs";
import path from "node:path";
import fileType from "file-type";
const fileTypeFromBuffer = fileType.fromBuffer || fileType;
import { generateWAMessageFromContent } from "@itsliaaa/baileys";
import { getAssetBuffer } from "../../src/lib/asset-manager.js";
import appConfig from "../../config.js";

const config = {
  name: "swgcv2",
  alias: ["statusgrupv2"],
  category: "owner",
  description: "Post Group Status V2 ke grup pilihan",
  usage: ".swgcv2 <teks> atau reply media",
  example: ".swgcv2 Halo semua!",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 0,
  isEnabled: true
};

const pendingSwgcV2 = new Map();

function getText(m) {
  return String(
    m?.text ??
    m?.body ??
    m?.message?.conversation ??
    m?.message?.extendedTextMessage?.text ??
    m?.message?.imageMessage?.caption ??
    m?.message?.videoMessage?.caption ??
    ""
  ).trim();
}

function getMime(m) {
  return String(
    m?.mimetype ??
    m?.msg?.mimetype ??
    m?.message?.imageMessage?.mimetype ??
    m?.message?.videoMessage?.mimetype ??
    m?.message?.audioMessage?.mimetype ??
    ""
  );
}

function isImage(m) {
  return Boolean(
    m?.isImage ||
    m?.imageMessage ||
    m?.msg?.imageMessage ||
    m?.message?.imageMessage ||
    /^image\//i.test(getMime(m))
  );
}

function isVideo(m) {
  return Boolean(
    m?.isVideo ||
    m?.videoMessage ||
    m?.msg?.videoMessage ||
    m?.message?.videoMessage ||
    /^video\//i.test(getMime(m))
  );
}

function isAudio(m) {
  return Boolean(
    m?.isAudio ||
    m?.audioMessage ||
    m?.msg?.audioMessage ||
    m?.message?.audioMessage ||
    /^audio\//i.test(getMime(m))
  );
}

async function downloadMedia(target) {
  if (!target) return null;

  if (typeof target.download === "function") {
    return await target.download();
  }

  if (
    target.msg &&
    typeof target.msg.download === "function"
  ) {
    return await target.msg.download();
  }

  return null;
}

function getBotJid(sock) {
  const id = String(
    sock?.user?.id ||
    sock?.user?.jid ||
    ""
  );

  const number = id
    .split(":")[0]
    .split("@")[0]
    .replace(/\D/g, "");

  return number
    ? `${number}@s.whatsapp.net`
    : "0@s.whatsapp.net";
}

function buildStatusContext(rawContent) {
  return {
    isGroupStatus: true,
    statusSourceType:
      rawContent.text
        ? 4
        : rawContent.audio
          ? 3
          : rawContent.video
            ? 1
            : 0,
    featureEligibilities: {
      canBeReshared: true,
      canReceiveMultiReact: false
    },
    statusAttributions: [
      {
        type: 10
      }
    ],
    statusAudienceMetadata: {
      audienceType: 1
    }
  };
}

function buildBaseContent(rawContent) {
  if (rawContent.image) {
    return {
      image: rawContent.image,
      caption: rawContent.caption || "",
      mimetype: rawContent.mimetype || "image/jpeg"
    };
  }

  if (rawContent.video) {
    return {
      video: rawContent.video,
      caption: rawContent.caption || "",
      mimetype: rawContent.mimetype || "video/mp4"
    };
  }

  if (rawContent.audio) {
    return {
      audio: rawContent.audio,
      mimetype: rawContent.mimetype || "audio/mpeg",
      ptt: Boolean(rawContent.ptt)
    };
  }

  if (rawContent.text) {
    return {
      text: rawContent.text
    };
  }

  return null;
}

async function createStatusMessage(
  sock,
  targetGroupId,
  rawContent
) {
  const baseContent =
    buildBaseContent(rawContent);

  if (!baseContent) {
    throw new Error(
      "Konten story tidak ditemukan."
    );
  }

  let generated = null;

  const generateMessage =
    sock?.generateWAMessage;

  if (typeof generateMessage === "function") {
    try {
      generated =
        await generateMessage.call(
          sock,
          targetGroupId,
          baseContent,
          {
            userJid: getBotJid(sock),
            upload:
              typeof sock?.waUploadToServer === "function"
                ? sock.waUploadToServer
                : undefined
          }
        );
    } catch (error) {
      console.log(
        "[SWGCV2] generateWAMessage gagal:",
        error?.message || error
      );
    }
  }

  if (generated?.message) {
    const generatedMessage =
      generated.message;

    const messageType =
      Object.keys(generatedMessage).find(
        key =>
          key.endsWith("Message") &&
          key !== "senderKeyDistributionMessage"
      );

    if (!messageType) {
      throw new Error(
        "Jenis pesan tidak ditemukan."
      );
    }

    const statusMessage =
      generatedMessage[messageType];

    statusMessage.contextInfo = {
      ...(statusMessage.contextInfo || {}),
      ...buildStatusContext(rawContent)
    };

    return {
      message: {
        [messageType]: statusMessage
      },
      messageId:
        generated?.key?.id ||
        `${Date.now()}-swgcv2`
    };
  }

  let message;

  if (rawContent.image) {
    message = {
      imageMessage: {
        image: rawContent.image,
        caption: rawContent.caption || "",
        mimetype:
          rawContent.mimetype ||
          "image/jpeg",
        contextInfo:
          buildStatusContext(rawContent)
      }
    };
  } else if (rawContent.video) {
    message = {
      videoMessage: {
        video: rawContent.video,
        caption: rawContent.caption || "",
        mimetype:
          rawContent.mimetype ||
          "video/mp4",
        contextInfo:
          buildStatusContext(rawContent)
      }
    };
  } else if (rawContent.audio) {
    message = {
      audioMessage: {
        audio: rawContent.audio,
        mimetype:
          rawContent.mimetype ||
          "audio/mpeg",
        ptt: Boolean(rawContent.ptt),
        contextInfo:
          buildStatusContext(rawContent)
      }
    };
  } else {
    message = {
      extendedTextMessage: {
        text:
          rawContent.text || "",
        contextInfo:
          buildStatusContext(rawContent)
      }
    };
  }

  return {
    message,
    messageId:
      `${Date.now()}-swgcv2`
  };
}

async function sendGroupStatus(
  sock,
  targetGroupId,
  rawContent
) {
  const {
    message,
    messageId
  } = await createStatusMessage(
    sock,
    targetGroupId,
    rawContent
  );

  await sock.relayMessage(
    targetGroupId,
    {
      groupStatusMessageV2: {
        message
      }
    },
    {
      messageId
    }
  );

  return messageId;
}

function cleanup(file) {
  if (!file) return;

  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}

async function getGroupList(sock) {
  const groups =
    await sock.groupFetchAllParticipating();

  return Object.entries(
    groups || {}
  );
}

function parseArgs(m, prefix) {
  if (Array.isArray(m?.args)) {
    return m.args.map(String);
  }

  const text = getText(m);

  if (!text) return [];

  const args =
    text.split(/\s+/).filter(Boolean);

  if (
    args[0]?.toLowerCase() ===
    `${prefix}swgcv2`.toLowerCase()
  ) {
    args.shift();
  }

  return args;
}

async function sendGroupPicker(
  sock,
  m,
  prefix,
  groupList,
  mediaType
) {
  const rows =
    groupList.map(
      ([id, metadata]) => ({
        title: String(
          metadata?.subject ||
          "Unknown Group"
        ).slice(0, 24),

        description:
          "Klik untuk memilih grup",

        id:
          `${prefix}swgcv2 --confirm ${id}`
      })
    );

  const bodyText =
    `📋 *ᴘɪʟɪʜ ɢʀᴜᴘ ᴜɴᴛᴜᴋ ᴘᴏsᴛ sᴛᴏʀʏ ᴠ2*\n\n` +
    `> Media: *${mediaType}*\n` +
    `> Total Grup: *${groupList.length}*\n\n` +
    `_Pilih grup dari tombol di bawah:_`;

  const buttons = [
    {
      buttonId:
        `${prefix}swgcv2-group`,

      buttonText: {
        displayText:
          "🏠 Pilih Grup"
      },

      nativeFlowInfo: {
        name:
          "single_select",

        paramsJson:
          JSON.stringify({
            title:
              "🏠 Pilih Grup",

            sections: [
              {
                title:
                  `Daftar Grup (${groupList.length})`,

                highlight_label:
                  "Pilih Grup",

                rows
              }
            ]
          })
      },

      type: 1
    },

    {
      buttonId:
        `${prefix}cancelswgcv2`,

      buttonText: {
        displayText:
          "❌ Batal"
      },

      type: 1
    }
  ];

  /*
   * Gunakan buttonsMessage langsung.
   * Ini lebih cocok untuk nativeFlowInfo
   * pada @itsliaaa/baileys yang dipakai Niwo.
   */

  const messageContent = {
    buttonsMessage: {
      contentText:
        bodyText,

      footerText:
        "NIWO BOT",

      buttons,

      headerType: 1
    }
  };

  const generated =
    generateWAMessageFromContent(
      m.chat,
      messageContent,
      {
        quoted: m,
        userJid:
          getBotJid(sock)
      }
    );

  await sock.relayMessage(
    m.chat,
    generated.message,
    {
      messageId:
        generated.key.id
    }
  );
}

async function handler(
  m,
  {
    sock,
    db
  } = {}
) {
  const prefix =
    m?.prefix ||
    appConfig?.prefix ||
    ".";

  const text =
    getText(m);

  const args =
    parseArgs(
      m,
      prefix
    );

  /*
   * ========================================
   * CONFIRM GROUP
   * ========================================
   */

  if (
    args[0]?.toLowerCase() ===
      "--confirm" &&
    args[1]?.endsWith("@g.us")
  ) {
    const targetGroupId =
      args[1];

    const pending =
      pendingSwgcV2.get(
        m.sender
      );

    if (!pending) {
      return m.reply(
        `⚠️ *Tidak ada data pending.*\n\n` +
        `Kirim ulang media lalu gunakan ` +
        `\`${prefix}swgcv2\`.`
      );
    }

    try {
      let groupName =
        "Grup";

      try {
        const metadata =
          await sock.groupMetadata(
            targetGroupId
          );

        groupName =
          metadata?.subject ||
          "Grup";
      } catch {}

      await m.react?.("🕕");

      await sendGroupStatus(
        sock,
        targetGroupId,
        pending.rawContent
      );

      await m.react?.("✅");

      pendingSwgcV2.delete(
        m.sender
      );

      if (pending.tempFile) {
        setTimeout(() => {
          cleanup(
            pending.tempFile
          );
        }, 5000);
      }

      return m.reply(
        `✅ Berhasil up sw (V2) ke grup *${groupName}*`
      );
    } catch (error) {
      console.error(
        "[SWGCV2 CONFIRM]",
        error?.stack || error
      );

      return m.reply(
        `❌ *Gagal posting story V2*\n\n` +
        `> ${error?.message || error}`
      );
    }
  }

  /*
   * ========================================
   * BATAL
   * ========================================
   */

  if (
    args[0]?.toLowerCase() ===
      "cancelswgcv2"
  ) {
    const pending =
      pendingSwgcV2.get(
        m.sender
      );

    if (pending) {
      cleanup(
        pending.tempFile
      );

      pendingSwgcV2.delete(
        m.sender
      );
    }

    return m.reply(
      "✅ Proses SWGC V2 dibatalkan."
    );
  }

  /*
   * ========================================
   * AMBIL MEDIA
   * ========================================
   */

  let rawContent = {};
  let tempFile = null;
  let buffer = null;

  const tempDir =
    path.join(
      process.cwd(),
      "temp"
    );

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(
      tempDir,
      {
        recursive: true
      }
    );
  }

  /*
   * Reply media
   */

  if (
    m?.quoted &&
    (
      isImage(m.quoted) ||
      isVideo(m.quoted) ||
      isAudio(m.quoted)
    )
  ) {
    try {
      buffer =
        await downloadMedia(
          m.quoted
        );

      if (!buffer) {
        return m.reply(
          "❌ Gagal mengambil media."
        );
      }

      const type =
        await fileTypeFromBuffer(
          buffer
        );

      const ext =
        type?.ext ||
        "bin";

      tempFile =
        path.join(
          tempDir,
          `swgcv2_${Date.now()}.${ext}`
        );

      fs.writeFileSync(
        tempFile,
        buffer
      );

      if (isImage(m.quoted)) {
        rawContent = {
          image: buffer,
          caption:
            text || "",
          mimetype:
            type?.mime ||
            getMime(m.quoted) ||
            "image/jpeg"
        };
      } else if (isVideo(m.quoted)) {
        rawContent = {
          video: buffer,
          caption:
            text || "",
          mimetype:
            type?.mime ||
            getMime(m.quoted) ||
            "video/mp4"
        };
      } else if (isAudio(m.quoted)) {
        rawContent = {
          audio: buffer,
          mimetype:
            type?.mime ||
            getMime(m.quoted) ||
            "audio/mpeg",
          ptt: Boolean(
            m.quoted?.msg?.ptt ||
            m.quoted?.ptt
          )
        };
      }
    } catch (error) {
      console.error(
        "[SWGCV2 REPLY MEDIA]",
        error?.stack || error
      );

      cleanup(tempFile);

      return m.reply(
        `❌ Gagal mengambil media.\n\n` +
        `${error?.message || error}`
      );
    }
  }

  /*
   * Media langsung
   */

  else if (
    isImage(m) ||
    isVideo(m) ||
    isAudio(m)
  ) {
    try {
      buffer =
        await downloadMedia(m);

      if (!buffer) {
        return m.reply(
          "❌ Gagal mengambil media."
        );
      }

      const type =
        await fileTypeFromBuffer(
          buffer
        );

      const ext =
        type?.ext ||
        "bin";

      tempFile =
        path.join(
          tempDir,
          `swgcv2_${Date.now()}.${ext}`
        );

      fs.writeFileSync(
        tempFile,
        buffer
      );

      if (isImage(m)) {
        rawContent = {
          image: buffer,
          caption:
            text || "",
          mimetype:
            type?.mime ||
            getMime(m) ||
            "image/jpeg"
        };
      } else if (isVideo(m)) {
        rawContent = {
          video: buffer,
          caption:
            text || "",
          mimetype:
            type?.mime ||
            getMime(m) ||
            "video/mp4"
        };
      } else if (isAudio(m)) {
        rawContent = {
          audio: buffer,
          mimetype:
            type?.mime ||
            "audio/mpeg",
          ptt: Boolean(
            m?.msg?.ptt ||
            m?.ptt
          )
        };
      }
    } catch (error) {
      console.error(
        "[SWGCV2 MEDIA]",
        error?.stack || error
      );

      cleanup(tempFile);

      return m.reply(
        `❌ Gagal mengambil media.\n\n` +
        `${error?.message || error}`
      );
    }
  }

  /*
   * Text
   */

  else if (text) {
    rawContent = {
      text
    };
  }

  /*
   * Tidak ada content
   */

  else {
    return m.reply(
      `⚠️ *ᴄᴀʀᴀ ᴘᴀᴋᴀɪ*\n\n` +
      `> \`${prefix}swgcv2 teks\` - Story teks\n` +
      `> Reply gambar/video/audio + \`${prefix}swgcv2\`\n` +
      `> Kirim gambar/video + caption \`${prefix}swgcv2\``
    );
  }

  /*
   * ========================================
   * SIMPAN PENDING
   * ========================================
   */

  pendingSwgcV2.set(
    m.sender,
    {
      rawContent,
      tempFile,
      timestamp:
        Date.now()
    }
  );

  /*
   * ========================================
   * AMBIL GRUP
   * ========================================
   */

  try {
    const groupList =
      await getGroupList(
        sock
      );

    if (!groupList.length) {
      cleanup(tempFile);

      pendingSwgcV2.delete(
        m.sender
      );

      return m.reply(
        "⚠️ *Bot tidak berada di grup manapun.*"
      );
    }

    const mediaType =
      rawContent.text
        ? "Teks"
        : rawContent.image
          ? "Gambar"
          : rawContent.video
            ? "Video"
            : rawContent.audio
              ? "Audio"
              : "Media";

    /*
     * Kirim native group picker.
     */

    await sendGroupPicker(
      sock,
      m,
      prefix,
      groupList,
      mediaType
    );
  } catch (error) {
    console.error(
      "[SWGCV2 GROUP LIST]",
      error?.stack || error
    );

    cleanup(tempFile);

    pendingSwgcV2.delete(
      m.sender
    );

    return m.reply(
      `❌ *Gagal mengambil daftar grup.*\n\n` +
      `> ${error?.message || error}`
    );
  }
}

export {
  pendingSwgcV2
};

export default {
  config,
  handler
};
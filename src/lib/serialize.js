/**
 * serialize.js
 * Serializer for Niwo Bot.
 *
 * Designed around the message shape used by plugins:
 *   m.chat, m.sender, m.pushName, m.body, m.command, m.args,
 *   m.prefix, m.text, m.isCommand, m.quoted, m.isOwner,
 *   m.isPremium, m.isGroup, m.isAdmin, m.isBotAdmin, m.reply(),
 *   m.react(), m.download(), etc.
 *
 * This version has no dependency on any old proprietary package or on
 * bot-specific database/LID/asset modules : only official Baileys-compatible APIs.
 */

import {
  downloadContentFromMessage,
  getContentType,
  jidDecode,
  normalizeMessageContent,
} from "@itsliaaa/baileys";
import fs, { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import axios from "axios";
import { getDatabase } from "./database.js";
import config from "../../config.js";

const PREFIX_CACHE_TTL = 30_000;
let _prefixCache = null;
let _prefixCacheTime = 0;

function decodeJid(jid = "") {
  if (!jid) return "";
  try {
    const d = jidDecode(jid);
    if (d?.user && d?.server) return `${d.user}@${d.server}`;
  } catch {}
  return jid;
}

function numberOf(jid = "") {
  return String(jid).replace(/[^0-9]/g, "");
}

function isGroupJid(jid = "") {
  return jid.endsWith("@g.us");
}

function isNewsletterJid(jid = "") {
  return jid.endsWith("@newsletter");
}

function getPrefixes() {
  const now = Date.now();
  if (_prefixCache && now - _prefixCacheTime < PREFIX_CACHE_TTL) {
    return _prefixCache;
  }

  const mainPrefix =
    global.prefix ??
    config?.command?.prefix ??
    config?.prefix ??
    ".";

  let prefixes = Array.isArray(mainPrefix) ? mainPrefix : [mainPrefix];
  let noprefix = false;

  try {
    const prefixFile = path.join(process.cwd(), "database", "prefix.json");
    if (existsSync(prefixFile)) {
      const data = JSON.parse(fs.readFileSync(prefixFile, "utf8"));
      prefixes.push(...(data.prefixes || []));
      noprefix = data.noprefix === true;
    }
  } catch {}

  prefixes = [...new Set(prefixes.filter(Boolean).map(String))].sort(
    (a, b) => b.length - a.length
  );

  _prefixCache = { list: prefixes, noprefix };
  _prefixCacheTime = now;
  return _prefixCache;
}

function invalidatePrefixCache() {
  _prefixCache = null;
  _prefixCacheTime = 0;
}

function parseCommand(body = "") {
  const result = {
    isCommand: false,
    command: "",
    prefix: "",
    args: [],
    text: "",
    fullArgs: "",
  };

  const input = String(body || "").trim();
  if (!input) return result;

  const { list, noprefix } = getPrefixes();

  for (const prefix of list) {
    if (!input.startsWith(prefix)) continue;

    const rest = input.slice(prefix.length).trim();
    if (!rest) return result;

    const parts = rest.split(/\s+/);
    const command = parts.shift();

    result.isCommand = true;
    result.command = config?.command?.caseSensitive
      ? command
      : command.toLowerCase();
    result.prefix = prefix;
    result.args = parts;
    result.text = parts.join(" ");
    result.fullArgs = rest.slice(command.length).trim();
    return result;
  }

  if (noprefix) {
    const parts = input.split(/\s+/);
    const command = parts[0];

    if (/^[a-z0-9_-]{1,30}$/i.test(command)) {
      result.isCommand = true;
      result.command = config?.command?.caseSensitive
        ? command
        : command.toLowerCase();
      result.prefix = "";
      result.args = parts.slice(1);
      result.text = result.args.join(" ");
      result.fullArgs = result.text;
    }
  }

  return result;
}

function unwrapMessage(message) {
  if (!message) return null;

  let current = message;
  for (let i = 0; i < 5; i++) {
    const normalized = normalizeMessageContent(current) || current;

    if (normalized?.ephemeralMessage?.message) {
      current = normalized.ephemeralMessage.message;
      continue;
    }
    if (normalized?.viewOnceMessage?.message) {
      current = normalized.viewOnceMessage.message;
      continue;
    }
    if (normalized?.viewOnceMessageV2?.message) {
      current = normalized.viewOnceMessageV2.message;
      continue;
    }
    if (normalized?.viewOnceMessageV2Extension?.message) {
      current = normalized.viewOnceMessageV2Extension.message;
      continue;
    }

    return normalized;
  }

  return current;
}

function getMessageType(message) {
  const content = unwrapMessage(message);
  if (!content) return null;

  try {
    return getContentType(content);
  } catch {
    return Object.keys(content)[0] || null;
  }
}

function getMessageBody(message, type = null) {
  const content = unwrapMessage(message);
  if (!content) return "";

  const t = type || getMessageType(content);
  const data = content[t];
  if (!data) return "";

  switch (t) {
    case "conversation":
      return content.conversation || "";

    case "extendedTextMessage":
      return data.text || "";

    case "imageMessage":
    case "videoMessage":
    case "documentMessage":
    case "audioMessage":
      return data.caption || "";

    case "buttonsResponseMessage":
      return data.selectedButtonId || "";

    case "listResponseMessage":
      return data.singleSelectReply?.selectedRowId || "";

    case "templateButtonReplyMessage":
      return data.selectedId || "";

    case "interactiveResponseMessage":
      try {
        const json = JSON.parse(
          data.nativeFlowResponseMessage?.paramsJson || "{}"
        );
        if (json.id) return json.id;
        if (json.selectedRowId) return json.selectedRowId;
        if (json.selected_row_id) return json.selected_row_id;

        if (json.response_json) {
          const nested = JSON.parse(json.response_json);
          return (
            nested.id ||
            nested.selectedRowId ||
            nested.selected_row_id ||
            ""
          );
        }
      } catch {}
      return "";

    case "pollCreationMessage":
      return data.name || "";

    default:
      return "";
  }
}

function getMediaFlags(type) {
  return {
    isMedia: [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "stickerMessage",
      "documentMessage",
    ].includes(type),

    isImage: type === "imageMessage",
    isVideo: type === "videoMessage",
    isAudio: type === "audioMessage",
    isSticker: type === "stickerMessage",
    isDocument: type === "documentMessage",
    isContact:
      type === "contactMessage" || type === "contactsArrayMessage",
    isLocation:
      type === "locationMessage" || type === "liveLocationMessage",
    isPoll: type === "pollCreationMessage",
  };
}

function getQuotedData(messageData, type) {
  const content = unwrapMessage(messageData);
  const ctx = content?.[type]?.contextInfo;
  if (!ctx?.quotedMessage) return null;

  const quotedMessage = unwrapMessage(ctx.quotedMessage);
  const quotedType = getMessageType(quotedMessage);
  if (!quotedType) return null;

  return {
    message: quotedMessage,
    type: quotedType,
    contextInfo: ctx,
  };
}

function roleCheck(name, jid) {
  try {
    if (
      typeof global?.[name] === "function" &&
      global[name](jid)
    ) {
      return true;
    }
  } catch {}

  try {
    if (
      typeof config?.[name] === "function" &&
      config[name](jid)
    ) {
      return true;
    }
  } catch {}

  let list = config?.[`${name.replace(/^is/, "").toLowerCase()}`];

  if (name === "isOwner" && list == null) {
    list = config?.owner?.number || config?.owner || config?.owners;
  } else if (name === "isPartner" && list == null) {
    list = config?.partner?.number || config?.partner || config?.partners;
  } else if (name === "isPremium" && list == null) {
    list = config?.premium?.number || config?.premium || config?.premiums;
  }

  const candidates = Array.isArray(list) ? list : (list ? [list] : []);
  if (name === "isOwner" || name === "isPartner" || name === "isPremium") {
    const n = numberOf(jid);
    if (candidates.some((x) => numberOf(x) === n)) return true;
  }

  // ==========================================
  // DATABASE EXTRA OWNER
  // ==========================================

  if (name === "isOwner") {
    try {
      const db = getDatabase();

      if (
        typeof db.isExtraOwner ===
        "function" &&
        db.isExtraOwner(jid)
      ) {
        return true;
      }
    } catch (err) {
      console.error(
        "[serialize] Owner database error:",
        err.message
      );
    }
  }

  return false;
}

async function downloadMessageContent(message, type) {
  if (!message || !type) return null;

  try {
    const stream = await downloadContentFromMessage(
      message,
      type.replace(/Message$/, "")
    );

    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

async function serializeQuotedMessage(
  message,
  type,
  sock,
  participants = []
) {
  const quoted = getQuotedData(message, type);
  if (!quoted) return null;

  const participant =
    quoted.contextInfo?.participant ||
    quoted.contextInfo?.remoteJid ||
    "";

  const quotedJid = decodeJid(participant);
  const flags = getMediaFlags(quoted.type);

  let pushName = "~ User";

  try {
    const contacts = sock?.store?.contacts || {};
    pushName =
      contacts?.[quotedJid]?.name ||
      contacts?.[quotedJid]?.notify ||
      pushName;
  } catch {}

  const q = {
    key: {
      remoteJid: quoted.contextInfo?.remoteJid || "",
      fromMe: !!quoted.contextInfo?.fromMe,
      id: quoted.contextInfo?.stanzaId || "",
      participant: quotedJid,
    },
    id: quoted.contextInfo?.stanzaId || "",
    sender: quotedJid,
    senderNumber: numberOf(quotedJid),
    pushName,
    type: quoted.type,
    body: getMessageBody(quoted.message, quoted.type),
    text: getMessageBody(quoted.message, quoted.type),
    message: quoted.message,
    mentionedJid: quoted.contextInfo?.mentionedJid || [],
    isViewOnce: !!(
      quoted.message?.viewOnceMessage ||
      quoted.message?.viewOnceMessageV2 ||
      quoted.message?.viewOnceMessageV2Extension
    ),
    ...flags,
  };

  q.download = async (filename = null) => {
    if (!q.isMedia) return null;

    const buffer = await downloadMessageContent(
      q.message[q.type],
      q.type
    );

    if (!buffer) return null;

    if (!filename) return buffer;

    const dir = path.join(process.cwd(), "storage", "temp");
    mkdirSync(dir, { recursive: true });

    const filepath = path.join(dir, filename);
    writeFileSync(filepath, buffer);
    return filepath;
  };

  return q;
}

function createContextInfo(
  jid,
  text,
  title = "",
  body = "",
  thumbnail = null
) {
  const ctx = {
    mentionedJid: [],
    forwardingScore: 1,
    isForwarded: true,
  };

  if (jid && text) {
    ctx.quotedMessage = { conversation: String(text) };
    ctx.participant = jid;
    ctx.stanzaId = `NIWO_${Date.now()}`;
  }

  if (title || body || thumbnail) {
    ctx.externalAdReply = {
      title,
      body,
      mediaType: 1,
      renderLargerThumbnail: true,
      thumbnail,
    };
  }

  return ctx;
}

async function fetchBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);

  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    const res = await axios.get(input, {
      responseType: "arraybuffer",
      timeout: 15_000,
    });
    return Buffer.from(res.data);
  }

  if (typeof input === "string" && existsSync(input)) {
    return fs.readFileSync(input);
  }

  return input;
}

async function serialize(sock, msg, store = {}) {
  if (!sock || !msg?.key || !msg?.message) return null;

  const m = {};

  m.key = msg.key;
  m.raw = msg;
  m.id = msg.key.id || "";
  m.fromMe = !!msg.key.fromMe;

  const remoteJid =
    msg.key.remoteJid ||
    msg.key.remoteJidAlt ||
    "";

  m.chat = decodeJid(remoteJid);
  m.remoteJid = m.chat;
  m.jid = m.chat;
  m.from = m.chat;
  m.to = m.chat;

  m.isGroup = isGroupJid(m.chat);
  m.isNewsletter = isNewsletterJid(m.chat);
  m.isChannel = m.isNewsletter;
  m.isPrivate = !m.isGroup && !m.isNewsletter;
  m.isPrivateChat = m.isPrivate;
  m.isGroupChat = m.isGroup;

  let sender =
    msg.key.participant ||
    msg.key.participantAlt ||
    msg.participant ||
    (m.fromMe ? sock.user?.id : m.chat);

  sender = decodeJid(sender || "");

  if (m.isGroup && msg.key.participantAlt && !sender) {
    sender = decodeJid(msg.key.participantAlt);
  }

  m.sender = sender;
  m.senderId = sender;
  m.senderNumber = numberOf(sender);

  m.pushName =
    msg.pushName ||
    (m.isNewsletter ? "Channel" : "Unknown");

  m.isBot = m.fromMe;
  m.isOwner = m.fromMe || roleCheck("isOwner", m.sender);
  m.isPartner = m.fromMe || roleCheck("isPartner", m.sender);
  m.isPremium = m.fromMe || roleCheck("isPremium", m.sender);
  m.isBanned = !m.fromMe && roleCheck("isBanned", m.sender);

  try {
    const user = getDatabase().getUser(m.sender);
    if (user?.premium === true) m.isPremium = true;
    if (user?.isBanned === true || user?.banned === true) m.isBanned = true;
    if (user?.partner === true) m.isPartner = true;
  } catch {}

  const messageData = unwrapMessage(msg.message);
  m.message = messageData;
  m.type = getMessageType(messageData);
  m.mediaType = m.type;
  m.body = getMessageBody(messageData, m.type);
  m.text = m.body;

  const parsed = parseCommand(m.body);
  Object.assign(m, parsed);

  const flags = getMediaFlags(m.type);
  Object.assign(m, flags);
  m.hasMedia = m.isMedia;
  m.mimetype = messageData?.[m.type]?.mimetype || "";
  m.fileLength = messageData?.[m.type]?.fileLength || 0;
  m.fileName = messageData?.[m.type]?.fileName || "";
  m.seconds = messageData?.[m.type]?.seconds || 0;
  m.ptt = messageData?.[m.type]?.ptt || false;
  m.isAnimated = messageData?.[m.type]?.isAnimated || false;

  const contextInfo =
    messageData?.[m.type]?.contextInfo || {};

  m.mentionedJid = Array.isArray(contextInfo.mentionedJid)
    ? contextInfo.mentionedJid
    : [];
  m.hasMentions = m.mentionedJid.length > 0;

  m.isViewOnce = !!(
    msg.message?.viewOnceMessage ||
    msg.message?.viewOnceMessageV2 ||
    msg.message?.viewOnceMessageV2Extension
  );

  m.isForwarded = !!contextInfo.isForwarded;
  m.forwardingScore = contextInfo.forwardingScore || 0;
  m.expiration = contextInfo.expiration || 0;
  m.timestamp = msg.messageTimestamp;

  // Group metadata/admin state.
  m.groupMetadata = null;
  m.groupName = "";
  m.groupDesc = "";
  m.groupMembers = [];
  m.groupAdmins = [];
  m.isAdmin = false;
  m.isBotAdmin = false;

  if (m.isGroup) {
    try {
      m.groupMetadata =
        store?.groupMetadata?.[m.chat] ||
        (await sock.groupMetadata(m.chat));

      m.groupName = m.groupMetadata?.subject || "";
      m.groupDesc = m.groupMetadata?.desc || "";
      m.groupMembers =
        m.groupMetadata?.participants || [];

      m.groupAdmins = m.groupMembers
        .filter((p) => p.admin)
        .map((p) => p.id || p.jid || p.lid)
        .filter(Boolean);

      const senderNum = numberOf(m.sender);
      const botNum = numberOf(sock.user?.id);

      m.isAdmin = m.groupMembers.some((p) => {
        if (!p.admin) return false;
        const pNum = numberOf(p.id || p.jid || p.lid);
        return (
          pNum === senderNum ||
          (pNum && senderNum &&
            (pNum.endsWith(senderNum) ||
              senderNum.endsWith(pNum)))
        );
      });

      m.isBotAdmin = m.groupMembers.some((p) => {
        if (!p.admin) return false;
        const pNum = numberOf(p.id || p.jid || p.lid);
        return (
          pNum === botNum ||
          (pNum && botNum &&
            (pNum.endsWith(botNum) ||
              botNum.endsWith(pNum)))
        );
      });
    } catch (e) {
      m.groupMetadata = null;
    }
  }

  // Quoted message.
  m.isQuoted = false;
  m.quoted = null;

  const q = await serializeQuotedMessage(
    messageData,
    m.type,
    sock,
    m.groupMembers
  );

  if (q) {
    m.quoted = q;
    m.isQuoted = true;
  }

  m.quotedMsg = m.quoted;
  m.quotedBody = m.quoted?.body || "";
  m.quotedSender = m.quoted?.sender || "";
  m.quotedType = m.quoted?.type || "";
  m.hasQuotedMedia = !!m.quoted?.isMedia;
  m.hasQuotedImage = !!m.quoted?.isImage;
  m.hasQuotedVideo = !!m.quoted?.isVideo;
  m.hasQuotedSticker = !!m.quoted?.isSticker;
  m.hasQuotedAudio = !!m.quoted?.isAudio;
  m.hasQuotedDocument = !!m.quoted?.isDocument;
  m.isReply = m.isQuoted;

  // Resolve target before sending, while still tolerating
  // socket-level LID resolver if exposed.
  const ensureResolved = async (jid) => {
    if (!jid) return jid;

    try {
      if (typeof sock?.resolveJid === "function") {
        return (await sock.resolveJid(jid)) || jid;
      }
    } catch {}

    return decodeJid(jid);
  };

  const quotedOption = (options = {}) =>
    options.quoted === false ? undefined : msg;

  // ─────────────────────────────────────────────
  // Message helpers
  // ─────────────────────────────────────────────

  m.reply = async (text, options = {}) => {
    if (text === undefined || text === null) return null;

    const content =
      typeof text === "object" && !Buffer.isBuffer(text)
        ? text
        : {
            text: String(text),
            ...(options.mentions
              ? {
                  contextInfo: {
                    mentionedJid: options.mentions,
                  },
                }
              : {}),
          };

    if (options.contextInfo) {
      content.contextInfo = {
        ...(content.contextInfo || {}),
        ...options.contextInfo,
      };
    }

    return sock.sendMessage(
      await ensureResolved(m.chat),
      content,
      { quoted: quotedOption(options) }
    );
  };

  m.replyWithMentions = async (text) => {
    const mentions = [
      ...String(text).matchAll(/@(\d{5,20})/g),
    ].map((x) => `${x[1]}@s.whatsapp.net`);

    return m.reply(text, { mentions });
  };

  m.replyImage = async (image, caption = "", options = {}) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        image: await fetchBuffer(image),
        caption,
        mentions: options.mentions || [],
        ...options,
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyVideo = async (video, caption = "", options = {}) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        video: await fetchBuffer(video),
        caption,
        gifPlayback: !!options.gif,
        mentions: options.mentions || [],
        ...options,
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyAudio = async (audio, options = {}) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        audio: await fetchBuffer(audio),
        mimetype: options.mimetype || "audio/mpeg",
        ptt: !!options.ptt,
        ...options,
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replySticker = async (sticker, options = {}) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        sticker: await fetchBuffer(sticker),
        ...options,
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyDocument = async (
    document,
    fileName = "file",
    mimetype = "application/octet-stream",
    options = {}
  ) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        document: await fetchBuffer(document),
        fileName,
        mimetype,
        ...options,
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyContact = async (
    displayName,
    vcard,
    options = {}
  ) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        contacts: {
          displayName,
          contacts: [{ vcard }],
        },
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyLocation = async (
    latitude,
    longitude,
    options = {}
  ) => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          name: options.name || "",
          address: options.address || "",
        },
      },
      { quoted: quotedOption(options) }
    );
  };

  m.replyWithQuote = async (
    text,
    fakeJid,
    fakeText,
    options = {}
  ) => {
    const fakeMsg = {
      key: {
        remoteJid: m.chat,
        fromMe: false,
        id: `NIWO_${Date.now()}`,
        participant: fakeJid,
      },
      message: {
        conversation: String(fakeText || ""),
      },
      pushName: options.pushName || "Niwo Bot",
    };

    return sock.sendMessage(
      await ensureResolved(m.chat),
      {
        text: String(text),
        contextInfo: {
          ...createContextInfo(
            fakeJid,
            fakeText,
            options.title,
            options.body,
            options.thumbnail
          ),
          mentionedJid: options.mentions || [],
        },
      },
      { quoted: fakeMsg }
    );
  };

  m.replyWithPreview = async (
    text,
    preview = {},
    options = {}
  ) => {
    const contextInfo = {
      ...(options.contextInfo || {}),
      mentionedJid: options.mentions || [],
      externalAdReply: {
        title: preview.title || global.botname || "Niwo Bot",
        body: preview.body || "",
        mediaType: 1,
        thumbnail: preview.thumbnail || undefined,
        sourceUrl: preview.sourceUrl || undefined,
        renderLargerThumbnail: true,
      },
    };

    return sock.sendMessage(
      await ensureResolved(m.chat),
      { text: String(text), contextInfo },
      { quoted: quotedOption(options) }
    );
  };

  m.react = async (emoji) => {
    try {
      return await sock.sendMessage(
        await ensureResolved(m.chat),
        {
          react: {
            text: String(emoji),
            key: msg.key,
          },
        }
      );
    } catch {
      return null;
    }
  };

  m.download = async (filename = null) => {
    if (!m.isMedia || !messageData?.[m.type]) return null;

    const buffer = await downloadMessageContent(
      messageData[m.type],
      m.type
    );

    if (!buffer) return null;
    if (!filename) return buffer;

    const tempDir = path.join(
      process.cwd(),
      "storage",
      "temp"
    );
    mkdirSync(tempDir, { recursive: true });

    const filepath = path.join(tempDir, filename);
    writeFileSync(filepath, buffer);
    return filepath;
  };

  m.delete = async () => {
    return sock.sendMessage(
      await ensureResolved(m.chat),
      { delete: msg.key }
    );
  };

  m.forward = async (jid, forceForward = false) => {
    return sock.sendMessage(
      await ensureResolved(jid),
      { forward: msg, force: forceForward }
    );
  };

  m.copy = async (jid, options = {}) => {
    let content;

    if (m.isImage) {
      content = {
        image: await m.download(),
        caption: m.body,
      };
    } else if (m.isVideo) {
      content = {
        video: await m.download(),
        caption: m.body,
      };
    } else if (m.isAudio) {
      content = {
        audio: await m.download(),
        mimetype: messageData[m.type]?.mimetype,
        ptt: !!messageData[m.type]?.ptt,
      };
    } else if (m.isSticker) {
      content = { sticker: await m.download() };
    } else if (m.isDocument) {
      content = {
        document: await m.download(),
        fileName: m.fileName || "file",
        mimetype:
          m.mimetype || "application/octet-stream",
      };
    } else {
      content = { text: m.body || "" };
    }

    return sock.sendMessage(
      await ensureResolved(jid),
      content,
      options
    );
  };

  // Compatibility aliases frequently used by plugins.
  m.verifiedQuoted = msg;
  m.quotedMessage = m.quoted;
  m.messageId = m.id;
  m.chatId = m.chat;

  return m;
}

function getNumber(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0];
}

export {
  serialize,
  decodeJid,
  getMessageType,
  getMessageBody,
  parseCommand,
  serializeQuotedMessage,
  createContextInfo,
  getPrefixes,
  invalidatePrefixCache,
  getNumber,
};

export const createJid = (number) => {
  const n = String(number || "").replace(/[^0-9]/g, "");
  return n ? `${n}@s.whatsapp.net` : "";
};

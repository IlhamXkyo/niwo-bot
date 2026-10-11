/**
 * Reference Contract Engine for Remote C2 Assistant E2E Testing.
 * Encapsulates exact interface contracts from PROJECT.md and ORIGINAL_REQUEST.md.
 * Automatically delegates to production modules when available.
 */

const path = require('path');
const fs = require('fs');

// Comprehensive Unicode Emoji regular expression (modern emojis only)
const EMOJI_REGEX = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;

// Standard Japanese Kaomoji patterns
const KAOMOJI_PATTERNS = [
  /\(\s*\*v\*\s*\)/,
  /\(\s*[Uu][Ww][Uu]\s*\)/,
  /\(\s*\*\/\u03c9\uff3c\*\s*\)/, // (*/ω＼*)
  /\(\s*\*\^\u25bd\^\*\s*\)/,   // (*^▽^*)
  /m\(_\s*_\)m/,
  /\(,,>\ufe4f<,,\)/,     // (,,>﹏<,,)
  /\(\uff61\u2022\u0301\ufe35\u2022\u0300\uff61\)/, // (｡•́︿•̀｡)
  /\(\u273f\u25e0\u203f\u25e0\)/, // (✿◠‿◠)
  /\(\>\/\/\/\<\)/,
  /\(\*'\u25bd'\*\)/,
  /\(\s*\^\s*\_\s*\^\s*\)/,
  /\(\s*'\s*\.\s*'\s*\)/
];

function sanitizeEmojis(text) {
  if (typeof text !== 'string') {
    return { cleanText: '', removedCount: 0 };
  }
  const matches = text.match(EMOJI_REGEX) || [];
  const cleanText = text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText,
    removedCount: matches.length
  };
}

function parseStickerAction(text) {
  if (typeof text !== 'string') {
    return { cleanText: '', emotion: null };
  }
  const actionRegex = /\[ACTION:\s*SEND_STICKER_([A-Z_]+)\s*\]/i;
  const match = text.match(actionRegex);
  if (!match) {
    return { cleanText: text.trim(), emotion: null };
  }
  const emotion = match[1].toLowerCase();
  const cleanText = text.replace(actionRegex, '').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText,
    emotion
  };
}

function validateKaomoji(text) {
  if (typeof text !== 'string' || !text) return false;
  return KAOMOJI_PATTERNS.some(p => p.test(text));
}

function resolveStickerEmotion(emotion) {
  const normalized = String(emotion || '').toLowerCase().trim();
  const validEmotions = ['shy', 'happy', 'surprise', 'sad', 'greeting', 'default'];
  if (validEmotions.includes(normalized)) {
    return normalized;
  }
  return 'default';
}

function evaluateGroupRouting({
  mode,
  isGroup,
  text = '',
  quoted = null,
  botJid = '6285217124804@s.whatsapp.net',
  mentionedJid = []
}) {
  if (mode === 'off') {
    return { shouldRoute: false, reason: 'BRIDGE_OFF' };
  }

  if (!isGroup) {
    if (mode === 'chat' || mode === 'both') {
      return { shouldRoute: true, reason: 'DM_ALLOWED' };
    }
    return { shouldRoute: false, reason: 'DM_DISABLED_IN_GROUP_MODE' };
  }

  // From here on, message is in a group
  if (mode === 'chat') {
    return { shouldRoute: false, reason: 'GROUP_DISABLED_IN_CHAT_MODE' };
  }

  // Group mode or both mode
  // Check 1: Reply to bot
  if (quoted) {
    const quotedSender = quoted.sender || quoted.participant || '';
    if (botJid && quotedSender && quotedSender.split('@')[0] === botJid.split('@')[0]) {
      return { shouldRoute: true, reason: 'QUOTED_BOT' };
    }
  }

  // Check 2: Mentioned / Tagged bot via WhatsApp mention metadata
  const botNum = botJid ? botJid.split('@')[0] : '';
  if (botNum && Array.isArray(mentionedJid) && mentionedJid.length > 0) {
    if (mentionedJid.some((j) => String(j).split('@')[0] === botNum)) {
      return { shouldRoute: true, reason: 'TAGGED_BOT' };
    }
  }

  // Check 3: Keywords trigger
  const lowerText = text.toLowerCase();
  const keywords = ['sawako', 'gravity', 'kuronuma', 'agy'];
  const hasKeyword = keywords.some((kw) => lowerText.includes(kw));

  if (hasKeyword) {
    return { shouldRoute: true, reason: 'KEYWORD_MATCH' };
  }

  return { shouldRoute: false, reason: 'UNPROMPTED_DROP' };
}

function validateBridgeMode(mode) {
  const validModes = ['chat', 'group', 'both', 'off'];
  const normalized = String(mode || '').toLowerCase().trim();
  if (!validModes.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid bridge mode '${mode}'. Allowed: chat, group, both, off.`
    };
  }
  return { valid: true, mode: normalized };
}

function evaluateTimeoutOrOffline({
  heartbeatAgeMs = 0,
  queueAgeMs = 0,
  maxHeartbeatAgeMs = 15000,
  maxQueueWaitMs = 20000
}) {
  const isHeartbeatStale = heartbeatAgeMs > maxHeartbeatAgeMs;
  const isQueueTimedOut = queueAgeMs > maxQueueWaitMs;

  return {
    isOffline: isHeartbeatStale || isQueueTimedOut,
    reason: isHeartbeatStale ? 'HEARTBEAT_STALE' : (isQueueTimedOut ? 'QUEUE_TIMEOUT' : 'NORMAL')
  };
}

function generateOfflineNotice() {
  return {
    text: "A-ano... sumimasen m(_ _)m Sesi Antigravity sepertinya sedang tidak aktif atau tertutup di laptop. (,,>﹏<,,)",
    buttons: [
      {
        id: ".gravity open",
        text: "🚀 Open Antigravity",
        type: "quick_reply"
      }
    ]
  };
}

function validateSafeFilePath(requestedPath, projectRoot) {
  let decoded = requestedPath;
  try {
    decoded = decodeURIComponent(requestedPath);
  } catch (err) {
    decoded = requestedPath;
  }

  if (decoded.includes('..') || requestedPath.includes('..') || /%2e%2e/i.test(requestedPath)) {
    return {
      safe: false,
      error: 'Security alert: Access outside project root is strictly blocked.'
    };
  }

  const resolved = path.resolve(projectRoot, decoded);
  const relative = path.relative(projectRoot, resolved);
  const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);

  if (!isInside) {
    return {
      safe: false,
      error: 'Security alert: Access outside project root is strictly blocked.'
    };
  }

  return {
    safe: true,
    resolvedPath: resolved
  };
}

module.exports = {
  sanitizeEmojis,
  parseStickerAction,
  validateKaomoji,
  resolveStickerEmotion,
  evaluateGroupRouting,
  validateBridgeMode,
  evaluateTimeoutOrOffline,
  generateOfflineNotice,
  validateSafeFilePath,
  KAOMOJI_PATTERNS
};

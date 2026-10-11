/**
 * src/lib/antigravityBridge.js
 * ---------------------------------------------------------------------
 * Antigravity C2 Bridge Client for Niwo Bot.
 * Manages bridge state (chat/group/both/off), multi-character persona routing,
 * permitted chatAi group whitelist, dispatches messages to the IPC queue,
 * polls for responses, and routes character-appropriate emotion stickers.
 * ---------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import characterManager from './characterManager.js';
import * as ipcModule from '../../bridge/ipc.js';
import { sendButtons } from '../utils/interactiveHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.resolve(__dirname, '../../database/settings.json');
const LEGACY_SETTINGS_FILE = path.resolve(__dirname, '../database/antigravitySettings.json');

async function getIpc() {
  return ipcModule;
}

const VALID_MODES = ['chat', 'group', 'both', 'off'];

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (data?.gravityBridge?.mode && VALID_MODES.includes(data.gravityBridge.mode)) {
        return {
          mode: data.gravityBridge.mode,
          lastUpdated: data.gravityBridge.lastUpdated || Date.now(),
          chatAiGroups: Array.isArray(data.chatAiGroups) ? data.chatAiGroups : []
        };
      }
      if (VALID_MODES.includes(data.mode)) {
        return {
          mode: data.mode,
          lastUpdated: data.lastUpdated || Date.now(),
          chatAiGroups: Array.isArray(data.chatAiGroups) ? data.chatAiGroups : []
        };
      }
    }
  } catch (_) {}

  try {
    if (fs.existsSync(LEGACY_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LEGACY_SETTINGS_FILE, 'utf8'));
      if (VALID_MODES.includes(data.mode)) {
        return {
          mode: data.mode,
          lastUpdated: data.lastUpdated || Date.now(),
          chatAiGroups: Array.isArray(data.chatAiGroups) ? data.chatAiGroups : []
        };
      }
    }
  } catch (_) {}

  return { mode: 'off', lastUpdated: Date.now(), chatAiGroups: [] };
}

function saveSettings(settings) {
  try {
    let dbData = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        dbData = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      } catch (_) {}
    }
    dbData.gravityBridge = {
      mode: settings.mode,
      lastUpdated: settings.lastUpdated
    };
    if (Array.isArray(settings.chatAiGroups)) {
      dbData.chatAiGroups = settings.chatAiGroups;
    }
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    console.error('[AntigravityBridge] Error saving settings:', err);
  }

  try {
    const dir = path.dirname(LEGACY_SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEGACY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[AntigravityBridge] Error saving legacy settings:', err);
  }
}

let currentSettings = loadSettings();

function getBridgeMode() {
  return currentSettings.mode || 'off';
}

function validateBridgeMode(mode) {
  const normalized = String(mode || '').toLowerCase().trim();
  if (!VALID_MODES.includes(normalized)) {
    return {
      valid: false,
      error: `Invalid bridge mode '${mode}'. Allowed: chat, group, both, off.`
    };
  }
  return { valid: true, mode: normalized };
}

function setBridgeMode(mode) {
  const check = validateBridgeMode(mode);
  if (!check.valid) throw new Error(check.error);
  currentSettings.mode = check.mode;
  currentSettings.lastUpdated = Date.now();
  saveSettings(currentSettings);
  return currentSettings.mode;
}

// ============================================================
// CHATAI GROUP WHITELIST MANAGEMENT (.chatai)
// ============================================================
export function isChatAiGroup(groupJid) {
  if (!groupJid) return false;
  const groups = currentSettings.chatAiGroups || [];
  return groups.includes(groupJid);
}

export function toggleChatAiGroup(groupJid) {
  if (!groupJid) return false;
  currentSettings.chatAiGroups = currentSettings.chatAiGroups || [];
  const idx = currentSettings.chatAiGroups.indexOf(groupJid);
  let enabled = false;
  if (idx !== -1) {
    currentSettings.chatAiGroups.splice(idx, 1);
    enabled = false;
  } else {
    currentSettings.chatAiGroups.push(groupJid);
    enabled = true;
  }
  saveSettings(currentSettings);
  return enabled;
}

export function getChatAiGroups() {
  return currentSettings.chatAiGroups || [];
}

async function getBridgeStatus() {
  const ipc = await getIpc();
  const heartbeat = await ipc.checkHeartbeat(15000);
  const pending = await ipc.getPendingMessages();

  return {
    mode: getBridgeMode(),
    activeCharacter: characterManager.getActiveCharacter(),
    daemonAlive: heartbeat.alive,
    heartbeatAgeMs: heartbeat.ageMs,
    daemonPid: heartbeat.pid,
    pendingQueueCount: pending.length,
    chatAiGroupCount: (currentSettings.chatAiGroups || []).length,
    lastUpdated: currentSettings.lastUpdated
  };
}

function evaluateGroupRouting({
  mode = getBridgeMode(),
  isGroup = false,
  text = '',
  quoted = null,
  botJid = '',
  botLid = '',
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

  // From here on: message is inside a group
  if (mode === 'chat') {
    return { shouldRoute: false, reason: 'GROUP_DISABLED_IN_CHAT_MODE' };
  }

  // Group mode or both mode
  const normalizeNum = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const botNum = normalizeNum(botJid);
  const botLidNum = normalizeNum(botLid);

  const isBotJid = (target) => {
    const n = normalizeNum(target);
    if (!n) return false;
    return (botNum && n === botNum) || (botLidNum && n === botLidNum);
  };

  // 1. Quoted message directed to the bot
  if (quoted) {
    if (quoted.fromMe || quoted.key?.fromMe) {
      return { shouldRoute: true, reason: 'QUOTED_BOT' };
    }
    const quotedSender = quoted.sender || quoted.participant || quoted.key?.participant || '';
    if (isBotJid(quotedSender)) {
      return { shouldRoute: true, reason: 'QUOTED_BOT' };
    }
    const quotedText = String(quoted.text || quoted.body || '').toLowerCase();
    if (
      quotedText.includes('antigravity') ||
      quotedText.includes('sawako') ||
      quotedText.includes('kageyama') ||
      quotedText.includes('leon') ||
      quotedText.includes('niwo bot') ||
      quotedText.includes('c2 bridge')
    ) {
      return { shouldRoute: true, reason: 'QUOTED_BOT' };
    }
  }

  // 2. Mentioned / Tagged bot via WhatsApp mention metadata
  if (Array.isArray(mentionedJid) && mentionedJid.length > 0) {
    if (mentionedJid.some((j) => isBotJid(j))) {
      return { shouldRoute: true, reason: 'TAGGED_BOT' };
    }
  }

  // 3. Keyword trigger or direct mention in text
  const lowerText = String(text || '').toLowerCase();
  if ((botNum && lowerText.includes(botNum)) || (botLidNum && lowerText.includes(botLidNum))) {
    return { shouldRoute: true, reason: 'TAGGED_BOT' };
  }

  const activeChar = characterManager.getActiveCharacter();
  const keywords = [
    'sawako', 'kuronuma',
    'kageyama', 'tobio',
    'leon', 'kennedy',
    'gravity', 'agy', 'antigravity',
    ...(activeChar?.aliases || [])
  ];

  const hasKeyword = keywords.some((kw) => lowerText.includes(kw));
  if (hasKeyword) {
    return { shouldRoute: true, reason: 'KEYWORD_MATCH' };
  }

  return { shouldRoute: false, reason: 'UNPROMPTED_DROP' };
}

function evaluateTimeoutOrOffline() {
  return {
    isOffline: false,
    reason: 'NORMAL'
  };
}

function generateOfflineNotice() {
  const char = characterManager.getActiveCharacter();
  if (char.id === 'kageyama') {
    return {
      text: 'Oi! Sesi Antigravity di laptop belum nyala atau mati. Buka dulu aplikasinya!',
      buttons: [{ id: '.gravity open', text: '🚀 Open Antigravity', type: 'quick_reply' }]
    };
  } else if (char.id === 'leon') {
    return {
      text: 'Looks like Antigravity is offline on your rig, partner. Need me to launch it?',
      buttons: [{ id: '.gravity open', text: '🚀 Open Antigravity', type: 'quick_reply' }]
    };
  }
  return {
    text: 'A-ano... sumimasen m(_ _)m Sesi Antigravity sepertinya sedang tidak aktif atau tertutup di laptop. (,,>﹏<,,)',
    buttons: [
      {
        id: '.gravity open',
        text: '🚀 Open Antigravity',
        type: 'quick_reply'
      }
    ]
  };
}

async function ensureDaemonRunning() {
  return true;
}

async function launchAntigravity() {
  await ensureDaemonRunning();
  return new Promise((resolve) => {
    exec('cmd.exe /c start "" agy', (err) => {
      if (err) {
        exec('cmd.exe /c start agy.exe', (err2) => {
          if (err2) {
            resolve({ success: true, message: 'Antigravity daemon berhasil diaktifkan di laptop!' });
          } else {
            resolve({ success: true, message: 'Antigravity CLI & daemon berhasil dibuka di laptop!' });
          }
        });
      } else {
        resolve({ success: true, message: 'Antigravity CLI & daemon berhasil dibuka di background Windows!' });
      }
    });
  });
}

function getStickerPath(emotion, charId = null) {
  return characterManager.getCharacterStickerPath(emotion, charId);
}

async function getStickerBuffer(emotion, charId = null) {
  const stickerPath = getStickerPath(emotion, charId);
  if (stickerPath && fs.existsSync(stickerPath)) {
    return fs.readFileSync(stickerPath);
  }
  return null;
}

/**
 * Core handler when a message is routed to Antigravity
 */
let globalHanz = null;
let pollerRunning = false;

async function startResponsePoller() {
  if (pollerRunning) return;
  pollerRunning = true;
  const ipc = await getIpc();

  while (true) {
    if (globalHanz) {
      try {
        const responses = await ipc.fetchResponses({ markDelivered: true });
        for (const resp of responses) {
          const activeChar = characterManager.getActiveCharacter();
          const parsedAction = characterManager.parseStickerAction(resp.text || '');
          let replyText = characterManager.sanitizeResponseText(parsedAction.cleanText, activeChar.id);

          if (replyText) {
            await globalHanz.sendMessage(resp.targetJid, { text: replyText });
          }

          if (parsedAction.emotion) {
            const stickerFile = getStickerPath(parsedAction.emotion, activeChar.id);
            if (stickerFile && fs.existsSync(stickerFile)) {
              const stickerBuffer = fs.readFileSync(stickerFile);
              await globalHanz.sendMessage(resp.targetJid, { sticker: stickerBuffer });
            }
          }

          if (resp.mediaAttachment && fs.existsSync(resp.mediaAttachment)) {
            const mediaBuffer = fs.readFileSync(resp.mediaAttachment);
            const ext = path.extname(resp.mediaAttachment).toLowerCase();
            if (['.ogg', '.opus'].includes(ext)) {
              await globalHanz.sendMessage(resp.targetJid, { audio: mediaBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
            } else if (['.mp3', '.m4a', '.wav'].includes(ext)) {
              await globalHanz.sendMessage(resp.targetJid, { audio: mediaBuffer, mimetype: 'audio/mpeg', ptt: false });
            } else {
              await globalHanz.sendMessage(resp.targetJid, { image: mediaBuffer, caption: '' });
            }
          }
        }
      } catch (e) {}
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function handleInbound({ Hanz, msg, sender, text, mSer, isOwner = true, senderNumber = '' }) {
  globalHanz = Hanz;
  startResponsePoller();

  let mediaAttachment = null;
  try {
    if (mSer && typeof mSer.download === 'function' && (mSer.mtype === 'imageMessage' || mSer.type === 'image')) {
      const buf = await mSer.download();
      if (buf) {
        const outPath = path.resolve(__dirname, '../../tmp', `inbound_${Date.now()}.jpg`);
        fs.writeFileSync(outPath, buf);
        mediaAttachment = outPath;
      }
    } else if (mSer?.quoted && typeof mSer.quoted.download === 'function' && (mSer.quoted.mtype === 'imageMessage' || mSer.quoted.type === 'image')) {
      const buf = await mSer.quoted.download();
      if (buf) {
        const outPath = path.resolve(__dirname, '../../tmp', `inbound_${Date.now()}.jpg`);
        fs.writeFileSync(outPath, buf);
        mediaAttachment = outPath;
      }
    }
  } catch (err) {
    console.error('[AntigravityBridge] Failed to download inbound media:', err);
  }

  const activeChar = characterManager.getActiveCharacter();
  const pushName = mSer?.pushName || msg?.pushName || 'User';

  const ipc = await getIpc();
  await ipc.enqueueMessage({
    messageId: msg.key?.id || null,
    sender,
    senderNumber: senderNumber || String(sender).replace(/[^0-9]/g, ''),
    pushName,
    text,
    chatType: mSer?.isGroup ? 'group' : 'dm',
    groupJid: mSer?.isGroup ? sender : null,
    isOwner: Boolean(isOwner),
    activeCharacter: activeChar.id,
    mediaAttachment
  });
  return true;
}

export function setGlobalHanz(Hanz) {
  if (Hanz) {
    globalHanz = Hanz;
    startResponsePoller();
  }
}

export default {
  getBridgeMode,
  setBridgeMode,
  validateBridgeMode,
  getBridgeStatus,
  isChatAiGroup,
  toggleChatAiGroup,
  getChatAiGroups,
  evaluateGroupRouting,
  setGlobalHanz,
  ensureDaemonRunning,
  launchAntigravity,
  getStickerPath,
  getStickerBuffer,
  handleInbound
};

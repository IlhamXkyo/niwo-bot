#!/usr/bin/env node
/**
 * bridge/reply.js
 * 
 * CLI Responder tool for Antigravity Agent to send WhatsApp replies via file IPC.
 * 
 * Usage:
 *   node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>] [--action <type>] [--force] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  acquireLock,
  releaseLock,
  readJsonSafe,
  atomicWriteJson
} from './ipc.js';

export const EXIT = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  QUEUE_NOT_FOUND: 2,
  ALREADY_COMPLETED: 3,
  MEDIA_NOT_FOUND: 4,
  STORAGE_CORRUPT: 5,
  LOCK_TIMEOUT: 6,
  IO_ERROR: 7
};

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

export function getReplyPaths(customDir) {
  const dir = customDir
    ? path.resolve(customDir)
    : process.env.BRIDGE_DIR
      ? path.resolve(process.env.BRIDGE_DIR)
      : CURRENT_DIR;
  return {
    dir,
    queueFile: path.join(dir, 'wa_queue.json'),
    responseFile: path.join(dir, 'wa_response.json'),
    lockFile: path.join(dir, '.queue.lock')
  };
}

export function printHelp() {
  const helpText = `
Usage:
  node bridge/reply.js --id <queueId> --text <text> [options]

Required Options:
  -i, --id <queueId>       Queue message ID from wa_queue.json
  -t, --text <text>        Sawako response text (UTF-8, kaomoji supported)

Optional Options:
  -s, --sticker <EMOTION>  Emotion sticker key (HAPPY, SHY, SURPRISE, SAD, GREETING, DEFAULT)
  -m, --image <path>       Relative or absolute path to image attachment
  -a, --action <type>      Custom system action type (SCREENSHOT, SHUTDOWN, etc.)
  -f, --force              Force reply even if item is already completed or missing
      --json               Output machine-readable JSON format to stdout
  -h, --help               Display this help message

Exit Codes:
  0 : Success
  1 : Invalid Arguments
  2 : Queue Item Not Found
  3 : Queue Item Already Completed
  4 : Media File Not Found
  5 : Storage JSON Corrupt
  6 : Lock Acquisition Timeout
  7 : Filesystem I/O Error
`;
  process.stdout.write(helpText.trim() + '\n');
}

export function emitError(code, message, isJson = false) {
  const codeName = Object.keys(EXIT).find((key) => EXIT[key] === code) || 'UNKNOWN';
  if (isJson) {
    process.stderr.write(
      JSON.stringify({ success: false, errorCode: code, errorName: codeName, message }) + '\n'
    );
  } else {
    process.stderr.write(`[REPLY_ERROR:${codeName}] ${message}\n`);
  }
}

function parseContainer(rawData, defaultKey) {
  if (Array.isArray(rawData)) {
    return { isWrapped: false, raw: null, items: rawData };
  }
  if (rawData && typeof rawData === 'object' && Array.isArray(rawData[defaultKey])) {
    return { isWrapped: true, raw: rawData, items: rawData[defaultKey] };
  }
  return { isWrapped: false, raw: null, items: [] };
}

export async function executeReply(args = process.argv.slice(2), options = {}) {
  const paths = getReplyPaths(options.bridgeDir);
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        id: { type: 'string', short: 'i' },
        text: { type: 'string', short: 't' },
        sticker: { type: 'string', short: 's' },
        image: { type: 'string', short: 'm' },
        action: { type: 'string', short: 'a' },
        force: { type: 'boolean', short: 'f', default: false },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false }
      },
      allowPositionals: false,
      strict: true
    });
  } catch (err) {
    emitError(EXIT.INVALID_ARGS, `CLI argument parsing failed: ${err.message}`, false);
    return EXIT.INVALID_ARGS;
  }

  const { values } = parsed;
  const isJson = Boolean(values.json);

  if (values.help) {
    printHelp();
    return EXIT.SUCCESS;
  }

  if (!values.id || typeof values.id !== 'string' || !values.id.trim()) {
    emitError(EXIT.INVALID_ARGS, 'Missing required argument: --id <queueId>', isJson);
    return EXIT.INVALID_ARGS;
  }

  if (!values.text || typeof values.text !== 'string' || !values.text.trim()) {
    emitError(EXIT.INVALID_ARGS, 'Missing required argument: --text <text>', isJson);
    return EXIT.INVALID_ARGS;
  }

  const queueId = values.id.trim();
  const responseText = values.text.trim();
  let stickerKey = values.sticker ? values.sticker.trim().toUpperCase() : null;
  const rawActions = [];

  // Parse inline [ACTION: SEND_STICKER_<EMOTION>] in text
  const stickerRegex = /\[ACTION:\s*SEND_STICKER_([A-Za-z_]+)\]/i;
  const stickerMatch = responseText.match(stickerRegex);
  if (stickerMatch) {
    const inlineEmotion = stickerMatch[1].toUpperCase();
    if (!stickerKey) {
      stickerKey = inlineEmotion;
    }
    rawActions.push(`SEND_STICKER_${inlineEmotion}`);
  } else if (stickerKey) {
    rawActions.push(`SEND_STICKER_${stickerKey}`);
  }

  if (values.action && values.action.trim()) {
    rawActions.push(values.action.trim().toUpperCase());
  }
  const actions = Array.from(new Set(rawActions));

  // Validate image attachment path if provided
  let mediaAttachment = null;
  if (values.image && values.image.trim()) {
    const resolvedImagePath = path.resolve(process.cwd(), values.image.trim());
    if (!fs.existsSync(resolvedImagePath) || !fs.statSync(resolvedImagePath).isFile()) {
      emitError(
        EXIT.MEDIA_NOT_FOUND,
        `Media attachment file not found: ${resolvedImagePath}`,
        isJson
      );
      return EXIT.MEDIA_NOT_FOUND;
    }
    mediaAttachment = resolvedImagePath;
  }

  // Acquire Lock and Execute State Transition
  let lockHandle = null;
  try {
    lockHandle = await acquireLock(paths.lockFile, { timeout: 5000, ttl: 8000, holder: 'reply.js' });

    // Read and Validate Queue Item
    let queueRaw;
    try {
      if (!fs.existsSync(paths.queueFile)) {
        queueRaw = [];
      } else {
        const fileContent = fs.readFileSync(paths.queueFile, 'utf8');
        queueRaw = fileContent.trim() ? JSON.parse(fileContent) : [];
      }
    } catch (err) {
      emitError(EXIT.STORAGE_CORRUPT, `Failed reading wa_queue.json: ${err.message}`, isJson);
      return EXIT.STORAGE_CORRUPT;
    }

    const queueContainer = parseContainer(queueRaw, 'messages');
    const queueItems = queueContainer.items;
    const itemIndex = queueItems.findIndex((item) => item.id === queueId);

    let targetJid = null;
    let quotedMessageId = null;
    let chatType = 'dm';
    let groupJid = null;

    if (itemIndex === -1) {
      if (!values.force) {
        emitError(
          EXIT.QUEUE_NOT_FOUND,
          `Queue item '${queueId}' not found in ${paths.queueFile}. Use --force to override.`,
          isJson
        );
        return EXIT.QUEUE_NOT_FOUND;
      }
      targetJid = 'unknown@s.whatsapp.net';
    } else {
      const queueItem = queueItems[itemIndex];
      const isAlreadyCompleted = (queueItem.status || '').toLowerCase() === 'completed';

      if (isAlreadyCompleted && !values.force) {
        emitError(
          EXIT.ALREADY_COMPLETED,
          `Queue item '${queueId}' was already completed at ${queueItem.completedAt || 'unknown'}. Use --force to reply again.`,
          isJson
        );
        return EXIT.ALREADY_COMPLETED;
      }

      chatType = queueItem.chatType || (queueItem.groupJid ? 'group' : 'dm');
      groupJid = queueItem.groupJid || null;
      targetJid =
        groupJid || queueItem.sender || queueItem.senderNumber || 'unknown@s.whatsapp.net';
      quotedMessageId = queueItem.messageId || null;

      const responseId = `wa_resp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.replyId = responseId;

      if (queueContainer.isWrapped) {
        queueContainer.raw.messages = queueItems;
        queueContainer.raw.updatedAt = Date.now();
        await atomicWriteJson(paths.queueFile, queueContainer.raw);
      } else {
        await atomicWriteJson(paths.queueFile, queueItems);
      }

      // Read Responses and Append Outbound Item
      let responseRaw;
      try {
        if (!fs.existsSync(paths.responseFile)) {
          responseRaw = [];
        } else {
          const fileContent = fs.readFileSync(paths.responseFile, 'utf8');
          responseRaw = fileContent.trim() ? JSON.parse(fileContent) : [];
        }
      } catch (err) {
        emitError(EXIT.STORAGE_CORRUPT, `Failed reading wa_response.json: ${err.message}`, isJson);
        return EXIT.STORAGE_CORRUPT;
      }

      const responseContainer = parseContainer(responseRaw, 'responses');
      const responseItems = responseContainer.items;

      const responseRecord = {
        id: responseId,
        queueId,
        targetJid,
        chatType,
        groupJid,
        text: responseText,
        actions,
        stickerKey,
        mediaAttachment,
        quotedMessageId,
        timestamp: Date.now(),
        status: 'pending'
      };

      responseItems.push(responseRecord);

      if (responseContainer.isWrapped) {
        responseContainer.raw.responses = responseItems;
        responseContainer.raw.updatedAt = Date.now();
        await atomicWriteJson(paths.responseFile, responseContainer.raw);
      } else {
        await atomicWriteJson(paths.responseFile, responseItems);
      }

      // Success Emission
      if (isJson) {
        process.stdout.write(
          JSON.stringify({
            success: true,
            responseId: responseRecord.id,
            queueId: responseRecord.queueId,
            targetJid: responseRecord.targetJid,
            status: 'completed',
            stickerKey: responseRecord.stickerKey,
            mediaAttachment: responseRecord.mediaAttachment,
            timestamp: responseRecord.timestamp
          }) + '\n'
        );
      } else {
        process.stdout.write(
          `[REPLY_SUCCESS] Response ${responseRecord.id} queued for ${queueId} (target: ${targetJid}${stickerKey ? `, sticker: ${stickerKey}` : ''})\n`
        );
      }

      return EXIT.SUCCESS;
    }
  } catch (err) {
    if (err.code === 'ELOCKTIMEOUT') {
      emitError(EXIT.LOCK_TIMEOUT, err.message, isJson);
      return EXIT.LOCK_TIMEOUT;
    }
    emitError(EXIT.IO_ERROR, `Unexpected filesystem error: ${err.message}`, isJson);
    return EXIT.IO_ERROR;
  } finally {
    if (lockHandle) {
      await releaseLock(lockHandle);
    }
  }
}

// Direct Execution Entrypoint
const isDirectExecution =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
   process.argv[1].endsWith('reply.js'));

if (isDirectExecution) {
  executeReply().then((code) => {
    process.exit(code);
  }).catch((err) => {
    process.stderr.write(`[FATAL_UNHANDLED] ${err.stack || err.message}\n`);
    process.exit(EXIT.IO_ERROR);
  });
}

export default {
  EXIT,
  executeReply,
  printHelp,
  emitError
};

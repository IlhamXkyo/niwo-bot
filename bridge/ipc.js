/**
 * bridge/ipc.js
 * 
 * Concurrency-safe Inter-Process Communication Storage and Locking Module.
 * Implements atomic writes on Windows (temp file + fsync + close + rename + retry),
 * advisory file locking with 5000ms stale TTL, and queue/heartbeat operations.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_BRIDGE_DIR = path.resolve(process.cwd(), 'bridge');
export const LOCK_TTL_MS = 5000;
export const LOCK_TIMEOUT_MS = 10000;
export const RETRY_BASE_DELAY_MS = 25;
export const RETRY_MAX_ATTEMPTS = 12;

export function getPaths(customDir) {
  const dir = customDir
    ? path.resolve(customDir)
    : process.env.BRIDGE_DIR
      ? path.resolve(process.env.BRIDGE_DIR)
      : DEFAULT_BRIDGE_DIR;
  return {
    dir,
    queueFile: path.join(dir, 'wa_queue.json'),
    responseFile: path.join(dir, 'wa_response.json'),
    heartbeatFile: path.join(dir, 'bridge_heartbeat.json'),
    lockFile: path.join(dir, '.queue.lock')
  };
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Atomically writes data to a target JSON file on Windows NTFS.
 * Follows temp-file + write + sync + close + rename with exponential backoff retry.
 */
export async function atomicWriteJson(targetPath, data) {
  const dir = path.dirname(targetPath);
  ensureDirSync(dir);

  const serialized = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(serialized, 'utf8');
  const tempPath = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`
  );

  let fileHandle = null;
  try {
    fileHandle = await fs.promises.open(tempPath, 'w', 0o666);
    await fileHandle.write(buffer, 0, buffer.length, 0);
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;

    let attempt = 0;
    while (true) {
      try {
        await fs.promises.rename(tempPath, targetPath);
        break;
      } catch (err) {
        attempt++;
        const isSharingViolation =
          err.code === 'EBUSY' ||
          err.code === 'EPERM' ||
          err.code === 'EACCES' ||
          err.code === 'EMFILE';

        if (isSharingViolation && attempt < RETRY_MAX_ATTEMPTS) {
          const delay = Math.min(
            250,
            Math.floor(RETRY_BASE_DELAY_MS * Math.pow(1.5, attempt) + Math.random() * 20)
          );
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
  } finally {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (_) {}
    }
    if (fs.existsSync(tempPath)) {
      try {
        await fs.promises.unlink(tempPath);
      } catch (_) {}
    }
  }
}

/**
 * Safely reads and parses a JSON file with fallback.
 */
export async function readJsonSafe(targetPath, fallback = null) {
  try {
    if (!fs.existsSync(targetPath)) return fallback;
    const raw = await fs.promises.readFile(targetPath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    return JSON.parse(trimmed);
  } catch (_) {
    return fallback;
  }
}

/**
 * Acquires advisory lock on lockFilePath with 5000ms TTL stale expiration.
 */
export async function acquireLock(lockFilePath, options = {}) {
  const ttl = options.ttl || LOCK_TTL_MS;
  const timeout = options.timeout || LOCK_TIMEOUT_MS;
  const holder = options.holder || `PID_${process.pid}`;
  const token = crypto.randomUUID();
  const startTime = Date.now();

  ensureDirSync(path.dirname(lockFilePath));

  while (true) {
    try {
      const handle = await fs.promises.open(lockFilePath, 'wx');
      const lockData = {
        pid: process.pid,
        acquiredAt: Date.now(),
        holder,
        token
      };
      await handle.write(Buffer.from(JSON.stringify(lockData, null, 2), 'utf8'));
      await handle.sync();
      await handle.close();

      return { lockFilePath, token };
    } catch (err) {
      if (!['EEXIST', 'EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        throw err;
      }

      // Lock file exists. Check for staleness or dead owner process.
      try {
        const raw = await fs.promises.readFile(lockFilePath, 'utf8');
        const lockInfo = JSON.parse(raw);
        const age = Date.now() - (lockInfo.acquiredAt || 0);

        let isDead = false;
        if (lockInfo.pid && typeof lockInfo.pid === 'number') {
          try {
            process.kill(lockInfo.pid, 0);
          } catch (kErr) {
            if (kErr.code === 'ESRCH') {
              isDead = true;
            }
          }
        }

        if (age > ttl || isDead) {
          try {
            await fs.promises.unlink(lockFilePath);
          } catch (_) {
            // Concurrent unlink is non-fatal
          }
          continue;
        }
      } catch (_) {
        // Transient read or parse error while another process is writing lock
      }

      if (Date.now() - startTime > timeout) {
        const timeoutErr = new Error(
          `LockTimeoutError: Failed to acquire lock ${lockFilePath} within ${timeout}ms`
        );
        timeoutErr.code = 'ELOCKTIMEOUT';
        throw timeoutErr;
      }

      const wait = Math.floor(25 + Math.random() * 35);
      await sleep(wait);
    }
  }
}

/**
 * Releases advisory lock safely with token verification.
 */
export async function releaseLock(lockHandle) {
  if (!lockHandle || !lockHandle.lockFilePath || !lockHandle.token) return;
  const { lockFilePath, token } = lockHandle;

  try {
    if (!fs.existsSync(lockFilePath)) return;
    const raw = await fs.promises.readFile(lockFilePath, 'utf8');
    const lockInfo = JSON.parse(raw);
    if (lockInfo.token === token) {
      await fs.promises.unlink(lockFilePath);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      try {
        await fs.promises.unlink(lockFilePath);
      } catch (_) {}
    }
  }
}

/**
 * Scoped execution inside advisory lock.
 */
export async function withLock(lockFilePath, fn, options = {}) {
  const lock = await acquireLock(lockFilePath, options);
  try {
    return await fn();
  } finally {
    await releaseLock(lock);
  }
}

// -----------------------------------------------------------------------------
// QUEUE & IPC METHODS
// -----------------------------------------------------------------------------

function parseQueueContainer(rawData) {
  if (Array.isArray(rawData)) {
    return { isWrapped: false, raw: null, messages: rawData };
  }
  if (rawData && typeof rawData === 'object' && Array.isArray(rawData.messages)) {
    return { isWrapped: true, raw: rawData, messages: rawData.messages };
  }
  return { isWrapped: false, raw: null, messages: [] };
}

function parseResponseContainer(rawData) {
  if (Array.isArray(rawData)) {
    return { isWrapped: false, raw: null, responses: rawData };
  }
  if (rawData && typeof rawData === 'object' && Array.isArray(rawData.responses)) {
    return { isWrapped: true, raw: rawData, responses: rawData.responses };
  }
  return { isWrapped: false, raw: null, responses: [] };
}

export async function enqueueMessage(messageObject, options = {}) {
  if (!messageObject || typeof messageObject !== 'object') {
    throw new TypeError('messageObject must be a non-null object');
  }
  if (!messageObject.sender || typeof messageObject.sender !== 'string') {
    throw new TypeError('sender is required');
  }
  if (typeof messageObject.text !== 'string') {
    throw new TypeError('text is required');
  }

  const paths = getPaths(options.bridgeDir);
  const queueId = `wa_msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const messageRecord = {
    id: queueId,
    messageId: messageObject.messageId || null,
    timestamp: Date.now(),
    sender: messageObject.sender,
    senderNumber:
      messageObject.senderNumber || String(messageObject.sender).replace(/[^0-9]/g, ''),
    pushName: messageObject.pushName || 'User',
    chatType: messageObject.chatType || (messageObject.groupJid ? 'group' : 'dm'),
    groupJid: messageObject.groupJid || null,
    text: messageObject.text,
    quoted: messageObject.quoted || null,
    mediaAttachment: messageObject.mediaAttachment || null,
    isOwner: Boolean(messageObject.isOwner),
    status: 'pending',
    attempts: 0,
    processedAt: null,
    completedAt: null,
    replyId: null,
    error: null
  };

  await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.queueFile, []);
    const container = parseQueueContainer(rawData);

    // Retention prune: keep last 200 items, purge completed/failed older than 24h
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    container.messages = container.messages
      .filter((m) => {
        const status = (m.status || '').toLowerCase();
        if (status === 'completed' || status === 'failed') {
          return m.timestamp > oneDayAgo;
        }
        return true;
      })
      .slice(-199);

    container.messages.push(messageRecord);

    if (container.isWrapped) {
      container.raw.messages = container.messages;
      container.raw.updatedAt = Date.now();
      await atomicWriteJson(paths.queueFile, container.raw);
    } else {
      await atomicWriteJson(paths.queueFile, container.messages);
    }
  });

  return queueId;
}

export async function getPendingMessages(options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.queueFile, []);
    const { messages } = parseQueueContainer(rawData);
    return messages.filter((m) => (m.status || '').toLowerCase() === 'pending');
  });
}

export async function markProcessing(queueId, options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.queueFile, []);
    const container = parseQueueContainer(rawData);

    const target = container.messages.find((m) => m.id === queueId);
    if (!target) return false;

    target.status = 'processing';
    target.processedAt = Date.now();
    target.attempts = (target.attempts || 0) + 1;

    if (container.isWrapped) {
      container.raw.messages = container.messages;
      container.raw.updatedAt = Date.now();
      await atomicWriteJson(paths.queueFile, container.raw);
    } else {
      await atomicWriteJson(paths.queueFile, container.messages);
    }
    return true;
  });
}

export async function markCompleted(queueId, error = null, options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.queueFile, []);
    const container = parseQueueContainer(rawData);

    const target = container.messages.find((m) => m.id === queueId);
    if (!target) return false;

    target.status = error ? 'failed' : 'completed';
    target.completedAt = Date.now();
    target.error = error ? (error.message || String(error)) : null;
    if (options.replyId) {
      target.replyId = options.replyId;
    }

    if (container.isWrapped) {
      container.raw.messages = container.messages;
      container.raw.updatedAt = Date.now();
      await atomicWriteJson(paths.queueFile, container.raw);
    } else {
      await atomicWriteJson(paths.queueFile, container.messages);
    }
    return true;
  });
}

export async function appendResponse(responseObject, options = {}) {
  if (!responseObject || typeof responseObject !== 'object') {
    throw new TypeError('responseObject must be a non-null object');
  }
  if (!responseObject.targetJid || typeof responseObject.targetJid !== 'string') {
    throw new TypeError('targetJid is required');
  }
  if (typeof responseObject.text !== 'string') {
    throw new TypeError('text is required');
  }

  const paths = getPaths(options.bridgeDir);
  const responseId = `wa_resp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const responseRecord = {
    id: responseId,
    queueId: responseObject.queueId || null,
    targetJid: responseObject.targetJid,
    chatType: responseObject.chatType || (responseObject.groupJid ? 'group' : 'dm'),
    groupJid: responseObject.groupJid || null,
    text: responseObject.text,
    actions: Array.isArray(responseObject.actions) ? responseObject.actions : [],
    stickerKey: responseObject.stickerKey || null,
    mediaAttachment: responseObject.mediaAttachment || null,
    quotedMessageId: responseObject.quotedMessageId || null,
    timestamp: Date.now(),
    status: 'pending',
    deliveredAt: null
  };

  await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.responseFile, []);
    const container = parseResponseContainer(rawData);

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    container.responses = container.responses
      .filter((r) => {
        const status = (r.status || '').toLowerCase();
        if (status === 'delivered' || status === 'failed') {
          return r.timestamp > oneDayAgo;
        }
        return true;
      })
      .slice(-199);

    container.responses.push(responseRecord);

    if (container.isWrapped) {
      container.raw.responses = container.responses;
      container.raw.updatedAt = Date.now();
      await atomicWriteJson(paths.responseFile, container.raw);
    } else {
      await atomicWriteJson(paths.responseFile, container.responses);
    }
  });

  return responseId;
}

export async function fetchResponses(options = {}) {
  const paths = getPaths(options.bridgeDir);
  const targetStatus = (options.status || 'pending').toLowerCase();
  const targetJid = options.targetJid || null;
  const markDelivered = Boolean(options.markDelivered);

  return await withLock(paths.lockFile, async () => {
    const rawData = await readJsonSafe(paths.responseFile, []);
    const container = parseResponseContainer(rawData);

    const matched = container.responses.filter((r) => {
      const matchStatus = (r.status || '').toLowerCase() === targetStatus;
      const matchJid = !targetJid || r.targetJid === targetJid;
      return matchStatus && matchJid;
    });

    if (markDelivered && matched.length > 0) {
      const matchedIds = new Set(matched.map((m) => m.id));
      for (const r of container.responses) {
        if (matchedIds.has(r.id)) {
          r.status = 'delivered';
          r.deliveredAt = Date.now();
        }
      }

      if (container.isWrapped) {
        container.raw.responses = container.responses;
        container.raw.updatedAt = Date.now();
        await atomicWriteJson(paths.responseFile, container.raw);
      } else {
        await atomicWriteJson(paths.responseFile, container.responses);
      }
    }

    return matched;
  });
}

export async function updateHeartbeat(options = {}) {
  const paths = getPaths(options.bridgeDir);
  const payload = {
    status: 'ALIVE',
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    pid: process.pid,
    uptime: Math.round(process.uptime() * 10) / 10,
    version: '1.0.0'
  };
  await atomicWriteJson(paths.heartbeatFile, payload);
}

export async function checkHeartbeat(maxAgeMs = 15000, options = {}) {
  const paths = getPaths(options.bridgeDir);
  const data = await readJsonSafe(paths.heartbeatFile, null);
  if (!data || typeof data.timestamp !== 'number') {
    return {
      alive: false,
      ageMs: Infinity,
      lastSeen: null,
      pid: null,
      status: null
    };
  }

  const ageMs = Date.now() - data.timestamp;
  const alive = ageMs <= maxAgeMs && data.status === 'ALIVE';

  return {
    alive,
    ageMs,
    lastSeen: data.timestamp,
    pid: data.pid || null,
    status: data.status || null
  };
}

export default {
  DEFAULT_BRIDGE_DIR,
  LOCK_TTL_MS,
  LOCK_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  getPaths,
  atomicWriteJson,
  readJsonSafe,
  acquireLock,
  releaseLock,
  withLock,
  enqueueMessage,
  getPendingMessages,
  markProcessing,
  markCompleted,
  appendResponse,
  fetchResponses,
  updateHeartbeat,
  checkHeartbeat
};

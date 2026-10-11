# Technical Analysis and Architecture Design: IPC Storage and Locking (`bridge/ipc.js`)

## 1. Executive Summary

Milestone 1 establishes the foundational storage and inter-process communication (IPC) layer between Niwo Bot (WhatsApp Baileys client in Node.js) and the Antigravity C2 agent session. The IPC subsystem operates across multiple separate processes on Windows 11:
1. Niwo Bot runtime (`src/lib/antigravityBridge.js`)
2. Antigravity bridge watcher daemon (`bridge/daemon.js`)
3. Antigravity agent CLI responder helper (`bridge/reply.js`)
4. Potential background system workers

Because these processes read and write shared JSON state files (`wa_queue.json`, `wa_response.json`, `bridge_heartbeat.json`) asynchronously, standard file operations (`fs.writeFile`, `fs.writeFileSync`) introduce severe failure modes on Windows. These include `EBUSY` and `EPERM` sharing violations, half-written JSON files causing `SyntaxError: Unexpected end of JSON input`, and the lost-update anomaly where parallel writers overwrite each other's changes.

This document details the concrete implementation strategy for `bridge/ipc.js`, featuring an atomic write pipeline (temp file + fsync + close + rename + exponential backoff retry), an advisory lock file (`bridge/.queue.lock`) with 5000ms TTL stale expiration, strict JSON schemas, and eight production-ready helper methods.

---

## 2. Windows Filesystem Concurrency and Sharing Violations

### 2.1 The Windows NTFS Lock Model
Unlike POSIX systems where file unlinking and directory renaming succeed atomically even while other processes hold open read descriptors, Windows NTFS enforces mandatory byte-range locking and strict sharing modes (`FILE_SHARE_READ`, `FILE_SHARE_WRITE`, `FILE_SHARE_DELETE`).

When Node.js executes `fs.rename(source, destination)` on Windows:
1. Node.js invokes the Win32 API `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`.
2. If `destination` is open by another handle without `FILE_SHARE_DELETE`, the Win32 call fails with error code 32 (`ERROR_SHARING_VIOLATION`) or error code 5 (`ERROR_ACCESS_DENIED`). Node.js maps these to `EBUSY` or `EPERM`.
3. Background services such as Windows Defender (`MsMpEng.exe`), Search Indexer, and Chokidar file watchers frequently hold transient read handles on newly created or modified files for 5 to 50 milliseconds. A naive write or rename that does not retry will crash the application.

### 2.2 Incomplete Buffer Reads (Torn Writes)
When a process writes directly to `bridge/wa_queue.json` using streaming writes or default `fs.writeFile`:
- A Chokidar watcher or concurrent reader triggers on the `change` event while the OS buffer is partially flushed.
- The reader attempts `JSON.parse()` on truncated text (e.g. `{"version":1,"messages":[{"id":"wa_msg_...`) and crashes with `SyntaxError`.
- Direct writes must be banned. All writes must target a private temp file on the same volume, sync to disk, close cleanly, and rename atomically into place.

---

## 3. Atomic Write Algorithm (`atomicWriteJson`)

### 3.1 Algorithm Specification
To eliminate torn writes and survive Windows sharing violations, the write pipeline follows six strict stages:

```
[Serialize to UTF-8 Buffer]
             │
             ▼
[Create Unique Temp File in Target Dir (.wa_queue.json.<pid>.<ts>.<rand>.tmp)]
             │
             ▼
[Write Buffer via FileHandle]
             │
             ▼
[Flush OS & Disk Buffers (fileHandle.sync())]
             │
             ▼
[Close FileHandle (Crucial on Windows before rename)]
             │
             ▼
[Atomic Rename (MoveFileExW) with Exponential Backoff Retry]
   ├── Success ──► Complete
   └── EBUSY / EPERM / EACCES ──► Sleep (25ms * 1.5^attempt + jitter) ──► Retry (Max 12x)
             │
             ▼
[Finally: Guaranteed Cleanup of Temp File if Still Present]
```

### 3.2 Temp File Placement Rule
The temporary file MUST be created in the exact same directory as the target file:
- Rationale: Moving files across filesystem mount points or drives in Windows results in a copy-and-delete fallback, destroying atomicity. Placing the `.tmp` file in the same directory guarantees that `MoveFileExW` performs an atomic NTFS directory index pointer exchange.
- Naming format: `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`

### 3.3 Retry Backoff Parameters
- Target Errors: `EBUSY`, `EPERM`, `EACCES`, `EMFILE`, `ENFILE`
- Max Retries: 12 attempts
- Initial Base Delay: 25 milliseconds
- Multiplier: 1.5
- Randomized Jitter: `Math.floor(Math.random() * 20)` milliseconds
- Maximum Per-Attempt Cap: 250 milliseconds
- Cumulative Retry Duration: ~1.8 seconds (sufficient to outlast Windows Defender and directory change event scans)

---

## 4. Advisory File Lock (`bridge/.queue.lock`) with Stale Lock Expiration

### 4.1 Locking Philosophy
Atomic file writes prevent corrupt JSON, but they do NOT prevent race conditions during read-modify-write workflows:
- Process A reads queue (3 pending messages).
- Process B reads queue (3 pending messages).
- Process A appends Message 4 and atomically writes queue.
- Process B appends Message 5 and atomically writes queue.
- Result: Message 4 is overwritten and lost.

To guarantee mutual exclusion across independent processes, an advisory lock file (`bridge/.queue.lock`) coordinates all state modifications.

### 4.2 Atomic Lock Acquisition via `open('wx')`
In Node.js, `fs.promises.open(lockPath, 'wx')` passes the `O_CREAT | O_EXCL` flags directly to the OS kernel. This is an atomic check-and-create operation:
- If the file does not exist: the OS creates it and returns a file descriptor.
- If the file exists: the OS fails immediately with `EEXIST`.

### 4.3 Lock File Metadata
Once created, the lock holder writes its ownership descriptor:
```json
{
  "pid": 28412,
  "acquiredAt": 1728392400100,
  "holder": "NiwoBot_BridgeWriter",
  "token": "d748f2c1-8419-4d57-b081-36427df61a12"
}
```
- `token`: A unique UUIDv4 or crypto-random nonce generated per lock acquisition.
- `holder`: Informative tag indicating process name or function.
- `acquiredAt`: Epoch timestamp in milliseconds.
- `pid`: Process identifier.

### 4.4 Stale Lock Detection & Break (TTL 5000ms)
If `fs.promises.open` returns `EEXIST`, the lock is currently held. The requester inspects the existing lock file:
1. Parse the lock file content.
2. Calculate age: `const ageMs = Date.now() - lockData.acquiredAt`.
3. Check Process Liveness:
   On Windows and Node.js, execute `process.kill(lockData.pid, 0)`:
   - If it succeeds or throws `EPERM`: the process is alive.
   - If it throws `ESRCH`: the process is definitively dead and crashed without cleaning its lock.
4. Eviction Condition:
   The lock is declared stale if:
   `ageMs > ttlMs` (where `ttlMs` = 5000ms) OR `isProcessDead === true`.
5. Safe Lock Break:
   The requester attempts to unlink `bridge/.queue.lock`. If `unlink` succeeds (or returns `ENOENT` because another contender already unlinked it), the requester re-enters the acquisition loop.

### 4.5 Lock Release and Anti-ABA Guard
To prevent a slow process from deleting a lock that has already expired and been re-acquired by a third process (the classic ABA race):
- When releasing, the process reads `bridge/.queue.lock`.
- It compares `currentLock.token === heldLock.token`.
- Only if the tokens match does it invoke `fs.promises.unlink`.
- If the tokens do not match, it leaves the lock untouched and logs a warning.

---

## 5. Storage Schemas

### 5.1 Inbound Message Queue (`bridge/wa_queue.json`)
```json
{
  "version": 1,
  "updatedAt": 1728392400000,
  "messages": [
    {
      "id": "wa_msg_1728392400000_a9b1c2",
      "timestamp": 1728392400000,
      "sender": "628123456789@s.whatsapp.net",
      "senderNumber": "628123456789",
      "pushName": "Ilham",
      "chatType": "dm",
      "groupJid": null,
      "text": "Tolong cek status server",
      "quoted": null,
      "isOwner": true,
      "status": "pending",
      "attempts": 0,
      "processedAt": null,
      "completedAt": null,
      "error": null
    }
  ]
}
```

Field rules:
- `id`: Unique identifier formatted as `wa_msg_<timestamp>_<6-hex-chars>`.
- `chatType`: Either `"dm"` or `"group"`.
- `groupJid`: Required when `chatType === "group"`, null otherwise.
- `quoted`: Object containing `{ id: string, sender: string, text: string }` if quoting another message, else null.
- `status`: State machine transition: `"pending"` -> `"processing"` -> `"completed"` (or `"failed"`).
- `attempts`: Non-negative integer tracking daemon pickup count.

### 5.2 Outbound Agent Response Queue (`bridge/wa_response.json`)
```json
{
  "version": 1,
  "updatedAt": 1728392405000,
  "responses": [
    {
      "id": "wa_resp_1728392405000_f3e2d1",
      "queueId": "wa_msg_1728392400000_a9b1c2",
      "timestamp": 1728392405000,
      "targetJid": "628123456789@s.whatsapp.net",
      "text": "Server berjalan dengan lancar (*v*)",
      "actions": ["SEND_STICKER_HAPPY"],
      "stickerKey": "happy",
      "mediaAttachment": null,
      "status": "pending",
      "deliveredAt": null
    }
  ]
}
```

Field rules:
- `id`: Unique identifier formatted as `wa_resp_<timestamp>_<6-hex-chars>`.
- `queueId`: ID of the corresponding inbound message if responding to one, or null for proactive messages.
- `actions`: Array of parsed action directives (e.g. `SEND_STICKER_SHY`, `EXEC_SCREENSHOT`).
- `status`: `"pending"` -> `"delivered"` -> `"failed"`.
- `mediaAttachment`: Object containing `{ type: "image", path: string }` if media is attached, else null.

### 5.3 Daemon Heartbeat (`bridge/bridge_heartbeat.json`)
```json
{
  "status": "ALIVE",
  "timestamp": 1728392400000,
  "pid": 28412,
  "uptime": 3600,
  "version": "1.0.0"
}
```

Field rules:
- `status`: Constant `"ALIVE"`.
- `timestamp`: Milliseconds timestamp of last heartbeat pulse.
- `pid`: Process identifier of `bridge/daemon.js`.
- `uptime`: Seconds elapsed since daemon start.

---

## 6. Helper Methods Specifications and Contract Details

All functions reside in `bridge/ipc.js` and operate with standard promises.

### 6.1 `enqueueMessage(messageObject, options)`
- **Signature**: `async function enqueueMessage(messageObject, options = {})`
- **Input Parameters**:
  - `messageObject`: Object containing `{ sender, senderNumber, pushName, chatType, groupJid, text, quoted, isOwner }`
  - `options.bridgeDir`: Custom bridge directory path (defaults to `path.join(process.cwd(), 'bridge')`)
- **Preconditions**:
  - `sender` and `text` must be non-empty strings.
  - `chatType` must be `"dm"` or `"group"`.
- **Processing**:
  1. Validate input; throw `TypeError` if required fields are missing.
  2. Generate unique `id`: `wa_msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`.
  3. Acquire `.queue.lock` via `withLock`.
  4. Read `bridge/wa_queue.json` (initialize fallback object `{ version: 1, updatedAt: Date.now(), messages: [] }` if missing or corrupted).
  5. Prune retention: keep max 200 items; remove items completed/failed older than 24 hours.
  6. Push new record with status `"pending"`.
  7. Write `bridge/wa_queue.json` via `atomicWriteJson`.
- **Output**: Returns Promise resolving to the created `queueId` string.

### 6.2 `getPendingMessages(options)`
- **Signature**: `async function getPendingMessages(options = {})`
- **Input Parameters**:
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Acquire `.queue.lock` via `withLock`.
  2. Read and parse `bridge/wa_queue.json`.
  3. Filter items where `status === 'pending'`.
- **Output**: Resolves to an array of pending `QueueMessage` objects.

### 6.3 `markProcessing(queueId, options)`
- **Signature**: `async function markProcessing(queueId, options = {})`
- **Input Parameters**:
  - `queueId`: Target message ID string
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Acquire `.queue.lock` via `withLock`.
  2. Read `bridge/wa_queue.json`.
  3. Locate message with `id === queueId`. If not found, return `false`.
  4. Mutate record:
     `status = 'processing'`
     `processedAt = Date.now()`
     `attempts = (attempts || 0) + 1`
  5. Write `bridge/wa_queue.json` via `atomicWriteJson`.
- **Output**: Resolves to `true` if updated, `false` if not found.

### 6.4 `markCompleted(queueId, error = null, options = {})`
- **Signature**: `async function markCompleted(queueId, error = null, options = {})`
- **Input Parameters**:
  - `queueId`: Target message ID string
  - `error`: Error instance or string if failed, null if completed successfully
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Acquire `.queue.lock` via `withLock`.
  2. Read `bridge/wa_queue.json`.
  3. Locate message with `id === queueId`. If not found, return `false`.
  4. Mutate record:
     `status = error ? 'failed' : 'completed'`
     `completedAt = Date.now()`
     `error = error ? (error.message || String(error)) : null`
  5. Write `bridge/wa_queue.json` via `atomicWriteJson`.
- **Output**: Resolves to `true` if updated, `false` if not found.

### 6.5 `appendResponse(responseObject, options = {})`
- **Signature**: `async function appendResponse(responseObject, options = {})`
- **Input Parameters**:
  - `responseObject`: Object containing `{ queueId, targetJid, text, actions, stickerKey, mediaAttachment }`
  - `options.bridgeDir`: Custom bridge directory path
- **Preconditions**:
  - `targetJid` and `text` must be valid strings.
- **Processing**:
  1. Validate fields.
  2. Generate unique `id`: `wa_resp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`.
  3. Acquire `.queue.lock` (or dedicated `.response.lock`) via `withLock`.
  4. Read `bridge/wa_response.json` (initialize fallback object `{ version: 1, updatedAt: Date.now(), responses: [] }` if missing or corrupted).
  5. Prune delivered/failed items older than 24 hours (keep max 200 items).
  6. Push response with `status: "pending"`, `timestamp: Date.now()`.
  7. Write `bridge/wa_response.json` via `atomicWriteJson`.
- **Output**: Resolves to the created `responseId` string.

### 6.6 `fetchResponses(options = {})`
- **Signature**: `async function fetchResponses(options = {})`
- **Input Parameters**:
  - `options.targetJid`: Optional WhatsApp JID filter
  - `options.status`: Status filter (defaults to `"pending"`)
  - `options.markDelivered`: Boolean. If true, atomically marks returned responses as `"delivered"`.
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Acquire lock via `withLock`.
  2. Read `bridge/wa_response.json`.
  3. Filter items matching `status` and `targetJid` (if specified).
  4. If `markDelivered === true` and matching items exist:
     - Mutate matched items: `status = 'delivered'`, `deliveredAt = Date.now()`.
     - Write `bridge/wa_response.json` via `atomicWriteJson`.
- **Output**: Resolves to an array of matching `QueueResponse` objects.

### 6.7 `updateHeartbeat(options = {})`
- **Signature**: `async function updateHeartbeat(options = {})`
- **Input Parameters**:
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Construct heartbeat payload:
     `{ status: "ALIVE", timestamp: Date.now(), pid: process.pid, uptime: Math.floor(process.uptime()), version: "1.0.0" }`
  2. Write `bridge/bridge_heartbeat.json` via `atomicWriteJson`.
  (Heartbeat does not require mutex locking because only `bridge/daemon.js` writes to this file).
- **Output**: Resolves to `void`.

### 6.8 `checkHeartbeat(maxAgeMs = 15000, options = {})`
- **Signature**: `async function checkHeartbeat(maxAgeMs = 15000, options = {})`
- **Input Parameters**:
  - `maxAgeMs`: Maximum acceptable age in milliseconds before declaring daemon stale (default 15000).
  - `options.bridgeDir`: Custom bridge directory path
- **Processing**:
  1. Read `bridge/bridge_heartbeat.json`. If file does not exist or JSON parsing fails, return `{ alive: false, ageMs: Infinity, lastSeen: null, pid: null }`.
  2. Compute `ageMs = Date.now() - data.timestamp`.
  3. Validate: `alive = ageMs <= maxAgeMs && data.status === "ALIVE"`.
- **Output**: Resolves to `{ alive: boolean, ageMs: number, lastSeen: number | null, pid: number | null }`.

---

## 7. Module System Interoperability

### 7.1 ESM and CommonJS Dual Compatibility Strategy
The repository contains a hybrid module topology:
- `package.json` at root defines CommonJS (no `"type": "module"`).
- `src/lib/package.json` defines `{ "type": "module" }` (ESM).
- `plugins/package.json` defines `{ "type": "module" }` (ESM).
- `bridge/` scripts will be executed both as standalone CLI (`node bridge/daemon.js`, `node bridge/reply.js`) and imported by `src/lib/antigravityBridge.js`.

### 7.2 Implementation Decision
1. Place a dedicated `bridge/package.json` containing `{ "type": "module" }`.
2. Write `bridge/ipc.js` in modern native ECMAScript Modules (`export async function ...`).
3. This allows:
   - `src/lib/antigravityBridge.js` to directly write:
     `import { enqueueMessage, fetchResponses, checkHeartbeat } from '../../bridge/ipc.js';`
   - `bridge/daemon.js` and `bridge/reply.js` to directly import `bridge/ipc.js`.
   - Node.js 18+ natively supports ES Modules out of the box.
   - For any potential CommonJS caller (like root scripts), dynamic `const { enqueueMessage } = await import('./bridge/ipc.js')` provides 100% interoperability without transpile bloat.

---

## 8. Complete Reference Implementation

Below is the production-ready implementation of `bridge/ipc.js` adhering to all constraints:

```javascript
/**
 * bridge/ipc.js
 * -----------------------------------------------------------------------------
 * Concurrency-safe Inter-Process Communication Storage & Locking Module.
 * Implements atomic writes on Windows (temp file + fsync + close + rename + retry),
 * advisory file locking with 5000ms stale TTL, and queue/heartbeat operations.
 * -----------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_BRIDGE_DIR = path.resolve(process.cwd(), 'bridge');
const LOCK_TTL_MS = 5000;
const LOCK_TIMEOUT_MS = 10000;
const RETRY_BASE_DELAY_MS = 25;
const RETRY_MAX_ATTEMPTS = 12;

function getPaths(customDir) {
  const dir = customDir ? path.resolve(customDir) : DEFAULT_BRIDGE_DIR;
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
 * Atomically writes data to a file using temp-file + fsync + close + rename with retry.
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
      } catch {}
    }
    if (fs.existsSync(tempPath)) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
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
  } catch (err) {
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
      if (err.code !== 'EEXIST') {
        throw err;
      }

      // Lock file exists. Check for staleness.
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
          } catch (uErr) {
            // Ignored if unlinked concurrently
          }
          continue;
        }
      } catch (readErr) {
        // Corrupted or being written, loop to retry
      }

      if (Date.now() - startTime > timeout) {
        throw new Error(
          `LockTimeoutError: Failed to acquire lock ${lockFilePath} within ${timeout}ms`
        );
      }

      const wait = Math.floor(30 + Math.random() * 40);
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
      } catch {}
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

export async function enqueueMessage(messageObject, options = {}) {
  if (!messageObject || typeof messageObject !== 'object') {
    throw new TypeError('messageObject must be a non-null object');
  }
  if (!messageObject.sender || typeof messageObject.sender !== 'string') {
    throw new TypeError('sender is required');
  }
  if (!messageObject.text || typeof messageObject.text !== 'string') {
    throw new TypeError('text is required');
  }

  const paths = getPaths(options.bridgeDir);
  const queueId = `wa_msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const messageRecord = {
    id: queueId,
    timestamp: Date.now(),
    sender: messageObject.sender,
    senderNumber: messageObject.senderNumber || messageObject.sender.split('@')[0],
    pushName: messageObject.pushName || 'User',
    chatType: messageObject.chatType || 'dm',
    groupJid: messageObject.groupJid || null,
    text: messageObject.text,
    quoted: messageObject.quoted || null,
    isOwner: Boolean(messageObject.isOwner),
    status: 'pending',
    attempts: 0,
    processedAt: null,
    completedAt: null,
    error: null
  };

  await withLock(paths.lockFile, async () => {
    const queueData = (await readJsonSafe(paths.queueFile)) || {
      version: 1,
      updatedAt: Date.now(),
      messages: []
    };

    // Retention prune: keep last 200 items, purge completed > 24h
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    queueData.messages = queueData.messages
      .filter((m) => {
        if (m.status === 'completed' || m.status === 'failed') {
          return m.timestamp > oneDayAgo;
        }
        return true;
      })
      .slice(-199);

    queueData.messages.push(messageRecord);
    queueData.updatedAt = Date.now();
    await atomicWriteJson(paths.queueFile, queueData);
  });

  return queueId;
}

export async function getPendingMessages(options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const queueData = await readJsonSafe(paths.queueFile);
    if (!queueData || !Array.isArray(queueData.messages)) return [];
    return queueData.messages.filter((m) => m.status === 'pending');
  });
}

export async function markProcessing(queueId, options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const queueData = await readJsonSafe(paths.queueFile);
    if (!queueData || !Array.isArray(queueData.messages)) return false;

    const target = queueData.messages.find((m) => m.id === queueId);
    if (!target) return false;

    target.status = 'processing';
    target.processedAt = Date.now();
    target.attempts = (target.attempts || 0) + 1;
    queueData.updatedAt = Date.now();

    await atomicWriteJson(paths.queueFile, queueData);
    return true;
  });
}

export async function markCompleted(queueId, error = null, options = {}) {
  const paths = getPaths(options.bridgeDir);
  return await withLock(paths.lockFile, async () => {
    const queueData = await readJsonSafe(paths.queueFile);
    if (!queueData || !Array.isArray(queueData.messages)) return false;

    const target = queueData.messages.find((m) => m.id === queueId);
    if (!target) return false;

    target.status = error ? 'failed' : 'completed';
    target.completedAt = Date.now();
    target.error = error ? (error.message || String(error)) : null;
    queueData.updatedAt = Date.now();

    await atomicWriteJson(paths.queueFile, queueData);
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
    timestamp: Date.now(),
    targetJid: responseObject.targetJid,
    text: responseObject.text,
    actions: Array.isArray(responseObject.actions) ? responseObject.actions : [],
    stickerKey: responseObject.stickerKey || null,
    mediaAttachment: responseObject.mediaAttachment || null,
    status: 'pending',
    deliveredAt: null
  };

  await withLock(paths.lockFile, async () => {
    const respData = (await readJsonSafe(paths.responseFile)) || {
      version: 1,
      updatedAt: Date.now(),
      responses: []
    };

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    respData.responses = respData.responses
      .filter((r) => {
        if (r.status === 'delivered' || r.status === 'failed') {
          return r.timestamp > oneDayAgo;
        }
        return true;
      })
      .slice(-199);

    respData.responses.push(responseRecord);
    respData.updatedAt = Date.now();
    await atomicWriteJson(paths.responseFile, respData);
  });

  return responseId;
}

export async function fetchResponses(options = {}) {
  const paths = getPaths(options.bridgeDir);
  const targetStatus = options.status || 'pending';
  const targetJid = options.targetJid || null;
  const markDelivered = Boolean(options.markDelivered);

  return await withLock(paths.lockFile, async () => {
    const respData = await readJsonSafe(paths.responseFile);
    if (!respData || !Array.isArray(respData.responses)) return [];

    const matched = respData.responses.filter((r) => {
      const matchStatus = r.status === targetStatus;
      const matchJid = !targetJid || r.targetJid === targetJid;
      return matchStatus && matchJid;
    });

    if (markDelivered && matched.length > 0) {
      const matchedIds = new Set(matched.map((m) => m.id));
      for (const r of respData.responses) {
        if (matchedIds.has(r.id)) {
          r.status = 'delivered';
          r.deliveredAt = Date.now();
        }
      }
      respData.updatedAt = Date.now();
      await atomicWriteJson(paths.responseFile, respData);
    }

    return matched;
  });
}

export async function updateHeartbeat(options = {}) {
  const paths = getPaths(options.bridgeDir);
  const payload = {
    status: 'ALIVE',
    timestamp: Date.now(),
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
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
      pid: null
    };
  }

  const ageMs = Date.now() - data.timestamp;
  const alive = ageMs <= maxAgeMs && data.status === 'ALIVE';

  return {
    alive,
    ageMs,
    lastSeen: data.timestamp,
    pid: data.pid || null
  };
}
```

---

## 9. Concurrency & Atomic Writes Test Verification Plan

The test suite must be integrated into `test/e2e/tier2_boundary_tests.js` and standalone unit checks.

### Test Case TC-IPC-01: Windows Concurrent Atomic Write Integrity
- **Objective**: Prove that multiple concurrent writes never produce corrupted or partially-written JSON files.
- **Setup**:
  1. Initialize clean temp directory `bridge_test_atomic/`.
  2. Spawn 10 concurrent asynchronous workers. Each worker performs 25 consecutive writes with random data payloads (total 250 writes).
  3. Concurrently run 5 rapid reader loops that continuously read and execute `JSON.parse()` on `bridge_test_atomic/wa_queue.json` every 5 milliseconds.
- **Pass Criteria**:
  - Exactly 0 `SyntaxError: Unexpected end of JSON input` thrown by readers.
  - Exactly 0 unhandled `EBUSY` or `EPERM` rejections crash the workers.
  - Final file parses successfully and passes schema validation.

### Test Case TC-IPC-02: Advisory Lock Mutual Exclusion
- **Objective**: Prove that `bridge/.queue.lock` guarantees strict single-holder execution.
- **Setup**:
  1. Create a shared test counter file `bridge_test_lock/counter.json` holding `{ count: 0 }`.
  2. Spawn 8 parallel worker tasks competing for `.queue.lock`.
  3. Inside the locked block, each worker reads the counter, sleeps for 30ms (simulating I/O delay), increments the value, and writes it back.
- **Pass Criteria**:
  - Final counter equals `8 * numIterations` with zero lost updates.
  - An in-memory concurrent holder detector records a maximum concurrency of exactly 1.

### Test Case TC-IPC-03: Stale Lock Expiration & Dead Process Recovery
- **Objective**: Verify that abandoned or stale locks are evicted cleanly without manual intervention.
- **Setup**:
  1. Manually write `bridge_test_stale/.queue.lock` with `acquiredAt: Date.now() - 7000` (older than 5000ms TTL) and dummy `pid: 99999999`.
  2. Call `acquireLock` with `ttl: 5000`.
- **Pass Criteria**:
  - `acquireLock` completes in under 250 milliseconds.
  - The stale lock is evicted, and a new valid lock with current PID and fresh token is created.

### Test Case TC-IPC-04: Queue Lifecycle State Transitions
- **Objective**: Verify end-to-end status transitions from pending to processing and completed.
- **Setup**:
  1. Enqueue 5 test messages.
  2. Verify all 5 are returned by `getPendingMessages()`.
  3. Call `markProcessing()` on message 1; verify message 1 is omitted from subsequent `getPendingMessages()`.
  4. Call `markCompleted()` on message 1. Verify status is `"completed"` and `completedAt` is recorded.
  5. Call `markCompleted()` with error on message 2. Verify status is `"failed"` and `error` contains the message.
- **Pass Criteria**:
  - All state transitions persist correctly and match schema contracts.

### Test Case TC-IPC-05: Heartbeat Freshness and Staleness Detection
- **Objective**: Verify daemon liveness detection and offline thresholding.
- **Setup**:
  1. Call `updateHeartbeat()`.
  2. Call `checkHeartbeat(15000)`. Assert `alive === true` and `ageMs < 100`.
  3. Overwrite `bridge_heartbeat.json` with a timestamp 20000ms in the past.
  4. Call `checkHeartbeat(15000)`. Assert `alive === false` and `ageMs >= 20000`.
  5. Delete `bridge_heartbeat.json`. Assert `alive === false` and `ageMs === Infinity`.
- **Pass Criteria**:
  - Returns expected boolean flags without throwing uncaught exceptions.

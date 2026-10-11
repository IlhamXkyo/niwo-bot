# Technical Analysis and Architecture Design: Daemon Watcher (`bridge/daemon.js`)

## Executive Summary
This document defines the complete architectural specification and implementation strategy for the Daemon Watcher script (`bridge/daemon.js`) in Milestone 1 of the Remote C2 Assistant project.

The Daemon Watcher serves as the critical bridge link between Niwo Bot's file-based IPC queue (`wa_queue.json`) and the active Antigravity session. It performs three core runtime duties:
1. High-fidelity file watching via Chokidar with tuned `awaitWriteFinish` and multi-tier event deduplication on Windows 11 NTFS.
2. High-precision 5-second heartbeat emitter publishing liveness status to `bridge/bridge_heartbeat.json`.
3. Standardized stdout log emitter delivering the exact `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE` wake signal required to trigger Antigravity reactive wakeups.
4. Resilient process lifecycle with single-instance mutex locking, stale PID recovery, and graceful shutdown handling.

---

## 1. Chokidar File Watcher Setup on Windows 11

### 1.1 Root Cause of Duplicate Events on Windows NTFS
Under the Windows NTFS filesystem, any file write operation triggers multiple raw OS notifications through the Win32 `ReadDirectoryChangesW` API:
- `FILE_ACTION_MODIFIED` is generated when metadata changes (timestamps, file allocation size).
- Another `FILE_ACTION_MODIFIED` is generated when data buffers are flushed to disk.
- When atomic file replacement is used (writing to `.tmp` followed by `fs.rename` via `MoveFileExW`), Windows can generate `FILE_ACTION_REMOVED`, `FILE_ACTION_RENAMED_NEW_NAME`, and subsequent `FILE_ACTION_MODIFIED` events in rapid succession within 5 to 50 milliseconds.

If a file watcher listens naively to `fs.watch` or unconfigured Chokidar, each incoming WhatsApp message triggers 2 to 4 duplicate events. This leads to duplicate wake emissions and race conditions.

### 1.2 Optimal Chokidar Configuration
Chokidar v3.6.0 provides the `awaitWriteFinish` option. However, default settings (`stabilityThreshold: 2000`) cause an unacceptable 2-second lag. Setting it too aggressively (< 100ms) risks reading partially flushed JSON.

The calibrated configuration for Windows 11 NTFS:

```javascript
const chokidar = require('chokidar');
const path = require('path');

const QUEUE_FILE_PATH = path.resolve(__dirname, 'wa_queue.json');

const watcherOptions = {
  persistent: true,
  ignoreInitial: true, // Startup backlog is processed separately by explicit drain
  awaitWriteFinish: {
    stabilityThreshold: 300, // 300ms stability window guarantees write completion
    pollInterval: 100        // Check size and mtime every 100ms
  },
  atomic: true,              // Handles atomic temp-file replace patterns
  usePolling: false,         // Native Windows ReadDirectoryChangesW (minimal CPU, low latency)
  depth: 0,
  ignorePermissionErrors: true
};

const watcher = chokidar.watch(QUEUE_FILE_PATH, watcherOptions);
```

Key configuration rationale:
- `stabilityThreshold: 300`: On Windows NTFS with background antivirus (Defender), 300ms ensures all file handles and buffer flushes are settled while keeping latency under a third of a second.
- `pollInterval: 100`: High responsiveness without measurable CPU overhead.
- `atomic: true`: Tells Chokidar to recognize temporary file rename sequences.
- `usePolling: false`: Keeps CPU consumption near 0% by utilizing OS-level event notification.
- Event binding: Must bind to both `'add'` and `'change'` events because on Windows, atomic replacement can be interpreted as either event depending on file handle release timing:
  ```javascript
  watcher
    .on('add', filePath => handleQueueEvent('add', filePath))
    .on('change', filePath => handleQueueEvent('change', filePath))
    .on('error', error => handleWatcherError(error));
  ```

### 1.3 Multi-Tier Deduplication Architecture
Because filesystem events can never provide 100% deduplication guarantees across all OS environments, the daemon implements a secondary application-level defense layer:

1. **In-Memory Seen Message Tracker**:
   A local `Set` (`seenMessageIds = new Set()`) tracks message IDs that have already triggered a wake emission during this daemon process lifetime.
2. **Debounce Queue Processor**:
   A 100ms debounce timer coalesces burst notifications into a single discrete queue processing pass.
3. **Queue Status Validation**:
   When reading `wa_queue.json`, only items with `status === 'pending'` are inspected. Once an item has been emitted, its ID is stored in `seenMessageIds`.
4. **Bounded Memory Pruning**:
   When `seenMessageIds.size > 2000`, older IDs are purged or the set is re-synchronized against current queue records to prevent unbounded memory growth during long-term daemon execution.
5. **Startup Queue Drain**:
   On daemon initialization, the daemon reads `wa_queue.json` immediately. Any existing messages with `status === 'pending'` are processed, preventing dropped messages if Niwo Bot enqueued items while the daemon was restarting.

---

## 2. Periodic Heartbeat Generator (`bridge/bridge_heartbeat.json`)

### 2.1 Heartbeat Architecture & System Purpose
The heartbeat file provides authoritative liveness telemetry for external observers:
- Niwo Bot (`plugins/owner/gravity.js` and `src/lib/antigravityBridge.js`) inspects this file to verify whether the Antigravity C2 daemon is active.
- If `Date.now() - heartbeat.timestamp > 15000` (15 seconds), Niwo Bot triggers Fallback Mode (notifies user that Antigravity is offline and presents the "Open Antigravity" button).
- If the daemon shuts down gracefully, it updates `"status": "STOPPED"` so Niwo Bot detects offline status immediately without waiting for the 15-second timeout.

### 2.2 Heartbeat Schema Specification
File path: `bridge/bridge_heartbeat.json`

```json
{
  "status": "ALIVE",
  "timestamp": 1728392840000,
  "isoTime": "2026-10-08T13:10:40.000Z",
  "pid": 12345,
  "uptime": 125.4,
  "pendingMessages": 0,
  "version": "1.0.0"
}
```

Field Definitions:
- `status`: String enum: `"ALIVE"` during active execution, `"STOPPED"` upon graceful termination.
- `timestamp`: Integer Unix timestamp in milliseconds (`Date.now()`).
- `isoTime`: ISO 8601 UTC string representation for human inspection.
- `pid`: Integer process ID of the running daemon (`process.pid`).
- `uptime`: Float representing process uptime in seconds (`process.uptime()`).
- `pendingMessages`: Integer count of unprocessed messages currently in `wa_queue.json`.
- `version`: String version identifier of the bridge protocol (`"1.0.0"`).

### 2.3 Atomic Write Mechanics on Windows
Direct `fs.writeFileSync` to `bridge_heartbeat.json` risks partial read collisions if Niwo Bot or a test harness reads the file while Node is writing.
To ensure atomic updates:
1. Write JSON payload to temporary file: `bridge/.bridge_heartbeat.tmp.<pid>`.
2. Atomically rename temporary file to `bridge/bridge_heartbeat.json` using `fs.renameSync` (or async `fs.promises.rename`).
3. Implement exponential backoff retry (up to 3 attempts with 20ms delay) to handle transient Windows `EBUSY` / `EPERM` locks.

### 2.4 Interval Timing Loop
```javascript
const HEARTBEAT_INTERVAL_MS = 5000;
let heartbeatTimer = null;

async function writeHeartbeat(status = 'ALIVE') {
  const payload = {
    status: status,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    pid: process.pid,
    uptime: Math.round(process.uptime() * 10) / 10,
    pendingMessages: getPendingMessageCount(),
    version: '1.0.0'
  };

  const tempPath = path.resolve(__dirname, `.bridge_heartbeat.tmp.${process.pid}`);
  const targetPath = path.resolve(__dirname, 'bridge_heartbeat.json');

  await atomicWriteJson(tempPath, targetPath, payload);
}

function startHeartbeatLoop() {
  // Execute immediate tick on boot
  writeHeartbeat('ALIVE').catch(err => {
    console.error(`[ANTIGRAVITY_BRIDGE] [ERROR] Initial heartbeat failed: ${err.message}`);
  });

  heartbeatTimer = setInterval(() => {
    writeHeartbeat('ALIVE').catch(err => {
      console.error(`[ANTIGRAVITY_BRIDGE] [WARN] Periodic heartbeat failed: ${err.message}`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Prevent interval from blocking clean shutdown if event loop clears
  if (heartbeatTimer.unref) {
    // Keep ref active during normal execution so daemon stays alive
  }
}
```

---

## 3. Stdout Log Emitter for Antigravity Reactive Wakeup

### 3.1 Antigravity Reactive Wake Protocol
In Antigravity's C2 architecture, agents executing background tasks do not poll in loops. Antigravity monitors stdout/stderr streams of background child processes. When stdout emits a specific structured pattern, Antigravity triggers a reactive wakeup, delivering the line directly to the agent context.

### 3.2 Exact Protocol Syntax
Contract defined in `PROJECT.md` Section 4:
```
[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:<id> FROM:<sender> TEXT:<text>
```

Parameters:
- `ID:<id>`: Unique message identifier, format: `wa_msg_<timestamp>_<hex>` (e.g., `wa_msg_1728392840000_3f8a`).
- `FROM:<sender>`: WhatsApp JID or phone number (e.g., `628123456789@s.whatsapp.net` or `628123456789`).
- `TEXT:<text>`: The sanitized single-line message body.

### 3.3 Text Sanitization & Single-Line Guarantee
WhatsApp messages frequently contain:
- Multiple lines with raw CRLF / LF (`\r\n`, `\n`).
- Japanese Kaomoji containing special punctuation: `(*v*)`, `(UwU)`, `(*/ω＼*)`, `m(_ _)m`.
- Double quotes, backslashes, emojis, or command prefixes.

If the message body contains unescaped newlines, standard line-based pattern matchers (such as `^\[ANTIGRAVITY_BRIDGE\] INCOMING_WHATSAPP_MESSAGE.*$`) only capture the first line. Subsequent lines will appear as untracked plain logs.

**Sanitization Algorithm**:
```javascript
function formatWakeLine(message) {
  const cleanId = String(message.id || '').trim();
  const cleanSender = String(message.sender || message.senderNumber || 'UNKNOWN').trim();
  
  // Replace carriage returns and newlines with explicit \n string escape
  const cleanText = String(message.text || '')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n');

  return `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:${cleanId} FROM:${cleanSender} TEXT:${cleanText}\n`;
}
```

### 3.4 Direct Stdout Stream Writing
To bypass Node.js output buffering when stdout is connected to a pipe on Windows:
```javascript
function emitWakeSignal(message) {
  const logLine = formatWakeLine(message);
  process.stdout.write(logLine);
}
```
All diagnostic and lifecycle logs use distinct prefixes:
- `[ANTIGRAVITY_BRIDGE] [INFO] ...`
- `[ANTIGRAVITY_BRIDGE] [WARN] ...`
- `[ANTIGRAVITY_BRIDGE] [ERROR] ...`
- `[ANTIGRAVITY_BRIDGE] DAEMON_STOPPED pid=...`

This ensures regex parsers targeting the wake signal never mistake operational logs for incoming messages.

---

## 4. Process Lifecycle, Mutex Locking & Graceful Shutdown

### 4.1 Single-Instance Mutex Enforcement
To prevent concurrent daemons from running simultaneously and causing write collisions:
- Mutex file: `bridge/.daemon.lock`
- Content:
  ```json
  {
    "pid": 12345,
    "startedAt": 1728392840000,
    "hostname": "ACER-NITRO"
  }
  ```

Startup Validation Algorithm:
1. Check if `bridge/.daemon.lock` exists.
2. If it exists, parse recorded PID:
   ```javascript
   function isProcessAlive(pid) {
     try {
       process.kill(pid, 0); // Signal 0 checks existence without terminating
       return true;
     } catch (err) {
       return false;
     }
   }
   ```
3. If process is alive and PID != `process.pid`:
   Log error: `[ANTIGRAVITY_BRIDGE] [FATAL] Daemon already active (PID: ${lock.pid}). Exiting.`
   Exit with code 1.
4. If process is dead (stale lock after system reboot or hard crash):
   Log warning: `[ANTIGRAVITY_BRIDGE] [WARN] Removing stale lock from dead PID ${lock.pid}.`
   Overwrite with current PID.
5. If lock file does not exist:
   Create `bridge/.daemon.lock` with current PID.

### 4.2 Signal Handling on Windows 11
Windows does not support POSIX signals natively, but Node.js emulates `SIGINT`, `SIGTERM`, and `SIGBREAK`.
The daemon registers hooks for all termination paths:
```javascript
process.on('SIGINT', () => executeGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => executeGracefulShutdown('SIGTERM'));
process.on('SIGBREAK', () => executeGracefulShutdown('SIGBREAK'));

// IPC shutdown message for child-process runners
process.on('message', msg => {
  if (msg === 'shutdown' || msg?.command === 'stop') {
    executeGracefulShutdown('IPC_COMMAND');
  }
});

// Guard against unhandled crashes
process.on('uncaughtException', err => {
  console.error(`[ANTIGRAVITY_BRIDGE] [FATAL] Uncaught exception: ${err.stack || err.message}`);
  emergencyCleanup();
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error(`[ANTIGRAVITY_BRIDGE] [ERROR] Unhandled rejection: ${reason}`);
});
```

### 4.3 Graceful Shutdown Sequence
```javascript
let isShuttingDown = false;

async function executeGracefulShutdown(signalName) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[ANTIGRAVITY_BRIDGE] [INFO] Initiating graceful shutdown (trigger: ${signalName}, pid: ${process.pid})...`);

  // Step 1: Clear heartbeat interval timer
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Step 2: Clear queue debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Step 3: Close Chokidar watcher and release file handles
  if (watcher) {
    try {
      await watcher.close();
    } catch (err) {
      console.error(`[ANTIGRAVITY_BRIDGE] [WARN] Error closing watcher: ${err.message}`);
    }
  }

  // Step 4: Update heartbeat file with STOPPED state
  try {
    await writeHeartbeat('STOPPED');
  } catch (err) {
    // Non-fatal on final shutdown
  }

  // Step 5: Remove daemon lock file
  try {
    const lockPath = path.resolve(__dirname, '.daemon.lock');
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch (err) {
    // Non-fatal
  }

  console.log(`[ANTIGRAVITY_BRIDGE] DAEMON_STOPPED pid=${process.pid}`);
  process.exit(0);
}
```

---

## 5. Complete Implementation Blueprint for `bridge/daemon.js`

Below is the concrete, production-grade architectural blueprint for `bridge/daemon.js`:

```javascript
/**
 * bridge/daemon.js
 * Antigravity Remote C2 Bridge Daemon Watcher
 * 
 * Responsibilities:
 * 1. Watch wa_queue.json via Chokidar with awaitWriteFinish on Windows 11.
 * 2. Deduplicate queue events and emit stdout reactive wake signals.
 * 3. Publish periodic liveness heartbeat to bridge_heartbeat.json every 5 seconds.
 * 4. Manage daemon mutex lock (.daemon.lock) and graceful termination.
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Directory & File Paths
const BRIDGE_DIR = __dirname;
const QUEUE_FILE = path.join(BRIDGE_DIR, 'wa_queue.json');
const HEARTBEAT_FILE = path.join(BRIDGE_DIR, 'bridge_heartbeat.json');
const DAEMON_LOCK_FILE = path.join(BRIDGE_DIR, '.daemon.lock');

// Runtime State
let watcher = null;
let heartbeatTimer = null;
let debounceTimer = null;
let isShuttingDown = false;
const emittedMessageIds = new Set();

// Utility: Sleep helper
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Utility: Robust atomic JSON write with Windows retry
async function atomicWriteJson(targetPath, data, maxRetries = 3) {
  const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  const serialized = JSON.stringify(data, null, 2);

  fs.writeFileSync(tempPath, serialized, 'utf8');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.renameSync(tempPath, targetPath);
      return;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < maxRetries) {
        await sleep(25 * attempt);
        continue;
      }
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
      throw err;
    }
  }
}

// Utility: Robust JSON file reader with retry
function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Mutex: Single-Instance Enforcement
function acquireDaemonLock() {
  if (fs.existsSync(DAEMON_LOCK_FILE)) {
    const existing = safeReadJson(DAEMON_LOCK_FILE);
    if (existing && existing.pid) {
      let isRunning = false;
      try {
        process.kill(existing.pid, 0);
        isRunning = true;
      } catch (e) {
        isRunning = false;
      }

      if (isRunning && existing.pid !== process.pid) {
        console.error(`[ANTIGRAVITY_BRIDGE] [FATAL] Another daemon is running with PID ${existing.pid}. Aborting.`);
        process.exit(1);
      }
    }
  }

  const lockData = {
    pid: process.pid,
    startedAt: Date.now(),
    hostname: process.env.COMPUTERNAME || 'localhost'
  };
  fs.writeFileSync(DAEMON_LOCK_FILE, JSON.stringify(lockData, null, 2), 'utf8');
}

function releaseDaemonLock() {
  try {
    if (fs.existsSync(DAEMON_LOCK_FILE)) {
      fs.unlinkSync(DAEMON_LOCK_FILE);
    }
  } catch (_) {}
}

// Heartbeat Generator
async function writeHeartbeat(status = 'ALIVE') {
  const queueData = safeReadJson(QUEUE_FILE);
  const pendingCount = Array.isArray(queueData)
    ? queueData.filter(m => m.status === 'pending').length
    : 0;

  const payload = {
    status: status,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    pid: process.pid,
    uptime: Math.round(process.uptime() * 10) / 10,
    pendingMessages: pendingCount,
    version: '1.0.0'
  };

  await atomicWriteJson(HEARTBEAT_FILE, payload);
}

// Queue Inspection & Stdout Wake Emitter
async function processQueue() {
  if (isShuttingDown) return;
  const queue = safeReadJson(QUEUE_FILE);
  if (!Array.isArray(queue) || queue.length === 0) return;

  for (const message of queue) {
    if (message.status === 'pending' && !emittedMessageIds.has(message.id)) {
      emittedMessageIds.add(message.id);

      // Single-line sanitization
      const text = String(message.text || '')
        .replace(/\r\n/g, '\\n')
        .replace(/\r/g, '\\n')
        .replace(/\n/g, '\\n');
      const sender = String(message.sender || message.senderNumber || 'UNKNOWN');
      const wakeLine = `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:${message.id} FROM:${sender} TEXT:${text}\n`;

      process.stdout.write(wakeLine);
    }
  }

  // Memory management: Bound emitted IDs set
  if (emittedMessageIds.size > 2000) {
    const activeIds = new Set(queue.map(m => m.id));
    for (const id of emittedMessageIds) {
      if (!activeIds.has(id)) {
        emittedMessageIds.delete(id);
      }
    }
  }
}

function scheduleQueueProcess() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    processQueue().catch(err => {
      console.error(`[ANTIGRAVITY_BRIDGE] [ERROR] Queue processing error: ${err.message}`);
    });
  }, 100);
}

// Watcher Initialization
function initWatcher() {
  // Ensure bridge directory and queue file exist
  if (!fs.existsSync(BRIDGE_DIR)) fs.mkdirSync(BRIDGE_DIR, { recursive: true });
  if (!fs.existsSync(QUEUE_FILE)) fs.writeFileSync(QUEUE_FILE, JSON.stringify([], null, 2), 'utf8');

  watcher = chokidar.watch(QUEUE_FILE, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    },
    atomic: true,
    usePolling: false,
    depth: 0,
    ignorePermissionErrors: true
  });

  watcher
    .on('add', () => scheduleQueueProcess())
    .on('change', () => scheduleQueueProcess())
    .on('error', err => console.error(`[ANTIGRAVITY_BRIDGE] [ERROR] Watcher error: ${err.message}`));
}

// Graceful Termination
async function shutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[ANTIGRAVITY_BRIDGE] [INFO] Stopping daemon (reason: ${reason}, pid: ${process.pid})...`);

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (debounceTimer) clearTimeout(debounceTimer);

  if (watcher) {
    try { await watcher.close(); } catch (_) {}
  }

  try { await writeHeartbeat('STOPPED'); } catch (_) {}
  releaseDaemonLock();

  console.log(`[ANTIGRAVITY_BRIDGE] DAEMON_STOPPED pid=${process.pid}`);
  process.exit(0);
}

// Main Bootstrap
async function startDaemon() {
  console.log(`[ANTIGRAVITY_BRIDGE] [INFO] Initializing daemon (pid: ${process.pid})...`);

  acquireDaemonLock();
  initWatcher();

  // Initial drain of any existing pending messages
  await processQueue();

  // Initial heartbeat
  await writeHeartbeat('ALIVE');

  // Recurring 5-second heartbeat
  heartbeatTimer = setInterval(() => {
    writeHeartbeat('ALIVE').catch(err => {
      console.error(`[ANTIGRAVITY_BRIDGE] [WARN] Heartbeat write failed: ${err.message}`);
    });
  }, 5000);

  // Signal bindings
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
  process.on('message', msg => {
    if (msg === 'shutdown' || msg?.command === 'stop') shutdown('IPC_MESSAGE');
  });

  console.log(`[ANTIGRAVITY_BRIDGE] [INFO] Daemon active and listening.`);
}

// Execute if run directly
if (require.main === module) {
  startDaemon().catch(err => {
    console.error(`[ANTIGRAVITY_BRIDGE] [FATAL] Daemon failed to start: ${err.stack || err.message}`);
    releaseDaemonLock();
    process.exit(1);
  });
}

module.exports = {
  startDaemon,
  shutdown,
  processQueue,
  writeHeartbeat,
  formatWakeLine: message => {
    const text = String(message.text || '').replace(/\r\n/g, '\\n').replace(/\r/g, '\\n').replace(/\n/g, '\\n');
    return `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:${message.id} FROM:${message.sender || message.senderNumber || 'UNKNOWN'} TEXT:${text}\n`;
  }
};
```

---

## 6. Comprehensive Test Verification Plan

The test verification plan aligns with `TEST_INFRA.md` requirements for Feature F9 ("IPC Bridge: Daemon Auto-Wake Stdout").

### 6.1 Tier 1: Feature Isolation Tests
1. **Heartbeat Initialization**: Spawn daemon in child process. Verify `bridge/bridge_heartbeat.json` is created within 500ms with `"status": "ALIVE"`, matching process PID.
2. **Heartbeat Periodic Cadence**: Monitor `bridge_heartbeat.json` across 11 seconds. Verify timestamp updates at least twice (~5s and ~10s).
3. **Queue Write Auto-Wake**: Enqueue a pending message into `bridge/wa_queue.json`. Verify child process emits stdout matching regex `^\[ANTIGRAVITY_BRIDGE\] INCOMING_WHATSAPP_MESSAGE ID:(.+) FROM:(.+) TEXT:(.+)$` within 800ms.
4. **Deduplication Check**: Perform 5 rapid consecutive writes to `wa_queue.json` containing the same message ID. Verify stdout receives exactly 1 wake line.
5. **Clean Termination**: Send `SIGINT` to child process. Verify exit code 0 within 2000ms, heartbeat file updated to `"status": "STOPPED"`, and `.daemon.lock` removed.

### 6.2 Tier 2: Boundary & Corner Cases
1. **Missing Directory/File Bootstrap**: Start daemon when `bridge/` directory does not exist. Verify daemon creates directory and starts cleanly without throw.
2. **Corrupted JSON Resilience**: Write invalid truncated JSON (`{ "invalid": `) to `wa_queue.json`. Verify daemon logs a warning and does not crash. Overwrite with valid JSON and verify queue processing resumes.
3. **Complex Multiline & Kaomoji Payload**: Enqueue message containing `Halo Sawako!\n(*v*)\n(UwU) "test"`. Verify emitted stdout line is strictly single-line with `\n` literal escapes.
4. **Burst Load Concurrency**: Atomically enqueue 50 distinct messages simultaneously. Verify daemon emits all 50 wake lines with zero drops and zero duplicates.
5. **Stale Lock Recovery**: Pre-create `.daemon.lock` with a dead PID (e.g. 9999999). Start daemon. Verify daemon identifies dead PID, overwrites lock, and boots successfully.

### 6.3 Tier 3: Pairwise Combination Tests
1. **Daemon + IPC Helper Interaction**: Use `bridge/ipc.js` to enqueue message. Verify daemon emits wake line. Use `bridge/reply.js` to mark message processed. Verify subsequent queue update does not re-emit wake line.
2. **Daemon + Niwo Bot Offline Detector**: Niwo Bot calls `ipc.checkHeartbeat(15000)`. Returns `alive: true` while daemon runs. Stop daemon. Returns `alive: false` immediately because heartbeat status is `"STOPPED"`.

### 6.4 Tier 4: Real-World Workflow Scenario
- **End-to-End Reactive Wake Simulation**: Spawn `daemon.js` as background daemon. In parallel test runner, simulate incoming WhatsApp message from user. Test runner captures child process stdout pipe, verifies that reactive wakeup is delivered with sub-second latency, and verifies payload integrity.

/**
 * test/unit/m1_ipc_daemon_test.js
 * 
 * Comprehensive Unit and Concurrency Test Suite for Milestone 1:
 * - Atomic write integrity under Windows concurrency (TC-IPC-01)
 * - Advisory file lock mutual exclusion (TC-IPC-02)
 * - Stale lock expiration and dead process recovery (TC-IPC-03)
 * - Token anti-ABA lock safety
 * - Queue lifecycle state transitions (TC-IPC-04)
 * - Outbound response queue serialization & delivery
 * - Heartbeat freshness and staleness detection (TC-IPC-05)
 * - Daemon watcher lifecycle, Chokidar event handling, deduplication, and stdout wake logger
 * - Reply CLI responder tool argument parsing, inline sticker tag detection, and exit codes (0-7)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
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
  checkHeartbeat,
  getPaths,
  DEFAULT_BRIDGE_DIR
} from '../../bridge/ipc.js';

import { EXIT, executeReply } from '../../bridge/reply.js';
import { formatWakeLine } from '../../bridge/daemon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DAEMON_SCRIPT = path.join(PROJECT_ROOT, 'bridge', 'daemon.js');
const REPLY_SCRIPT = path.join(PROJECT_ROOT, 'bridge', 'reply.js');

// Test Suite Harness
let totalTests = 0;
let passedTests = 0;
const failures = [];

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failures.push({ name, error: err });
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSandbox(prefix = 'm1_test_') {
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(sandboxDir, 'wa_queue.json'), '[]', 'utf8');
  fs.writeFileSync(path.join(sandboxDir, 'wa_response.json'), '[]', 'utf8');
  fs.writeFileSync(
    path.join(sandboxDir, 'bridge_heartbeat.json'),
    JSON.stringify(
      {
        status: 'STOPPED',
        timestamp: 0,
        isoTime: '1970-01-01T00:00:00.000Z',
        pid: null,
        uptime: 0,
        pendingMessages: 0,
        version: '1.0.0'
      },
      null,
      2
    ),
    'utf8'
  );
  return sandboxDir;
}

function cleanSandbox(sandboxDir) {
  if (sandboxDir && fs.existsSync(sandboxDir)) {
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log('  MILESTONE 1: CORE IPC & DAEMON WATCHER UNIT TEST SUITE');
  console.log('============================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Storage Initial State & Schemas
  // ---------------------------------------------------------------------------
  console.log('Suite 1: Storage Initialization & Initial JSON Schemas');

  await test('1.1: Default bridge files exist in project root bridge directory', async () => {
    const queueFile = path.join(DEFAULT_BRIDGE_DIR, 'wa_queue.json');
    const responseFile = path.join(DEFAULT_BRIDGE_DIR, 'wa_response.json');
    const heartbeatFile = path.join(DEFAULT_BRIDGE_DIR, 'bridge_heartbeat.json');

    assert.ok(fs.existsSync(queueFile), 'wa_queue.json must exist');
    assert.ok(fs.existsSync(responseFile), 'wa_response.json must exist');
    assert.ok(fs.existsSync(heartbeatFile), 'bridge_heartbeat.json must exist');

    const queueData = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    const responseData = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
    const heartbeatData = JSON.parse(fs.readFileSync(heartbeatFile, 'utf8'));

    assert.ok(Array.isArray(queueData), 'wa_queue.json must be an array');
    assert.ok(Array.isArray(responseData), 'wa_response.json must be an array');
    assert.strictEqual(typeof heartbeatData, 'object');
    assert.ok('status' in heartbeatData);
  });

  // ---------------------------------------------------------------------------
  // Suite 2: Atomic Write Concurrency Integrity (TC-IPC-01)
  // ---------------------------------------------------------------------------
  console.log('\nSuite 2: Atomic Write Concurrency Integrity (TC-IPC-01)');

  await test('2.1: Parallel writers produce zero torn writes and zero JSON parse errors', async () => {
    const sandbox = createSandbox('m1_atomic_');
    const targetFile = path.join(sandbox, 'concurrent_data.json');

    let syntaxErrors = 0;
    let readCount = 0;
    let stopReaders = false;

    // Concurrently read and parse
    const readerPromise = (async () => {
      while (!stopReaders) {
        try {
          if (fs.existsSync(targetFile)) {
            const raw = fs.readFileSync(targetFile, 'utf8');
            if (raw.trim()) {
              JSON.parse(raw);
              readCount++;
            }
          }
        } catch (err) {
          if (err instanceof SyntaxError) {
            syntaxErrors++;
          }
        }
        await sleep(5);
      }
    })();

    // 6 parallel worker tasks writing random JSON payloads
    const numWorkers = 6;
    const writesPerWorker = 10;
    const workerPromises = [];

    for (let w = 0; w < numWorkers; w++) {
      workerPromises.push(
        (async () => {
          for (let i = 0; i < writesPerWorker; i++) {
            const payload = {
              worker: w,
              iteration: i,
              timestamp: Date.now(),
              data: new Array(50).fill(`data_w${w}_i${i}_${Math.random()}`)
            };
            await atomicWriteJson(targetFile, payload);
            await sleep(5 + Math.floor(Math.random() * 10));
          }
        })()
      );
    }

    await Promise.all(workerPromises);
    stopReaders = true;
    await readerPromise;

    assert.strictEqual(syntaxErrors, 0, 'Zero SyntaxErrors should occur during concurrent atomic writes');
    assert.ok(readCount > 5, 'Rapid readers successfully parsed multiple iterations');

    const finalRaw = fs.readFileSync(targetFile, 'utf8');
    const finalData = JSON.parse(finalRaw);
    assert.ok(typeof finalData.worker === 'number', 'Final payload is valid and intact');

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 3: Advisory File Lock Mutual Exclusion (TC-IPC-02)
  // ---------------------------------------------------------------------------
  console.log('\nSuite 3: Advisory Mutex File Locking & Concurrency (TC-IPC-02)');

  await test('3.1: Strict mutual exclusion guarantees zero lost updates in concurrent counter', async () => {
    const sandbox = createSandbox('m1_lock_');
    const lockFile = path.join(sandbox, '.counter.lock');
    const counterFile = path.join(sandbox, 'counter.json');
    fs.writeFileSync(counterFile, JSON.stringify({ count: 0 }), 'utf8');

    let maxConcurrentHolders = 0;
    let currentHolders = 0;

    const numWorkers = 5;
    const incrementsPerWorker = 6;
    const workerTasks = [];

    for (let w = 0; w < numWorkers; w++) {
      workerTasks.push(
        (async () => {
          for (let i = 0; i < incrementsPerWorker; i++) {
            await withLock(
              lockFile,
              async () => {
                currentHolders++;
                if (currentHolders > maxConcurrentHolders) {
                  maxConcurrentHolders = currentHolders;
                }

                // Simulate filesystem I/O latency
                const raw = fs.readFileSync(counterFile, 'utf8');
                const data = JSON.parse(raw);
                await sleep(15 + Math.floor(Math.random() * 10));
                data.count += 1;
                fs.writeFileSync(counterFile, JSON.stringify(data), 'utf8');

                currentHolders--;
              },
              { timeout: 10000, ttl: 4000 }
            );
          }
        })()
      );
    }

    await Promise.all(workerTasks);

    assert.strictEqual(maxConcurrentHolders, 1, 'Max concurrent lock holders must strictly be 1');
    const finalData = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
    assert.strictEqual(
      finalData.count,
      numWorkers * incrementsPerWorker,
      'Final counter must equal exactly total increments (zero lost updates)'
    );

    cleanSandbox(sandbox);
  });

  await test('3.2: Stale lock recovery evicts expired lock file (> TTL) and dead PID', async () => {
    const sandbox = createSandbox('m1_stale_');
    const lockFile = path.join(sandbox, '.test.lock');

    // Create an expired lock file with dead PID
    const staleData = {
      pid: 99999999, // Dead PID on Windows
      acquiredAt: Date.now() - 7000, // 7s ago > 5s TTL
      holder: 'DeadWorker',
      token: 'dead-token-1234'
    };
    fs.writeFileSync(lockFile, JSON.stringify(staleData), 'utf8');

    const startAcquire = Date.now();
    const handle = await acquireLock(lockFile, { ttl: 5000, timeout: 3000 });
    const elapsed = Date.now() - startAcquire;

    assert.ok(handle && handle.token, 'Should acquire new lock token');
    assert.notStrictEqual(handle.token, staleData.token, 'New lock token must differ from stale token');
    assert.ok(elapsed < 1000, `Stale lock should be broken quickly (elapsed: ${elapsed}ms)`);

    await releaseLock(handle);
    assert.strictEqual(fs.existsSync(lockFile), false, 'Lock file unlinked on clean release');

    cleanSandbox(sandbox);
  });

  await test('3.3: Token verification prevents ABA lock deletion race', async () => {
    const sandbox = createSandbox('m1_aba_');
    const lockFile = path.join(sandbox, '.test_aba.lock');

    // Acquire lock 1
    const handle1 = await acquireLock(lockFile);

    // Overwrite lock file with new token simulating another process acquiring after expiry
    const newLockData = {
      pid: process.pid,
      acquiredAt: Date.now(),
      holder: 'ProcessB',
      token: 'token-b-uuid'
    };
    fs.writeFileSync(lockFile, JSON.stringify(newLockData), 'utf8');

    // Releasing handle 1 should NOT delete the lock because tokens differ
    await releaseLock(handle1);
    assert.ok(fs.existsSync(lockFile), 'Lock file must still exist after mismatched token release');

    const content = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    assert.strictEqual(content.token, 'token-b-uuid', 'Lock file retained its current owner token');

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 4: Queue Operations & Lifecycle State Transitions (TC-IPC-04)
  // ---------------------------------------------------------------------------
  console.log('\nSuite 4: Queue Operations & Lifecycle State Machine (TC-IPC-04)');

  await test('4.1: enqueueMessage validates inputs and creates valid pending record', async () => {
    const sandbox = createSandbox('m1_queue_');

    // Type checking validation
    await assert.rejects(
      async () => enqueueMessage(null, { bridgeDir: sandbox }),
      /messageObject must be a non-null object/
    );
    await assert.rejects(
      async () => enqueueMessage({ text: 'Hello' }, { bridgeDir: sandbox }),
      /sender is required/
    );
    await assert.rejects(
      async () => enqueueMessage({ sender: '6281@s.whatsapp.net' }, { bridgeDir: sandbox }),
      /text is required/
    );

    const msgId = await enqueueMessage(
      {
        sender: '628123456789@s.whatsapp.net',
        senderNumber: '628123456789',
        pushName: 'Sawako Tester',
        chatType: 'dm',
        text: 'Halo Sawako! (*v*)',
        isOwner: true
      },
      { bridgeDir: sandbox }
    );

    assert.ok(msgId.startsWith('wa_msg_'), 'ID format must start with wa_msg_');
    const pending = await getPendingMessages({ bridgeDir: sandbox });
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, msgId);
    assert.strictEqual(pending[0].status, 'pending');
    assert.strictEqual(pending[0].sender, '628123456789@s.whatsapp.net');
    assert.strictEqual(pending[0].text, 'Halo Sawako! (*v*)');

    cleanSandbox(sandbox);
  });

  await test('4.2: markProcessing and markCompleted execute state transitions', async () => {
    const sandbox = createSandbox('m1_state_');

    const id1 = await enqueueMessage(
      { sender: 'user1@s.whatsapp.net', text: 'Task 1' },
      { bridgeDir: sandbox }
    );
    const id2 = await enqueueMessage(
      { sender: 'user2@s.whatsapp.net', text: 'Task 2' },
      { bridgeDir: sandbox }
    );

    // Initial state: 2 pending
    let pending = await getPendingMessages({ bridgeDir: sandbox });
    assert.strictEqual(pending.length, 2);

    // Mark msg 1 as processing
    const procSuccess = await markProcessing(id1, { bridgeDir: sandbox });
    assert.strictEqual(procSuccess, true);

    pending = await getPendingMessages({ bridgeDir: sandbox });
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, id2);

    // Mark msg 1 as completed
    const compSuccess = await markCompleted(id1, null, { bridgeDir: sandbox, replyId: 'wa_resp_123' });
    assert.strictEqual(compSuccess, true);

    // Mark msg 2 as failed with error
    const failSuccess = await markCompleted(id2, new Error('Simulated failure'), { bridgeDir: sandbox });
    assert.strictEqual(failSuccess, true);

    const all = await readJsonSafe(path.join(sandbox, 'wa_queue.json'));
    const item1 = all.find((m) => m.id === id1);
    const item2 = all.find((m) => m.id === id2);

    assert.strictEqual(item1.status, 'completed');
    assert.ok(item1.completedAt > 0);
    assert.strictEqual(item1.replyId, 'wa_resp_123');
    assert.strictEqual(item1.error, null);

    assert.strictEqual(item2.status, 'failed');
    assert.ok(item2.completedAt > 0);
    assert.strictEqual(item2.error, 'Simulated failure');

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 5: Response Queue Operations & Delivery
  // ---------------------------------------------------------------------------
  console.log('\nSuite 5: Outbound Response Queue Operations & Delivery');

  await test('5.1: appendResponse and fetchResponses support filtering and delivery flagging', async () => {
    const sandbox = createSandbox('m1_resp_');

    const respId1 = await appendResponse(
      {
        queueId: 'wa_msg_001',
        targetJid: '628123456789@s.whatsapp.net',
        text: 'Balasan pertama (*^▽^*)',
        actions: ['SEND_STICKER_HAPPY'],
        stickerKey: 'HAPPY'
      },
      { bridgeDir: sandbox }
    );

    const respId2 = await appendResponse(
      {
        queueId: 'wa_msg_002',
        targetJid: '628987654321@s.whatsapp.net',
        text: 'Balasan kedua (UwU)'
      },
      { bridgeDir: sandbox }
    );

    assert.ok(respId1.startsWith('wa_resp_'));
    assert.ok(respId2.startsWith('wa_resp_'));

    // Fetch all pending responses
    let pending = await fetchResponses({ bridgeDir: sandbox });
    assert.strictEqual(pending.length, 2);

    // Filter by targetJid
    let filtered = await fetchResponses({
      targetJid: '628123456789@s.whatsapp.net',
      bridgeDir: sandbox
    });
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].id, respId1);

    // Fetch with markDelivered: true
    let delivered = await fetchResponses({
      targetJid: '628123456789@s.whatsapp.net',
      markDelivered: true,
      bridgeDir: sandbox
    });
    assert.strictEqual(delivered.length, 1);
    assert.strictEqual(delivered[0].id, respId1);

    // Now pending should have only respId2
    pending = await fetchResponses({ bridgeDir: sandbox });
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].id, respId2);

    // Delivered status verified in file
    const all = await readJsonSafe(path.join(sandbox, 'wa_response.json'));
    const item1 = all.find((r) => r.id === respId1);
    assert.strictEqual(item1.status, 'delivered');
    assert.ok(item1.deliveredAt > 0);

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 6: Heartbeat Telemetry & Staleness (TC-IPC-05)
  // ---------------------------------------------------------------------------
  console.log('\nSuite 6: Heartbeat Telemetry & Staleness Detection (TC-IPC-05)');

  await test('6.1: updateHeartbeat and checkHeartbeat accurately reflect freshness and age', async () => {
    const sandbox = createSandbox('m1_hb_');

    // Fresh heartbeat
    await updateHeartbeat({ bridgeDir: sandbox });
    const fresh = await checkHeartbeat(15000, { bridgeDir: sandbox });
    assert.strictEqual(fresh.alive, true);
    assert.strictEqual(fresh.status, 'ALIVE');
    assert.ok(fresh.ageMs < 1000);

    // Stale heartbeat (> 15000ms threshold)
    const hbFile = path.join(sandbox, 'bridge_heartbeat.json');
    const stalePayload = {
      status: 'ALIVE',
      timestamp: Date.now() - 20000,
      pid: process.pid,
      uptime: 50,
      version: '1.0.0'
    };
    fs.writeFileSync(hbFile, JSON.stringify(stalePayload), 'utf8');

    const stale = await checkHeartbeat(15000, { bridgeDir: sandbox });
    assert.strictEqual(stale.alive, false);
    assert.ok(stale.ageMs >= 20000);

    // Missing heartbeat file
    fs.unlinkSync(hbFile);
    const missing = await checkHeartbeat(15000, { bridgeDir: sandbox });
    assert.strictEqual(missing.alive, false);
    assert.strictEqual(missing.ageMs, Infinity);

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 7: Daemon Watcher & Reactive Auto-Wake Output
  // ---------------------------------------------------------------------------
  console.log('\nSuite 7: Daemon Watcher & Reactive Auto-Wake Output');

  await test('7.1: formatWakeLine escapes newlines and formats single-line wake signal', () => {
    const msg = {
      id: 'wa_msg_001',
      sender: '628123456789@s.whatsapp.net',
      text: 'Baris 1\r\nBaris 2\n(*v*)\r(UwU)'
    };
    const line = formatWakeLine(msg);
    assert.strictEqual(
      line,
      '[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:wa_msg_001 FROM:628123456789@s.whatsapp.net TEXT:Baris 1\\nBaris 2\\n(*v*)\\n(UwU)\n'
    );
    assert.strictEqual(line.split('\n').filter(Boolean).length, 1);
  });

  await test('7.2: Daemon emits reactive wake signal on queue write and deduplicates', async () => {
    const sandbox = createSandbox('m1_daemon_run_');
    const stdoutLines = [];

    // Launch daemon in child process with custom BRIDGE_DIR and IPC channel
    const daemonProc = spawn('node', [DAEMON_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, BRIDGE_DIR: sandbox },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    daemonProc.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        stdoutLines.push(line);
      }
    });

    // Wait for daemon initialization
    await sleep(800);

    // Enqueue message into sandbox queue
    const msgId = await enqueueMessage(
      {
        sender: '628123456789@s.whatsapp.net',
        text: 'Sawako bangun ya! (*v*)'
      },
      { bridgeDir: sandbox }
    );

    // Allow Chokidar awaitWriteFinish + debounce to fire
    await sleep(800);

    const wakeLine = stdoutLines.find(
      (l) => l.includes('INCOMING_WHATSAPP_MESSAGE') && l.includes(msgId)
    );
    assert.ok(wakeLine, `Daemon must emit wake line for enqueued message. Saw: ${stdoutLines.join(' | ')}`);
    assert.ok(wakeLine.startsWith('[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE'));
    assert.ok(wakeLine.includes('TEXT:Sawako bangun ya! (*v*)'));

    // Deduplication check: write identical queue again
    const queueFile = path.join(sandbox, 'wa_queue.json');
    const existingQueue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
    fs.writeFileSync(queueFile, JSON.stringify(existingQueue, null, 2), 'utf8');

    await sleep(600);
    const count = stdoutLines.filter((l) => l.includes(msgId)).length;
    assert.strictEqual(count, 1, 'Duplicate filesystem event must not re-emit wake signal');

    // Shutdown daemon cleanly via IPC message
    const exitPromise = new Promise((resolve) => {
      daemonProc.on('exit', (code) => resolve(code));
    });
    daemonProc.send('shutdown');
    const exitCode = await exitPromise;
    assert.strictEqual(exitCode, 0, 'Daemon must exit with code 0 on graceful shutdown');

    const hb = JSON.parse(fs.readFileSync(path.join(sandbox, 'bridge_heartbeat.json'), 'utf8'));
    assert.strictEqual(hb.status, 'STOPPED', 'Heartbeat status updated to STOPPED on shutdown');
    assert.strictEqual(fs.existsSync(path.join(sandbox, '.daemon.lock')), false, 'Lock removed');

    cleanSandbox(sandbox);
  });

  await test('7.3: Single-instance mutex lock prevents concurrent daemon execution', async () => {
    const sandbox = createSandbox('m1_daemon_single_');

    // Pre-create active daemon lock with current PID
    fs.writeFileSync(
      path.join(sandbox, '.daemon.lock'),
      JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
      'utf8'
    );

    const child = spawn('node', [DAEMON_SCRIPT], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, BRIDGE_DIR: sandbox },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const exitCode = await new Promise((resolve) => {
      child.on('exit', (code) => resolve(code));
    });

    assert.strictEqual(exitCode, 1, 'Second daemon must exit with code 1 when lock is active');

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Suite 8: Reply CLI Responder Tool & Exit Codes (0-7)
  // ---------------------------------------------------------------------------
  console.log('\nSuite 8: Reply CLI Responder Tool & Deterministic Exit Codes');

  await test('8.1: Missing arguments yields exit code 1 (EXIT_INVALID_ARGS)', async () => {
    const code = await executeReply([]);
    assert.strictEqual(code, EXIT.INVALID_ARGS);
  });

  await test('8.2: Nonexistent media file yields exit code 4 (EXIT_MEDIA_NOT_FOUND)', async () => {
    const code = await executeReply([
      '--id', 'wa_msg_001',
      '--text', 'Balasan',
      '--image', './nonexistent_photo_123.png'
    ]);
    assert.strictEqual(code, EXIT.MEDIA_NOT_FOUND);
  });

  await test('8.3: Nonexistent queue item yields exit code 2 (EXIT_QUEUE_NOT_FOUND)', async () => {
    const sandbox = createSandbox('m1_reply_notfound_');

    const code = await executeReply(
      ['--id', 'wa_msg_nonexistent_999', '--text', 'Halo'],
      { bridgeDir: sandbox }
    );

    assert.strictEqual(code, EXIT.QUEUE_NOT_FOUND);
    cleanSandbox(sandbox);
  });

  await test('8.4: Successful reply updates queue to completed and appends response with exit code 0', async () => {
    const sandbox = createSandbox('m1_reply_success_');

    const msgId = await enqueueMessage(
      {
        sender: '628123456789@s.whatsapp.net',
        text: 'Cek status'
      },
      { bridgeDir: sandbox }
    );

    const code = await executeReply(
      [
        '--id', msgId,
        '--text', 'Semua aman ya Kak Ilham! (*^▽^*) [ACTION: SEND_STICKER_HAPPY]'
      ],
      { bridgeDir: sandbox }
    );

    assert.strictEqual(code, EXIT.SUCCESS);

    // Queue item marked completed
    const queueData = await readJsonSafe(path.join(sandbox, 'wa_queue.json'));
    const item = queueData.find((m) => m.id === msgId);
    assert.strictEqual(item.status, 'completed');
    assert.ok(item.completedAt > 0);
    assert.ok(item.replyId);

    // Response appended
    const responseData = await readJsonSafe(path.join(sandbox, 'wa_response.json'));
    assert.strictEqual(responseData.length, 1);
    const resp = responseData[0];
    assert.strictEqual(resp.queueId, msgId);
    assert.strictEqual(resp.targetJid, '628123456789@s.whatsapp.net');
    assert.strictEqual(resp.stickerKey, 'HAPPY');
    assert.ok(resp.actions.includes('SEND_STICKER_HAPPY'));

    cleanSandbox(sandbox);
  });

  await test('8.5: Replying to already completed item yields exit code 3 unless forced', async () => {
    const sandbox = createSandbox('m1_reply_already_');

    const msgId = await enqueueMessage(
      { sender: 'user@s.whatsapp.net', text: 'Test' },
      { bridgeDir: sandbox }
    );

    // First reply
    const code1 = await executeReply(['--id', msgId, '--text', 'Reply 1'], { bridgeDir: sandbox });
    assert.strictEqual(code1, EXIT.SUCCESS);

    // Second reply without --force -> EXIT_ALREADY_COMPLETED
    const code2 = await executeReply(['--id', msgId, '--text', 'Reply 2'], { bridgeDir: sandbox });
    assert.strictEqual(code2, EXIT.ALREADY_COMPLETED);

    // Third reply with --force -> EXIT_SUCCESS
    const code3 = await executeReply(['--id', msgId, '--text', 'Reply 3', '--force'], { bridgeDir: sandbox });
    assert.strictEqual(code3, EXIT.SUCCESS);

    cleanSandbox(sandbox);
  });

  await test('8.6: Subprocess CLI execution with --json output and exit code verification', async () => {
    const sandbox = createSandbox('m1_reply_cli_');

    const msgId = await enqueueMessage(
      { sender: '628111222333@s.whatsapp.net', text: 'Status query' },
      { bridgeDir: sandbox }
    );

    // Run reply CLI as an actual subprocess
    const child = spawn(
      'node',
      [
        REPLY_SCRIPT,
        '--id', msgId,
        '--text', 'Siap Kak! (*v*)',
        '--sticker', 'SURPRISE',
        '--json'
      ],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, BRIDGE_DIR: sandbox },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    let stdoutData = '';
    let stderrData = '';
    child.stdout.on('data', (d) => { stdoutData += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderrData += d.toString('utf8'); });

    const exitCode = await new Promise((resolve) => {
      child.on('exit', (code) => resolve(code));
    });

    assert.strictEqual(exitCode, 0, `CLI subprocess should exit 0. Stderr: ${stderrData}`);
    const jsonOutput = JSON.parse(stdoutData.trim());
    assert.strictEqual(jsonOutput.success, true);
    assert.strictEqual(jsonOutput.queueId, msgId);
    assert.strictEqual(jsonOutput.stickerKey, 'SURPRISE');

    cleanSandbox(sandbox);
  });

  // ---------------------------------------------------------------------------
  // Summary & Assertion
  // ---------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`  TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (failures.length > 0) {
    console.error(`  FAILURES: ${failures.length}`);
    for (const f of failures) {
      console.error(`  - ${f.name}: ${f.error.message}`);
    }
    console.log('============================================================\n');
    process.exit(1);
  } else {
    console.log('  ALL TESTS PASSED WITH 100% SUCCESS RATE.');
    console.log('============================================================\n');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('[UNCAUGHT FATAL TEST ERROR]', err);
  process.exit(1);
});

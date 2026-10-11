# Handoff Report: Milestone 1 IPC Storage & Locking Design (`bridge/ipc.js`)

## 1. Observation

Direct observations from codebase inspection:
- `PROJECT.md` lines 31-38 specifies IPC storage layer files: `bridge/wa_queue.json`, `bridge/wa_response.json`, `bridge/bridge_heartbeat.json`, `bridge/.queue.lock`, and `bridge/media/`.
- `PROJECT.md` lines 148-162 defines the contract interface between `bridge/ipc.js`, `src/lib/antigravityBridge.js`, and `bridge/daemon.js`:
  `enqueueMessage`, `getPendingMessages`, `appendResponse`, `updateHeartbeat`, `checkHeartbeat`.
- `package.json` at root lines 1-62 uses CommonJS (`"main": "index.js"` with no `"type": "module"`), running on Node.js `>=18.0.0` (line 54).
- `src/lib/package.json` lines 1-2 specifies `{ "type": "module" }`. All library files in `src/lib/` (e.g. `database.js`, `serialize.js`) use ES module `import`/`export` syntax.
- `plugins/package.json` lines 1-2 specifies `{ "type": "module" }`. All plugin handlers use ES module syntax.
- `src/lib/database.js` lines 41-56 implements file writing via direct `fs.writeFileSync(...)` without atomic temp-file rename or locking, which is prone to concurrency corruption under multi-process scenarios.
- The `bridge/` directory does not yet exist in the project root (`find_by_name` returned zero bridge scripts, only `whatsapp-rust-bridge` in `node_modules`).
- Windows NTFS file system behavior: `fs.rename` delegates to `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`. When destination or source handles are held by indexers, antivirus, or file watchers without `FILE_SHARE_DELETE`, Windows raises Win32 error 32 or 5, mapped to Node.js `EBUSY` or `EPERM`.

## 2. Logic Chain

1. From the observation that `src/lib/antigravityBridge.js` resides in an ESM folder (`src/lib/package.json` has `{"type": "module"}`), while the daemon and reply CLI will be executed directly via `node bridge/daemon.js` and `node bridge/reply.js`, `bridge/` must also contain a `package.json` with `{"type": "module"}` so that `bridge/ipc.js` can be natively exported and imported without CommonJS transpilation or bundling overhead.
2. From the observation that Windows raises transient `EBUSY` and `EPERM` errors during `fs.rename` when Windows Defender, Chokidar watchers, or Antigravity processes access the directory, direct writes or single-attempt renames will cause intermittent process crashes. Therefore, the atomic write algorithm must:
   - Create a uniquely named `.tmp` file in the same directory (same NTFS volume) to ensure an atomic directory pointer swap rather than a cross-volume copy.
   - Write via explicit `FileHandle`, call `fileHandle.sync()` (`FlushFileBuffers`), and explicitly close the handle before calling `fs.promises.rename()`.
   - Wrap `fs.promises.rename` in a retry loop catching `EBUSY`, `EPERM`, `EACCES`, `EMFILE` with exponential backoff (25ms base delay, factor 1.5, max 12 attempts, plus randomized jitter).
3. From the observation that multiple processes (`src/lib/antigravityBridge.js`, `bridge/daemon.js`, and `bridge/reply.js`) mutate the queue concurrently, atomic writes alone cannot prevent the lost-update anomaly during read-modify-write sequences. Therefore, an advisory lock file (`bridge/.queue.lock`) is mandatory.
4. From the observation that sudden process termination or unexpected crash on Windows could abandon `.queue.lock` indefinitely, the lock mechanism must incorporate:
   - Atomic exclusive file creation via `fs.promises.open(lockPath, 'wx')`.
   - Stale lock detection with a 5000ms TTL threshold.
   - Active process liveness inspection via `process.kill(pid, 0)` checking for `ESRCH` (dead process).
   - Anti-ABA token verification during `releaseLock` to ensure slow holders do not unlink locks re-acquired by other processes.
5. From the contract specifications in `PROJECT.md` and the mission instructions, the eight required methods must be implemented with strict input validation, automatic status tracking (`pending`, `processing`, `completed`, `failed`), and retention pruning (keeping the last 200 items / purging completed items older than 24h) to avoid unbound JSON growth.

## 3. Caveats

- Antivirus interference duration: Under exceptionally heavy disk I/O or aggressive corporate endpoint protection, Windows Defender file scan delays might occasionally exceed 1.8 seconds. If this rare condition is encountered, the retry ceiling (`RETRY_MAX_ATTEMPTS`) can be increased from 12 to 16.
- Cross-process advisory lock limitation: Advisory locking relies on all cooperating processes in the repository adhering to `withLock`. Any rogue external script writing directly to `bridge/wa_queue.json` without acquiring `.queue.lock` will bypass mutual exclusion, although `atomicWriteJson` will still prevent torn JSON files.
- System clock skew: Stale lock expiration compares `Date.now()` with `lockInfo.acquiredAt`. If the host machine's system clock is shifted backward by more than 5000ms while a lock is held, expiration calculation could temporarily stall until time catches up.

## 4. Conclusion

The architectural design for `bridge/ipc.js` is complete and documented in `analysis_ipc.md`. The design provides:
1. An atomic write engine (`atomicWriteJson`) that guarantees zero partial reads and overcomes Windows `EBUSY`/`EPERM` sharing violations.
2. An advisory file lock (`bridge/.queue.lock`) with 5000ms TTL and `ESRCH` dead-process eviction.
3. Complete schemas and implementations for:
   - `enqueueMessage`
   - `getPendingMessages`
   - `markProcessing`
   - `markCompleted`
   - `appendResponse`
   - `fetchResponses`
   - `updateHeartbeat`
   - `checkHeartbeat`
4. A 5-tier concurrency and atomic write verification plan covering stress writes, mutex exclusion, stale lock recovery, lifecycle transitions, and heartbeat freshness.
The implementer can translate the reference implementation directly into `bridge/ipc.js` during Milestone 1 execution.

## 5. Verification Method

To verify the implementation once coded:
1. Verify module structure and files:
   - Inspect `bridge/package.json` contains `{"type": "module"}`.
   - Inspect `bridge/ipc.js` exports all eight required methods plus `atomicWriteJson` and `withLock`.
2. Execute the concurrency stress verification:
   - Run Node.js test script spawning 10 concurrent workers executing 25 writes each while 5 readers parse JSON simultaneously.
   - Assert 0 JSON syntax errors and 0 unhandled `EBUSY`/`EPERM` rejections.
3. Execute the mutex exclusion verification:
   - Run 8 parallel workers competing for `.queue.lock` incrementing a shared counter.
   - Assert final counter equals total iterations.
4. Execute stale lock recovery verification:
   - Create mock stale `.queue.lock` older than 5000ms with dead PID.
   - Call `acquireLock`; assert successful acquisition in under 250ms.
5. Invalidation conditions:
   - Any unhandled `EBUSY` or `EPERM` error thrown during concurrent writes.
   - Any `SyntaxError: Unexpected end of JSON input` thrown by concurrent readers.
   - Any lost update where final message count or counter is less than expected.

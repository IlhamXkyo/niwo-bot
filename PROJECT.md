# Project: Remote C2 Assistant (Niwo Bot to Antigravity Bridge)

## Architecture
The system establishes a bidirectional Remote Command & Control (C2) bridge between Niwo Bot (WhatsApp Baileys bot in Node.js) and an active Antigravity C2 agent session on Windows 11.

```
+-------------------------------------------------------------------------------+
|                               WHATSAPP CLIENT                                 |
+-------------------------------------------------------------------------------+
       ▲                                                            │
       │ Text / Media / Sticker                                     │ Inbound Message / Buttons
       │                                                            ▼
+-------------------------------------------------------------------------------+
|                       NIWO BOT (Node.js / Baileys)                            |
|                                                                               |
|  - plugins/owner/gravity.js:                                                  |
|      * Commands: .gravity on, .gravity on <mode>, .gravity off, .gravity status|
|      * Interactive native flow buttons for mode selection & fallback          |
|      * Group message filtering (reply, mention, keyword, unprompted drop)     |
|      * Offline detection (heartbeat stale > 15s or queue timeout > 25s)       |
|  - src/lib/antigravityBridge.js:                                              |
|      * Atomic IPC writer (wa_queue.json) & response poller (wa_response.json) |
|      * Sticker parser [ACTION: SEND_STICKER_<EMOTION>] & WebP dispatcher     |
|      * Emoji sanitizer filter (strict zero Unicode emoji enforcement)         |
|      * Windows launcher: cmd.exe /c start "" agy                              |
+-------------------------------------------------------------------------------+
       ▲                                                            │
       │ Atomic File I/O                                            │ Atomic File I/O
       │                                                            ▼
+-------------------------------------------------------------------------------+
|                        IPC STORAGE LAYER (bridge/)                            |
|                                                                               |
|  - bridge/wa_queue.json: Inbound message queue                                |
|  - bridge/wa_response.json: Outbound agent response queue                     |
|  - bridge/bridge_heartbeat.json: Daemon liveness timestamp                    |
|  - bridge/.queue.lock: Advisory mutex file lock                               |
|  - bridge/media/: Transient media directory (screenshots, exports)            |
+-------------------------------------------------------------------------------+
       ▲                                                            │
       │ Atomic File I/O                                            │ File Watcher (Chokidar)
       │                                                            ▼
+-------------------------------------------------------------------------------+
|                        ANTIGRAVITY DAEMON WATCHER                             |
|                           (bridge/daemon.js)                                  |
|                                                                               |
|  - Background daemon: updates bridge_heartbeat.json every 5s                  |
|  - Watches bridge/wa_queue.json via Chokidar (with awaitWriteFinish)          |
|  - Emits stdout log: [ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE           |
|    (triggers Antigravity reactive wakeup immediately)                         |
|  - bridge/reply.js: CLI tool for atomic response serialization                |
+-------------------------------------------------------------------------------+
       ▲                                                            │
       │ CLI / IPC reply                                            │ Reactive wake (stdout)
       │                                                            ▼
+-------------------------------------------------------------------------------+
|                    ANTIGRAVITY AGENT (Active Session)                         |
|                                                                               |
|  - Sawako Kuronuma persona: shy, polite, earnest tone                         |
|  - Japanese kaomoji vocabulary (*v*), (UwU), (*/ω＼*), (*^▽^*), m(_ _)m      |
|  - Strict prohibition of modern Unicode emojis                                |
|  - Emotion sticker triggers: [ACTION: SEND_STICKER_<EMOTION>]                 |
|  - System commands: screenshot.ps1, guarded shutdown, safe file queries       |
+-------------------------------------------------------------------------------+
```

---

## Code Layout
```
C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\
├── bridge/                              # IPC Storage & Daemon Watcher scripts (M1 & M4)
│   ├── wa_queue.json                    # Inbound queue
│   ├── wa_response.json                 # Outbound responses
│   ├── bridge_heartbeat.json            # Daemon heartbeat
│   ├── ipc.js                           # Shared atomic file I/O & locking module
│   ├── daemon.js                        # Background watcher & auto-wake logger
│   ├── reply.js                         # CLI responder helper for Antigravity agent
│   ├── tools/                           # System command helpers (M4)
│   │   ├── screenshot.ps1               # GDI+ / Windows Forms desktop capture
│   │   └── systemOps.js                 # Guarded shutdown & safe file query logic
│   └── media/                           # Temp media buffer (screenshots, etc.)
├── plugins/owner/
│   └── gravity.js                       # Niwo Bot Owner Command & Message Filter (M2)
├── src/lib/
│   ├── antigravityBridge.js             # Core bridge client & router in Niwo Bot (M2 & M4)
│   └── sawakoPersona.js                 # Persona sanitizer, kaomoji validator & sticker parser (M3)
├── assets/stickers/sawako/              # Sticker bank storage (M3)
│   ├── manifest.json                    # Sticker pack mapping
│   ├── shy/                             # shy_01.webp, etc.
│   ├── happy/                           # happy_01.webp, etc.
│   ├── surprise/                        # surprise_01.webp, etc.
│   ├── sad/                             # sad_01.webp, etc.
│   ├── greeting/                        # greeting_01.webp, etc.
│   └── default/                         # default_01.webp
└── test/e2e/                            # Opaque-box E2E test suite (E2E Track)
    ├── harness/                         # Mock WhatsApp socket & queue simulators
    ├── tier1_feature_tests.js           # Tier 1 Feature coverage tests
    ├── tier2_boundary_tests.js          # Tier 2 Boundary & error handling tests
    ├── tier3_combination_tests.js       # Tier 3 Cross-feature combination tests
    ├── tier4_application_tests.js       # Tier 4 End-to-end user scenario tests
    └── runner.js                        # Unified test runner
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F1 | `.gravity on` | Enables bridge, shows interactive mode selection buttons | M2 | ORIGINAL_REQUEST § R1 |
| F2 | `.gravity on <mode>` | Directly sets bridge mode (`chat`, `group`, `both`) | M2 | ORIGINAL_REQUEST § R1 |
| F3 | `.gravity off` | Disables bridge and halts message routing | M2 | ORIGINAL_REQUEST § R1 |
| F4 | `.gravity status` | Returns bridge state, daemon heartbeat, queue status | M2 | ORIGINAL_REQUEST § R1 |
| F5 | Group Routing: Reply-to-Bot | Routes group message if it quotes a bot message | M2 | ORIGINAL_REQUEST § R1 |
| F6 | Group Routing: Keyword Trigger | Routes group message if it contains trigger keyword (`sawako`, `gravity`, `kuronuma`, `agy`) | M2 | ORIGINAL_REQUEST § R1 |
| F7 | Group Routing: Unprompted Drop | Silently ignores random group banter | M2 | ORIGINAL_REQUEST § R1 |
| F8 | IPC Bridge: Queue Writer | Atomically writes inbound WhatsApp message to `wa_queue.json` | M1 | ORIGINAL_REQUEST § R2 |
| F9 | IPC Bridge: Daemon Auto-Wake | Background daemon watches queue and emits stdout `[ANTIGRAVITY_BRIDGE]` wake signal | M1 | ORIGINAL_REQUEST § R2 |
| F10 | IPC Bridge: Response Poller & Delivery | Reads `wa_response.json` and delivers to WhatsApp | M1 | ORIGINAL_REQUEST § R2 |
| F11 | Fallback: Timeout Detector | Detects unresponsive session (>20s) or stale heartbeat (>15s) | M4 | ORIGINAL_REQUEST § R2 |
| F12 | Fallback: Offline Notice & Button | Sends Sawako offline notice with "🚀 Open Antigravity" button | M4 | ORIGINAL_REQUEST § R2 |
| F13 | Remote Exec: `.gravity open` | Launches `start agy` / `agy.exe` executable on Windows host | M4 | ORIGINAL_REQUEST § R2 |
| F14 | Persona: Sawako Voice | System prompt producing shy, polite, earnest responses | M3 | ORIGINAL_REQUEST § R3 |
| F15 | Persona: Kaomoji Vocabulary | Natural inclusion of authentic Japanese kaomoji (`(*v*)`, `(UwU)`, `(*/ω＼*)`, etc.) | M3 | ORIGINAL_REQUEST § R3 |
| F16 | Persona: Zero Emoji Guard | Strict removal/prohibition of modern Unicode emojis | M3 | ORIGINAL_REQUEST § R3 |
| F17 | Sticker Bank: Action Parser | Parses `[ACTION: SEND_STICKER_<EMOTION>]` from response text | M3 | ORIGINAL_REQUEST § R4 |
| F18 | Sticker Bank: Emotion Mapping | Maps emotion tags to WebP files with fallback | M3 | ORIGINAL_REQUEST § R4 |
| F19 | Sticker Bank: WebP Dispatcher | Dispatches WebP sticker with EXIF metadata to WhatsApp | M3 | ORIGINAL_REQUEST § R4 |
| F20 | Remote C2: Desktop Screenshot | Captures desktop screenshot via PowerShell GDI+ with locked-screen fallback | M4 | ORIGINAL_REQUEST § Overview |
| F21 | Remote C2: Guarded Shutdown | Executes `shutdown /s /t 60` with `.abort_shutdown` option | M4 | ORIGINAL_REQUEST § Overview |
| F22 | Remote C2: Safe File Processing | Reads local files safely within project boundary | M4 | ORIGINAL_REQUEST § Overview |
| F23 | E2E Testing Verification | Pass 100% of E2E tests (Tiers 1-4) & adversarial hardening | M5 | Acceptance Criteria |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Bridge Core IPC, Storage & Daemon Watcher | `bridge/ipc.js`, `bridge/daemon.js`, `bridge/reply.js`, atomic file operations, mutex locking, queue schemas, auto-wake stdout logging | none | PLANNED |
| M2 | Niwo Bot Routing, Toggle Command & Group Filter | `plugins/owner/gravity.js`, `src/lib/antigravityBridge.js` routing logic, `database/settings.json` integration, `.gravity on/off/status`, interactive button handling, DM & group multi-stage filtering | M1 | PLANNED |
| M3 | Sawako Persona Engine, Kaomoji Filter & Sticker Bank Protocol | `src/lib/sawakoPersona.js`, `assets/stickers/sawako/` sticker bank & manifest, Unicode emoji sanitization regex, sticker action tag parser (`[ACTION: SEND_STICKER_<EMOTION>]`), Baileys sticker delivery | M1 | PLANNED |
| M4 | Remote C2 Tools, Fallback Engine & Windows Launcher | Timeout detection (>20s), stale heartbeat detector, Sawako offline message with "Open Antigravity" button, `.gravity open` Windows launcher (`start agy`), PowerShell screenshot tool, guarded shutdown & file query | M1, M2 | PLANNED |
| M5 | Final Milestone: 100% E2E Test Suite & Adversarial Hardening | Phase 1: Pass 100% E2E tests (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5) with Challengers | M1, M2, M3, M4, TEST_READY | PLANNED |

---

## Interface Contracts

### 1. `bridge/ipc.js` ↔ `src/lib/antigravityBridge.js` & `bridge/daemon.js`
- `enqueueMessage(messageObject): Promise<string>`
  - Input: `{ sender, senderNumber, pushName, chatType, groupJid, text, quoted, isOwner }`
  - Output: Unique queue ID (`wa_msg_<timestamp>_<rand>`)
  - Semantics: Atomic write to `bridge/wa_queue.json` under advisory file lock with retry.
- `getPendingMessages(): Promise<Array<MessageObject>>`
  - Output: Array of pending queue items.
- `appendResponse(responseObject): Promise<string>`
  - Input: `{ queueId, targetJid, text, actions, stickerKey, mediaAttachment }`
  - Output: Unique response ID.
- `updateHeartbeat(): Promise<void>`
  - Updates `bridge/bridge_heartbeat.json` with `{ status: "ALIVE", timestamp: Date.now(), pid: process.pid }`.
- `checkHeartbeat(maxAgeMs): Promise<{ alive: boolean, ageMs: number }>`
  - Returns true if heartbeat file exists and age <= maxAgeMs (default 15000ms).

### 2. `src/lib/sawakoPersona.js` ↔ `src/lib/antigravityBridge.js`
- `sanitizeEmojis(text: string): { cleanText: string, removedCount: number }`
  - Purges Unicode emojis (`\u{1F300}-\u{1F9FF}`, `\u{2600}-\u{26FF}`, `\u{2700}-\u{27BF}`) while strictly preserving Japanese kaomoji.
- `parseStickerAction(text: string): { cleanText: string, emotion: string | null }`
  - Matches `/\[ACTION:\s*SEND_STICKER_([A-Z_]+)\]/i`. Strips matched token from text and returns emotion string.
- `getStickerBuffer(emotion: string): Promise<Buffer | null>`
  - Resolves WebP sticker from `assets/stickers/sawako/<emotion>/` or fallback `default/default_01.webp`.
- `validateKaomoji(text: string): boolean`
  - Checks if text contains at least one recognized Japanese kaomoji.

### 3. `plugins/owner/gravity.js` ↔ `src/lib/antigravityBridge.js`
- `setBridgeMode(mode: 'chat' | 'group' | 'both' | 'off'): Promise<void>`
  - Saves mode to `database/settings.json` under `gravityBridge.mode`.
- `getBridgeStatus(): Promise<{ enabled: boolean, mode: string, daemonAlive: boolean, pendingCount: number }>`
- `launchAntigravity(): Promise<{ success: boolean, method: string, error?: string }>`
  - Spawns `cmd.exe /c start "" agy` detached and unreferenced.

### 4. `bridge/daemon.js` ↔ Antigravity Session
- Stdout Wakeup Protocol:
  - Output: `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:<id> FROM:<sender> TEXT:<text>`
- CLI Response Helper (`bridge/reply.js`):
  - Usage: `node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>]`

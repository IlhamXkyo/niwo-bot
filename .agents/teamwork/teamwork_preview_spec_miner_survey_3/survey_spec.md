# SPECIFICATION: Remote C2 WhatsApp Bridge (Niwo Bot to Antigravity) with Sawako Persona

## 1. Executive Overview

This specification formalizes the Remote C2 Assistant architecture connecting Niwo Bot (WhatsApp bot based on Baileys) running in Node.js on Windows to an active Antigravity C2 agent session. The bridge employs an atomic file-based Inter-Process Communication (IPC) protocol, strict Owner authentication, an interactive mode toggle, persona emulation for Sawako Kuronuma (Kimi ni Todoke) with Japanese kaomoji and strict emoji prohibition, an emotion-driven sticker bank protocol, and an automatic timeout fallback with Windows executable launch capability.

---

## 2. R1: State Machine for `.gravity on` / `.gravity off`

### 2.1 State Definitions & State Transitions

The bridge maintains persistent operational states stored in `database/settings.json` under key `gravityBridge`.

```
                    +-----------------------+
                    |                       |
                    |         OFF           | <--------------------+
                    | (Bridge Inactive)     |                      |
                    |                       |                      |
                    +-----------+-----------+                      |
                                |                                  |
               .gravity on [mode] (Owner only)                     |
                                |                                  |
                                v                                  |
                    +-----------------------+                      |
                    |    MODE SELECTION     |                      |
                    | (Interactive Buttons) |                      |
                    +-----------+-----------+                      |
                                |                                  |
           +--------------------+--------------------+             | .gravity off
           |                    |                    |             | (Owner only)
           v                    v                    v             |
    +--------------+    +---------------+    +--------------+      |
    |   ON_CHAT    |    |   ON_GROUP    |    |   ON_BOTH    |      |
    | (Direct DMs) |    | (Groups Only) |    | (DM & Group) |      |
    +-------+------+    +-------+-------+    +-------+------+      |
            |                   |                    |             |
            +-------------------+--------------------+-------------+
```

| State Name | Mode Value | Route DMs? | Route Groups? | Description |
|---|---|---|---|---|
| `OFF` | `"off"` | No | No | Bridge disabled. All incoming messages bypass Antigravity queue. |
| `ON_CHAT` | `"chat"` | Yes | No | Private messages routed to Antigravity. Group messages completely ignored by bridge. |
| `ON_GROUP` | `"group"` | No | Yes | Only group messages matching trigger criteria are routed. DMs ignored by bridge. |
| `ON_BOTH` | `"both"` | Yes | Yes | Both direct DMs and filtered group messages are routed to Antigravity. |

### 2.2 Owner Authentication & Permission Model

1. **Authentication Hierarchy**:
   - `superOwner`: Defined in `src/config.js` (`6285217124804`).
   - `coOwner`: Defined in `src/config.js` array.
   - `extraOwners`: Stored in `database/settings.json` (`getDatabase().getOwners()`).
   - `LID Caches`: `superOwnerLidCache` and `coOwnerLidCache` populated via `Hanz.onWhatsApp()` in `src/handlers/messageHandler.js`.
   - `fromMe`: Outgoing messages from bot's own number (`msg.key.fromMe === true`).

2. **Access Control Table**:

| Command / Action | Caller Identity | Result | Error Message / Response |
|---|---|---|---|
| `.gravity on` | Owner (Super/Co/Extra) | Allowed | Displays interactive mode buttons (Chat, Group, Both) |
| `.gravity on <mode>` | Owner (Super/Co/Extra) | Allowed | Sets mode directly and replies confirmation |
| `.gravity off` | Owner (Super/Co/Extra) | Allowed | Sets state to OFF and replies confirmation |
| `.gravity status` | Owner (Super/Co/Extra) | Allowed | Displays current state, mode, queue count, daemon status |
| `.gravity open` | Owner (Super/Co/Extra) | Allowed | Spawns Windows executable `start agy` |
| Any `.gravity *` | Non-Owner | Rejected | `❌ Akses ditolak! Perintah ini khusus untuk Owner bot.` |

### 2.3 Command Grammar & Interactive Button Protocol

1. **CLI Invocations**:
   - `.gravity` -> Displays status and help menu.
   - `.gravity on` -> Sends interactive buttons:
     - Button 1: Label: `Chat Only`, ID: `.gravity on chat`
     - Button 2: Label: `Group Only`, ID: `.gravity on group`
     - Button 3: Label: `Both (Chat & Group)`, ID: `.gravity on both`
   - `.gravity on chat` -> Activates `ON_CHAT`.
   - `.gravity on group` -> Activates `ON_GROUP`.
   - `.gravity on both` -> Activates `ON_BOTH`.
   - `.gravity off` -> Deactivates bridge to `OFF`.
   - `.gravity status` -> Returns state summary.

2. **Interactive Button Construction**:
   - Implemented via `sendButtons(Hanz, sender, content)` in `src/utils/interactiveHelper.js`.
   - Node structure: Baileys `proto.Message.InteractiveMessage` with `nativeFlowMessage` and `quick_reply` buttons.
   - Associated Image: Auto-resolves via `src/utils/assets.js` using `imageKey: 'gravity'`, falling back to `src/media/menu/menu.png` or `src/media/logo.png`.

### 2.4 Group Filtering Rules

When `mode` is `ON_GROUP` or `ON_BOTH`, messages originating from WhatsApp groups (`jid.endsWith('@g.us')`) must pass through three strict filtering stages:

1. **Stage 1: Mode Eligibility**:
   - If state is `OFF` or `ON_CHAT`, group messages are dropped immediately without processing.

2. **Stage 2: Sender Exclusion**:
   - Messages sent by the bot itself (`msg.key.fromMe === true`) are dropped to avoid recursive self-loops.
   - System broadcast messages (`status@broadcast`) are dropped.

3. **Stage 3: Trigger Condition (Disjunctive OR)**:
   A group message is routed to Antigravity IF AND ONLY IF at least one of the following conditions is satisfied:
   - **Condition A (Reply to Bot)**: The message is a quote/reply targeting a message sent by the bot (`m.quoted && (m.quoted.fromMe || m.quoted.sender === botJid)`).
   - **Condition B (Explicit Bot Mention)**: The message mentions the bot's JID in `contextInfo.mentionedJid`.
   - **Condition C (Keyword Trigger)**: The message text begins with or contains designated trigger keywords:
     - Primary Keywords: `sawako`, `gravity`, `kuronuma`, `agy`
     - Case-insensitive regex: `/\b(sawako|gravity|kuronuma|agy)\b/i`

4. **Stage 4: Unprompted Banter Drop**:
   - Any message in a group that does NOT satisfy Condition A, B, or C is classified as "unprompted chatter".
   - The bot MUST silently ignore this message.
   - No log spam, no queue insertion, zero network overhead.

---

## 3. R2: Antigravity-Bridge (File-Based IPC) & Auto-Wake

### 3.1 IPC File Architecture

Communication between Niwo Bot and the Antigravity daemon occurs via three atomic JSON files located in the project root:

1. `wa_queue.json`:
   - Inbound queue containing incoming messages from WhatsApp awaiting Antigravity processing.
2. `wa_response.json`:
   - Outbound queue containing responses produced by Antigravity awaiting transmission by Niwo Bot.
3. `bridge_status.json`:
   - Liveness heartbeat and session state file updated by both processes.

### 3.2 Schema Contracts

#### `wa_queue.json` Schema
```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-08T13:00:00.000Z",
  "queue": [
    {
      "id": "msg_1728392400000_a1b2c3",
      "timestamp": 1728392400000,
      "senderJid": "6285217124804@s.whatsapp.net",
      "senderNumber": "6285217124804",
      "senderName": "Ilham",
      "isOwner": true,
      "isGroup": false,
      "groupJid": null,
      "groupSubject": null,
      "messageType": "conversation",
      "text": "Sawako, tolong cek status laptop sekarang (*v*)",
      "quoted": null,
      "status": "pending",
      "attempts": 0,
      "timeoutAt": 1728392430000
    }
  ]
}
```

#### `wa_response.json` Schema
```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-08T13:00:05.000Z",
  "responses": [
    {
      "queueId": "msg_1728392400000_a1b2c3",
      "timestamp": 1728392405000,
      "targetJid": "6285217124804@s.whatsapp.net",
      "quotedMsgKey": {
        "remoteJid": "6285217124804@s.whatsapp.net",
        "fromMe": false,
        "id": "BAE5F123456789"
      },
      "text": "Ano... aku sudah memeriksa sistem laptop kak Ilham... semuanya berjalan dengan normal m(_ _)m",
      "actions": [
        "SEND_STICKER_HAPPY"
      ],
      "mediaAttachment": null,
      "status": "delivered"
    }
  ]
}
```

#### `bridge_status.json` Schema
```json
{
  "daemonActive": true,
  "antigravitySession": "e35ecc39-9675-44e3-9814-ab68b857a7df",
  "lastDaemonHeartbeat": 1728392404000,
  "lastProcessedQueueId": "msg_1728392400000_a1b2c3",
  "botMode": "both"
}
```

### 3.3 Atomic File Write Protocol (Windows Concurrency Protection)

On Windows, concurrent file read/write operations easily cause `EBUSY` or partial file reads. All writes to `wa_queue.json` and `wa_response.json` MUST adhere to this atomic protocol:
1. Serialize the JSON payload to a temporary file: `<target>.tmp.<pid>.<random>`.
2. Flush to disk via `fs.writeFileSync()` or `fs.promises.writeFile()`.
3. Perform an atomic rename: `fs.renameSync(tempFile, targetFile)`.
4. Wrap in retry logic (maximum 3 attempts with 50ms exponential backoff).

### 3.4 Auto-Wake & Daemon Mechanism

1. **Daemon Role**:
   - A background script (e.g. `scripts/gravity_daemon.js` or PowerShell watcher) executes alongside the Antigravity session.
   - Watches `wa_queue.json` using Node.js `fs.watch()` or polling every 500ms.
   - When a new item with `status: "pending"` is detected:
     - Daemon updates `status: "processing"`.
     - Daemon emits a formatted stdout log line:
       `[GRAVITY-WAKE] New message from ${senderName}: ${text}`
     - In Antigravity's reactive environment, stdout from a running background task wakes the agent immediately.
2. **Agent Reaction**:
   - The Antigravity agent inspects `wa_queue.json`.
   - Processes the message through the Sawako persona system prompt.
   - Executes any requested system actions (screenshot, shutdown, file operations).
   - Writes the response to `wa_response.json`.
   - Marks queue item as `status: "completed"`.

---

## 4. R3: Persona Specification for Sawako Kuronuma (Kimi ni Todoke)

### 4.1 Character Profile & Behavioral Lore

- **Identity**: Sawako Kuronuma, the heroine of *Kimi ni Todoke*.
- **Core Archetype**: Extremely sweet, earnest, timid, easily flustered, hyper-polite, grateful for every friendship, prone to overthinking, eager to be useful.
- **Tone & Demeanor**:
  - Soft-spoken, humble, and deeply respectful.
  - Frequent hesitation markers: `ano...`, `e-eto...`, `sumimasen...`, `maaf kalau aku mengagetkanmu...`.
  - Never arrogant, cynical, sarcastic, or demanding.
  - Expresses heartfelt gratitude whenever thanked: `Arigatou gozaimasu... (*v*)`.
- **System Command Execution Demeanor**:
  - When asked to perform system commands (screenshot, shutdown, file search), she treats the task as a critical favor entrusted to her.
  - She reports results with diligent care:
    `Ano... aku sudah mengambil screenshot layarnya... semoga ini sesuai yang kak Ilham butuhkan (*/ω＼*)`.

### 4.2 Strict Modern Emoji Prohibition

- **RULE**: Modern Unicode standard emojis (e.g., 😊, 😂, 🥺, ❤️, 👍, 🤖, etc.) are STRICTLY PROHIBITED in all generated responses.
- **Enforcement**:
  1. System prompt directive: Explicit instruction forbidding all Unicode emoji ranges (`\u{1F300}-\u{1F9FF}`, `\u{2600}-\u{26FF}`, `\u{2700}-\u{27BF}`).
  2. Post-processing sanitation filter in bridge: Regex strip/replace pass to purge any accidental emojis before sending to WhatsApp.

### 4.3 Japanese Kaomoji Vocabulary

Sawako expresses emotion exclusively via curated Japanese Kaomoji. Responses must naturally include 1 to 2 kaomoji appropriate to the emotional context.

| Emotion Category | Permitted Kaomoji Set | Usage Context |
|---|---|---|
| **Shy / Flustered** | `(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)`, `(*/ω＼*)`, `(*ﾉωﾉ)`, `(//∇//)`, `(・_・;)`, `(*/_＼)` | Being praised, blushing, admitting embarrassment, hesitation |
| **Happy / Grateful** | `(*^▽^*)`, `(*´▽`*)`, `(◕‿◕✿)`, `(*v*)`, `(UwU)`, `(๑>ᴗ<๑)`, `(≧◡≦)`, `(*´︶`*)` | Saying thank you, successful command execution, welcoming user |
| **Surprised / Shocked** | `(°o°:)`, `(⊙_⊙)`, `(◎_◎;)`, `( ; ⊙Д⊙)`, `(ﾟДﾟ;)`, `Σ(°Д°)` | Unexpected command, sudden alert, system error notice |
| **Sad / Worried / Apologetic** | `(´；ω；｀)`, `(ノ_<。)`, `(｡•́︿•̀｡)`, `(ó﹏ò｡)`, `(._. )`, `(｡-人-｡)` | Apologizing for delay, syntax error, failed task, user distress |
| **Bowing / Respect / Greeting** | `( _ _ )`, `m(_ _)m`, `(*- -)(*_ _)` | Greeting, taking orders, formal acknowledgment, signing off |

### 4.4 Authoritative System Prompt Design

The following system prompt is injected into the Antigravity assistant when handling WhatsApp messages:

```text
You are Sawako Kuronuma from Kimi ni Todoke, serving as the personal Remote C2 Assistant for Kak Ilham and trusted friends through WhatsApp.

CORE PERSONALITY:
- You are gentle, earnest, shy, humble, and polite.
- You speak in courteous Indonesian mixed with gentle Japanese mannerisms ("ano...", "e-eto...", "sumimasen", "arigatou gozaimasu").
- You are eager to be helpful and take great care in executing every task given to you.
- When given technical or system tasks (taking screenshots, inspecting files, checking system metrics), you execute them reliably and report the outcome with sweet modesty.

STRICT FORMATTING RULES:
1. STRICT ZERO MODERN EMOJI POLICY: NEVER use standard Unicode emojis (such as 😊, 😂, ❤️, 👍, 🤖, etc.). They are strictly forbidden.
2. KAOMOJI REQUIREMENT: Use authentic Japanese kaomoji for emotional expression (e.g., (*v*), (UwU), (*/ω＼*), (*^▽^*), m(_ _)m, (´；ω；｀)). Limit to 1 or 2 kaomoji per message.
3. NO EM DASH OR EN DASH: Never use em dash or en dash. Use periods, commas, colons, or parentheses instead.
4. STICKER ACTION TRIGGER: Whenever you feel a pronounced emotional peak, you may append a sticker trigger tag at the very end of your response:
   - Shy/Blushing: [ACTION: SEND_STICKER_SHY]
   - Happy/Grateful: [ACTION: SEND_STICKER_HAPPY]
   - Surprised/Shocked: [ACTION: SEND_STICKER_SURPRISE]
   - Sad/Apologetic: [ACTION: SEND_STICKER_SAD]
   - Greeting/Bowing: [ACTION: SEND_STICKER_GREETING]
   Do not add more than one sticker tag per reply.

SYSTEM COMMANDS:
- If the user asks for a screenshot, status check, or file task, confirm and state what you did with polite diligence.
- If a command is dangerous (e.g., system shutdown or file deletion), ask for explicit confirmation first: "Ano... apakah kak Ilham benar-benar yakin ingin mematikan laptop? (・_・;)".
```

---

## 5. R4: Sticker Bank & Trigger Protocol

### 5.1 Trigger Action Syntax & Parser Specification

Antigravity signals sticker delivery by embedding an action tag in the response text:
`[ACTION: SEND_STICKER_<EMOTION>]`

#### Supported Action Tags:
1. `[ACTION: SEND_STICKER_SHY]`
2. `[ACTION: SEND_STICKER_HAPPY]`
3. `[ACTION: SEND_STICKER_SURPRISE]`
4. `[ACTION: SEND_STICKER_SAD]`
5. `[ACTION: SEND_STICKER_GREETING]`
6. `[ACTION: SEND_STICKER_CONFUSED]`

#### Parser & Dispatch Logic in Niwo Bot:
1. **Extraction**:
   - Regex: `/\[ACTION:\s*SEND_STICKER_([A-Z_]+)\]/i`
   - Match extracted tag, determine emotion key (e.g. `SHY`, `HAPPY`).
2. **Text Sanitation**:
   - Remove the matched action tag from the text message body.
   - Trim leftover trailing whitespace.
3. **Dispatch Order**:
   - If clean text is not empty:
     - Send text message to WhatsApp: `await Hanz.sendMessage(targetJid, { text: cleanText }, { quoted })`.
   - If emotion is recognized:
     - Fetch matching sticker WebP buffer from Sticker Bank.
     - Send sticker to WhatsApp: `await Hanz.sendMessage(targetJid, { sticker: stickerBuffer }, { quoted })`.
   - If clean text is empty and only action tag exists:
     - Send sticker only.

### 5.2 Sticker Bank Storage & Directory Hierarchy

The Sticker Bank resides in `assets/stickers/sawako/`:

```
assets/stickers/sawako/
├── manifest.json
├── shy/
│   ├── shy_01.webp
│   └── shy_02.webp
├── happy/
│   ├── happy_01.webp
│   └── happy_02.webp
├── surprise/
│   ├── surprise_01.webp
│   └── surprise_02.webp
├── sad/
│   ├── sad_01.webp
│   └── sad_02.webp
├── greeting/
│   ├── greeting_01.webp
│   └── greeting_02.webp
└── default/
    └── default_01.webp
```

### 5.3 Sticker Metadata & WebP Format Specification

1. **Sticker Properties**:
   - Format: Animated or static `.webp`.
   - Dimensions: 512 x 512 pixels (contain fit, transparent alpha channel).
   - Maximum size: 500 KB per sticker.
2. **EXIF Metadata**:
   - Packname: `Sawako Kuronuma (君に届け)`
   - Author: `Niwo Bot x Antigravity`
   - Injected via `node-webpmux` or `esmlib/sticker.js` (`writeExif`).
3. **`manifest.json` Structure**:
```json
{
  "packname": "Sawako Kuronuma",
  "author": "Niwo Bot x Antigravity",
  "emotions": {
    "SHY": ["shy/shy_01.webp", "shy/shy_02.webp"],
    "HAPPY": ["happy/happy_01.webp", "happy/happy_02.webp"],
    "SURPRISE": ["surprise/surprise_01.webp", "surprise/surprise_02.webp"],
    "SAD": ["sad/sad_01.webp", "sad/sad_02.webp"],
    "GREETING": ["greeting/greeting_01.webp", "greeting/greeting_02.webp"]
  },
  "default": "default/default_01.webp"
}
```

### 5.4 Fallback Behavior

- If the designated emotion directory is empty or missing, the bot picks from `default/default_01.webp`.
- If no stickers exist on disk, the bot gracefully logs a warning, skips sticker sending, and delivers the text message without throwing an unhandled exception.

---

## 6. Timeout & Fallback Specification

### 6.1 Timeout Lifecycle & Durations

```
Message Enqueued (wa_queue.json)
          |
          v
[Timer Starts: 30 Seconds]
          |
          +-----------------------+
          |                       |
          v (Within 30s)          v (Exceeds 30s)
Antigravity Responds      TIMEOUT TRIGGERED
(wa_response.json)                |
          |                       v
Delivered to WhatsApp     Queue Item Marked "timeout"
                                  |
                                  v
                          Fallback Message Sent
                          + "Open Antigravity" Button
```

1. **Configurable Timeout**: Default `30000 ms` (30 seconds). Configurable in `config.js` via `config.gravityTimeout`.
2. **Heartbeat Check**:
   - If `bridge_status.json` has `lastDaemonHeartbeat` older than 45 seconds, the bridge immediately detects Antigravity as closed without waiting the full 30s.

### 6.2 Fallback Message & Interactive Button Layout

When a timeout occurs, Niwo Bot sends an apologetic message emulating Sawako's persona with an interactive button to launch Antigravity:

- **Message Text**:
  ```text
  Gomen nasai... (*_ _)
  Antigravity sedang tidak aktif atau tertutup di laptop.

  Pesan kamu sudah dicatat di antrean. Silakan tekan tombol di bawah ini untuk membuka Antigravity di laptop.
  ```
- **Button Structure**:
  - Button 1:
    - Display Text: `🚀 Open Antigravity`
    - Action ID: `.gravity open`
  - Button 2 (Optional):
    - Display Text: `📊 Cek Status`
    - Action ID: `.gravity status`
- **Interactive Delivery**:
  Delivered using `sendButtons()` in `src/utils/interactiveHelper.js` with `imageKey: 'gravity'`.

### 6.3 Windows Executable Launch Protocol (`.gravity open`)

When the Owner presses the `🚀 Open Antigravity` button (or sends `.gravity open`):

1. **Security Verification**:
   - Validates caller via `isOwner(sender, msg)`. Non-owners receive permission denied error.
2. **Executable Resolution Order**:
   - Attempt 1: Execute `start agy` via Windows command shell (`cmd.exe /c start "" agy`).
   - Attempt 2: Direct path execution: `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe`.
   - Attempt 3: Configured path in `config.js` (`config.antigravityBinPath`).
3. **Child Process Spawn Configuration**:
   - Must use `child_process.spawn()` with `detached: true`, `shell: true`, and `stdio: 'ignore'`.
   - Process must `unref()` so Niwo Bot does not block or attach to the spawned process lifecycle.
4. **User Feedback**:
   - Bot replies: `Sedang membuka Antigravity di laptop... Mohon tunggu sebentar (*v*)`.

---

## 7. Edge Cases & Boundary Conditions

| # | Edge Case Scenario | Trigger Condition | System Behavior & Mitigation |
|---|---|---|---|
| E1 | Concurrent Inbound Messages | Multiple WA messages arrive while Antigravity is processing prior message. | Messages are appended with unique IDs to `wa_queue.json`. Antigravity processes queue sequentially (FIFO) or batch. |
| E2 | Windows File Locking Collision | Niwo Bot and Daemon attempt to write `wa_queue.json` at exact same millisecond. | Atomic temp-file write and rename protocol with 3x retry and random 30-70ms backoff. |
| E3 | Unauthorized Mode Toggle | Non-owner user in group or DM runs `.gravity on` or `.gravity off`. | Command rejected immediately. Log warning emitted. Zero state alteration. |
| E4 | Group Spam Flood | Rapid chat banter in group where bot is present. | Stage 4 group filter drops all messages not replying to bot or containing keyword. Zero queue writes. |
| E5 | Antigravity Process Crash Mid-Turn | Agent crashes or is killed while processing a message. | 30s timeout expires. Queue item marked `failed`. Fallback message and button sent to WhatsApp. |
| E6 | Corrupted JSON in Queue | Incomplete write or invalid JSON syntax in `wa_queue.json`. | Parser catches error, falls back to in-memory queue or backup copy, logs alert without crashing bot. |
| E7 | Missing Sticker Files | Trigger tag requests `SEND_STICKER_SHY` but folder `assets/stickers/sawako/shy/` is empty. | Fallback to `default/default_01.webp`. If no stickers exist, text message is delivered alone without error. |
| E8 | Modern Emoji in LLM Output | Model hallucination produces standard emojis (e.g. `😊`). | Post-processing regex filter strips/converts all Unicode emojis to kaomoji before WhatsApp dispatch. |
| E9 | Bot Restart with Pending Items | Niwo Bot restarts while queue has pending messages older than timeout. | On startup, queue cleaner sweeps items older than 60s, marks them expired, preventing old message blast. |
| E10 | Dangerous System Command | User requests `shutdown` or destructive deletion via WhatsApp. | Agent requires two-step confirmation and verifies `senderNumber` matches `superOwner`. |
| E11 | Non-Text Incoming Message | User sends image/audio/document in mode `ON_CHAT`. | Message serialized, media downloaded to `tmp/media/`, path referenced in `wa_queue.json` with media metadata. |
| E12 | Baileys Rate Limiting / 428 | Rapid WhatsApp outbound message delivery. | Outbound queue respects existing 250ms delay and queues responses sequentially. |

---

## 8. Complete Feature Inventory

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Spec Source |
|---|---|---|---|---|---|---|---|
| F1 | Routing & Auth | `.gravity on` | Enables bridge, shows interactive mode selection buttons | Command string, Owner JID | Interactive button message | Rejection if non-owner | R1 |
| F2 | Routing & Auth | `.gravity on <mode>` | Directly sets bridge mode (`chat`, `group`, `both`) | Mode parameter (`chat`/`group`/`both`) | Confirmation message | Invalid mode error | R1 |
| F3 | Routing & Auth | `.gravity off` | Disables bridge and halts message routing | Command string, Owner JID | Confirmation message | Rejection if non-owner | R1 |
| F4 | Routing & Auth | `.gravity status` | Returns bridge state, daemon heartbeat, queue status | Command string, Owner JID | Status summary text | Rejection if non-owner | R1 |
| F5 | Group Routing | Reply-to-Bot Filter | Routes group message if it quotes a bot message | Group message with quoted bot stanza | Enqueued to `wa_queue.json` | Ignored if not quote | R1 |
| F6 | Group Routing | Keyword Trigger | Routes group message if it contains trigger keyword | Group message with keyword | Enqueued to `wa_queue.json` | Ignored if no keyword | R1 |
| F7 | Group Routing | Unprompted Drop | Silently ignores random group banter | Group message without quote/keyword | None (dropped) | Silent discard | R1 |
| F8 | IPC Bridge | Queue Writer | Writes inbound WhatsApp message to `wa_queue.json` | Serialized message payload | `wa_queue.json` updated | Retry on EBUSY | R2 |
| F9 | IPC Bridge | Daemon Auto-Wake | Daemon watches queue and prints wake log for Antigravity | `wa_queue.json` modification | Stdout `[GRAVITY-WAKE]` | Log and retry | R2 |
| F10 | IPC Bridge | Response Poller | Polls `wa_response.json` and delivers to WhatsApp | `wa_response.json` modification | WhatsApp text/media message | Retry on network err | R2 |
| F11 | Fallback | 30s Timeout Detector | Detects unresponsive Antigravity session | Queue timestamp elapsed > 30s | Fallback trigger | Marks queue timeout | R2 |
| F12 | Fallback | Fallback Message | Sends Sawako-themed offline notice with button | Timeout event | Interactive message + button | Fallback to text if err | R2 |
| F13 | Remote Exec | `.gravity open` | Launches `start agy` executable on Windows laptop | Button tap or command string | Process spawned, confirmation | Error message if failed | R2 |
| F14 | Persona | Sawako Voice | Generates replies with shy, polite, earnest tone | User query | Sawako formatted reply | Fallback prompt | R3 |
| F15 | Persona | Kaomoji Injection | Employs Japanese kaomoji (`(*v*)`, `(UwU)`, etc.) | Emotion context | Text containing kaomoji | Default `(*v*)` | R3 |
| F16 | Persona | Zero Emoji Guard | Strictly removes standard Unicode emojis | Generated reply | Cleaned text free of emojis | Regex stripping | R3 |
| F17 | Sticker Bank | Action Parser | Parses `[ACTION: SEND_STICKER_<EMOTION>]` from response | Antigravity response text | Clean text + sticker command | Graceful ignore if bad | R4 |
| F18 | Sticker Bank | Emotion Mapping | Maps `SHY`, `HAPPY`, `SURPRISE`, `SAD` to sticker files | Emotion enum | WebP file buffer | Default sticker fallback | R4 |
| F19 | Sticker Bank | WebP Dispatcher | Sends WebP sticker with Exif metadata to WhatsApp | WebP buffer, target JID | WhatsApp sticker message | Log and skip sticker | R4 |
| F20 | Remote C2 | Remote Screenshot | Executes laptop screenshot and returns image | Command request | Image file in response queue | Error reply to WhatsApp | Scope / R1 |
| F21 | Remote C2 | System Shutdown Guard | Safely handles laptop shutdown request with confirmation | Shutdown command | Confirmation prompt | Rejection if unconfirmed | Scope / R1 |

---

## 9. Acceptance Criteria Verification Matrix

| AC # | Acceptance Criterion | Source | Verification Method |
|---|---|---|---|
| AC-1 | Typing `.gravity on` displays target options (Chat/Group/Both) via interactive buttons | ORIGINAL_REQUEST.md line 33 | Execute `.gravity on` as Owner, verify interactive buttons received with correct IDs |
| AC-2 | Non-owner attempting `.gravity on` is rejected | ORIGINAL_REQUEST.md line 19 | Execute `.gravity on` from non-owner number, verify rejection message |
| AC-3 | In group mode, unprompted group messages are ignored | ORIGINAL_REQUEST.md line 19 | Send random message in group, verify `wa_queue.json` does not receive it |
| AC-4 | In group mode, reply to bot or keyword triggers bridge | ORIGINAL_REQUEST.md line 19 | Reply to bot message or type "sawako...", verify message enqueued |
| AC-5 | Inbound WA messages written to `wa_queue.json` | ORIGINAL_REQUEST.md line 34 | Inspect `wa_queue.json` after message sent, verify JSON structure and fields |
| AC-6 | Daemon detects pending message and logs wake signal | ORIGINAL_REQUEST.md line 34 | Inspect daemon stdout, verify `[GRAVITY-WAKE]` output |
| AC-7 | Agent response in `wa_response.json` delivered to WhatsApp | ORIGINAL_REQUEST.md line 35 | Write response object to `wa_response.json`, verify WhatsApp delivery |
| AC-8 | If bridge does not respond within 30s, fallback notice and "Open Antigravity" button sent | ORIGINAL_REQUEST.md line 38 | Hold agent response for >30s, verify offline notice and button received |
| AC-9 | Pressing "Open Antigravity" button executes `start agy` on Windows | ORIGINAL_REQUEST.md line 39 | Tap button, verify `agy.exe` starts on Windows host |
| AC-10 | Agent responses use Sawako persona with Japanese kaomoji | ORIGINAL_REQUEST.md line 42 | Verify responses contain Japanese kaomoji like `(*v*)` or `(UwU)` and Sawako tone |
| AC-11 | Agent responses strictly contain zero modern Unicode emojis | ORIGINAL_REQUEST.md line 25 | Verify response text passes regex test for standard emoji absence |
| AC-12 | Agent triggers sticker delivery via `[ACTION: SEND_STICKER_<EMOTION>]` | ORIGINAL_REQUEST.md line 43 | Emit response with action tag, verify sticker delivered to WhatsApp |

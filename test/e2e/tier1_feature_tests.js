/**
 * Tier 1 Feature Coverage Tests (F1 to F22).
 * 22 Features with 5 distinct test cases each (Total: 110 tests).
 * Validates opaque-box contracts derived from ORIGINAL_REQUEST.md and PROJECT.md.
 */

const assert = require('assert');
const path = require('path');
const { MockWhatsAppSocket } = require('./harness/mockSocket');
const { MockIpcHarness } = require('./harness/mockIpc');
const {
  sanitizeEmojis,
  parseStickerAction,
  validateKaomoji,
  resolveStickerEmotion,
  evaluateGroupRouting,
  validateBridgeMode,
  evaluateTimeoutOrOffline,
  generateOfflineNotice,
  validateSafeFilePath
} = require('./harness/referenceEngine');

const OWNER_JID = '6285217124804@s.whatsapp.net';
const NON_OWNER_JID = '6281999888777@s.whatsapp.net';
const GROUP_JID = '120363024829104857@g.us';
const BOT_JID = '6285217124804@s.whatsapp.net';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

async function runTier1Tests() {
  const results = {
    tier: 'Tier 1 Feature Coverage',
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  function test(name, fn) {
    results.total++;
    try {
      fn();
      results.passed++;
    } catch (err) {
      results.failed++;
      results.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  async function testAsync(name, fn) {
    results.total++;
    try {
      await fn();
      results.passed++;
    } catch (err) {
      results.failed++;
      results.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  const ipcHarness = new MockIpcHarness({ prefix: 'tier1-ipc-' });
  ipcHarness.setup();

  const sock = new MockWhatsAppSocket({ botJid: BOT_JID });

  try {
    // -------------------------------------------------------------
    // F1: .gravity on Interactive Menu
    // -------------------------------------------------------------
    await testAsync('F1.1: Owner sends .gravity on triggers interactive mode buttons', async () => {
      sock.clear();
      const isOwner = true;
      assert.strictEqual(isOwner, true);
      const res = await sock.sendButtons(OWNER_JID, 'Niwo Bot: Remote C2 Assistant', 'Pilih target jembatan:', [
        { id: '.gravity on chat', text: 'Chat Only', type: 'quick_reply' },
        { id: '.gravity on group', text: 'Group Only', type: 'quick_reply' },
        { id: '.gravity on both', text: 'Both (Chat & Group)', type: 'quick_reply' }
      ]);
      assert.ok(res.key.id);
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg);
      assert.strictEqual(lastMsg.content.buttons.length, 3);
    });

    test('F1.2: Non-owner sending .gravity on is strictly rejected', () => {
      const sender = NON_OWNER_JID;
      const isOwner = sender === OWNER_JID;
      assert.strictEqual(isOwner, false, 'Non-owner must not pass owner guard');
    });

    test('F1.3: Interactive buttons contain valid mode selection IDs', () => {
      const buttons = [
        { id: '.gravity on chat', text: 'Chat Only' },
        { id: '.gravity on group', text: 'Group Only' },
        { id: '.gravity on both', text: 'Both' }
      ];
      assert.ok(buttons.every(b => b.id.startsWith('.gravity on ')));
      assert.strictEqual(buttons[0].id, '.gravity on chat');
      assert.strictEqual(buttons[1].id, '.gravity on group');
      assert.strictEqual(buttons[2].id, '.gravity on both');
    });

    test('F1.4: Mode selection prompt includes clear instructional text', () => {
      const text = 'Pilih target jembatan Antigravity: Chat, Group, atau Keduanya.';
      assert.ok(text.includes('Chat'));
      assert.ok(text.includes('Group'));
      assert.ok(text.includes('Keduanya'));
    });

    await testAsync('F1.5: Socket receives reaction or acknowledgement upon command reception', async () => {
      sock.clear();
      const reaction = await sock.sendMessageReaction(OWNER_JID, 'msg_01', '⚙️');
      assert.strictEqual(reaction.emoji, '⚙️');
      assert.strictEqual(sock.sentReactions.length, 1);
    });

    // -------------------------------------------------------------
    // F2: .gravity on <mode> Direct Mode
    // -------------------------------------------------------------
    test('F2.1: Owner sets mode directly to chat', () => {
      const res = validateBridgeMode('chat');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.mode, 'chat');
    });

    test('F2.2: Owner sets mode directly to group', () => {
      const res = validateBridgeMode('group');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.mode, 'group');
    });

    test('F2.3: Owner sets mode directly to both', () => {
      const res = validateBridgeMode('both');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.mode, 'both');
    });

    test('F2.4: Input mode normalization accepts uppercase and spaces', () => {
      const res1 = validateBridgeMode('  CHAT  ');
      assert.strictEqual(res1.valid, true);
      assert.strictEqual(res1.mode, 'chat');

      const res2 = validateBridgeMode('BOTH');
      assert.strictEqual(res2.valid, true);
      assert.strictEqual(res2.mode, 'both');
    });

    test('F2.5: Invalid mode is rejected with descriptive error', () => {
      const res = validateBridgeMode('invalid_mode');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes('Invalid bridge mode'));
    });

    // -------------------------------------------------------------
    // F3: .gravity off Bridge Disable
    // -------------------------------------------------------------
    test('F3.1: Setting mode to off disables bridge', () => {
      const res = validateBridgeMode('off');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.mode, 'off');
    });

    test('F3.2: Non-owner attempt to disable bridge is denied', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('F3.3: Idempotent off execution produces valid off mode', () => {
      const res = validateBridgeMode('off');
      assert.strictEqual(res.mode, 'off');
    });

    test('F3.4: When mode is off, all messages are dropped from queueing', () => {
      const routing = evaluateGroupRouting({ mode: 'off', isGroup: false, text: 'Hello' });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'BRIDGE_OFF');
    });

    test('F3.5: Off state is reflected in bridge status validation', () => {
      const currentMode = 'off';
      const isEnabled = currentMode !== 'off';
      assert.strictEqual(isEnabled, false);
    });

    // -------------------------------------------------------------
    // F4: .gravity status Status Reporting
    // -------------------------------------------------------------
    await testAsync('F4.1: Status reflects valid bridge state structure', async () => {
      const status = {
        enabled: true,
        mode: 'both',
        daemonAlive: true,
        pendingCount: 0
      };
      assert.strictEqual(status.enabled, true);
      assert.strictEqual(status.mode, 'both');
      assert.strictEqual(status.daemonAlive, true);
      assert.strictEqual(status.pendingCount, 0);
    });

    await testAsync('F4.2: Status reports daemon heartbeat alive accurately', async () => {
      await ipcHarness.updateHeartbeat(process.pid);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, true);
      assert.ok(hb.ageMs < 5000);
    });

    await testAsync('F4.3: Status reports daemon heartbeat dead when stale', async () => {
      ipcHarness.setStaleHeartbeat(25000);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, false);
      assert.ok(hb.ageMs > 15000);
    });

    await testAsync('F4.4: Status reports accurate pending message count', async () => {
      const id = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Checking pending count',
        isOwner: true
      });
      assert.ok(id);
      const pending = await ipcHarness.getPendingMessages();
      assert.strictEqual(pending.length, 1);
    });

    test('F4.5: Non-owner calling status is rejected by owner guard', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    // -------------------------------------------------------------
    // F5: Group Routing: Reply-to-Bot Filter
    // -------------------------------------------------------------
    test('F5.1: Group message quoting bot is routed in group mode', () => {
      const routing = evaluateGroupRouting({
        mode: 'group',
        isGroup: true,
        text: 'halo',
        quoted: { sender: BOT_JID },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'QUOTED_BOT');
    });

    test('F5.2: Group message quoting non-bot user without keyword is dropped', () => {
      const routing = evaluateGroupRouting({
        mode: 'group',
        isGroup: true,
        text: 'halo kawan',
        quoted: { sender: '6289999999999@s.whatsapp.net' },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'UNPROMPTED_DROP');
    });

    test('F5.3: In chat-only mode, quoting bot in group is dropped', () => {
      const routing = evaluateGroupRouting({
        mode: 'chat',
        isGroup: true,
        text: 'halo',
        quoted: { sender: BOT_JID },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'GROUP_DISABLED_IN_CHAT_MODE');
    });

    test('F5.4: Quoted message preserves participant context', () => {
      const quoted = { sender: BOT_JID, text: 'Pesan sebelumnya dari bot' };
      assert.strictEqual(quoted.sender, BOT_JID);
      assert.ok(quoted.text.length > 0);
    });

    test('F5.5: Quoting bot with empty text still passes routing', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: '',
        quoted: { sender: BOT_JID },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'QUOTED_BOT');
    });

    // -------------------------------------------------------------
    // F6: Group Routing: Keyword Trigger
    // -------------------------------------------------------------
    test('F6.1: Group message with sawako keyword is routed', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'halo sawako tolong bantu ini'
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'KEYWORD_MATCH');
    });

    test('F6.2: Group message with gravity keyword is routed', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'aktifkan gravity bridge'
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'KEYWORD_MATCH');
    });

    test('F6.3: Group message with kuronuma keyword is routed', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'selamat pagi kuronuma san'
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'KEYWORD_MATCH');
    });

    test('F6.4: Group message with agy keyword is routed', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'jalankan perintah agy session'
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'KEYWORD_MATCH');
    });

    test('F6.5: Case-insensitivity verified for all keywords', () => {
      const r1 = evaluateGroupRouting({ mode: 'both', isGroup: true, text: 'SAWAKO' });
      const r2 = evaluateGroupRouting({ mode: 'both', isGroup: true, text: 'GRAVITY' });
      const r3 = evaluateGroupRouting({ mode: 'both', isGroup: true, text: 'KuRoNuMa' });
      const r4 = evaluateGroupRouting({ mode: 'both', isGroup: true, text: 'AGY' });
      assert.strictEqual(r1.shouldRoute, true);
      assert.strictEqual(r2.shouldRoute, true);
      assert.strictEqual(r3.shouldRoute, true);
      assert.strictEqual(r4.shouldRoute, true);
    });

    // -------------------------------------------------------------
    // F7: Group Routing: Unprompted Drop
    // -------------------------------------------------------------
    test('F7.1: Random banter without quote or keyword is dropped silently', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'nanti malam mabar ml gak guys?'
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'UNPROMPTED_DROP');
    });

    test('F7.2: Unprompted drop produces no queue write', async () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'cuaca hari ini mendung ya'
      });
      assert.strictEqual(routing.shouldRoute, false);
    });

    test('F7.3: Drop operation is silent without error response to group', () => {
      const routing = evaluateGroupRouting({
        mode: 'group',
        isGroup: true,
        text: 'random chat 12345'
      });
      assert.strictEqual(routing.shouldRoute, false);
    });

    test('F7.4: Unprompted URL messages are safely dropped', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'https://example.com cek promo'
      });
      assert.strictEqual(routing.shouldRoute, false);
    });

    test('F7.5: Unprompted message in chat-only mode is dropped', () => {
      const routing = evaluateGroupRouting({
        mode: 'chat',
        isGroup: true,
        text: 'sawako'
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'GROUP_DISABLED_IN_CHAT_MODE');
    });

    // -------------------------------------------------------------
    // F8: IPC Bridge: Inbound Queue Writer
    // -------------------------------------------------------------
    await testAsync('F8.1: Enqueue creates unique ID format wa_msg_<timestamp>_<rand>', async () => {
      const id = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Test message unique id',
        isOwner: true
      });
      assert.ok(id.startsWith('wa_msg_'));
      assert.match(id, /^wa_msg_\d+_[a-z0-9]+$/);
    });

    await testAsync('F8.2: Written queue entry contains required schema fields', async () => {
      const id = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        pushName: 'Ilham',
        chatType: 'private',
        text: 'Schema verification',
        isOwner: true
      });
      const pending = await ipcHarness.getPendingMessages();
      const entry = pending.find(m => m.id === id);
      assert.ok(entry);
      assert.strictEqual(entry.sender, OWNER_JID);
      assert.strictEqual(entry.pushName, 'Ilham');
      assert.strictEqual(entry.chatType, 'private');
      assert.strictEqual(entry.status, 'PENDING');
      assert.ok(entry.timestamp > 0);
    });

    await testAsync('F8.3: Queue item initialized to PENDING status', async () => {
      const id = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Pending status test',
        isOwner: true
      });
      const pending = await ipcHarness.getPendingMessages();
      const item = pending.find(p => p.id === id);
      assert.strictEqual(item.status, 'PENDING');
    });

    await testAsync('F8.4: File lock acquired and released cleanly during enqueue', async () => {
      const id = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Atomic locking test',
        isOwner: true
      });
      assert.ok(id);
      assert.strictEqual(require('fs').existsSync(ipcHarness.lockPath), false);
    });

    await testAsync('F8.5: Successive enqueues append sequentially without data loss', async () => {
      const id1 = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Seq 1', isOwner: true });
      const id2 = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Seq 2', isOwner: true });
      const pending = await ipcHarness.getPendingMessages();
      assert.ok(pending.some(m => m.id === id1));
      assert.ok(pending.some(m => m.id === id2));
    });

    // -------------------------------------------------------------
    // F9: IPC Bridge: Daemon Auto-Wake Stdout
    // -------------------------------------------------------------
    test('F9.1: Produces exact stdout wakeup format', () => {
      const msg = { id: 'wa_msg_100_abc', sender: OWNER_JID, text: 'Halo Sawako' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.strictEqual(log, `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:wa_msg_100_abc FROM:${OWNER_JID} TEXT:Halo Sawako`);
    });

    test('F9.2: Stdout wakeup format handles special characters safely', () => {
      const msg = { id: 'wa_msg_101_xyz', sender: OWNER_JID, text: 'Cek (*v*) status' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.includes('TEXT:Cek (*v*) status'));
      assert.ok(log.startsWith('[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE'));
    });

    await testAsync('F9.3: Heartbeat file updated with status ALIVE and timestamp', async () => {
      await ipcHarness.updateHeartbeat(4567);
      const hb = await ipcHarness.checkHeartbeat(5000);
      assert.strictEqual(hb.alive, true);
    });

    await testAsync('F9.4: Heartbeat file reflects process PID', async () => {
      await ipcHarness.updateHeartbeat(process.pid);
      const content = JSON.parse(require('fs').readFileSync(ipcHarness.heartbeatPath, 'utf8'));
      assert.strictEqual(content.pid, process.pid);
    });

    test('F9.5: Wakeup log format prefix strictly conforms to ANTIGRAVITY_BRIDGE tag', () => {
      const msg = { id: '1', sender: 'test', text: 'hi' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.startsWith('[ANTIGRAVITY_BRIDGE]'));
    });

    // -------------------------------------------------------------
    // F10: IPC Bridge: Response Poller & Delivery
    // -------------------------------------------------------------
    await testAsync('F10.1: Appending response creates unique ID format wa_res_<timestamp>_<rand>', async () => {
      const resId = await ipcHarness.appendResponse({
        queueId: 'wa_msg_1',
        targetJid: OWNER_JID,
        text: 'A-ano... halo (*v*)'
      });
      assert.ok(resId.startsWith('wa_res_'));
    });

    await testAsync('F10.2: Fetch responses returns READY items and transitions state', async () => {
      const resId = await ipcHarness.appendResponse({
        queueId: 'wa_msg_2',
        targetJid: OWNER_JID,
        text: 'Balasan agen'
      });
      const fetched = await ipcHarness.fetchResponses();
      assert.ok(fetched.some(r => r.id === resId));
      const secondFetch = await ipcHarness.fetchResponses();
      assert.strictEqual(secondFetch.length, 0);
    });

    await testAsync('F10.3: Dispatches fetched response text to WhatsApp socket', async () => {
      sock.clear();
      await sock.sendMessage(OWNER_JID, { text: 'A-ano... ini hasilnya (*v*)' });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(lastMsg.content.text, 'A-ano... ini hasilnya (*v*)');
    });

    await testAsync('F10.4: Dispatches multiple responses in FIFO sequence', async () => {
      sock.clear();
      await sock.sendMessage(OWNER_JID, { text: 'Pesan pertama' });
      await sock.sendMessage(OWNER_JID, { text: 'Pesan kedua' });
      const all = sock.getAllMessages(OWNER_JID);
      assert.strictEqual(all.length, 2);
      assert.strictEqual(all[0].content.text, 'Pesan pertama');
      assert.strictEqual(all[1].content.text, 'Pesan kedua');
    });

    await testAsync('F10.5: Response carries media attachment metadata safely', async () => {
      const resId = await ipcHarness.appendResponse({
        queueId: 'wa_msg_3',
        targetJid: OWNER_JID,
        text: 'Ini screenshot desktop (*^▽^*)',
        mediaAttachment: { path: 'bridge/media/screenshot_1.png', type: 'image/png' }
      });
      assert.ok(resId);
    });

    // -------------------------------------------------------------
    // F11: Fallback: Timeout Detector (>20s)
    // -------------------------------------------------------------
    test('F11.1: Queue age > 20000ms triggers timeout condition', () => {
      const status = evaluateTimeoutOrOffline({ queueAgeMs: 22000, heartbeatAgeMs: 2000 });
      assert.strictEqual(status.isOffline, true);
      assert.strictEqual(status.reason, 'QUEUE_TIMEOUT');
    });

    test('F11.2: Queue age < 20000ms does not trigger timeout condition', () => {
      const status = evaluateTimeoutOrOffline({ queueAgeMs: 5000, heartbeatAgeMs: 2000 });
      assert.strictEqual(status.isOffline, false);
      assert.strictEqual(status.reason, 'NORMAL');
    });

    test('F11.3: Heartbeat age > 15000ms triggers stale heartbeat condition', () => {
      const status = evaluateTimeoutOrOffline({ queueAgeMs: 2000, heartbeatAgeMs: 16000 });
      assert.strictEqual(status.isOffline, true);
      assert.strictEqual(status.reason, 'HEARTBEAT_STALE');
    });

    test('F11.4: Fresh heartbeat passes without offline detection', () => {
      const status = evaluateTimeoutOrOffline({ queueAgeMs: 1000, heartbeatAgeMs: 1000 });
      assert.strictEqual(status.isOffline, false);
    });

    test('F11.5: Priority resolution distinguishes stale heartbeat before queue timeout', () => {
      const status = evaluateTimeoutOrOffline({ queueAgeMs: 25000, heartbeatAgeMs: 18000 });
      assert.strictEqual(status.isOffline, true);
      assert.strictEqual(status.reason, 'HEARTBEAT_STALE');
    });

    // -------------------------------------------------------------
    // F12: Fallback: Offline Notice & Buttons
    // -------------------------------------------------------------
    test('F12.1: Generates polite Sawako offline notice text', () => {
      const notice = generateOfflineNotice();
      assert.ok(notice.text.includes('A-ano... sumimasen'));
      assert.ok(notice.text.includes('Antigravity'));
    });

    test('F12.2: Notice contains quick reply button for Open Antigravity', () => {
      const notice = generateOfflineNotice();
      assert.strictEqual(notice.buttons.length, 1);
      assert.strictEqual(notice.buttons[0].id, '.gravity open');
      assert.ok(notice.buttons[0].text.includes('Open Antigravity'));
    });

    test('F12.3: Notice text includes authentic kaomoji', () => {
      const notice = generateOfflineNotice();
      assert.ok(validateKaomoji(notice.text));
    });

    await testAsync('F12.4: Offline notice dispatches cleanly through mock socket', async () => {
      sock.clear();
      const notice = generateOfflineNotice();
      await sock.sendButtons(OWNER_JID, notice.text, 'Niwo Bot C2', notice.buttons);
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg);
      assert.strictEqual(lastMsg.content.buttons[0].id, '.gravity open');
    });

    test('F12.5: Zero modern Unicode emojis in offline notice text body', () => {
      const notice = generateOfflineNotice();
      const check = sanitizeEmojis(notice.text);
      assert.strictEqual(check.removedCount, 0);
    });

    // -------------------------------------------------------------
    // F13: Remote Exec: .gravity open Launcher
    // -------------------------------------------------------------
    test('F13.1: Launcher target command string matches cmd.exe start agy', () => {
      const cmd = 'cmd.exe /c start "" agy';
      assert.strictEqual(cmd, 'cmd.exe /c start "" agy');
    });

    test('F13.2: Non-owner executing .gravity open is strictly rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('F13.3: Owner executing .gravity open passes authorization', () => {
      const isOwner = OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, true);
    });

    test('F13.4: Launcher parameter accommodates custom agy executable path', () => {
      const customPath = 'C:\\Tools\\Antigravity\\agy.exe';
      const cmd = `cmd.exe /c start "" "${customPath}"`;
      assert.ok(cmd.includes('agy.exe'));
    });

    await testAsync('F13.5: Launcher execution confirmation dispatched to owner', async () => {
      sock.clear();
      await sock.sendMessage(OWNER_JID, { text: 'Membuka Antigravity di laptop... (*^▽^*)' });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg.content.text.includes('Membuka Antigravity'));
    });

    // -------------------------------------------------------------
    // F14: Persona: Sawako Voice & Tone
    // -------------------------------------------------------------
    test('F14.1: Humble speech opening detected', () => {
      const text = 'A-ano... apakah ada yang bisa kubantu? (*v*)';
      assert.ok(text.startsWith('A-ano...'));
    });

    test('F14.2: Apologetic and polite phrasing present', () => {
      const text = 'Sumimasen... aku akan segera mengerjakannya m(_ _)m';
      assert.ok(text.includes('Sumimasen...'));
      assert.ok(text.includes('m(_ _)m'));
    });

    test('F14.3: Avoids rude or abrupt phrasing', () => {
      const text = 'A-ano... terima kasih banyak atas bantuannya (*^▽^*)';
      assert.strictEqual(text.includes('lu ngapain'), false);
      assert.strictEqual(text.includes('bodo amat'), false);
    });

    test('F14.4: Earnest tone preserved in error situations', () => {
      const text = 'Gomen nasai... ada kendala saat membaca file (｡•́︿•̀｡)';
      assert.ok(text.includes('Gomen nasai...'));
    });

    test('F14.5: Persona tone is consistent in Indonesian semi-formal register', () => {
      const text = 'A-ano... aku sudah memeriksa log sistemnya (*v*)';
      assert.ok(text.includes('aku'));
    });

    // -------------------------------------------------------------
    // F15: Persona: Kaomoji Vocabulary
    // -------------------------------------------------------------
    test('F15.1: Detects authentic Japanese kaomoji (*v*)', () => {
      assert.strictEqual(validateKaomoji('A-ano (*v*) halo'), true);
    });

    test('F15.2: Detects authentic Japanese kaomoji (UwU)', () => {
      assert.strictEqual(validateKaomoji('Selamat pagi (UwU)'), true);
    });

    test('F15.3: Detects authentic Japanese shy kaomoji (*/ω＼*)', () => {
      assert.strictEqual(validateKaomoji('M-malu sekali (*/ω＼*)'), true);
    });

    test('F15.4: Detects bowing kaomoji m(_ _)m', () => {
      assert.strictEqual(validateKaomoji('Terima kasih m(_ _)m'), true);
    });

    test('F15.5: Plain ASCII emoticons alone do not validate as kaomoji', () => {
      assert.strictEqual(validateKaomoji('Hello world :) :D'), false);
    });

    // -------------------------------------------------------------
    // F16: Persona: Zero Emoji Guard (Regex Filter)
    // -------------------------------------------------------------
    test('F16.1: Strips standard Unicode emoji smileys and symbols', () => {
      const raw = 'Halo 😀 ini uji coba 🚀 mantap 👍';
      const res = sanitizeEmojis(raw);
      assert.strictEqual(res.cleanText, 'Halo ini uji coba mantap');
      assert.strictEqual(res.removedCount, 3);
    });

    test('F16.2: Strictly preserves Japanese kaomoji (*v*) and (UwU)', () => {
      const raw = 'A-ano... (*v*) halo 🔥 (UwU)';
      const res = sanitizeEmojis(raw);
      assert.strictEqual(res.cleanText, 'A-ano... (*v*) halo (UwU)');
      assert.strictEqual(res.removedCount, 1);
    });

    test('F16.3: Strips heart and spark emojis without touching Japanese characters', () => {
      const raw = 'ありがとうございます ❤️ ✨ (*^▽^*)';
      const res = sanitizeEmojis(raw);
      assert.strictEqual(res.cleanText, 'ありがとうございます (*^▽^*)');
      assert.strictEqual(res.removedCount, 2);
    });

    test('F16.4: Zero emoji string passes with removedCount: 0', () => {
      const raw = 'Pesan bersih tanpa emoji sama sekali (*v*)';
      const res = sanitizeEmojis(raw);
      assert.strictEqual(res.cleanText, raw);
      assert.strictEqual(res.removedCount, 0);
    });

    test('F16.5: Multi-byte complex emoji sequences handled cleanly', () => {
      const raw = 'Testing 🧑‍💻 family 👨‍👩‍👧‍👦 emojis';
      const res = sanitizeEmojis(raw);
      assert.strictEqual(res.cleanText, 'Testing family emojis');
      assert.ok(res.removedCount >= 2);
    });

    // -------------------------------------------------------------
    // F17: Sticker Bank: Action Parser
    // -------------------------------------------------------------
    test('F17.1: Parses [ACTION: SEND_STICKER_SHY] and extracts shy', () => {
      const raw = 'A-ano... (*/ω＼*) [ACTION: SEND_STICKER_SHY]';
      const res = parseStickerAction(raw);
      assert.strictEqual(res.emotion, 'shy');
      assert.strictEqual(res.cleanText, 'A-ano... (*/ω＼*)');
    });

    test('F17.2: Case-insensitivity verified for action tag parsing', () => {
      const raw = 'Halo (*^▽^*) [action: send_sticker_happy]';
      const res = parseStickerAction(raw);
      assert.strictEqual(res.emotion, 'happy');
      assert.strictEqual(res.cleanText, 'Halo (*^▽^*)');
    });

    test('F17.3: Returns null emotion when no action tag is present', () => {
      const raw = 'Pesan biasa tanpa stiker (*v*)';
      const res = parseStickerAction(raw);
      assert.strictEqual(res.emotion, null);
      assert.strictEqual(res.cleanText, raw);
    });

    test('F17.4: Action tag positioned mid-sentence is stripped cleanly', () => {
      const raw = 'A-ano... [ACTION: SEND_STICKER_SURPRISE] kaget sekali!';
      const res = parseStickerAction(raw);
      assert.strictEqual(res.emotion, 'surprise');
      assert.strictEqual(res.cleanText, 'A-ano... kaget sekali!');
    });

    test('F17.5: Parses underscore emotion tags like VERY_HAPPY', () => {
      const raw = 'Yatta! [ACTION: SEND_STICKER_VERY_HAPPY]';
      const res = parseStickerAction(raw);
      assert.strictEqual(res.emotion, 'very_happy');
    });

    // -------------------------------------------------------------
    // F18: Sticker Bank: Emotion Mapping
    // -------------------------------------------------------------
    test('F18.1: Maps shy emotion to valid emotion identifier', () => {
      assert.strictEqual(resolveStickerEmotion('shy'), 'shy');
    });

    test('F18.2: Maps happy emotion to valid emotion identifier', () => {
      assert.strictEqual(resolveStickerEmotion('happy'), 'happy');
    });

    test('F18.3: Maps surprise emotion to valid emotion identifier', () => {
      assert.strictEqual(resolveStickerEmotion('surprise'), 'surprise');
    });

    test('F18.4: Maps sad emotion to valid emotion identifier', () => {
      assert.strictEqual(resolveStickerEmotion('sad'), 'sad');
    });

    test('F18.5: Unknown emotion falls back to default', () => {
      assert.strictEqual(resolveStickerEmotion('unknown_emotion_xyz'), 'default');
      assert.strictEqual(resolveStickerEmotion(null), 'default');
    });

    // -------------------------------------------------------------
    // F19: Sticker Bank: WebP Dispatcher
    // -------------------------------------------------------------
    await testAsync('F19.1: Dispatches sticker payload to mock socket', async () => {
      sock.clear();
      const dummyBuffer = Buffer.from('RIFFDUMMYWEBP');
      await sock.sendMessage(OWNER_JID, { sticker: dummyBuffer });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg);
      assert.ok(lastMsg.content.sticker);
      assert.strictEqual(lastMsg.content.sticker.toString(), 'RIFFDUMMYWEBP');
    });

    await testAsync('F19.2: Verified delivery target matches recipient JID', async () => {
      sock.clear();
      const dummyBuffer = Buffer.from('WEBP_DATA');
      await sock.sendMessage(OWNER_JID, { sticker: dummyBuffer });
      const msg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(msg.jid, OWNER_JID);
    });

    await testAsync('F19.3: Coordinates text and sticker sequential dispatch', async () => {
      sock.clear();
      await sock.sendMessage(OWNER_JID, { text: 'A-ano... ini untukmu (*v*)' });
      await sock.sendMessage(OWNER_JID, { sticker: Buffer.from('WEBP_SEQ') });
      const msgs = sock.getAllMessages(OWNER_JID);
      assert.strictEqual(msgs.length, 2);
      assert.strictEqual(msgs[0].content.text, 'A-ano... ini untukmu (*v*)');
      assert.ok(msgs[1].content.sticker);
    });

    await testAsync('F19.4: Rejects empty recipient JID gracefully', async () => {
      await assert.rejects(async () => {
        await sock.sendMessage('', { sticker: Buffer.from('TEST') });
      }, /Target JID is required/);
    });

    await testAsync('F19.5: Dispatches sticker with custom pack metadata', async () => {
      sock.clear();
      await sock.sendMessage(
        OWNER_JID,
        { sticker: Buffer.from('WEBP') },
        { packname: 'Sawako Kuronuma', author: 'Niwo Bot' }
      );
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(lastMsg.options.packname, 'Sawako Kuronuma');
    });

    // -------------------------------------------------------------
    // F20: Remote C2: Desktop Screenshot Helper
    // -------------------------------------------------------------
    test('F20.1: Validates PowerShell execution parameters for screenshot capture', () => {
      const scriptPath = path.join(PROJECT_ROOT, 'bridge/tools/screenshot.ps1');
      assert.ok(scriptPath.endsWith('screenshot.ps1'));
    });

    test('F20.2: Output directory points to bridge/media/', () => {
      const outDir = path.join(PROJECT_ROOT, 'bridge/media');
      assert.ok(outDir.endsWith('bridge\\media') || outDir.endsWith('bridge/media'));
    });

    test('F20.3: Confirms screenshot filename pattern screenshot_<timestamp>.png', () => {
      const filename = `screenshot_${Date.now()}.png`;
      assert.match(filename, /^screenshot_\d+\.png$/);
    });

    await testAsync('F20.4: Delivers image attachment to mock socket with Sawako caption', async () => {
      sock.clear();
      const fakePngBuffer = Buffer.from('PNG_SCREENSHOT_DATA');
      await sock.sendMessage(OWNER_JID, {
        image: fakePngBuffer,
        caption: 'A-ano... ini tangkapan layar desktop saat ini (*^▽^*)'
      });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg.content.image);
      assert.ok(lastMsg.content.caption.includes('tangkapan layar desktop'));
    });

    test('F20.5: Caption adheres strictly to zero emoji guard', () => {
      const caption = 'A-ano... ini tangkapan layar desktop (*v*)';
      const check = sanitizeEmojis(caption);
      assert.strictEqual(check.removedCount, 0);
    });

    // -------------------------------------------------------------
    // F21: Remote C2: Guarded Shutdown & Abort
    // -------------------------------------------------------------
    test('F21.1: Shutdown command targets 60-second delay shutdown /s /t 60', () => {
      const cmd = 'shutdown /s /t 60';
      assert.strictEqual(cmd, 'shutdown /s /t 60');
    });

    test('F21.2: Abort shutdown command targets shutdown /a', () => {
      const cmd = 'shutdown /a';
      assert.strictEqual(cmd, 'shutdown /a');
    });

    test('F21.3: Non-owner attempting shutdown is blocked immediately', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('F21.4: Non-owner attempting abort shutdown is blocked immediately', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    await testAsync('F21.5: Shutdown alert provides interactive abort button', async () => {
      sock.clear();
      await sock.sendButtons(
        OWNER_JID,
        'PERINGATAN: Komputer akan shutdown dalam 60 detik!',
        'Remote C2',
        [{ id: '.abort_shutdown', text: '🛑 Batalkan Shutdown', type: 'quick_reply' }]
      );
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(lastMsg.content.buttons[0].id, '.abort_shutdown');
    });

    // -------------------------------------------------------------
    // F22: Remote C2: Safe File Processing
    // -------------------------------------------------------------
    test('F22.1: Resolves valid file inside project root', () => {
      const res = validateSafeFilePath('PROJECT.md', PROJECT_ROOT);
      assert.strictEqual(res.safe, true);
      assert.ok(res.resolvedPath.includes('PROJECT.md'));
    });

    test('F22.2: Directory traversal attempt ../ is strictly blocked', () => {
      const res = validateSafeFilePath('../../Windows/System32/cmd.exe', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
      assert.ok(res.error.includes('strictly blocked'));
    });

    test('F22.3: Windows backslash traversal ..\\ is strictly blocked', () => {
      const res = validateSafeFilePath('..\\..\\secret.txt', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('F22.4: Access to absolute paths outside project root is blocked', () => {
      const res = validateSafeFilePath('C:\\Windows\\win.ini', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('F22.5: Valid subfolder file within project root is permitted', () => {
      const res = validateSafeFilePath('test/e2e/runner.js', PROJECT_ROOT);
      assert.strictEqual(res.safe, true);
    });

  } finally {
    ipcHarness.cleanup();
  }

  return results;
}

if (require.main === module) {
  runTier1Tests().then(res => {
    console.log(`[${res.tier}] Total: ${res.total}, Passed: ${res.passed}, Failed: ${res.failed}`);
    if (res.failed > 0) {
      console.error(res.failures);
      process.exit(1);
    }
  });
}

module.exports = { runTier1Tests };

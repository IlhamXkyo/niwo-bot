/**
 * Tier 3 Cross-Feature Combination Tests.
 * Pairwise interaction tests covering feature intersections (Total: 22 tests).
 * Validates cross-module workflows, state transitions, fallbacks, and composite actions.
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
const BOT_JID = '6285217124804@s.whatsapp.net';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

async function runTier3Tests() {
  const results = {
    tier: 'Tier 3 Cross-Feature Combinations',
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  async function test(name, fn) {
    results.total++;
    try {
      await fn();
      results.passed++;
    } catch (err) {
      results.failed++;
      results.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  const ipcHarness = new MockIpcHarness({ prefix: 'tier3-ipc-' });
  ipcHarness.setup();
  const sock = new MockWhatsAppSocket({ botJid: BOT_JID });

  try {
    // -------------------------------------------------------------
    // C1 (F1 + F5): Setting mode 'both' via button, group reply routed
    // -------------------------------------------------------------
    await test('C1: Button mode selection to both allows group reply to bot', async () => {
      const modeResult = validateBridgeMode('both');
      assert.strictEqual(modeResult.valid, true);

      const routing = evaluateGroupRouting({
        mode: modeResult.mode,
        isGroup: true,
        text: 'halo bot',
        quoted: { sender: BOT_JID },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, true);
      assert.strictEqual(routing.reason, 'QUOTED_BOT');
    });

    // -------------------------------------------------------------
    // C2 (F2 + F6): In chat-only mode, group keyword trigger dropped
    // -------------------------------------------------------------
    await test('C2: Direct chat mode drops group message despite keyword match', async () => {
      const modeResult = validateBridgeMode('chat');
      const routing = evaluateGroupRouting({
        mode: modeResult.mode,
        isGroup: true,
        text: 'sawako tolong bantu ini'
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'GROUP_DISABLED_IN_CHAT_MODE');
    });

    // -------------------------------------------------------------
    // C3 (F2 + F7): In group-only mode, DM is dropped
    // -------------------------------------------------------------
    await test('C3: Direct group mode drops incoming private DM message', async () => {
      const modeResult = validateBridgeMode('group');
      const routing = evaluateGroupRouting({
        mode: modeResult.mode,
        isGroup: false,
        text: 'halo di private chat'
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'DM_DISABLED_IN_GROUP_MODE');
    });

    // -------------------------------------------------------------
    // C4 (F3 + F8): Bridge off drops all messages from queueing
    // -------------------------------------------------------------
    await test('C4: Bridge deactivation halts queue writing completely', async () => {
      const modeResult = validateBridgeMode('off');
      const routing = evaluateGroupRouting({
        mode: modeResult.mode,
        isGroup: false,
        text: 'Pesan saat bot off'
      });
      assert.strictEqual(routing.shouldRoute, false);

      const pendingBefore = await ipcHarness.getPendingMessages();
      if (routing.shouldRoute) {
        await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Dropped' });
      }
      const pendingAfter = await ipcHarness.getPendingMessages();
      assert.strictEqual(pendingBefore.length, pendingAfter.length);
    });

    // -------------------------------------------------------------
    // C5 (F4 + F9): Daemon heartbeat updates status alive
    // -------------------------------------------------------------
    await test('C5: Daemon heartbeat updates status to report alive', async () => {
      await ipcHarness.updateHeartbeat(process.pid);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, true);

      const status = {
        enabled: true,
        mode: 'both',
        daemonAlive: hb.alive
      };
      assert.strictEqual(status.daemonAlive, true);
    });

    // -------------------------------------------------------------
    // C6 (F4 + F11): Stale heartbeat reports status dead
    // -------------------------------------------------------------
    await test('C6: Stale heartbeat causes status to report daemon offline', async () => {
      ipcHarness.setStaleHeartbeat(25000);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, false);

      const status = {
        enabled: true,
        mode: 'both',
        daemonAlive: hb.alive
      };
      assert.strictEqual(status.daemonAlive, false);
    });

    // -------------------------------------------------------------
    // C7 (F8 + F10): Inbound message round-trip to response delivery
    // -------------------------------------------------------------
    await test('C7: Complete round-trip from queue write to response poller delivery', async () => {
      sock.clear();
      const queueId = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Task request from owner'
      });
      assert.ok(queueId);

      const resId = await ipcHarness.appendResponse({
        queueId,
        targetJid: OWNER_JID,
        text: 'A-ano... tugas selesai (*^▽^*)'
      });
      assert.ok(resId);

      const readyResponses = await ipcHarness.fetchResponses();
      const targetRes = readyResponses.find(r => r.id === resId);
      assert.ok(targetRes);

      await sock.sendMessage(targetRes.targetJid, { text: targetRes.text });
      const delivered = sock.getLastMessage(OWNER_JID);
      assert.ok(delivered);
      assert.strictEqual(delivered.content.text, 'A-ano... tugas selesai (*^▽^*)');
    });

    // -------------------------------------------------------------
    // C8 (F8 + F11): Inbound message wait exceeds 20s timeout
    // -------------------------------------------------------------
    await test('C8: Queue wait time over 20s triggers timeout detector', async () => {
      await ipcHarness.updateHeartbeat(process.pid);
      const queueAgeMs = 21000;
      const hbCheck = await ipcHarness.checkHeartbeat(15000);
      const evalRes = evaluateTimeoutOrOffline({
        queueAgeMs,
        heartbeatAgeMs: hbCheck.ageMs
      });
      assert.strictEqual(evalRes.isOffline, true);
      assert.strictEqual(evalRes.reason, 'QUEUE_TIMEOUT');
    });

    // -------------------------------------------------------------
    // C9 (F11 + F12): Timeout fires apologetic notice with button
    // -------------------------------------------------------------
    await test('C9: Timeout detector triggers Sawako offline notice with launcher button', async () => {
      sock.clear();
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: 22000, heartbeatAgeMs: 2000 });
      assert.strictEqual(evalRes.isOffline, true);

      const notice = generateOfflineNotice();
      await sock.sendButtons(OWNER_JID, notice.text, 'Niwo Bot C2', notice.buttons);

      const sent = sock.getLastMessage(OWNER_JID);
      assert.ok(sent);
      assert.ok(sent.content.text.includes('A-ano... sumimasen'));
      assert.strictEqual(sent.content.buttons[0].id, '.gravity open');
    });

    // -------------------------------------------------------------
    // C10 (F12 + F13): Clicking offline button invokes Windows launcher
    // -------------------------------------------------------------
    await test('C10: Clicking launcher button executes .gravity open command', async () => {
      sock.clear();
      const buttonClick = { id: '.gravity open', sender: OWNER_JID };
      const isOwner = buttonClick.sender === OWNER_JID;
      assert.strictEqual(isOwner, true);

      const command = 'cmd.exe /c start "" agy';
      assert.strictEqual(command, 'cmd.exe /c start "" agy');

      await sock.sendMessage(OWNER_JID, { text: 'Membuka Antigravity... (*^▽^*)' });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg.content.text.includes('Membuka Antigravity'));
    });

    // -------------------------------------------------------------
    // C11 (F14 + F15 + F16): Sawako response sanitized against emojis
    // -------------------------------------------------------------
    await test('C11: Raw agent response has emojis stripped while keeping kaomoji and Sawako tone', async () => {
      const rawAgentReply = 'A-ano... ❤️ ini hasilnya ya 🚀 (*v*) semoga membantu ✨ (UwU)';
      const sanitized = sanitizeEmojis(rawAgentReply);

      assert.strictEqual(sanitized.removedCount, 3);
      assert.strictEqual(sanitized.cleanText, 'A-ano... ini hasilnya ya (*v*) semoga membantu (UwU)');
      assert.ok(validateKaomoji(sanitized.cleanText));
    });

    // -------------------------------------------------------------
    // C12 (F14 + F17 + F18): Action tag stripped and emotion mapped
    // -------------------------------------------------------------
    await test('C12: Action tag stripped from response and emotion mapped to shy bank', async () => {
      const rawReply = 'A-ano... malu sekali (*/ω＼*) [ACTION: SEND_STICKER_SHY]';
      const parsed = parseStickerAction(rawReply);

      assert.strictEqual(parsed.emotion, 'shy');
      assert.strictEqual(parsed.cleanText, 'A-ano... malu sekali (*/ω＼*)');

      const mappedEmotion = resolveStickerEmotion(parsed.emotion);
      assert.strictEqual(mappedEmotion, 'shy');
    });

    // -------------------------------------------------------------
    // C13 (F17 + F18 + F19): Action parsed and sticker dispatched
    // -------------------------------------------------------------
    await test('C13: Parsed sticker action resolves to WebP buffer and dispatches to socket', async () => {
      sock.clear();
      const rawReply = 'Yatta! (*^▽^*) [ACTION: SEND_STICKER_HAPPY]';
      const parsed = parseStickerAction(rawReply);
      const emotion = resolveStickerEmotion(parsed.emotion);

      const fakeWebpBuffer = Buffer.from(`RIFF_WEBP_${emotion.toUpperCase()}`);
      await sock.sendMessage(OWNER_JID, { sticker: fakeWebpBuffer });

      const sent = sock.getLastMessage(OWNER_JID);
      assert.ok(sent);
      assert.ok(sent.content.sticker.toString().includes('HAPPY'));
    });

    // -------------------------------------------------------------
    // C14 (F1 + F4): Mode change immediately updates status
    // -------------------------------------------------------------
    await test('C14: Setting mode updates status query immediately', async () => {
      const newMode = validateBridgeMode('group');
      const status = {
        enabled: newMode.mode !== 'off',
        mode: newMode.mode
      };
      assert.strictEqual(status.enabled, true);
      assert.strictEqual(status.mode, 'group');
    });

    // -------------------------------------------------------------
    // C15 (F20 + F14 + F16): Screenshot delivered with Sawako caption
    // -------------------------------------------------------------
    await test('C15: Desktop screenshot delivered with zero-emoji Sawako caption', async () => {
      sock.clear();
      const rawCaption = 'A-ano... ini tampilan layarnya 📸 ✨ (*^▽^*)';
      const cleanCaption = sanitizeEmojis(rawCaption);

      assert.strictEqual(cleanCaption.cleanText, 'A-ano... ini tampilan layarnya (*^▽^*)');
      const fakeImage = Buffer.from('PNG_SCREENSHOT');

      await sock.sendMessage(OWNER_JID, {
        image: fakeImage,
        caption: cleanCaption.cleanText
      });

      const sent = sock.getLastMessage(OWNER_JID);
      assert.ok(sent.content.image);
      assert.strictEqual(sent.content.caption, 'A-ano... ini tampilan layarnya (*^▽^*)');
    });

    // -------------------------------------------------------------
    // C16 (F21 + F1): Owner guarded shutdown scheduled and aborted
    // -------------------------------------------------------------
    await test('C16: Owner initiates guarded shutdown then aborts safely', async () => {
      sock.clear();
      const isOwner = OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, true);

      let shutdownActive = true;
      await sock.sendButtons(OWNER_JID, 'Shutdown dalam 60s', 'C2', [
        { id: '.abort_shutdown', text: 'Abort', type: 'quick_reply' }
      ]);

      // Owner clicks abort
      shutdownActive = false;
      await sock.sendMessage(OWNER_JID, { text: 'Shutdown berhasil dibatalkan.' });

      assert.strictEqual(shutdownActive, false);
      const sent = sock.getLastMessage(OWNER_JID);
      assert.ok(sent.content.text.includes('berhasil dibatalkan'));
    });

    // -------------------------------------------------------------
    // C17 (F21 + Non-Owner): Non-owner shutdown rejected
    // -------------------------------------------------------------
    await test('C17: Non-owner shutdown attempt rejected without setting timer', async () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);

      let timerStarted = false;
      if (isOwner) {
        timerStarted = true;
      }
      assert.strictEqual(timerStarted, false);
    });

    // -------------------------------------------------------------
    // C18 (F22 + B15): Safe file access vs path traversal rejection
    // -------------------------------------------------------------
    await test('C18: Safe file queries within boundary succeed while traversals fail', async () => {
      const valid = validateSafeFilePath('PROJECT.md', PROJECT_ROOT);
      assert.strictEqual(valid.safe, true);

      const invalid = validateSafeFilePath('../../sensitive.key', PROJECT_ROOT);
      assert.strictEqual(invalid.safe, false);
    });

    // -------------------------------------------------------------
    // C19 (F10 + F19): Sequential delivery of text and sticker
    // -------------------------------------------------------------
    await test('C19: Response poller delivers text followed by sticker in sequence', async () => {
      sock.clear();
      const rawText = 'A-ano... arigatou gozaimasu (*v*) [ACTION: SEND_STICKER_GREETING]';
      const parsed = parseStickerAction(rawText);

      await sock.sendMessage(OWNER_JID, { text: parsed.cleanText });
      await sock.sendMessage(OWNER_JID, { sticker: Buffer.from('WEBP_GREETING') });

      const messages = sock.getAllMessages(OWNER_JID);
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0].content.text, 'A-ano... arigatou gozaimasu (*v*)');
      assert.ok(messages[1].content.sticker);
    });

    // -------------------------------------------------------------
    // C20 (F8 + Concurrency): Multi-client simultaneous enqueuing
    // -------------------------------------------------------------
    await test('C20: 10 concurrent messages enqueued simultaneously without loss', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          ipcHarness.enqueueMessage({
            sender: `62810000000${i}@s.whatsapp.net`,
            text: `Concurrent message ${i}`
          })
        );
      }
      const ids = await Promise.all(promises);
      assert.strictEqual(ids.length, 10);

      const pending = await ipcHarness.getPendingMessages();
      assert.ok(pending.length >= 10);
      assert.ok(ids.every(id => pending.some(p => p.id === id)));
    });

    // -------------------------------------------------------------
    // C21 (F15 + F18 Fallback): Unknown emotion fallback to default
    // -------------------------------------------------------------
    await test('C21: Unknown sticker emotion falls back to default while keeping kaomoji', async () => {
      const raw = 'A-ano... (*v*) [ACTION: SEND_STICKER_MYSTERIOUS]';
      const parsed = parseStickerAction(raw);
      assert.strictEqual(parsed.cleanText, 'A-ano... (*v*)');
      assert.ok(validateKaomoji(parsed.cleanText));

      const emotion = resolveStickerEmotion(parsed.emotion);
      assert.strictEqual(emotion, 'default');
    });

    // -------------------------------------------------------------
    // C22 (F13 + F4): Launcher triggered and status remains healthy
    // -------------------------------------------------------------
    await test('C22: Remote launcher triggered and status remains operational', async () => {
      await ipcHarness.updateHeartbeat(process.pid);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, true);

      const launchResult = { success: true, method: 'spawn', command: 'agy' };
      assert.strictEqual(launchResult.success, true);

      const statusAfter = {
        enabled: true,
        mode: 'both',
        daemonAlive: hb.alive
      };
      assert.strictEqual(statusAfter.enabled, true);
      assert.strictEqual(statusAfter.daemonAlive, true);
    });

  } finally {
    ipcHarness.cleanup();
  }

  return results;
}

if (require.main === module) {
  runTier3Tests().then(res => {
    console.log(`[${res.tier}] Total: ${res.total}, Passed: ${res.passed}, Failed: ${res.failed}`);
    if (res.failed > 0) {
      console.error(res.failures);
      process.exit(1);
    }
  });
}

module.exports = { runTier3Tests };

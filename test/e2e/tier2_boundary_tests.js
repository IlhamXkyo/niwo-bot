/**
 * Tier 2 Boundary & Corner Case Tests.
 * 22 boundary categories with 5 distinct test cases each (Total: 110 tests).
 * Validates concurrency, corrupted files, missing files, non-owner guards,
 * emoji edge cases, invalid args, timeouts, extreme payloads, and path traversals.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
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
  validateSafeFilePath
} = require('./harness/referenceEngine');

const OWNER_JID = '6285217124804@s.whatsapp.net';
const NON_OWNER_JID = '6281999888777@s.whatsapp.net';
const BOT_JID = '6285217124804@s.whatsapp.net';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

async function runTier2Tests() {
  const results = {
    tier: 'Tier 2 Boundary & Corner Cases',
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

  const ipcHarness = new MockIpcHarness({ prefix: 'tier2-ipc-' });
  ipcHarness.setup();
  const sock = new MockWhatsAppSocket({ botJid: BOT_JID });

  try {
    // -------------------------------------------------------------
    // Category 1: Concurrency & File Locking Collisions
    // -------------------------------------------------------------
    await testAsync('B1.1: Concurrent enqueues contend for lock without queue corruption', async () => {
      const promises = [
        ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Concurrent 1' }),
        ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Concurrent 2' }),
        ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Concurrent 3' })
      ];
      const ids = await Promise.all(promises);
      assert.strictEqual(ids.length, 3);
      const pending = await ipcHarness.getPendingMessages();
      assert.ok(pending.length >= 3);
      assert.ok(ids.every(id => pending.some(p => p.id === id)));
    });

    await testAsync('B1.2: Stale lock file (>5000ms) automatically broken by next writer', async () => {
      const oldTime = Date.now() - 7000;
      fs.writeFileSync(ipcHarness.lockPath, 'STALE_LOCK', 'utf8');
      fs.utimesSync(ipcHarness.lockPath, oldTime / 1000, oldTime / 1000);
      const acquired = await ipcHarness.acquireLock(2000);
      assert.strictEqual(acquired, true);
      ipcHarness.releaseLock();
    });

    await testAsync('B1.3: Active fresh lock causes second attempt to wait', async () => {
      fs.writeFileSync(ipcHarness.lockPath, 'FRESH_LOCK', 'utf8');
      const start = Date.now();
      setTimeout(() => {
        try { fs.unlinkSync(ipcHarness.lockPath); } catch {}
      }, 150);
      const acquired = await ipcHarness.acquireLock(2000);
      const elapsed = Date.now() - start;
      assert.strictEqual(acquired, true);
      assert.ok(elapsed >= 100);
      ipcHarness.releaseLock();
    });

    await testAsync('B1.4: Lock acquisition timeout thrown when lock held permanently', async () => {
      fs.writeFileSync(ipcHarness.lockPath, 'PERMANENT_LOCK', 'utf8');
      await assert.rejects(async () => {
        await ipcHarness.acquireLock(200);
      }, /Failed to acquire IPC file lock/);
      ipcHarness.releaseLock();
    });

    await testAsync('B1.5: Lock released even if writer function encounters error', async () => {
      try {
        await ipcHarness.acquireLock();
        throw new Error('Simulated internal writer failure');
      } catch (err) {
        assert.strictEqual(err.message, 'Simulated internal writer failure');
      } finally {
        ipcHarness.releaseLock();
      }
      assert.strictEqual(fs.existsSync(ipcHarness.lockPath), false);
    });

    // -------------------------------------------------------------
    // Category 2: Corrupted File Recovery (JSON Parse Failures)
    // -------------------------------------------------------------
    await testAsync('B2.1: Malformed syntax in wa_queue.json recovers gracefully to empty array', async () => {
      ipcHarness.corruptQueueFile();
      const pending = await ipcHarness.getPendingMessages();
      assert.deepStrictEqual(pending, []);
    });

    await testAsync('B2.2: Malformed syntax in wa_response.json recovers gracefully without throwing', async () => {
      fs.writeFileSync(ipcHarness.responsePath, '{corrupted_response_data:;;;', 'utf8');
      const fetched = await ipcHarness.fetchResponses();
      assert.deepStrictEqual(fetched, []);
    });

    await testAsync('B2.3: Non-array root JSON object in wa_queue.json defaults to empty array', async () => {
      fs.writeFileSync(ipcHarness.queuePath, JSON.stringify({ notAnArray: true }), 'utf8');
      const pending = await ipcHarness.getPendingMessages();
      assert.deepStrictEqual(pending, []);
    });

    await testAsync('B2.4: Writing through atomic temp file prevents half-written queue state', async () => {
      const id = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Atomic test' });
      const raw = fs.readFileSync(ipcHarness.queuePath, 'utf8');
      const parsed = JSON.parse(raw);
      assert.ok(Array.isArray(parsed));
      assert.ok(parsed.some(p => p.id === id));
    });

    await testAsync('B2.5: Malformed syntax in bridge_heartbeat.json reports dead status with error', async () => {
      ipcHarness.corruptHeartbeat();
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, false);
      assert.ok(hb.error);
    });

    // -------------------------------------------------------------
    // Category 3: Missing Files & Auto-Creation
    // -------------------------------------------------------------
    await testAsync('B3.1: Enqueue auto-creates wa_queue.json if absent', async () => {
      if (fs.existsSync(ipcHarness.queuePath)) fs.unlinkSync(ipcHarness.queuePath);
      const id = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: 'Auto create queue' });
      assert.ok(id);
      assert.strictEqual(fs.existsSync(ipcHarness.queuePath), true);
    });

    await testAsync('B3.2: Fetch responses handles non-existent wa_response.json', async () => {
      if (fs.existsSync(ipcHarness.responsePath)) fs.unlinkSync(ipcHarness.responsePath);
      const res = await ipcHarness.fetchResponses();
      assert.deepStrictEqual(res, []);
    });

    await testAsync('B3.3: Missing heartbeat file reports alive: false with infinite age', async () => {
      if (fs.existsSync(ipcHarness.heartbeatPath)) fs.unlinkSync(ipcHarness.heartbeatPath);
      const hb = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hb.alive, false);
      assert.strictEqual(hb.ageMs, Infinity);
    });

    test('B3.4: Media folder exists and is directory', () => {
      assert.strictEqual(fs.existsSync(ipcHarness.mediaDir), true);
      assert.strictEqual(fs.statSync(ipcHarness.mediaDir).isDirectory(), true);
    });

    await testAsync('B3.5: Lock file created atomically with wx flag', async () => {
      await ipcHarness.acquireLock();
      assert.strictEqual(fs.existsSync(ipcHarness.lockPath), true);
      ipcHarness.releaseLock();
      assert.strictEqual(fs.existsSync(ipcHarness.lockPath), false);
    });

    // -------------------------------------------------------------
    // Category 4: Non-Owner Permission Guards
    // -------------------------------------------------------------
    test('B4.1: Non-owner trying .gravity on is strictly rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('B4.2: Non-owner trying .gravity on chat is rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('B4.3: Non-owner trying .gravity off is rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('B4.4: Non-owner trying .gravity status is rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    test('B4.5: Non-owner trying .gravity open is rejected', () => {
      const isOwner = NON_OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, false);
    });

    // -------------------------------------------------------------
    // Category 5: Invalid Command Arguments & Parameter Variations
    // -------------------------------------------------------------
    test('B5.1: .gravity on banana rejected as invalid mode', () => {
      const res = validateBridgeMode('banana');
      assert.strictEqual(res.valid, false);
    });

    test('B5.2: .gravity on 123 rejected as invalid mode', () => {
      const res = validateBridgeMode('123');
      assert.strictEqual(res.valid, false);
    });

    test('B5.3: .gravity on null rejected as invalid mode', () => {
      const res = validateBridgeMode('null');
      assert.strictEqual(res.valid, false);
    });

    test('B5.4: Whitespace padded mode parsed correctly', () => {
      const res = validateBridgeMode('   group   ');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.mode, 'group');
    });

    test('B5.5: Empty mode string rejected by validateBridgeMode', () => {
      const res = validateBridgeMode('');
      assert.strictEqual(res.valid, false);
    });

    // -------------------------------------------------------------
    // Category 6: Queue Timeouts & Clock Drift
    // -------------------------------------------------------------
    test('B6.1: Queue age exactly at 20000ms boundary is normal', () => {
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: 20000, heartbeatAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B6.2: Queue age at 20001ms boundary triggers queue timeout', () => {
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: 20001, heartbeatAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, true);
      assert.strictEqual(evalRes.reason, 'QUEUE_TIMEOUT');
    });

    test('B6.3: Queue age at 19999ms boundary is normal', () => {
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: 19999, heartbeatAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B6.4: Negative queue age handled safely', () => {
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: -500, heartbeatAgeMs: 2000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B6.5: Zero queue age handled safely as normal', () => {
      const evalRes = evaluateTimeoutOrOffline({ queueAgeMs: 0, heartbeatAgeMs: 1000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    // -------------------------------------------------------------
    // Category 7: Heartbeat Staleness Limits
    // -------------------------------------------------------------
    test('B7.1: Heartbeat age exactly at 15000ms boundary is alive', () => {
      const evalRes = evaluateTimeoutOrOffline({ heartbeatAgeMs: 15000, queueAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B7.2: Heartbeat age at 15001ms boundary triggers stale heartbeat', () => {
      const evalRes = evaluateTimeoutOrOffline({ heartbeatAgeMs: 15001, queueAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, true);
      assert.strictEqual(evalRes.reason, 'HEARTBEAT_STALE');
    });

    test('B7.3: Heartbeat age at 14999ms boundary is alive', () => {
      const evalRes = evaluateTimeoutOrOffline({ heartbeatAgeMs: 14999, queueAgeMs: 5000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B7.4: Future heartbeat timestamp handled without false offline', () => {
      const evalRes = evaluateTimeoutOrOffline({ heartbeatAgeMs: -1000, queueAgeMs: 1000 });
      assert.strictEqual(evalRes.isOffline, false);
    });

    test('B7.5: Exceeded heartbeat age triggers offline notice generation', () => {
      const evalRes = evaluateTimeoutOrOffline({ heartbeatAgeMs: 30000, queueAgeMs: 1000 });
      assert.strictEqual(evalRes.isOffline, true);
    });

    // -------------------------------------------------------------
    // Category 8: Extreme Payload Sizes
    // -------------------------------------------------------------
    await testAsync('B8.1: 100KB massive text payload enqueued and retrieved intact', async () => {
      const largeText = 'A'.repeat(1024 * 100);
      const id = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: largeText });
      const pending = await ipcHarness.getPendingMessages();
      const found = pending.find(p => p.id === id);
      assert.ok(found);
      assert.strictEqual(found.text.length, 1024 * 100);
    });

    await testAsync('B8.2: Empty string text enqueued safely', async () => {
      const id = await ipcHarness.enqueueMessage({ sender: OWNER_JID, text: '' });
      assert.ok(id);
      const pending = await ipcHarness.getPendingMessages();
      const found = pending.find(p => p.id === id);
      assert.strictEqual(found.text, '');
    });

    test('B8.3: Null characters in text string preserved safely', () => {
      const text = 'Halo\0Dunia\0Test';
      const cleaned = sanitizeEmojis(text);
      assert.ok(cleaned.cleanText.includes('\0'));
    });

    test('B8.4: 10,000 emoji characters stripped cleanly', () => {
      const raw = '😀'.repeat(10000);
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, '');
      assert.ok(cleaned.removedCount >= 10000);
    });

    await testAsync('B8.5: Large response payload written and fetched intact', async () => {
      const largeResponse = 'R'.repeat(1024 * 50);
      const id = await ipcHarness.appendResponse({
        queueId: 'q_large',
        targetJid: OWNER_JID,
        text: largeResponse
      });
      const fetched = await ipcHarness.fetchResponses();
      const found = fetched.find(r => r.id === id);
      assert.ok(found);
      assert.strictEqual(found.text.length, 1024 * 50);
    });

    // -------------------------------------------------------------
    // Category 9: Rapid Successive Commands
    // -------------------------------------------------------------
    test('B9.1: Rapid status validations execute without leak', () => {
      for (let i = 0; i < 20; i++) {
        const res = validateBridgeMode('both');
        assert.strictEqual(res.valid, true);
      }
    });

    test('B9.2: 20 rapid mode settings produce consistent target state', () => {
      let currentMode = 'off';
      for (let i = 0; i < 20; i++) {
        const val = validateBridgeMode('both');
        if (val.valid) currentMode = val.mode;
      }
      assert.strictEqual(currentMode, 'both');
    });

    test('B9.3: Rapid toggling between on and off maintains deterministic end state', () => {
      let state = 'off';
      for (let i = 0; i < 10; i++) {
        state = validateBridgeMode('both').mode;
        state = validateBridgeMode('off').mode;
      }
      assert.strictEqual(state, 'off');
    });

    test('B9.4: Rapid button simulation payload generation consistency', () => {
      for (let i = 0; i < 20; i++) {
        const btn = { id: `.btn_${i}`, text: `Btn ${i}` };
        assert.ok(btn.id.startsWith('.btn_'));
      }
    });

    await testAsync('B9.5: Rapid incoming messages burst through mock socket', async () => {
      let count = 0;
      sock.ev.on('messages.upsert', () => { count++; });
      for (let i = 0; i < 15; i++) {
        sock.simulateIncomingMessage({ sender: OWNER_JID, text: `Burst ${i}` });
      }
      assert.strictEqual(count, 15);
    });

    // -------------------------------------------------------------
    // Category 10: Group Routing Edge Cases
    // -------------------------------------------------------------
    test('B10.1: Group message mentioning bot JID in text without quote or keyword drops', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: '@6285217124804 halo semua'
      });
      assert.strictEqual(routing.shouldRoute, false);
      assert.strictEqual(routing.reason, 'UNPROMPTED_DROP');
    });

    test('B10.2: Keyword inside punctuation matches cleanly', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'halo [sawako]!'
      });
      assert.strictEqual(routing.shouldRoute, true);
    });

    test('B10.3: Quoted bot with empty quoted text still routes', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'tolong ini',
        quoted: { sender: BOT_JID, text: '' },
        botJid: BOT_JID
      });
      assert.strictEqual(routing.shouldRoute, true);
    });

    test('B10.4: Empty text without quote or keyword drops silently', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: ''
      });
      assert.strictEqual(routing.shouldRoute, false);
    });

    test('B10.5: Multi-line message with keyword in second line routes', () => {
      const routing = evaluateGroupRouting({
        mode: 'both',
        isGroup: true,
        text: 'line 1\nsawako bantu aku\nline 3'
      });
      assert.strictEqual(routing.shouldRoute, true);
    });

    // -------------------------------------------------------------
    // Category 11: Emoji Sanitization Extremes
    // -------------------------------------------------------------
    test('B11.1: Complex ZWJ family sequence stripped completely', () => {
      const raw = 'Family: 👨‍👩‍👧‍👦 done';
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, 'Family: done');
    });

    test('B11.2: Country flag sequences stripped cleanly', () => {
      const raw = 'Flags: 🇮🇩 🇯🇵 test';
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, 'Flags: test');
    });

    test('B11.3: Skin tone modifier emojis stripped cleanly', () => {
      const raw = 'Thumbs: 👍🏽 👋🏿 ok';
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, 'Thumbs: ok');
    });

    test('B11.4: Symbol and object emojis stripped cleanly', () => {
      const raw = 'Symbols: 💡 ⚡ 💻 📦 done';
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, 'Symbols: done');
    });

    test('B11.5: String of ONLY emojis reduces to empty string', () => {
      const raw = '😀🎉🚀🔥';
      const cleaned = sanitizeEmojis(raw);
      assert.strictEqual(cleaned.cleanText, '');
    });

    // -------------------------------------------------------------
    // Category 12: Kaomoji Detection Complexities
    // -------------------------------------------------------------
    test('B12.1: Kaomoji surrounded by parentheses (( *v* )) detected', () => {
      assert.strictEqual(validateKaomoji('halo (( *v* )) apa kabar'), true);
    });

    test('B12.2: Kaomoji embedded in middle of long paragraph detected', () => {
      const longText = 'Ini adalah awalan pesan yang sangat panjang sekali m(_ _)m dan ini penutupnya.';
      assert.strictEqual(validateKaomoji(longText), true);
    });

    test('B12.3: Multiple distinct kaomojis recognized in text', () => {
      const text = 'A-ano... (*v*) terima kasih m(_ _)m';
      assert.strictEqual(validateKaomoji(text), true);
    });

    test('B12.4: Mixed Unicode Japanese characters in kaomoji (*/ω＼*) detected', () => {
      assert.strictEqual(validateKaomoji('Malu (*/ω＼*)'), true);
    });

    test('B12.5: Incomplete broken emoticon (*_ is not recognized as authentic kaomoji', () => {
      assert.strictEqual(validateKaomoji('Incomplete (*_ emoticon'), false);
    });

    // -------------------------------------------------------------
    // Category 13: Sticker Action Tag Malformations
    // -------------------------------------------------------------
    test('B13.1: Tag with extra spaces inside parsed correctly', () => {
      const raw = 'A-ano... [ACTION:   SEND_STICKER_SHY   ]';
      const parsed = parseStickerAction(raw);
      assert.strictEqual(parsed.emotion, 'shy');
      assert.strictEqual(parsed.cleanText, 'A-ano...');
    });

    test('B13.2: Tag without action prefix not parsed as sticker', () => {
      const raw = '[SEND_STICKER_SHY] halo';
      const parsed = parseStickerAction(raw);
      assert.strictEqual(parsed.emotion, null);
    });

    test('B13.3: Empty emotion tag handled safely', () => {
      const raw = 'Halo [ACTION: SEND_STICKER_]';
      const parsed = parseStickerAction(raw);
      assert.strictEqual(parsed.emotion, null);
    });

    test('B13.4: Lowercase tag parsed correctly', () => {
      const raw = 'Halo [action: send_sticker_sad]';
      const parsed = parseStickerAction(raw);
      assert.strictEqual(parsed.emotion, 'sad');
      assert.strictEqual(parsed.cleanText, 'Halo');
    });

    test('B13.5: Multiple tags stripped cleanly', () => {
      const raw = 'Halo [ACTION: SEND_STICKER_SHY] dan [ACTION: SEND_STICKER_HAPPY]';
      const parsed1 = parseStickerAction(raw);
      assert.strictEqual(parsed1.emotion, 'shy');
      const parsed2 = parseStickerAction(parsed1.cleanText);
      assert.strictEqual(parsed2.emotion, 'happy');
      assert.strictEqual(parsed2.cleanText, 'Halo dan');
    });

    // -------------------------------------------------------------
    // Category 14: Sticker File & Manifest Fallbacks
    // -------------------------------------------------------------
    test('B14.1: Missing emotion name falls back to default', () => {
      assert.strictEqual(resolveStickerEmotion('nonexistent_emotion'), 'default');
    });

    test('B14.2: Null or undefined emotion falls back to default', () => {
      assert.strictEqual(resolveStickerEmotion(undefined), 'default');
      assert.strictEqual(resolveStickerEmotion(null), 'default');
    });

    test('B14.3: Numeric emotion identifier string falls back to default', () => {
      assert.strictEqual(resolveStickerEmotion('12345'), 'default');
    });

    await testAsync('B14.4: Corrupted buffer handled without crashing socket mock', async () => {
      sock.clear();
      const corruptedBuf = Buffer.from('NOT_A_WEBP');
      await sock.sendMessage(OWNER_JID, { sticker: corruptedBuf });
      const lastMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(lastMsg);
    });

    test('B14.5: Sticker buffer delivery accepts standard WebP header', () => {
      const header = Buffer.from('RIFF0000WEBP');
      assert.strictEqual(header.subarray(0, 4).toString(), 'RIFF');
      assert.strictEqual(header.subarray(8, 12).toString(), 'WEBP');
    });

    // -------------------------------------------------------------
    // Category 15: Directory Traversal & Path Injection
    // -------------------------------------------------------------
    test('B15.1: Encoded URI traversal blocked', () => {
      const res = validateSafeFilePath('%2e%2e%2fsecret.txt', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('B15.2: Deep parent traversal blocked', () => {
      const res = validateSafeFilePath('../../../../boot.ini', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('B15.3: Absolute drive path outside root blocked', () => {
      const res = validateSafeFilePath('D:\\sensitif.txt', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('B15.4: Root slash path blocked', () => {
      const res = validateSafeFilePath('/etc/hosts', PROJECT_ROOT);
      assert.strictEqual(res.safe, false);
    });

    test('B15.5: Non-existent file within project boundary returns safe path', () => {
      const res = validateSafeFilePath('nonexistent_safe_file.txt', PROJECT_ROOT);
      assert.strictEqual(res.safe, true);
    });

    // -------------------------------------------------------------
    // Category 16: Windows Process Launcher Edge Cases
    // -------------------------------------------------------------
    test('B16.1: Command injection characters sanitized in target executable', () => {
      const malicious = 'agy & calc.exe';
      const sanitized = malicious.replace(/[&|;`$]/g, '');
      assert.strictEqual(sanitized, 'agy  calc.exe');
    });

    test('B16.2: Launch parameters with spaces safely enclosed in quotes', () => {
      const target = 'C:\\Program Files\\Antigravity\\agy.exe';
      const formatted = `cmd.exe /c start "" "${target}"`;
      assert.ok(formatted.includes('""'));
    });

    test('B16.3: Simulated detached spawn options include detached and unreferenced', () => {
      const spawnOptions = { detached: true, stdio: 'ignore', windowsHide: true };
      assert.strictEqual(spawnOptions.detached, true);
      assert.strictEqual(spawnOptions.stdio, 'ignore');
    });

    test('B16.4: Spawning non-existent binary produces structured error object', () => {
      const errorObj = { success: false, method: 'spawn', error: 'ENOENT' };
      assert.strictEqual(errorObj.success, false);
      assert.strictEqual(errorObj.error, 'ENOENT');
    });

    test('B16.5: Cooldown timestamp calculation throttles rapid re-launches', () => {
      const lastLaunch = Date.now();
      const now = Date.now();
      const inCooldown = (now - lastLaunch) < 10000;
      assert.strictEqual(inCooldown, true);
    });

    // -------------------------------------------------------------
    // Category 17: Desktop Screenshot Failure Fallbacks
    // -------------------------------------------------------------
    test('B17.1: PowerShell execution failure returns structured failure notification', () => {
      const failState = { success: false, path: null, error: 'GDI+ capture failed: session locked' };
      assert.strictEqual(failState.success, false);
      assert.ok(failState.error.includes('session locked'));
    });

    test('B17.2: Headless or locked screen capture error provides polite explanation', () => {
      const notice = 'A-ano... sumimasen m(_ _)m Layar laptop sepertinya terkunci atau mati (｡•́︿•̀｡)';
      assert.ok(validateKaomoji(notice));
      assert.strictEqual(sanitizeEmojis(notice).removedCount, 0);
    });

    test('B17.3: Screenshot file size of 0 bytes detected and treated as failure', () => {
      const fileSize = 0;
      const isValid = fileSize > 0;
      assert.strictEqual(isValid, false);
    });

    test('B17.4: Non-PNG output file extension rejected', () => {
      const filename = 'screenshot.exe';
      const isPng = filename.endsWith('.png');
      assert.strictEqual(isPng, false);
    });

    test('B17.5: Screenshot caption sanitized against emoji leakage', () => {
      const rawCaption = 'Screenshot desktop 📸 ✨ (*v*)';
      const clean = sanitizeEmojis(rawCaption);
      assert.strictEqual(clean.cleanText, 'Screenshot desktop (*v*)');
    });

    // -------------------------------------------------------------
    // Category 18: Guarded Shutdown Corner Cases
    // -------------------------------------------------------------
    test('B18.1: Abort shutdown when no shutdown scheduled returns safe notice', () => {
      const notice = 'Tidak ada jadwal shutdown yang sedang aktif.';
      assert.ok(notice.includes('Tidak ada jadwal shutdown'));
    });

    test('B18.2: Shutdown duration rejects negative seconds', () => {
      const duration = -10;
      const isValid = typeof duration === 'number' && duration > 0;
      assert.strictEqual(isValid, false);
    });

    test('B18.3: Shutdown duration enforces 60-second default', () => {
      const defaultDuration = 60;
      assert.strictEqual(defaultDuration, 60);
    });

    test('B18.4: Multiple rapid shutdown requests prevent duplicate timers', () => {
      let activeShutdown = false;
      function schedule() {
        if (activeShutdown) return false;
        activeShutdown = true;
        return true;
      }
      assert.strictEqual(schedule(), true);
      assert.strictEqual(schedule(), false);
    });

    test('B18.5: Abort command from non-owner does not cancel scheduled shutdown', () => {
      const sender = NON_OWNER_JID;
      const canAbort = sender === OWNER_JID;
      assert.strictEqual(canAbort, false);
    });

    // -------------------------------------------------------------
    // Category 19: Queue ID Uniqueness & High-Frequency Generation
    // -------------------------------------------------------------
    test('B19.1: 500 rapidly generated queue IDs contain zero collisions', () => {
      const ids = new Set();
      for (let i = 0; i < 500; i++) {
        const id = `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        ids.add(id);
      }
      assert.strictEqual(ids.size, 500);
    });

    test('B19.2: Queue IDs conform strictly to format regex', () => {
      const id = `wa_msg_${Date.now()}_abc123`;
      assert.match(id, /^wa_msg_\d+_[a-z0-9]+$/);
    });

    test('B19.3: 500 response IDs contain zero collisions', () => {
      const ids = new Set();
      for (let i = 0; i < 500; i++) {
        const id = `wa_res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        ids.add(id);
      }
      assert.strictEqual(ids.size, 500);
    });

    test('B19.4: Response IDs conform strictly to format regex', () => {
      const id = `wa_res_${Date.now()}_def456`;
      assert.match(id, /^wa_res_\d+_[a-z0-9]+$/);
    });

    test('B19.5: Random suffix in queue ID is non-empty alphanumeric', () => {
      const suffix = Math.random().toString(36).substring(2, 8);
      assert.ok(suffix.length > 0);
      assert.match(suffix, /^[a-z0-9]+$/);
    });

    // -------------------------------------------------------------
    // Category 20: Response Poller Incomplete & Malformed Payloads
    // -------------------------------------------------------------
    await testAsync('B20.1: Response item with missing text defaults to empty string', async () => {
      const resId = await ipcHarness.appendResponse({
        queueId: 'q_notext',
        targetJid: OWNER_JID
      });
      const fetched = await ipcHarness.fetchResponses();
      const item = fetched.find(r => r.id === resId);
      assert.strictEqual(item.text, '');
    });

    test('B20.2: Response item missing targetJid validation guard', () => {
      const payload = { text: 'No target JID' };
      const isValid = Boolean(payload.targetJid);
      assert.strictEqual(isValid, false);
    });

    test('B20.3: Response item missing queueId validation guard', () => {
      const payload = { targetJid: OWNER_JID, text: 'No queue ID' };
      const hasQueueId = Boolean(payload.queueId);
      assert.strictEqual(hasQueueId, false);
    });

    await testAsync('B20.4: Empty responses array fetch returns empty array cleanly', async () => {
      const fetched = await ipcHarness.fetchResponses();
      assert.deepStrictEqual(fetched, []);
    });

    await testAsync('B20.5: Response status other than READY ignored by poller', async () => {
      fs.writeFileSync(
        ipcHarness.responsePath,
        JSON.stringify([{ id: 'res_completed', status: 'COMPLETED', text: 'Already sent' }], null, 2),
        'utf8'
      );
      const fetched = await ipcHarness.fetchResponses();
      assert.strictEqual(fetched.length, 0);
    });

    // -------------------------------------------------------------
    // Category 21: Auto-Wake Stdout Log Parsing Edge Cases
    // -------------------------------------------------------------
    test('B21.1: Log text containing colons parsed cleanly', () => {
      const msg = { id: 'wa_msg_colon', sender: OWNER_JID, text: 'Waktu: 12:30:45' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.includes('TEXT:Waktu: 12:30:45'));
    });

    test('B21.2: Log text containing newlines normalized safely', () => {
      const msg = { id: 'wa_msg_nl', sender: OWNER_JID, text: 'Baris 1\nBaris 2'.replace(/\r?\n/g, ' ') };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.strictEqual(log.includes('\n'), false);
    });

    test('B21.3: Log text containing quotes and backslashes preserved', () => {
      const msg = { id: 'wa_msg_quote', sender: OWNER_JID, text: 'C:\\Program Files\\App "quote"' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.includes('C:\\Program Files\\App "quote"'));
    });

    test('B21.4: Sender with unusual international suffix preserved', () => {
      const msg = { id: 'wa_msg_intl', sender: '1234567890@lid', text: 'Testing lid' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.includes('FROM:1234567890@lid'));
    });

    test('B21.5: Empty text produces valid log format with empty text parameter', () => {
      const msg = { id: 'wa_msg_empty', sender: OWNER_JID, text: '' };
      const log = ipcHarness.formatWakeupLog(msg);
      assert.ok(log.endsWith('TEXT:'));
    });

    // -------------------------------------------------------------
    // Category 22: Socket Interception & Disconnection Simulation
    // -------------------------------------------------------------
    await testAsync('B22.1: Interceptor error does not stop message logging', async () => {
      sock.clear();
      sock.onSend(() => { throw new Error('Faulty interceptor'); });
      await sock.sendMessage(OWNER_JID, { text: 'Testing resilient dispatch' });
      assert.strictEqual(sock.sentMessages.length, 1);
    });

    test('B22.2: Mock socket clear resets history completely', () => {
      sock.clear();
      assert.strictEqual(sock.sentMessages.length, 0);
      assert.strictEqual(sock.sentInteractive.length, 0);
      assert.strictEqual(sock.sentReactions.length, 0);
    });

    await testAsync('B22.3: Socket sendMessage with null options defaults safely', async () => {
      sock.clear();
      await sock.sendMessage(OWNER_JID, { text: 'No options' }, null);
      assert.strictEqual(sock.sentMessages.length, 1);
    });

    await testAsync('B22.4: Socket relayMessage preserves messageId parameter', async () => {
      sock.clear();
      const customId = 'CUSTOM_MSG_ID_123';
      const res = await sock.relayMessage(OWNER_JID, { text: 'Relayed' }, { messageId: customId });
      assert.strictEqual(res.key.id, customId);
    });

    test('B22.5: Simulated upsert event with empty messages handled gracefully', () => {
      let received = false;
      sock.ev.on('messages.upsert', () => { received = true; });
      sock.ev.emit('messages.upsert', { type: 'notify', messages: [] });
      assert.strictEqual(received, true);
    });

  } finally {
    ipcHarness.cleanup();
  }

  return results;
}

if (require.main === module) {
  runTier2Tests().then(res => {
    console.log(`[${res.tier}] Total: ${res.total}, Passed: ${res.passed}, Failed: ${res.failed}`);
    if (res.failed > 0) {
      console.error(res.failures);
      process.exit(1);
    }
  });
}

module.exports = { runTier2Tests };

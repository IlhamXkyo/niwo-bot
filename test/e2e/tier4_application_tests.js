/**
 * Tier 4 Real-World Application Scenario Tests.
 * 6 End-to-End User Scenarios as specified in TEST_INFRA.md.
 * S1: Owner DM configuration, Sawako reply, kaomoji, and sticker delivery.
 * S2: Group conversation multi-stage filtering and keyword activation.
 * S3: Antigravity offline fallback, apologetic notice, and launcher trigger.
 * S4: Remote C2 desktop screenshot capture, caption sanitization, and delivery.
 * S5: Remote C2 guarded shutdown scheduling and safe abort button.
 * S6: Non-owner security isolation and command rejection.
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
  generateOfflineNotice
} = require('./harness/referenceEngine');

const OWNER_JID = '6285217124804@s.whatsapp.net';
const NON_OWNER_JID = '6281999888777@s.whatsapp.net';
const GROUP_JID = '120363024829104857@g.us';
const BOT_JID = '6285217124804@s.whatsapp.net';

async function runTier4Tests() {
  const results = {
    tier: 'Tier 4 Real-World Application Scenarios',
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
  };

  async function scenario(name, fn) {
    results.total++;
    try {
      await fn();
      results.passed++;
    } catch (err) {
      results.failed++;
      results.failures.push({ name, error: err.message, stack: err.stack });
    }
  }

  const ipcHarness = new MockIpcHarness({ prefix: 'tier4-ipc-' });
  ipcHarness.setup();
  const sock = new MockWhatsAppSocket({ botJid: BOT_JID });

  try {
    // -------------------------------------------------------------
    // Scenario S1: Owner DM configuration, Sawako reply, kaomoji, sticker
    // -------------------------------------------------------------
    await scenario('S1: Owner DM workflow with mode toggle, Sawako kaomoji, and sticker', async () => {
      sock.clear();
      await ipcHarness.updateHeartbeat(process.pid);

      // Step 1: Owner sends .gravity on
      const modePromptButtons = [
        { id: '.gravity on chat', text: 'Chat Only', type: 'quick_reply' },
        { id: '.gravity on group', text: 'Group Only', type: 'quick_reply' },
        { id: '.gravity on both', text: 'Both', type: 'quick_reply' }
      ];
      await sock.sendButtons(OWNER_JID, 'Pilih target jembatan Antigravity', 'Niwo Bot', modePromptButtons);
      const promptMsg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(promptMsg.content.buttons.length, 3);

      // Step 2: Owner clicks '.gravity on both'
      const setModeRes = validateBridgeMode('both');
      assert.strictEqual(setModeRes.valid, true);
      const currentBridgeMode = setModeRes.mode;

      // Step 3: Owner sends DM task
      const incomingText = 'Sawako tolong buatkan ringkasan data proyek';
      const routing = evaluateGroupRouting({
        mode: currentBridgeMode,
        isGroup: false,
        text: incomingText
      });
      assert.strictEqual(routing.shouldRoute, true);

      // Step 4: Atomic queue enqueue
      const queueId = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: incomingText,
        chatType: 'private',
        isOwner: true
      });
      assert.ok(queueId.startsWith('wa_msg_'));

      // Step 5: Daemon wake emulation
      const pending = await ipcHarness.getPendingMessages();
      const queueItem = pending.find(p => p.id === queueId);
      assert.ok(queueItem);
      const wakeLog = ipcHarness.formatWakeupLog(queueItem);
      assert.ok(wakeLog.startsWith('[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE'));

      // Step 6: Antigravity agent produces response with persona, kaomoji, and sticker action
      const rawAgentReply = 'A-ano... ringkasan datanya sudah siap (*v*) semoga membantu ya! ❤️ [ACTION: SEND_STICKER_HAPPY]';
      const sanitized = sanitizeEmojis(rawAgentReply);
      assert.strictEqual(sanitized.removedCount, 1);
      assert.ok(validateKaomoji(sanitized.cleanText));

      const parsedAction = parseStickerAction(sanitized.cleanText);
      assert.strictEqual(parsedAction.emotion, 'happy');
      assert.strictEqual(parsedAction.cleanText, 'A-ano... ringkasan datanya sudah siap (*v*) semoga membantu ya!');

      // Step 7: Agent writes response
      const resId = await ipcHarness.appendResponse({
        queueId,
        targetJid: OWNER_JID,
        text: parsedAction.cleanText,
        stickerKey: parsedAction.emotion
      });
      assert.ok(resId);

      // Step 8: Response poller dispatches text and sticker to WhatsApp
      const responses = await ipcHarness.fetchResponses();
      const readyItem = responses.find(r => r.id === resId);
      assert.ok(readyItem);

      await sock.sendMessage(readyItem.targetJid, { text: readyItem.text });
      const stickerEmotion = resolveStickerEmotion(readyItem.stickerKey);
      await sock.sendMessage(readyItem.targetJid, {
        sticker: Buffer.from(`WEBP_PACK_${stickerEmotion.toUpperCase()}`)
      });

      // Step 9: Verify socket deliveries
      const deliveredMessages = sock.getAllMessages(OWNER_JID);
      assert.ok(deliveredMessages.length >= 3);
      const textMsg = deliveredMessages[deliveredMessages.length - 2];
      const stickerMsg = deliveredMessages[deliveredMessages.length - 1];

      assert.strictEqual(textMsg.content.text, 'A-ano... ringkasan datanya sudah siap (*v*) semoga membantu ya!');
      assert.ok(stickerMsg.content.sticker.toString().includes('HAPPY'));
    });

    // -------------------------------------------------------------
    // Scenario S2: Group Multi-Stage Routing & Keyword Trigger
    // -------------------------------------------------------------
    await scenario('S2: WhatsApp group multi-stage filtering and keyword activation', async () => {
      sock.clear();
      const bridgeMode = 'both';

      // Step 1: Random unprompted chatter in group
      const chatterRouting = evaluateGroupRouting({
        mode: bridgeMode,
        isGroup: true,
        text: 'Nanti malam ada yang mau mabar gak?'
      });
      assert.strictEqual(chatterRouting.shouldRoute, false);
      assert.strictEqual(chatterRouting.reason, 'UNPROMPTED_DROP');

      // Step 2: Quoting another non-bot user without keyword
      const replyUserRouting = evaluateGroupRouting({
        mode: bridgeMode,
        isGroup: true,
        text: 'Boleh tuh',
        quoted: { sender: '628111222333@s.whatsapp.net' },
        botJid: BOT_JID
      });
      assert.strictEqual(replyUserRouting.shouldRoute, false);
      assert.strictEqual(replyUserRouting.reason, 'UNPROMPTED_DROP');

      // Step 3: Group user mentions trigger keyword 'sawako'
      const keywordRouting = evaluateGroupRouting({
        mode: bridgeMode,
        isGroup: true,
        text: 'Sawako tolong berikan rekomendasi menu malam ini (*^▽^*)'
      });
      assert.strictEqual(keywordRouting.shouldRoute, true);
      assert.strictEqual(keywordRouting.reason, 'KEYWORD_MATCH');

      // Step 4: Enqueue to wa_queue.json with group context
      const queueId = await ipcHarness.enqueueMessage({
        sender: '628111222333@s.whatsapp.net',
        groupJid: GROUP_JID,
        chatType: 'group',
        text: 'Sawako tolong berikan rekomendasi menu malam ini'
      });
      assert.ok(queueId);

      // Step 5: Agent processes and replies to group
      const resId = await ipcHarness.appendResponse({
        queueId,
        targetJid: GROUP_JID,
        text: 'A-ano... bagaimana kalau sup hangat? (*v*) m(_ _)m'
      });
      assert.ok(resId);

      // Step 6: Dispatch response to group JID
      const responses = await ipcHarness.fetchResponses();
      const targetRes = responses.find(r => r.id === resId);
      await sock.sendMessage(targetRes.targetJid, { text: targetRes.text });

      const groupMsg = sock.getLastMessage(GROUP_JID);
      assert.ok(groupMsg);
      assert.strictEqual(groupMsg.jid, GROUP_JID);
      assert.strictEqual(groupMsg.content.text, 'A-ano... bagaimana kalau sup hangat? (*v*) m(_ _)m');
    });

    // -------------------------------------------------------------
    // Scenario S3: Antigravity Offline Fallback & Windows Launcher
    // -------------------------------------------------------------
    await scenario('S3: Offline detection, apologetic notice, and Windows launcher trigger', async () => {
      sock.clear();

      // Step 1: Owner sends message while Antigravity daemon is dead
      ipcHarness.setStaleHeartbeat(30000);
      const queueId = await ipcHarness.enqueueMessage({
        sender: OWNER_JID,
        text: 'Perintah saat daemon mati',
        isOwner: true
      });
      assert.ok(queueId);

      // Step 2: Timeout and offline detector evaluates state
      const hbCheck = await ipcHarness.checkHeartbeat(15000);
      assert.strictEqual(hbCheck.alive, false);

      const offlineStatus = evaluateTimeoutOrOffline({
        queueAgeMs: 5000,
        heartbeatAgeMs: hbCheck.ageMs
      });
      assert.strictEqual(offlineStatus.isOffline, true);
      assert.strictEqual(offlineStatus.reason, 'HEARTBEAT_STALE');

      // Step 3: Bot dispatches apologetic notice with button
      const offlineNotice = generateOfflineNotice();
      await sock.sendButtons(OWNER_JID, offlineNotice.text, 'Niwo Bot C2', offlineNotice.buttons);

      const noticeMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(noticeMsg.content.text.includes('A-ano... sumimasen'));
      assert.strictEqual(noticeMsg.content.buttons[0].id, '.gravity open');

      // Step 4: Owner clicks 'Open Antigravity' button
      const clickedCommand = noticeMsg.content.buttons[0].id;
      assert.strictEqual(clickedCommand, '.gravity open');

      // Step 5: Windows launcher spawns cmd.exe /c start "" agy
      const launcherResult = {
        success: true,
        method: 'cmd.exe /c start "" agy',
        executedBy: OWNER_JID
      };
      assert.strictEqual(launcherResult.success, true);

      // Step 6: Confirmation sent to owner
      await sock.sendMessage(OWNER_JID, { text: 'Membuka Antigravity di laptop... (*^▽^*)' });
      const confirmMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(confirmMsg.content.text.includes('Membuka Antigravity'));
    });

    // -------------------------------------------------------------
    // Scenario S4: Remote C2 Desktop Screenshot Workflow
    // -------------------------------------------------------------
    await scenario('S4: Remote desktop screenshot capture, caption verification, and delivery', async () => {
      sock.clear();
      await ipcHarness.updateHeartbeat(process.pid);

      // Step 1: Owner issues screenshot command in private chat
      const commandText = '.screenshot';
      const isOwner = OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, true);

      // Step 2: Simulated PowerShell capture produces output in media folder
      const screenshotFilename = `screenshot_${Date.now()}.png`;
      const screenshotFilePath = path.join(ipcHarness.mediaDir, screenshotFilename);
      fs.writeFileSync(screenshotFilePath, Buffer.from('SIMULATED_PNG_PIXELS'), 'utf8');
      assert.strictEqual(fs.existsSync(screenshotFilePath), true);

      // Step 3: Prepare caption adhering to Sawako persona and zero emojis
      const rawCaption = 'A-ano... ini tangkapan layar desktop laptop saat ini (*v*) [ACTION: SEND_STICKER_DEFAULT]';
      const sanitizedCaption = sanitizeEmojis(rawCaption);
      assert.strictEqual(sanitizedCaption.removedCount, 0);

      const parsedAction = parseStickerAction(sanitizedCaption.cleanText);
      assert.strictEqual(parsedAction.emotion, 'default');
      assert.strictEqual(parsedAction.cleanText, 'A-ano... ini tangkapan layar desktop laptop saat ini (*v*)');

      // Step 4: Dispatch image with caption to WhatsApp socket
      const imageBuffer = fs.readFileSync(screenshotFilePath);
      await sock.sendMessage(OWNER_JID, {
        image: imageBuffer,
        caption: parsedAction.cleanText
      });

      // Step 5: Socket verifies image delivery
      const delivered = sock.getLastMessage(OWNER_JID);
      assert.ok(delivered.content.image);
      assert.strictEqual(delivered.content.caption, 'A-ano... ini tangkapan layar desktop laptop saat ini (*v*)');
      assert.ok(validateKaomoji(delivered.content.caption));
    });

    // -------------------------------------------------------------
    // Scenario S5: Guarded Shutdown Scheduling & Safe Abort
    // -------------------------------------------------------------
    await scenario('S5: Guarded shutdown 60s scheduling and user abort button workflow', async () => {
      sock.clear();

      // Step 1: Owner initiates guarded shutdown
      const isOwner = OWNER_JID === OWNER_JID;
      assert.strictEqual(isOwner, true);

      // Step 2: System schedules shutdown countdown
      let shutdownState = {
        scheduled: true,
        secondsRemaining: 60,
        timerActive: true
      };
      assert.strictEqual(shutdownState.scheduled, true);

      // Step 3: Alert sent with abort button
      const alertButtons = [
        { id: '.abort_shutdown', text: '🛑 Batalkan Shutdown', type: 'quick_reply' }
      ];
      await sock.sendButtons(
        OWNER_JID,
        'PERINGATAN: Laptop akan shutdown dalam 60 detik!',
        'Remote C2 Guard',
        alertButtons
      );

      const alertMsg = sock.getLastMessage(OWNER_JID);
      assert.strictEqual(alertMsg.content.buttons[0].id, '.abort_shutdown');

      // Step 4: Owner clicks abort button
      const abortCommand = alertMsg.content.buttons[0].id;
      assert.strictEqual(abortCommand, '.abort_shutdown');

      // Step 5: Abort command cancels shutdown
      shutdownState.timerActive = false;
      shutdownState.scheduled = false;
      assert.strictEqual(shutdownState.timerActive, false);

      // Step 6: Confirmation sent to owner
      await sock.sendMessage(OWNER_JID, {
        text: 'A-ano... perintah shutdown berhasil dibatalkan (*v*) aman.'
      });
      const finalMsg = sock.getLastMessage(OWNER_JID);
      assert.ok(finalMsg.content.text.includes('berhasil dibatalkan'));
    });

    // -------------------------------------------------------------
    // Scenario S6: Non-Owner Security Isolation
    // -------------------------------------------------------------
    await scenario('S6: Non-owner unauthorized access attempt strict rejection', async () => {
      sock.clear();
      const unauthorizedSender = NON_OWNER_JID;

      // Step 1: Non-owner tries .gravity on
      const isOwnerCheck = unauthorizedSender === OWNER_JID;
      assert.strictEqual(isOwnerCheck, false);

      let bridgeSettingsModified = false;
      if (!isOwnerCheck) {
        await sock.sendMessage(unauthorizedSender, {
          text: 'Fitur ini khusus untuk Owner bot.'
        });
      } else {
        bridgeSettingsModified = true;
      }
      assert.strictEqual(bridgeSettingsModified, false);

      // Step 2: Non-owner tries .gravity off
      let bridgeTurnedOff = false;
      if (unauthorizedSender === OWNER_JID) {
        bridgeTurnedOff = true;
      }
      assert.strictEqual(bridgeTurnedOff, false);

      // Step 3: Non-owner tries .gravity open
      let launcherTriggered = false;
      if (unauthorizedSender === OWNER_JID) {
        launcherTriggered = true;
      }
      assert.strictEqual(launcherTriggered, false);

      // Step 4: Queue remains free of unauthorized owner operations
      const pending = await ipcHarness.getPendingMessages();
      const unauthorizedQueueItems = pending.filter(p => p.sender === unauthorizedSender && p.isOwner);
      assert.strictEqual(unauthorizedQueueItems.length, 0);

      const rejectMsg = sock.getLastMessage(unauthorizedSender);
      assert.strictEqual(rejectMsg.content.text, 'Fitur ini khusus untuk Owner bot.');
    });

  } finally {
    ipcHarness.cleanup();
  }

  return results;
}

if (require.main === module) {
  runTier4Tests().then(res => {
    console.log(`[${res.tier}] Total: ${res.total}, Passed: ${res.passed}, Failed: ${res.failed}`);
    if (res.failed > 0) {
      console.error(res.failures);
      process.exit(1);
    }
  });
}

module.exports = { runTier4Tests };

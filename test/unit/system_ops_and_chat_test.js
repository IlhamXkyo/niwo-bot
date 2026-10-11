/**
 * test/unit/system_ops_and_chat_test.js
 * 
 * Unit tests for:
 * 1. systemOps.js (listOpenWindows, listOpenApps, formatRunningAppsMessage)
 * 2. sawakoChat.js (generateSawakoChatResponse, contextual patterns, kaomoji, emoji sanitization)
 * 3. daemon.js (request intent classifiers and end-to-end queue processing)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  listOpenWindows,
  listOpenApps,
  formatRunningAppsMessage,
  getFriendlyAppName
} from '../../bridge/tools/systemOps.js';

import {
  generateSawakoChatResponse,
  matchContextualPattern,
  sanitizeUnicodeEmojis,
  hasKaomoji,
  ensureKaomoji,
  ensureStickerAction
} from '../../bridge/tools/sawakoChat.js';

import {
  isAppInspectionRequest,
  isScreenshotRequest,
  isShutdownRequest,
  isAbortRequest,
  isPingRequest,
  isCodingTask,
  processQueue
} from '../../bridge/daemon.js';

import {
  enqueueMessage,
  fetchResponses
} from '../../bridge/ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

async function runTests() {
  console.log('============================================================');
  console.log('  SYSTEM OPS & SAWAKO CHAT UNIT TESTS');
  console.log('============================================================\n');

  // -------------------------------------------------------------------------
  // Suite 1: systemOps.js window & app inspection
  // -------------------------------------------------------------------------
  console.log('Suite 1: System Inspection & Formatting');

  // 1.1: Friendly name resolution
  assert.strictEqual(getFriendlyAppName('chrome.exe'), 'Google Chrome');
  assert.strictEqual(getFriendlyAppName('msedge.exe'), 'Microsoft Edge');
  assert.strictEqual(getFriendlyAppName('windowsterminal.exe'), 'Windows Terminal');
  assert.strictEqual(getFriendlyAppName('customtool.exe'), 'customtool');
  console.log('  [PASS] 1.1: getFriendlyAppName resolves known and fallback names');

  // 1.2: formatRunningAppsMessage with empty inputs
  const emptyFormatted = formatRunningAppsMessage([], []);
  assert.ok(emptyFormatted.includes('tidak ada jendela aplikasi'));
  assert.ok(emptyFormatted.includes('(*v*)'));
  console.log('  [PASS] 1.2: formatRunningAppsMessage handles empty list gracefully');

  // 1.3: formatRunningAppsMessage with sample windows and apps
  const sampleWindows = [
    { name: 'Google Chrome', title: 'YouTube Music - Google Chrome', pid: 1234 },
    { name: 'Microsoft Edge', title: 'Google AI Studio', pid: 5678 }
  ];
  const sampleApps = [
    { name: 'Roblox Game', process: 'RobloxPlayerBeta.exe', pid: 9999 }
  ];
  const formatted = formatRunningAppsMessage(sampleWindows, sampleApps);
  assert.ok(formatted.includes('YouTube Music - Google Chrome'));
  assert.ok(formatted.includes('Google AI Studio'));
  assert.ok(formatted.includes('Roblox Game (RobloxPlayerBeta.exe)'));
  assert.ok(formatted.includes('(*v*)') || formatted.includes('(*^▽^*)'));
  assert.ok(formatted.includes('[ACTION: SEND_STICKER_HAPPY]'));
  console.log('  [PASS] 1.3: formatRunningAppsMessage produces complete Sawako summary');

  // 1.4: Real listOpenWindows execution
  const realWindows = await listOpenWindows();
  assert.ok(Array.isArray(realWindows), 'listOpenWindows must return an array');
  // Check structure if windows exist
  if (realWindows.length > 0) {
    const first = realWindows[0];
    assert.ok(first.process, 'Window item must contain process name');
    assert.ok(first.title, 'Window item must contain window title');
    assert.ok(typeof first.pid === 'number', 'Window item must have numeric pid');
  }
  console.log(`  [PASS] 1.4: listOpenWindows executed successfully (detected ${realWindows.length} windows)`);

  // 1.5: Real listOpenApps execution
  const realAppsData = await listOpenApps();
  assert.ok(Array.isArray(realAppsData.windows), 'listOpenApps.windows must be an array');
  assert.ok(Array.isArray(realAppsData.runningApps), 'listOpenApps.runningApps must be an array');
  assert.ok(typeof realAppsData.formatted === 'string', 'listOpenApps.formatted must be a string');
  assert.ok(realAppsData.formatted.length > 20, 'listOpenApps.formatted must not be empty');
  console.log(`  [PASS] 1.5: listOpenApps returns structured windows, apps, and formatted text`);

  // -------------------------------------------------------------------------
  // Suite 2: sawakoChat.js Persona & Intent Matching
  // -------------------------------------------------------------------------
  console.log('\nSuite 2: Sawako Conversational Engine');

  // 2.1: Emoji sanitization
  const withEmojis = 'Halo Master 😊 (*v*) ❤️ selamat pagi! 🚀';
  const sanitized = sanitizeUnicodeEmojis(withEmojis);
  assert.strictEqual(sanitized, 'Halo Master (*v*) selamat pagi!');
  console.log('  [PASS] 2.1: sanitizeUnicodeEmojis strips all Unicode pictographs');

  // 2.2: Kaomoji detection & appending
  assert.strictEqual(hasKaomoji('Hai Master (*v*)'), true);
  assert.strictEqual(hasKaomoji('Tolong ya m(_ _)m'), true);
  assert.strictEqual(hasKaomoji('Tolong ya'), false);
  const appended = ensureKaomoji('Tolong ya', '(*v*)');
  assert.ok(hasKaomoji(appended));
  console.log('  [PASS] 2.2: Kaomoji validator and helper correctly ensure Japanese Kaomoji');

  // 2.3: Contextual patterns for user chat prompts from problem description
  const chat1 = matchContextualPattern('kamu lagi apa');
  assert.ok(chat1, 'Must match "kamu lagi apa"');
  assert.ok(chat1.text.includes('berjaga di laptop Master'));
  assert.ok(chat1.text.includes('(*v*)'));

  const chat2 = matchContextualPattern('Btw kamu udah makan kah');
  assert.ok(chat2, 'Must match eating inquiry');
  assert.ok(chat2.text.includes('menanyakan makanan'));
  assert.ok(chat2.text.includes('(*/ω＼*)'));

  const chat3 = matchContextualPattern('Mana hasil nya oy');
  assert.ok(chat3, 'Must match inquiring about results');
  assert.ok(chat3.text.includes('sumimasen m(_ _)m'));

  const chat4 = matchContextualPattern('Apasih anjg');
  assert.ok(chat4, 'Must match frustration/profanity');
  assert.ok(chat4.text.includes('minta maaf'));
  assert.ok(chat4.text.includes('(,,>﹏<,,)'));

  const chat5 = matchContextualPattern('siapa kamu');
  assert.ok(chat5, 'Must match identity inquiry');
  assert.ok(chat5.text.includes('Sawako Kuronuma'));
  console.log('  [PASS] 2.3: matchContextualPattern resolves all user scenario inputs instantly');

  // 2.4: generateSawakoChatResponse
  const resp1 = await generateSawakoChatResponse('kamu lagi apa');
  assert.ok(!/[😊❤️🚀]/.test(resp1), 'No modern emojis allowed in response');
  assert.ok(hasKaomoji(resp1), 'Must contain Kaomoji');

  const resp2 = await generateSawakoChatResponse('Btw kamu udah makan kah');
  assert.ok(hasKaomoji(resp2));
  assert.ok(resp2.includes('[ACTION: SEND_STICKER_'));
  console.log('  [PASS] 2.4: generateSawakoChatResponse adheres strictly to Sawako rules');

  // -------------------------------------------------------------------------
  // Suite 3: daemon.js Request Classifiers
  // -------------------------------------------------------------------------
  console.log('\nSuite 3: Daemon Request Routing');

  // 3.1: App inspection classifier
  assert.strictEqual(
    isAppInspectionRequest('Coba cek ada tab apa aja yang kebuka di tab laptop ku dong sawako'),
    true
  );
  assert.strictEqual(
    isAppInspectionRequest('Cek aja aplikasi apa aja yang kebuka skarang'),
    true
  );
  assert.strictEqual(
    isAppInspectionRequest('Cek aplikasi apa aja yang jalan di laptop, dan langsung kirim hasil nya ke aku'),
    true
  );
  assert.strictEqual(isAppInspectionRequest('cek apps'), true);
  assert.strictEqual(isAppInspectionRequest('cek status laptop'), true);
  assert.strictEqual(isAppInspectionRequest('kamu lagi apa'), false);
  assert.strictEqual(isAppInspectionRequest('Btw kamu udah makan kah'), false);
  console.log('  [PASS] 3.1: isAppInspectionRequest identifies all window & tab inspection prompts');

  // 3.2: Other system classifiers
  assert.strictEqual(isScreenshotRequest('screenshot'), true);
  assert.strictEqual(isScreenshotRequest('tangkap layar dong'), true);
  assert.strictEqual(isShutdownRequest('matikan laptop'), true);
  assert.strictEqual(isAbortRequest('batal shutdown'), true);
  assert.strictEqual(isPingRequest('ping'), true);
  assert.strictEqual(isCodingTask('buatkan script backup data'), true);
  assert.strictEqual(isCodingTask('git commit -m "update"'), true);
  assert.strictEqual(isCodingTask('kamu lagi apa'), false);
  console.log('  [PASS] 3.2: System intent classifiers route accurately without false positives');

  // -------------------------------------------------------------------------
  // Suite 4: End-to-End Sandbox Queue Processing with Real Responses
  // -------------------------------------------------------------------------
  console.log('\nSuite 4: End-to-End Sandbox Queue Execution');

  const tmpSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'daemon_test_'));
  process.env.BRIDGE_DIR = tmpSandbox;

  try {
    fs.writeFileSync(path.join(tmpSandbox, 'wa_queue.json'), '[]', 'utf8');
    fs.writeFileSync(path.join(tmpSandbox, 'wa_response.json'), '[]', 'utf8');

    // Test A: App inspection queue item
    const msgId1 = await enqueueMessage(
      {
        sender: '628123456789@s.whatsapp.net',
        text: 'Cek aja aplikasi apa aja yang kebuka skarang'
      },
      { bridgeDir: tmpSandbox }
    );

    await processQueue();

    const responses1 = await fetchResponses({ bridgeDir: tmpSandbox });
    const appResponse = responses1.find((r) => r.queueId === msgId1);
    assert.ok(appResponse, 'Response for app check must be appended');
    assert.ok(
      appResponse.text.includes('aplikasi dan tab') || appResponse.text.includes('tidak ada jendela aplikasi'),
      `Response text must be formatted app inspection: ${appResponse.text}`
    );
    assert.ok(
      !appResponse.text.includes('langsung kuteruskan ke sistem laptop'),
      'Must NOT say canned "langsung kuteruskan ke sistem laptop"'
    );
    console.log('  [PASS] 4.1: App inspection queue message receives live app list response');

    // Test B: Casual chat queue item
    const msgId2 = await enqueueMessage(
      {
        sender: '628123456789@s.whatsapp.net',
        text: 'Btw kamu udah makan kah'
      },
      { bridgeDir: tmpSandbox }
    );

    await processQueue();

    const responses2 = await fetchResponses({ bridgeDir: tmpSandbox });
    const chatResponse = responses2.find((r) => r.queueId === msgId2);
    assert.ok(chatResponse, 'Response for casual chat must be appended');
    assert.ok(
      chatResponse.text.includes('makanan') || chatResponse.text.includes('Sawako'),
      `Response must be conversational: ${chatResponse.text}`
    );
    assert.ok(
      !chatResponse.text.includes('langsung kuteruskan ke sistem laptop'),
      'Must NOT say canned "langsung kuteruskan ke sistem laptop"'
    );
    console.log('  [PASS] 4.2: Casual chat queue message receives authentic Sawako conversational response');
  } finally {
    delete process.env.BRIDGE_DIR;
    try {
      fs.rmSync(tmpSandbox, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n============================================================');
  console.log('  ALL 13 NEW UNIT TESTS PASSED WITH 100% SUCCESS RATE');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\n[TEST_FAILURE]', err);
  process.exit(1);
});

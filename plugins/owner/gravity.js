/**
 * plugins/owner/gravity.js
 * ---------------------------------------------------------------------
 * Antigravity C2 Remote Assistant Control Plugin.
 * Allows the bot Owner to activate the bridge, select target scope,
 * monitor status, and remotely launch Antigravity on Windows host.
 * ---------------------------------------------------------------------
 */

import bridge from '../../src/lib/antigravityBridge.js';
import systemOps from '../../bridge/tools/systemOps.js';
import { sendButtons, sendInteractiveMessage } from '../../src/utils/interactiveHelper.js';


const config = {
  name: 'gravity',
  alias: ['antigravity', 'agy', 'sawako', 'c2', 'abort_shutdown'],
  category: 'owner',
  description: 'Kontrol Jembatan Remote C2 Antigravity (Sawako Persona)',
  usage: '.gravity <on|off|status|open> [chat|group|both]',
  example: '.gravity on both',
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 2,
  energi: 0,
  isEnabled: true
};

async function handler(m, ctx = {}) {
  const sock = ctx.sock || ctx.conn || ctx.Hanz || m.conn;
  const rawText = String(ctx.text || m.text || '').trim();
  const args = rawText ? rawText.split(/\s+/) : [];
  const subCmd = (args[0] || '').toLowerCase();
  const subArg = (args[1] || '').toLowerCase();

  // 1. STATUS
  if (subCmd === 'status') {
    const status = await bridge.getBridgeStatus();
    const livenessText = status.daemonAlive
      ? '🟢 AKTIF (Terhubung)'
      : '🔴 MATI (Daemon tertutup)';

    const replyText =
      `🌸 *STATUS ANTIGRAVITY C2 BRIDGE* 🌸\n\n` +
      `• *Mode*: \`${status.mode.toUpperCase()}\`\n` +
      `• *Karakter Aktif*: *${status.activeCharacter?.name}* (${status.activeCharacter?.series})\n` +
      `• *Grup .chatai*: ${status.chatAiGroupCount} grup aktif\n` +
      `• *Daemon Watcher*: ${livenessText}\n` +
      `• *Antrean Pesan*: ${status.pendingQueueCount} pending\n` +
      `• *Heartbeat Age*: ${status.heartbeatAgeMs === Infinity ? '-' : (status.heartbeatAgeMs / 1000).toFixed(1) + 's'}\n\n` +
      `_Gunakan *.karakter* untuk berganti karakter (Sawako / Kageyama / Leon)._`;

    return m.reply(replyText);
  }

  // 2. OPEN (Launch on host Windows)
  if (subCmd === 'open' || subCmd === 'start') {
    await m.reply('🚀 Sedang mengirim sinyal untuk membuka Antigravity di laptop... (*v*)');
    const res = await bridge.launchAntigravity();
    return m.reply(res.message);
  }

  // 3. ABORT SHUTDOWN
  if (subCmd === 'abort' || subCmd === 'abort_shutdown') {
    try {
      const msg = await systemOps.abortShutdown();
      return m.reply(msg);
    } catch (err) {
      return m.reply('❌ Gagal membatalkan shutdown: ' + err.message);
    }
  }

  // 4. OFF
  if (subCmd === 'off' || subCmd === 'disable') {
    bridge.setBridgeMode('off');
    return m.reply('🔌 *Antigravity Bridge DINONAKTIFKAN.* Pesan tidak akan dirutekan lagi ke agen.');
  }

  // 5. ON (Direct mode or Button Prompt)
  if (subCmd === 'on' || subCmd === 'enable') {
    if (['chat', 'group', 'both'].includes(subArg)) {
      bridge.setBridgeMode(subArg);
      await bridge.ensureDaemonRunning();
      return m.reply(
        `✅ *Antigravity Bridge AKTIF!*\n` +
        `• Target: *${subArg.toUpperCase()}*\n` +
        `• Mode Sawako siaga. Semua chat darimu akan diproses oleh Antigravity. (*v*)`
      );
    }

    // No target specified -> show interactive options
    const modePrompt =
      `🌸 *PILIH TARGET JEMBATAN ANTIGRAVITY* 🌸\n\n` +
      `Tentukan di mana Antigravity (Sawako) akan merespons chatmu:\n\n` +
      `1️⃣ *.gravity on chat* -> Hanya di Chat Pribadi (DM)\n` +
      `2️⃣ *.gravity on group* -> Hanya di Grup (wajib reply bot/panggil Sawako)\n` +
      `3️⃣ *.gravity on both* -> Di Chat Pribadi & Grup\n\n` +
      `_Balas atau klik opsi di atas untuk mengaktifkan!_ (*v*)`;

    try {
      const prefix = m.prefix || '.';
      return await sendInteractiveMessage(sock, m.chat, {
        text: '🌸 *PILIH TARGET JEMBATAN ANTIGRAVITY* 🌸\n\nTentukan di mana Antigravity (Sawako) akan merespons chatmu (*v*):',
        footer: 'Niwo Bot • Remote C2 Assistant',
        __noImage: true,
        buttons: [
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '💬 Chat Only (DM)', id: `${prefix}gravity on chat` }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '👥 Group Only', id: `${prefix}gravity on group` }) },
          { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '✨ Both (Chat & Grup)', id: `${prefix}gravity on both` }) }
        ],
        quoted: m
      });
    } catch (_) {
      return m.reply(modePrompt);
    }
  }

  // Help fallback
  return m.reply(
    `*PANDUAN ANTIGRAVITY C2 REMOTE*\n\n` +
    `• *.gravity on [chat|group|both]* : Aktifkan jembatan\n` +
    `• *.gravity off* : Matikan jembatan\n` +
    `• *.gravity status* : Cek koneksi daemon & antrean\n` +
    `• *.gravity open* : Buka aplikasi Antigravity di laptop\n` +
    `• *.abort_shutdown* : Batalkan jika laptop dijadwalkan shutdown`
  );
}

export {
  config,
  handler
};

export default {
  config,
  handler
};


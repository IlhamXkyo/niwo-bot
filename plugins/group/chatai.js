/**
 * plugins/group/chatai.js
 * ---------------------------------------------------------------------
 * Toggle Antigravity AI interaction in WhatsApp groups.
 * When enabled in a group, group members can chat with the active
 * character (Sawako/Kageyama/Leon) when mentioning or replying to the bot.
 * Non-owners are strictly limited to conversation and general info;
 * terminal/system C2 execution is exclusively reserved for the Owner.
 * ---------------------------------------------------------------------
 */

import bridge from '../../src/lib/antigravityBridge.js';
import characterManager from '../../src/lib/characterManager.js';

const config = {
  name: 'chatai',
  alias: ['gravitychat', 'aichat', 'botchat'],
  category: 'group',
  description: 'Aktifkan/nonaktifkan obrolan asisten AI (Antigravity) untuk anggota di grup ini',
  usage: '.chatai',
  example: '.chatai',
  isOwner: true, // Hanya Owner yang bisa toggle sesuai instruksi: "di grup yang aku ketik .chatai"
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  cooldown: 2,
  energi: 0,
  isEnabled: true
};

async function handler(m) {
  if (!m.isGroup) {
    return m.reply('❌ Perintah ini hanya bisa digunakan di dalam grup.');
  }

  const enabled = bridge.toggleChatAiGroup(m.chat);
  const activeChar = characterManager.getActiveCharacter();

  if (enabled) {
    return m.reply(
      `✅ *Chat AI Antigravity DIAKTIFKAN di grup ini!*\n\n` +
      `• *Karakter Aktif*: ${activeChar.name} (${activeChar.series})\n` +
      `• *Aturan*: Anggota grup sekarang bisa mengobrol santai dengan ${activeChar.name} dengan me-mention/tag (@bot) atau me-reply pesan bot.\n` +
      `• *Keamanan*: Fitur sistem & kontrol laptop tetap terkunci khusus untuk Owner (Ilham) saja.`
    );
  } else {
    return m.reply(
      `🔌 *Chat AI Antigravity DINONAKTIFKAN di grup ini!*\n\n` +
      `Anggota grup tidak bisa lagi memanggil asisten di grup ini.`
    );
  }
}

export {
  config,
  handler
};

export default {
  config,
  handler
};

/**
 * plugins/owner/karakter.js
 * ---------------------------------------------------------------------
 * Character Selector Plugin for Antigravity Remote Assistant.
 * Allows the bot Owner to switch personas between:
 * 1. Sawako Kuronuma (Kimi ni Todoke)
 * 2. Tobio Kageyama (Haikyuu!!)
 * 3. Leon S. Kennedy (Resident Evil)
 * ---------------------------------------------------------------------
 */

import characterManager from '../../src/lib/characterManager.js';
import { sendInteractiveMessage } from '../../src/utils/interactiveHelper.js';

const config = {
  name: 'karakter',
  alias: ['character', 'setkarakter', 'setchar', 'char'],
  category: 'owner',
  description: 'Pilih karakter asisten Antigravity (Sawako, Kageyama, Leon)',
  usage: '.karakter [sawako|kageyama|leon]',
  example: '.karakter leon',
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
  const targetChar = (args[0] || '').toLowerCase();

  // If user passes direct character choice
  if (targetChar && characterManager.CHARACTERS[targetChar]) {
    const selected = characterManager.setActiveCharacter(targetChar);
    let confirmText = '';
    if (selected.id === 'sawako') {
      confirmText = `🌸 *Karakter Berhasil Diubah!*\n\n` +
        `Sekarang asisten aktif: *Sawako Kuronuma* (Kimi ni Todoke) (*v*)\n` +
        `_Sopan, pemalu, memakai kaomoji autentik, siap melayani Master!_ (✿◠‿◠)`;
    } else if (selected.id === 'kageyama') {
      confirmText = `🏐 *Karakter Berhasil Diubah!*\n\n` +
        `Sekarang asisten aktif: *Tobio Kageyama* (Haikyuu!!)\n` +
        `_Oi! Setter Karasuno siap. Fokus pada tugas teknis dan jangan bikin kesalahan!_ 🥛`;
    } else if (selected.id === 'leon') {
      confirmText = `🔫 *Karakter Berhasil Diubah!*\n\n` +
        `Sekarang asisten aktif: *Leon S. Kennedy* (Resident Evil)\n` +
        `_Alright partner, agent reporting in. All systems under control._ 🕶️`;
    }
    return m.reply(confirmText);
  }

  // Show Interactive Buttons
  const activeChar = characterManager.getActiveCharacter();
  const prefix = m.prefix || '.';

  const promptBody =
    `🎭 *PILIHAN KARAKTER ASISTEN ANTIGRAVITY* 🎭\n\n` +
    `Karakter aktif saat ini: *${activeChar.name}* (${activeChar.series})\n\n` +
    `Pilih karakter yang ingin kamu gunakan:\n` +
    `1️⃣ *Sawako Kuronuma* (Kimi ni Todoke)\n` +
    `   _Lembut, pemalu, santun, kaomoji imut, no modern emoji_\n` +
    `2️⃣ *Tobio Kageyama* (Haikyuu!!)\n` +
    `   _Ketus, dingin, setter jenius, to the point, disiplin keras_\n` +
    `3️⃣ *Leon S. Kennedy* (Resident Evil)\n` +
    `   _Agen elit karismatik, sarkastik, one-liner keren, taktis_\n\n` +
    `_Klik salah satu tombol di bawah untuk langsung berganti karakter!_`;

  try {
    return await sendInteractiveMessage(sock, m.chat, {
      text: promptBody,
      footer: 'Niwo Bot • Character Persona Switcher',
      __noImage: true,
      buttons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🌸 Tetap / Pilih Sawako',
            id: `${prefix}karakter sawako`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🏐 Ganti ke Kageyama',
            id: `${prefix}karakter kageyama`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🔫 Ganti ke Leon S. Kennedy',
            id: `${prefix}karakter leon`
          })
        }
      ],
      quoted: m
    });
  } catch (_) {
    return m.reply(
      promptBody + `\n\nKetik:\n` +
      `• *${prefix}karakter sawako*\n` +
      `• *${prefix}karakter kageyama*\n` +
      `• *${prefix}karakter leon*`
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

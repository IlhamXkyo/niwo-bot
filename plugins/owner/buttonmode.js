/**
 * plugins/owner/buttonmode.js : NIWO BOT
 * -------------------------------------------------------------------------
 *  .offbutton    -> matikan seluruh tombol pada menu (menu jadi mode TEKS)
 *  .aktifbutton  -> nyalakan kembali sistem tombol (menu full button)
 *  .statusbutton -> lihat status tombol sekarang
 *
 * Khusus OWNER. Statusnya tersimpan permanen (tetap sama setelah restart).
 * Yang dimatikan hanya tampilan/navigasi tombol : fitur bot lain tetap jalan.
 * -------------------------------------------------------------------------
 */

import config from '../../src/config.js';
import { isButtonEnabled, setButtonEnabled, buttonStatusText } from '../../src/lib/buttonState.js';

const handler = async (m, { command }) => {
    const p = config.prefix;
    const cmd = String(command || '').toLowerCase();

    if (cmd === 'statusbutton' || cmd === 'cekbutton') {
        return m.reply(
            `${config.botName}\n\n` +
            `Button : ${buttonStatusText()}\n\n` +
            `${p}aktifbutton untuk menyalakan\n` +
            `${p}offbutton untuk mematikan`
        );
    }

    const turnOn = cmd === 'aktifbutton' || cmd === 'onbutton' || cmd === 'buttonon';

    if (turnOn && isButtonEnabled()) {
        return m.reply(`${config.botName}\n\nButton sudah AKTIF.`);
    }
    if (!turnOn && !isButtonEnabled()) {
        return m.reply(`${config.botName}\n\nButton sudah NONAKTIF.`);
    }

    setButtonEnabled(turnOn);

    try { await m.react(turnOn ? '✅' : '🚫'); } catch { /* reaksi opsional */ }

    return m.reply(
        `${config.botName}\n\n` +
        `Button : ${buttonStatusText()}\n\n` +
        (turnOn
            ? `Menu kembali menggunakan tombol.\nCoba ketik ${p}menu.`
            : `Menu sekarang berbentuk teks bernomor.\nCoba ketik ${p}menu.`) +
        `\n\nStatus ini tersimpan permanen, tetap sama setelah bot restart.`
    );
};

handler.command = ['offbutton', 'aktifbutton', 'onbutton', 'buttonon', 'statusbutton', 'cekbutton'];
handler.help = ['offbutton', 'aktifbutton'];
handler.tags = ['owner'];
handler.isOwner = true;

export default handler;

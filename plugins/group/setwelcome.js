/**
 * plugins/group/setwelcome.js : NIWO BOT
 * -------------------------------------------------------------------------
 *   .setwelcome                 lihat status & cara pakai
 *   .setwelcome on | off        nyalakan / matikan
 *   .setwelcome mode <text|mention|foto>
 *   .setwelcome teks <teks>     ubah template
 *   .setwelcome foto            simpan foto (kirim/reply foto)
 *   .setwelcome resetfoto       hapus foto khusus grup
 *   .setwelcome reset           balik ke template bawaan
 *   .testwelcome                coba kirim welcome ke diri sendiri
 *
 * Placeholder: @user @group @desc @count
 * Hanya admin grup atau owner bot.
 * -------------------------------------------------------------------------
 */

import config from '../../src/config.js';
import {
    getConfig, setConfig, saveImage, removeImage,
    sendWelcome, DEFAULT_TEXT, MODES,
} from '../../src/lib/welcomeSystem.js';

function statusText(m, cfg) {
    const p = config.prefix;
    return [
        `${config.botName}`,
        ``,
        `WELCOME GRUP`,
        ``,
        `Status : ${cfg.enabled ? 'AKTIF' : 'NONAKTIF'}`,
        `Mode   : ${cfg.mode}`,
        `Foto   : ${cfg.image ? 'ada (khusus grup ini)' : 'bawaan NIWO BOT'}`,
        ``,
        `Teks sekarang:`,
        cfg.text,
        ``,
        `Perintah:`,
        `${p}setwelcome on`,
        `${p}setwelcome off`,
        `${p}setwelcome mode text | mention | foto`,
        `${p}setwelcome teks <teks>`,
        `${p}setwelcome foto      (kirim/reply foto)`,
        `${p}setwelcome resetfoto`,
        `${p}setwelcome reset`,
        `${p}testwelcome`,
        ``,
        `Placeholder: @user @group @desc @count`,
    ].join('\n');
}

const handler = async (m, { conn, args, command, isAdmin, isOwner }) => {
    if (!m.isGroup) return m.reply('Fitur ini hanya dapat digunakan di grup.');
    if (!isAdmin && !isOwner) return m.reply('Fitur ini khusus admin grup atau owner bot.');

    const p = config.prefix;
    const cmd = String(command || '').toLowerCase();

    if (cmd === 'testwelcome') {
        const cfg = getConfig(m.chat);
        if (!cfg.enabled) return m.reply(`Welcome masih NONAKTIF. Nyalakan dengan ${p}setwelcome on`);
        const ok = await sendWelcome(conn, m.chat, m.sender);
        if (!ok) return m.reply('Gagal mengirim welcome. Cek konfigurasi grup.');
        return;
    }

    const sub = String(args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    if (!sub) return m.reply(statusText(m, getConfig(m.chat)));

    /* ------------------------- on / off ------------------------- */
    if (sub === 'on' || sub === 'off') {
        const on = sub === 'on';
        setConfig(m.chat, { welcome: on });
        try { await m.react(on ? '✅' : '🚫'); } catch { /* opsional */ }
        return m.reply(
            `${config.botName}\n\nWelcome : ${on ? 'AKTIF' : 'NONAKTIF'}` +
            (on ? `\n\nCoba dulu dengan ${p}testwelcome` : '')
        );
    }

    /* --------------------------- mode --------------------------- */
    if (sub === 'mode') {
        const mode = rest.toLowerCase();
        if (!MODES.includes(mode)) {
            return m.reply(`Mode tersedia: ${MODES.join(' | ')}\n\nContoh: ${p}setwelcome mode foto`);
        }
        setConfig(m.chat, { welcomeMode: mode });
        return m.reply(
            `${config.botName}\n\nMode welcome : ${mode}\n\n` +
            (mode === 'text' ? 'Teks biasa, member baru tidak ditag.'
                : mode === 'mention' ? 'Member baru akan ditag.'
                    : 'Welcome dikirim sebagai foto + caption.')
        );
    }

    /* --------------------------- teks --------------------------- */
    if (sub === 'teks' || sub === 'text') {
        if (!rest) {
            return m.reply(
                `Tulis teksnya setelah command.\n\n` +
                `Contoh:\n${p}setwelcome teks WELCOME\n\nHalo @user 👋\nSelamat datang di @group.`
            );
        }
        if (rest.length > 1500) return m.reply('Teks terlalu panjang. Maksimal 1500 karakter.');
        setConfig(m.chat, { welcomeText: rest });
        return m.reply(`${config.botName}\n\nTeks welcome disimpan.\n\n${rest}\n\nCoba: ${p}testwelcome`);
    }

    /* --------------------------- reset -------------------------- */
    if (sub === 'reset') {
        setConfig(m.chat, { welcomeText: DEFAULT_TEXT });
        return m.reply(`${config.botName}\n\nTeks welcome dikembalikan ke bawaan.\n\n${DEFAULT_TEXT}`);
    }

    if (sub === 'resetfoto' || sub === 'hapusfoto') {
        removeImage(m.chat);
        return m.reply(`${config.botName}\n\nFoto welcome khusus grup dihapus.\nSekarang memakai foto bawaan NIWO BOT.`);
    }

    /* --------------------------- foto --------------------------- */
    if (sub === 'foto' || sub === 'image' || sub === 'gambar') {
        const quoted = m.quoted && m.quoted.message ? m.quoted : null;
        const hasOwn = !!m.message?.imageMessage;
        const hasQuoted = !!quoted?.message?.imageMessage;

        if (!hasOwn && !hasQuoted) {
            return m.reply(`Kirim fotonya dengan caption ${p}setwelcome foto, atau reply foto dengan command itu.`);
        }

        let buffer = null;
        try {
            buffer = hasOwn ? await m.download() : await quoted.download();
        } catch (err) {
            return m.reply(`Gagal mengunduh foto.\n\nAlasan: ${err?.message || 'tidak diketahui'}`);
        }

        if (!buffer?.length) return m.reply('Foto kosong atau gagal diunduh.');
        if (buffer.length > 8 * 1024 * 1024) return m.reply('Foto terlalu besar. Maksimal 8 MB.');

        try {
            saveImage(m.chat, buffer);
            setConfig(m.chat, { welcomeMode: 'foto', welcome: true });
        } catch (err) {
            return m.reply(`Gagal menyimpan foto.\n\nAlasan: ${err?.message || 'tidak diketahui'}`);
        }

        try { await m.react('✅'); } catch { /* opsional */ }
        return m.reply(
            `${config.botName}\n\nFoto welcome disimpan.\nMode otomatis diubah ke "foto" dan welcome diaktifkan.\n\nCoba: ${p}testwelcome`
        );
    }

    return m.reply(statusText(m, getConfig(m.chat)));
};

handler.command = ['setwelcome', 'welcome', 'testwelcome'];
handler.help = ['setwelcome', 'testwelcome'];
handler.tags = ['group'];
handler.isGroup = true;

export default handler;

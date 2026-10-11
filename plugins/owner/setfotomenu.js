/**
 * plugins/owner/setfotomenu.js : NIWO BOT
 * -------------------------------------------------------------------------
 *   .setfotomenu            ganti foto MENU UTAMA (kirim/reply foto)
 *   .setfotomenu game       ganti foto kategori tertentu
 *   .resetfotomenu [nama]   hapus foto, balik ke foto bawaan
 *   .cekfotomenu            lihat foto menu yang sedang dipakai
 *
 * Foto disimpan ke folder asset yang sudah dipakai source
 * (src/media/menu/<nama>.png) : bukan sistem penyimpanan kedua.
 *
 * Karena getMenuImage() memvalidasi cache lewat mtime file, foto baru
 * LANGSUNG dipakai di .menu tanpa restart, dan penggantian berikutnya
 * juga otomatis memakai foto terbaru.
 * -------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import config from '../../src/config.js';
import assetsDefault from '../../src/utils/assets.js';
import profileSyncDefault from '../../src/utils/profileSync.js';

const { syncBotProfileFromMenuImage } = profileSyncDefault;

const { getMenuImage, getMenuImagePath, clearCache, MENU_IMG_DIR } = assetsDefault;

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

/** Nama file aman: huruf/angka/dash saja. */
function safeName(raw) {
    const n = String(raw || 'logo').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    return n || 'logo';
}

/** Hapus semua varian ekstensi untuk satu nama, supaya tidak ada foto ganda. */
function removeExisting(name) {
    let removed = 0;
    for (const ext of IMG_EXT) {
        const p = path.join(MENU_IMG_DIR, `${name}${ext}`);
        if (fs.existsSync(p)) {
            try { fs.unlinkSync(p); removed++; } catch { /* diabaikan */ }
        }
    }
    return removed;
}

const handler = async (m, { conn, args, command }) => {
    const p = config.prefix;
    const cmd = String(command || '').toLowerCase();
    const name = safeName(args[0] || 'logo');

    /* ------------------------- CEK ------------------------- */
    if (cmd === 'cekfotomenu') {
        const file = getMenuImagePath(name);
        const img = getMenuImage(name);
        const info =
            `${config.botName}\n\n` +
            `FOTO MENU: ${name}\n` +
            `File   : ${file ? path.basename(file) : '(tidak ada, pakai fallback)'}\n` +
            `Sumber : ${file ? path.dirname(file) : '-'}`;

        if (img) return conn.sendMessage(m.chat, { image: img, caption: info }, { quoted: m.raw || m });
        return m.reply(info);
    }

    /* ------------------------ RESET ------------------------ */
    if (cmd === 'resetfotomenu' || cmd === 'hapusfotomenu') {
        const removed = removeExisting(name);
        clearCache();
        return m.reply(
            removed
                ? `${config.botName}\n\nFoto menu "${name}" dihapus.\nMenu kembali memakai foto bawaan.`
                : `${config.botName}\n\nTidak ada foto khusus untuk "${name}".`
        );
    }

    /* ------------------------- SET ------------------------- */
    // Foto boleh dikirim langsung dengan caption, atau di-reply.
    const quoted = m.quoted && m.quoted.message ? m.quoted : null;
    const hasOwnImage = !!m.message?.imageMessage;
    const hasQuotedImage = !!(quoted?.message?.imageMessage);

    if (!hasOwnImage && !hasQuotedImage) {
        return m.reply(
            `${config.botName}\n\n` +
            `Kirim fotonya dengan caption ${p}${cmd}, atau reply foto dengan ${p}${cmd}.\n\n` +
            `${p}setfotomenu          ganti foto menu utama\n` +
            `${p}setfotomenu game     ganti foto kategori game\n` +
            `${p}resetfotomenu        balik ke foto bawaan\n` +
            `${p}cekfotomenu          lihat foto sekarang`
        );
    }

    let buffer = null;
    try {
        buffer = hasOwnImage ? await m.download() : await quoted.download();
    } catch (err) {
        return m.reply(`Gagal mengunduh foto.\n\nAlasan: ${err?.message || 'tidak diketahui'}`);
    }

    if (!buffer || !buffer.length) return m.reply('Foto kosong atau gagal diunduh.');
    if (buffer.length > 8 * 1024 * 1024) return m.reply('Foto terlalu besar. Maksimal 8 MB.');

    try {
        fs.mkdirSync(MENU_IMG_DIR, { recursive: true });
        removeExisting(name);
        fs.writeFileSync(path.join(MENU_IMG_DIR, `${name}.png`), buffer);
        clearCache();
    } catch (err) {
        return m.reply(`Gagal menyimpan foto.\n\nAlasan: ${err?.message || 'tidak diketahui'}`);
    }

    try { await m.react('✅'); } catch { /* opsional */ }

    // "logo" = foto menu UTAMA (dipakai .menu). Ini satu-satunya sumber
    // foto profil bot juga : begitu foto ini diganti, foto profil bot
    // langsung ikut disinkronkan (tanpa perlu command terpisah, dan tanpa
    // pernah merusak koneksi bot kalau gagal).
    let profileNote = '';
    if (name === 'logo') {
        try { fs.writeFileSync(path.join(path.dirname(MENU_IMG_DIR), 'logo.png'), buffer); } catch { /* opsional */ }
        const result = await syncBotProfileFromMenuImage(conn, { buffer, force: true });
        if (result.updated) profileNote = '\nFoto profil bot ikut diperbarui otomatis.';
    }

    const preview = getMenuImage(name);
    const caption =
        `${config.botName}\n\n` +
        `Foto menu "${name}" berhasil diganti.\n` +
        `Foto ini langsung dipakai di ${p}menu, tanpa perlu restart.` +
        profileNote;

    if (preview) return conn.sendMessage(m.chat, { image: preview, caption }, { quoted: m.raw || m });
    return m.reply(caption);
};

handler.command = ['setfotomenu', 'setmenuimage', 'resetfotomenu', 'hapusfotomenu', 'cekfotomenu'];
handler.help = ['setfotomenu', 'resetfotomenu', 'cekfotomenu'];
handler.tags = ['owner'];
handler.isOwner = true;

export default handler;

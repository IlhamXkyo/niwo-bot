/**
 * src/lib/buttonState.js : NIWO BOT
 * -------------------------------------------------------------------------
 * Status global tombol (button) menu.
 *
 *  • Default  : AKTIF  (menu utama tampil dengan tombol/native flow)
 *  • .offbutton   -> semua navigasi menu jadi mode TEKS
 *  • .aktifbutton -> kembali ke mode tombol
 *
 * Statusnya DISIMPAN PERMANEN lewat sistem settings NIWO BOT yang sudah ada
 * (src/lib/database.js -> database/settings.json), jadi setelah bot
 * restart status terakhir tetap dipertahankan. Tidak ada database baru
 * yang dibuat khusus untuk ini.
 *
 * Yang dimatikan HANYA tampilan/navigasi tombol. Seluruh fitur bot lain
 * tetap berjalan normal.
 * -------------------------------------------------------------------------
 */

import { getDatabase } from './database.js';

const KEY = 'menuButtonEnabled';

/** Status tombol saat ini. Default true (aktif) kalau belum pernah diatur. */
export function isButtonEnabled() {
    try {
        const db = getDatabase();
        const val = db.setting(KEY);
        if (val === undefined || val === null) return true;
        return val !== false && val !== 'false' && val !== 0;
    } catch {
        return true; // kalau database bermasalah, jangan sampai menu ikut mati
    }
}

/** Set status tombol, langsung tersimpan ke settings. */
export function setButtonEnabled(enabled) {
    const value = !!enabled;
    try {
        const db = getDatabase();
        db.setting(KEY, value);
    } catch { /* penyimpanan gagal: status tetap dipakai untuk sesi ini */ }
    global.__niwoButton = value;
    return value;
}

/** 'AKTIF' / 'NONAKTIF' : dipakai di baris "Button :" pada menu. */
export function buttonStatusText() {
    return isButtonEnabled() ? 'AKTIF' : 'NONAKTIF';
}

export default { isButtonEnabled, setButtonEnabled, buttonStatusText };

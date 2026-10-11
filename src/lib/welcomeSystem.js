/**
 * src/lib/welcomeSystem.js : NIWO BOT
 * -------------------------------------------------------------------------
 * Sistem welcome grup.
 *
 * Konfigurasi disimpan per grup lewat database NIWO BOT yang sudah ada
 * (db.getGroup / db.setGroup) : bukan database kedua.
 *
 * Bentuk konfigurasi yang disimpan di group:
 *   welcome      : boolean        aktif / tidak
 *   welcomeMode  : 'text' | 'mention' | 'foto'
 *   welcomeText  : string         template, boleh pakai placeholder
 *   welcomeImage : string         nama file di database/welcome/
 *
 * Placeholder yang didukung: @user @group @desc @count
 * -------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';
import { getDatabase } from './database.js';

export const WELCOME_DIR = path.join(process.cwd(), 'database', 'welcome');

export const DEFAULT_TEXT = 'WELCOME\n\nHalo @user 👋\nSelamat datang di @group.';
export const MODES = ['text', 'mention', 'foto'];

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                         */
/* ------------------------------------------------------------------ */

export function getConfig(groupJid) {
    const g = getDatabase().getGroup(groupJid) || {};
    return {
        enabled: !!g.welcome,
        mode: MODES.includes(g.welcomeMode) ? g.welcomeMode : 'mention',
        text: typeof g.welcomeText === 'string' && g.welcomeText.trim() ? g.welcomeText : DEFAULT_TEXT,
        image: typeof g.welcomeImage === 'string' ? g.welcomeImage : null,
    };
}

export function setConfig(groupJid, patch) {
    getDatabase().setGroup(groupJid, patch);
    return getConfig(groupJid);
}

/* ------------------------------------------------------------------ */
/* Foto welcome                                                        */
/* ------------------------------------------------------------------ */

/** Simpan foto welcome khusus grup. Mengembalikan nama filenya. */
export function saveImage(groupJid, buffer) {
    fs.mkdirSync(WELCOME_DIR, { recursive: true });
    const name = `${String(groupJid).replace(/[^0-9a-zA-Z]/g, '_')}.png`;
    fs.writeFileSync(path.join(WELCOME_DIR, name), buffer);
    setConfig(groupJid, { welcomeImage: name });
    return name;
}

export function removeImage(groupJid) {
    const cfg = getConfig(groupJid);
    if (cfg.image) {
        try { fs.unlinkSync(path.join(WELCOME_DIR, cfg.image)); } catch { /* sudah tidak ada */ }
    }
    setConfig(groupJid, { welcomeImage: null });
}

/**
 * Buffer foto welcome untuk grup.
 * Urutan: foto khusus grup -> foto bawaan NIWO BOT -> null (kirim teks saja).
 * Dibaca ulang setiap kali, jadi foto baru langsung dipakai.
 */
export function getImage(groupJid) {
    const cfg = getConfig(groupJid);

    if (cfg.image) {
        const p = path.join(WELCOME_DIR, cfg.image);
        try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch { /* lanjut ke fallback */ }
    }

    // Fallback: foto bawaan NIWO BOT (src/media/menu/welcome.png, lalu logo).
    try {
        // require dipakai karena assets.js formatnya CommonJS
        const { createRequire } = require('module');
        const req = createRequire(import.meta.url);
        const assets = req('../utils/assets.js');
        return assets.getMenuImage('welcome') || assets.getMenuImage('logo');
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

/** Ganti placeholder. @user sengaja jadi @62xxx supaya bisa benar-benar ditag. */
export function renderText(template, { userJid, groupName, groupDesc, count }) {
    const num = String(userJid || '').split('@')[0];
    return String(template || DEFAULT_TEXT)
        .replace(/@user/g, `@${num}`)
        .replace(/@group/g, groupName || 'grup ini')
        .replace(/@desc/g, groupDesc || '-')
        .replace(/@count/g, String(count ?? '-'));
}

/**
 * Kirim welcome untuk satu member baru.
 * Tidak pernah melempar error ke pemanggil : kegagalan welcome tidak boleh
 * membuat bot crash atau mengganggu event grup lainnya.
 */
export async function sendWelcome(conn, groupJid, userJid, metadata = null) {
    try {
        const cfg = getConfig(groupJid);
        if (!cfg.enabled) return false;

        let meta = metadata;
        if (!meta) {
            try { meta = await conn.groupMetadata(groupJid); } catch { meta = null; }
        }

        const text = renderText(cfg.text, {
            userJid,
            groupName: meta?.subject,
            groupDesc: meta?.desc,
            count: meta?.participants?.length,
        });

        const mentions = [userJid];

        if (cfg.mode === 'foto') {
            const img = getImage(groupJid);
            if (img) {
                await conn.sendMessage(groupJid, { image: img, caption: text, mentions });
                return true;
            }
            // Tidak ada foto sama sekali -> jangan diam, kirim teksnya saja.
        }

        if (cfg.mode === 'text') {
            // Mode teks biasa: tanpa tag.
            await conn.sendMessage(groupJid, { text: text.replace(/@\d+/g, 'kamu') });
            return true;
        }

        await conn.sendMessage(groupJid, { text, mentions });
        return true;
    } catch (err) {
        console.error('[WELCOME]', err?.message || err);
        return false;
    }
}

export default {
    getConfig, setConfig, saveImage, removeImage, getImage,
    renderText, sendWelcome, DEFAULT_TEXT, MODES, WELCOME_DIR,
};

/**
 * src/lib/resellerStore.js : NIWO BOT
 * -------------------------------------------------------------------------
 * Daftar GRUP RESELLER panel. Grup yang terdaftar di sini boleh memakai
 * command pembuatan panel (.1gbv2 ... .unliv2) walaupun membernya bukan
 * owner/reseller perorangan.
 *
 * Disimpan di  database/cpanel/grupreseller.json  : mengikuti folder
 * database panel yang sudah dipakai source (database/cpanel/roles.json,
 * gcseller_v*.json), bukan database baru.
 *
 * Bentuk data:
 *   { "v1": ["1203xxxx@g.us"], "v2": [...], ... }
 * -------------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';

export const VALID_SERVERS = ['v1', 'v2', 'v3', 'v4', 'v5'];

const CPANEL_DIR = path.join(process.cwd(), 'database', 'cpanel');
const FILE = path.join(CPANEL_DIR, 'grupreseller.json');

function emptyData() {
    return Object.fromEntries(VALID_SERVERS.map(v => [v, []]));
}

function read() {
    try {
        if (!fs.existsSync(FILE)) return emptyData();
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        const out = emptyData();
        for (const v of VALID_SERVERS) {
            if (Array.isArray(data[v])) out[v] = data[v].filter(x => typeof x === 'string' && x.endsWith('@g.us'));
        }
        return out;
    } catch {
        return emptyData();
    }
}

function write(data) {
    fs.mkdirSync(CPANEL_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

const norm = (v) => String(v || '').toLowerCase();

/** Semua grup reseller untuk satu server. */
export function listResellerGroups(server) {
    return read()[norm(server)] || [];
}

/** Apakah chat ini grup reseller untuk server tertentu. */
export function isResellerGroup(chatJid, server) {
    if (!chatJid || !String(chatJid).endsWith('@g.us')) return false;
    return listResellerGroups(server).includes(chatJid);
}

/** Server mana saja yang bisa diakses dari grup ini. */
export function resellerServersOf(chatJid) {
    if (!chatJid || !String(chatJid).endsWith('@g.us')) return [];
    const data = read();
    return VALID_SERVERS.filter(v => (data[v] || []).includes(chatJid));
}

/** Tambah grup. Menolak duplicate. */
export function addResellerGroup(chatJid, server) {
    const v = norm(server);
    if (!VALID_SERVERS.includes(v)) return { success: false, error: 'Server tidak valid.' };
    if (!String(chatJid).endsWith('@g.us')) return { success: false, error: 'Hanya bisa dipakai di dalam grup.' };

    const data = read();
    if (data[v].includes(chatJid)) return { success: false, error: 'Grup ini sudah terdaftar.' };

    data[v].push(chatJid);
    write(data);
    return { success: true, total: data[v].length };
}

/** Hapus satu grup berdasarkan JID. */
export function removeResellerGroup(chatJid, server) {
    const v = norm(server);
    const data = read();
    if (!data[v]?.includes(chatJid)) return { success: false, error: 'Grup ini tidak terdaftar.' };

    data[v] = data[v].filter(x => x !== chatJid);
    write(data);
    return { success: true, removed: chatJid, total: data[v].length };
}

/** Hapus berdasarkan nomor urut di daftar (1-based). */
export function removeResellerGroupByIndex(index, server) {
    const v = norm(server);
    const data = read();
    const list = data[v] || [];
    const i = Number(index) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= list.length) {
        return { success: false, error: `Nomor tidak valid. Tersedia 1 - ${list.length || 0}.` };
    }
    const [removed] = list.splice(i, 1);
    data[v] = list;
    write(data);
    return { success: true, removed, total: list.length };
}

/** Kosongkan seluruh daftar satu server. */
export function clearResellerGroups(server) {
    const v = norm(server);
    const data = read();
    const count = (data[v] || []).length;
    data[v] = [];
    write(data);
    return { success: true, removed: count };
}

export default {
    VALID_SERVERS,
    listResellerGroups,
    isResellerGroup,
    resellerServersOf,
    addResellerGroup,
    removeResellerGroup,
    removeResellerGroupByIndex,
    clearResellerGroups,
};

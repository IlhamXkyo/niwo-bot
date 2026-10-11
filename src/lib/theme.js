/**
 * src/lib/theme.js : NIWO BOT  ❄️
 * -------------------------------------------------------------------------
 * Tema tampilan bersama (teks menu, .sc, .info, dll) supaya semua pesan
 * bot punya gaya yang sama: salju / es.
 *
 * Mau ganti gaya? Cukup ubah TEMA di bawah : semua menu ikut berubah.
 * -------------------------------------------------------------------------
 */

export const TEMA = {
    flake: '⚡',
    dot: '•',
    top: '╭───',
    mid: '│',
    bot: '╰────────────────────────',
    line: '────────────────────────',
};

export function smallCaps(str = '') {
    return String(str || '').toUpperCase();
}

/** Judul bot berbingkai clean. */
export function brandHeader(botName) {
    return `⚡ ━━━ *${String(botName || 'NIWO BOT').toUpperCase()}* ━━━ ⚡`;
}

/** Kotak ber-title rapi dan elegan. */
export function box(title, lines = []) {
    return [
        `${TEMA.top}「 *${title}* 」`,
        ...lines.map((l) => `${TEMA.mid} ${l}`),
        TEMA.bot,
    ].join('\n');
}

/** Baris daftar dengan bullet bersih. */
export const item = (text) => `${TEMA.dot} ${text}`;

/** Salam sesuai jam WIB. */
export function greeting(now = new Date()) {
    let h = 12;
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Jakarta',
        }).formatToParts(now);
        h = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
    } catch { /* pakai default */ }
    if (h >= 4 && h < 11) return 'Selamat pagi';
    if (h >= 11 && h < 15) return 'Selamat siang';
    if (h >= 15 && h < 18) return 'Selamat sore';
    return 'Selamat malam';
}

/** "Senin, 21 September 2026 • 21.30 WIB" */
export function waktuWIB(now = new Date()) {
    try {
        const tgl = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
        }).format(now);
        const jam = new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta',
        }).format(now).replace(':', '.');
        return `${tgl} • ${jam} WIB`;
    } catch {
        return now.toISOString();
    }
}

export default { TEMA, smallCaps, brandHeader, box, item, greeting, waktuWIB };

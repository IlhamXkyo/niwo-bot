/**
 * src/utils/profileSync.js : NIWO BOT
 * -------------------------------------------------------------------------
 * SATU sumber foto untuk menu DAN foto profil bot.
 *
 * Sumber utama : src/media/menu/logo.png  (fallback: src/media/logo.png)
 * Ini persis foto yang sama dipakai `.menu` (imageKey: 'logo') lewat
 * assets.js -> getMenuImage('logo'). TIDAK ADA salinan/konfigurasi kedua
 * (tidak ada menuImage1/menuImage2/profileImageOld/New) : kalau foto ini
 * diganti (lewat .setfotomenu ATAU langsung timpa file), foto profil bot
 * ikut berubah otomatis mengikuti isi file yang sama.
 *
 * Foto profil TIDAK diperbarui di setiap pesan : hanya ketika isinya
 * benar-benar berubah (dicek lewat hash file, disimpan di
 * src/database/profile-sync.json). Kalau update gagal (mis. rate limit
 * WhatsApp, method tidak tersedia, dsb), fungsi ini diam-diam gagal dan
 * TIDAK PERNAH melempar error yang bisa merusak koneksi bot.
 * -------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', 'media');
const MENU_IMG_DIR = path.join(MEDIA_DIR, 'menu');
const STATE_FILE = path.join(__dirname, '..', 'database', 'profile-sync.json');

/** Path tunggal foto menu utama yang juga dipakai sebagai foto profil bot. */
function mainImagePath() {
    const primary = path.join(MENU_IMG_DIR, 'logo.png');
    if (fs.existsSync(primary)) return primary;
    const fallback = path.join(MEDIA_DIR, 'logo.png');
    if (fs.existsSync(fallback)) return fallback;
    return null;
}

function readState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

function writeState(state) {
    try {
        fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch { /* gagal simpan state tidak boleh mengganggu bot */ }
}

function hashBuffer(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex');
}

/**
 * Sinkronkan foto profil bot dengan foto menu utama, HANYA kalau isinya
 * berbeda dari terakhir kali disinkron (atau force = true).
 *
 * @param {object} conn  koneksi Baileys (harus punya updateProfilePicture)
 * @param {object} opts  { force?: boolean, buffer?: Buffer } : buffer opsional
 *                       kalau foto barunya sudah ada di memori (mis. dari
 *                       .setfotomenu), supaya tidak perlu baca file lagi.
 * @returns {Promise<{updated: boolean, reason?: string}>}
 */
async function syncBotProfileFromMenuImage(conn, opts = {}) {
    try {
        const buffer = opts.buffer || (mainImagePath() ? fs.readFileSync(mainImagePath()) : null);
        if (!buffer || !buffer.length) return { updated: false, reason: 'NO_IMAGE' };

        const hash = hashBuffer(buffer);
        const state = readState();

        if (!opts.force && state.lastHash === hash) {
            return { updated: false, reason: 'UNCHANGED' };
        }

        if (typeof conn?.updateProfilePicture !== 'function') {
            return { updated: false, reason: 'NO_METHOD' };
        }

        const botJid = conn?.user?.id;
        if (!botJid) return { updated: false, reason: 'NO_BOT_JID' };

        await conn.updateProfilePicture(botJid, buffer);

        state.lastHash = hash;
        state.updatedAt = Date.now();
        writeState(state);

        return { updated: true };
    } catch (err) {
        // Jangan pernah melempar : kegagalan update foto profil tidak boleh
        // merusak koneksi bot atau menghentikan proses start-up.
        return { updated: false, reason: err?.message || 'ERROR' };
    }
}

module.exports = { syncBotProfileFromMenuImage, mainImagePath };

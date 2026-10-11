/**
 * assets.js : pengatur FOTO tombol/menu dan AUDIO (VN).
 *
 * FOTO  : src/media/menu/<nama>.png     (tiap menu/tombol beda foto)
 *         src/media/logo.png            (foto menu utama)
 * AUDIO : src/media/audio/<nama>.(ogg|opus|mp3|m4a|wav)
 * VIDEO : src/media/video/menu.mp4  (GIF autoplay di atas .menu; lihat config.menuVideo)
 *
 * Tinggal timpa/tambah file di folder itu : kode otomatis membacanya,
 * tidak perlu mengubah source code lagi.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA_DIR = path.join(__dirname, '..', 'media');
const MENU_IMG_DIR = path.join(MEDIA_DIR, 'menu');
const AUDIO_DIR = path.join(MEDIA_DIR, 'audio');
const VIDEO_DIR = path.join(MEDIA_DIR, 'video');

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const AUDIO_EXT = ['.ogg', '.opus', '.mp3', '.m4a', '.wav'];

const imgCache = new Map();

function findFile(dir, name, exts) {
    if (!name) return null;
    for (const ext of exts) {
        const p = path.join(dir, `${name}${ext}`);
        if (fs.existsSync(p)) return p;
    }
    // kalau user simpan dengan ekstensi langsung di nama
    const direct = path.join(dir, name);
    if (fs.existsSync(direct)) return direct;
    return null;
}

/**
 * Ambil buffer foto untuk menu/tombol. Selalu mengembalikan foto (fallback logo).
 *
 * Cache-nya divalidasi lewat mtime + ukuran file: kalau owner mengganti
 * file fotonya, foto BARU langsung dipakai tanpa perlu restart bot.
 * Foto lama tidak pernah "nyangkut" di memori.
 */
function getMenuImage(name = 'menu') {
    const key = String(name).toLowerCase();

    let file = findFile(MENU_IMG_DIR, key, IMG_EXT);

    if (!file && key !== 'menu') file = findFile(MENU_IMG_DIR, 'tools', IMG_EXT);
    if (!file) file = findFile(MENU_IMG_DIR, 'menu', IMG_EXT);
    if (!file) {
        const logo = path.join(MEDIA_DIR, 'logo.png');
        if (fs.existsSync(logo)) file = logo;
    }
    if (!file) { imgCache.delete(key); return null; }

    let stamp = null;
    try {
        const st = fs.statSync(file);
        stamp = `${file}:${st.mtimeMs}:${st.size}`;
    } catch { stamp = null; }

    const hit = imgCache.get(key);
    if (hit && stamp && hit.stamp === stamp) return hit.buf;

    const buf = fs.readFileSync(file);
    imgCache.set(key, { stamp, buf, file });
    return buf;
}

/** Path file foto yang sedang dipakai untuk sebuah nama menu. */
function getMenuImagePath(name = 'menu') {
    const key = String(name).toLowerCase();
    let file = findFile(MENU_IMG_DIR, key, IMG_EXT);
    if (!file && key !== 'menu') file = findFile(MENU_IMG_DIR, 'tools', IMG_EXT);
    if (!file) file = findFile(MENU_IMG_DIR, 'menu', IMG_EXT);
    if (!file) {
        const logo = path.join(MEDIA_DIR, 'logo.png');
        if (fs.existsSync(logo)) file = logo;
    }
    return file;
}

/** Path file audio VN. null kalau belum ada filenya (pesan tetap terkirim). */
function getAudio(name = 'menu') {
    const key = String(name).toLowerCase();
    let file = findFile(AUDIO_DIR, key, AUDIO_EXT);
    if (!file) file = findFile(AUDIO_DIR, 'menu', AUDIO_EXT);
    return file;
}

/** Semua nama foto yang ada di folder menu (tanpa ekstensi) */
function poolNames() {
    if (!fs.existsSync(MENU_IMG_DIR)) return [];
    return fs.readdirSync(MENU_IMG_DIR)
        .filter(f => IMG_EXT.includes(path.extname(f).toLowerCase()))
        .map(f => path.basename(f, path.extname(f)))
        .sort();
}

/**
 * Foto untuk tombol APAPUN.
 * - kalau ada file dengan nama sama -> pakai itu
 * - kalau tidak ada -> dipilih otomatis dari koleksi foto,
 *   tapi TETAP KONSISTEN & BEDA-BEDA per nama command.
 */
function getImageAuto(key = 'button') {
    const name = String(key).toLowerCase();
    if (findFile(MENU_IMG_DIR, name, IMG_EXT)) return getMenuImage(name);

    const pool = poolNames().filter(n => !['logo', 'menu', 'allmenu'].includes(n));
    if (!pool.length) return getMenuImage('menu');

    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return getMenuImage(pool[hash % pool.length]);
}


/* ------------------------------------------------------------------ */
/* VIDEO MENU (GIF autoplay)                                            */
/* ------------------------------------------------------------------ */
// Urutan sumber:
//   1. src/media/video/menu.mp4        (file lokal, diutamakan)
//   2. src/media/video/menu-cache-<hash>.mp4  (hasil download url config)
//   3. download dari cfg.url -> disimpan ke (2)
// Semua kegagalan mengembalikan null : menu tidak boleh ikut gagal.

const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const RETRY_AFTER_FAIL_MS = 60 * 1000;

let videoMem = null;          // { file, stamp, buf }
let videoInflight = null;     // Promise download yang sedang jalan
let videoLastFail = { url: null, at: 0 };

function isMp4(buf) {
    return Buffer.isBuffer(buf) && buf.length > 2048 && buf.slice(4, 8).toString('latin1') === 'ftyp';
}

function readVideoFile(file) {
    let st;
    try { st = fs.statSync(file); } catch { return null; }
    const stamp = `${file}:${st.mtimeMs}:${st.size}`;
    if (videoMem && videoMem.stamp === stamp) return videoMem.buf;
    const buf = fs.readFileSync(file);
    if (!isMp4(buf)) return null;
    videoMem = { file, stamp, buf };
    return buf;
}

async function downloadVideo(url, dest) {
    const axios = require('axios');
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_VIDEO_BYTES,
        maxBodyLength: MAX_VIDEO_BYTES,
        headers: { 'User-Agent': 'Mozilla/5.0 (NIWO-BOT)' },
    });
    const buf = Buffer.from(res.data);
    if (!isMp4(buf)) throw new Error('respons bukan file mp4');
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
    const tmp = `${dest}.part`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, dest);
    return buf;
}

/**
 * Ambil buffer video menu. cfg = config.menuVideo ({ url, enabled }).
 * Return Buffer mp4, atau null kalau tidak tersedia.
 */
async function getMenuVideo(cfg = {}) {
    try {
        if (cfg.enabled === false) return null;

        const local = readVideoFile(path.join(VIDEO_DIR, 'menu.mp4'));
        if (local) return local;

        const url = cfg.url;
        if (!url || !/^https?:\/\//i.test(url)) return null;

        const hash = crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 10);
        const cacheFile = path.join(VIDEO_DIR, `menu-cache-${hash}.mp4`);

        const cached = readVideoFile(cacheFile);
        if (cached) return cached;

        if (videoLastFail.url === url && Date.now() - videoLastFail.at < RETRY_AFTER_FAIL_MS) return null;

        if (!videoInflight) {
            videoInflight = downloadVideo(url, cacheFile)
                .then((buf) => { videoMem = null; return buf; })
                .catch((err) => {
                    videoLastFail = { url, at: Date.now() };
                    console.log(`[MENU-VIDEO] gagal mengunduh video: ${err.message}`);
                    return null;
                })
                .finally(() => { videoInflight = null; });
        }
        return await videoInflight;
    } catch (err) {
        console.log(`[MENU-VIDEO] error: ${err.message}`);
        return null;
    }
}

/** Panaskan cache di background (dipanggil sekali saat plugin menu dimuat). */
function prefetchMenuVideo(cfg = {}) {
    getMenuVideo(cfg).catch(() => { });
}

/** Daftar foto yang tersedia (buat command .listasset) */
function listAssets() {
    const img = fs.existsSync(MENU_IMG_DIR) ? fs.readdirSync(MENU_IMG_DIR) : [];
    const aud = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR) : [];
    const vid = fs.existsSync(VIDEO_DIR) ? fs.readdirSync(VIDEO_DIR).filter(f => f.endsWith('.mp4')) : [];
    return { images: img, audios: aud, videos: vid, imageDir: MENU_IMG_DIR, audioDir: AUDIO_DIR, videoDir: VIDEO_DIR };
}

function clearCache() { imgCache.clear(); }

module.exports = { getMenuImage, getMenuImagePath, getImageAuto, poolNames, getAudio, getMenuVideo, prefetchMenuVideo, listAssets, clearCache, MEDIA_DIR, MENU_IMG_DIR, AUDIO_DIR, VIDEO_DIR };

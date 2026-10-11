/**
 * globals.js : menyiapkan semua variabel global yang dipakai oleh
 * plugin di folder /plugins (global.db, global.apikey, global.web, dll).
 *
 * Tanpa file ini hampir semua plugin akan error "Cannot read property of undefined".
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_DIR = path.join(__dirname, '..', 'database');
const DB_FILE = path.join(DB_DIR, 'database.json');

const defaultUser = () => ({
    exp: 0,
    coin: 100,
    limit: 50,
    level: 0,
    warn: 0,
    premium: false,
    banned: false,
    registered: false,
    name: '',
    age: 0,
    lastClaim: 0,
    afk: -1,
    afkReason: '',
});

const defaultChat = () => ({
    welcome: false,
    goodbye: false,
    antilink: false,
    antiKudeta: false,
    groupSecurity: false,
    mute: false,
    nsfw: false,
    expired: 0,
});

/** Proxy yang otomatis membuat entry baru saat diakses */
function autoObject(makeDefault) {
    const target = {};
    return new Proxy(target, {
        get(obj, prop) {
            if (typeof prop === 'symbol' || prop in obj) return obj[prop];
            if (['toJSON', 'inspect', 'then', 'constructor'].includes(prop)) return obj[prop];
            if (typeof prop === 'string' && prop.includes('@')) {
                obj[prop] = { ...makeDefault() };
                return obj[prop];
            }
            return obj[prop];
        },
        set(obj, prop, value) {
            obj[prop] = value;
            return true;
        },
    });
}

function loadRaw() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) || {};
        }
    } catch { /* file rusak -> mulai dari kosong */ }
    return {};
}

function initDatabase() {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

    const raw = loadRaw();

    const users = autoObject(defaultUser);
    const chats = autoObject(defaultChat);

    for (const [k, v] of Object.entries(raw.users || {})) users[k] = { ...defaultUser(), ...v };
    for (const [k, v] of Object.entries(raw.chats || {})) chats[k] = { ...defaultChat(), ...v };

    const db = {
        data: {
            users,
            chats,
            settings: raw.settings || {},
            game: raw.game || {},
            others: raw.others || {},
        },
        read() { return db.data; },
        write() {
            try {
                fs.writeFileSync(DB_FILE, JSON.stringify({
                    users: { ...db.data.users },
                    chats: { ...db.data.chats },
                    settings: db.data.settings,
                    game: db.data.game,
                    others: db.data.others,
                }, null, 2));
            } catch (e) {
                console.error('[DB] gagal menyimpan:', e.message);
            }
            return true;
        },
        save() { return db.write(); },
    };

    // auto-save tiap 60 detik
    setInterval(() => db.write(), 60 * 1000).unref?.();
    return db;
}

function initGlobals() {
    if (global.__NIWO_GLOBALS__) return;
    global.__NIWO_GLOBALS__ = true;

    global.db = initDatabase();

    global.web = config.apiBaseUrl;
    global.apikey = { jereapi: config.apikey, ...(config.apikeyExtra || {}) };
    global.apiKey = config.apikey;

    global.botname = config.botName;
    global.ownername = config.ownerName;
    global.owner = [].concat(config.superOwner, config.coOwner || []).filter(Boolean);
    global.premium = [];

    global.stickerPack = {
        packname: config.stickerPackname,
        author: config.stickerAuthor,
    };
    global.packname = config.stickerPackname;
    global.author = config.stickerAuthor;

    global.saluran = config.channelId;
    global.linkch = config.channelLink;
    global.thumbnail = config.channelLink;

    global.groupSecurity = global.groupSecurity || {};
    global.bbProcessing = global.bbProcessing || {};
    global.pg = global.pg || {};
    global.plugins = global.plugins || {};

    global.Func = global.Func || {
        Styles: (text, style = 1) => String(text),
        delay: (ms) => new Promise(r => setTimeout(r, ms)),
    };

    global.wait = '⏳ _Sedang diproses, mohon tunggu..._';
    global.eror = '❌ _Terjadi kesalahan pada server._';
    global.rwait = '⏳';
    global.done = '✅';
}

module.exports = { initGlobals, defaultUser, defaultChat };

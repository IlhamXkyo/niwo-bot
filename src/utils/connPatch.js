/**
 * connPatch.js : menambahkan method bantuan ke socket (conn) supaya
 * plugin-plugin di folder /plugins bisa jalan tanpa diubah isinya.
 *
 * conn.reply, conn.sendFile, conn.sendButton (SELALU pakai foto),
 * conn.sendVoiceNote (audio VN/ptt), conn.getName, conn.delay, conn.game, dst.
 */

const fs = require('fs');
const path = require('path');
const { sendInteractiveWithImage, sendInteractiveMessage } = require('./interactiveHelper');
const { getMenuImage, getAudio } = require('./assets');

function guessType(filename = '', mimetype = '') {
    const ext = String(filename).split('.').pop().toLowerCase();
    const mime = String(mimetype).toLowerCase();
    if (/image/.test(mime) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        return ext === 'webp' ? 'sticker' : 'image';
    }
    if (/video/.test(mime) || ['mp4', 'mkv', 'mov', '3gp'].includes(ext)) return 'video';
    if (/audio/.test(mime) || ['mp3', 'm4a', 'ogg', 'opus', 'wav'].includes(ext)) return 'audio';
    return 'document';
}

function toSource(data) {
    if (Buffer.isBuffer(data)) return data;
    if (typeof data === 'string') {
        if (/^https?:\/\//i.test(data)) return { url: data };
        if (fs.existsSync(data)) return fs.readFileSync(data);
        return { url: data };
    }
    return data;
}

function patchConn(Hanz) {
    if (!Hanz || Hanz.__niwoPatched) return Hanz;
    Hanz.__niwoPatched = true;

    Hanz.game = Hanz.game || {};
    Hanz.delay = (ms = 1000) => new Promise(r => setTimeout(r, ms));

    /** conn.reply(jid, text, quoted, options) */
    Hanz.reply = async (jid, text = '', quoted = null, options = {}) => {
        const payload = typeof text === 'string' ? { text } : text;
        return Hanz.sendMessage(jid, { ...payload, ...options }, quoted ? { quoted: quoted.raw || quoted.fakeObj || quoted } : {});
    };

    Hanz.sendText = (jid, text, quoted, options) => Hanz.reply(jid, text, quoted, options);

    /** conn.sendFile(jid, data, filename, caption, quoted, ptt, options) */
    Hanz.sendFile = async (jid, data, filename = '', caption = '', quoted = null, ptt = false, options = {}) => {
        const source = toSource(data);
        const type = guessType(filename, options.mimetype || '');
        let payload;

        if (type === 'image') payload = { image: source, caption };
        else if (type === 'video') payload = { video: source, caption, mimetype: 'video/mp4' };
        else if (type === 'audio') payload = { audio: source, mimetype: ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg', ptt: !!ptt };
        else if (type === 'sticker') payload = { sticker: source };
        else payload = { document: source, mimetype: options.mimetype || 'application/octet-stream', fileName: filename || 'file', caption };

        return Hanz.sendMessage(jid, { ...payload, ...options },
            quoted ? { quoted: quoted.raw || quoted.fakeObj || quoted } : {});
    };

    /** Kirim audio sebagai VOICE NOTE (VN / ptt), bukan file audio biasa */
    Hanz.sendVoiceNote = async (jid, source, quoted = null, options = {}) => {
        let audio = source;
        if (typeof source === 'string' && fs.existsSync(source)) audio = fs.readFileSync(source);
        else if (typeof source === 'string' && /^https?:\/\//.test(source)) audio = { url: source };
        if (!audio) return null;

        return Hanz.sendMessage(jid, {
            audio,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,               // <- ini yang bikin tampil seperti VN
            waveform: options.waveform,
            ...options,
        }, quoted ? { quoted: quoted.raw || quoted.fakeObj || quoted } : {});
    };

    /** Kirim VN berdasarkan nama file di src/media/audio */
    Hanz.sendAudioMenu = async (jid, name, quoted = null) => {
        const file = getAudio(name);
        if (!file) return null;
        return Hanz.sendVoiceNote(jid, file, quoted);
    };

    /**
     * conn.sendButton(jid, { text, title, footer, buttons, image }, { quoted })
     * SELALU menempelkan foto di header tombol (sesuai permintaan).
     */
    Hanz.sendButton = async (jid, content = {}, opts = {}) => {
        const { text = '', footer = '', buttons = [], image, category } = content;
        const imageSource = image || getMenuImage(category || 'button');

        const payload = {
            text,
            footer,
            buttons,
            quoted: opts.quoted?.raw || opts.quoted?.fakeObj || opts.quoted,
            contextInfo: content.contextInfo || {},
        };

        if (imageSource) {
            return sendInteractiveWithImage(Hanz, jid, { ...payload, imageSource });
        }
        return sendInteractiveMessage(Hanz, jid, payload);
    };

    /** conn.sendAlbum(jid, items, { quoted, delay }) : fallback kirim satu per satu */
    if (typeof Hanz.sendAlbum !== 'function') {
        Hanz.sendAlbum = async (jid, items = [], options = {}) => {
            const quoted = options.quoted?.raw || options.quoted;
            for (const it of items) {
                const media = it.image || it.video || it.url || it;
                const payload = it.video
                    ? { video: toSource(it.video), caption: it.caption || '' }
                    : { image: toSource(media), caption: it.caption || '' };
                await Hanz.sendMessage(jid, payload, quoted ? { quoted } : {});
                await Hanz.delay(options.delay || 400);
            }
        };
    }

    /** conn.getName(jid) */
    if (typeof Hanz.getName !== 'function') {
        Hanz.getName = async (jid) => {
            try {
                if (String(jid).endsWith('@g.us')) {
                    const meta = await Hanz.groupMetadata(jid);
                    return meta?.subject || jid.split('@')[0];
                }
                const store = Hanz.__nameCache || (Hanz.__nameCache = {});
                if (store[jid]) return store[jid];
                return jid.split('@')[0];
            } catch {
                return String(jid).split('@')[0];
            }
        };
    }

    /** conn.resize(buffer, w, h) : pakai sharp kalau ada */
    if (typeof Hanz.resize !== 'function') {
        Hanz.resize = async (buffer, width = 512, height = 512) => {
            try {
                const sharp = require('sharp');
                return await sharp(buffer).resize(width, height).toBuffer();
            } catch {
                return buffer;
            }
        };
    }

    /** conn.input : dipakai beberapa plugin form/interaktif */
    Hanz.input = Hanz.input || {};
    Hanz.alias = Hanz.alias || {};
    Hanz.autoshalat = Hanz.autoshalat || {};
    Hanz.chats = Hanz.chats || {};

    return Hanz;
}

module.exports = { patchConn };

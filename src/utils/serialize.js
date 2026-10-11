/**
 * serialize.js : mengubah raw message Baileys menjadi objek `m`
 * dengan API yang sama seperti bot berbasis plugin (m.chat, m.reply,
 * m.quoted.download(), m.react(), m.mentionedJid, dst).
 */

const {
    getContentType,
    downloadMediaMessage,
    jidNormalizedUser,
} = require('@itsliaaa/baileys');

/** Buang bungkus viewOnce / ephemeral / documentWithCaption */
function unwrap(message) {
    if (!message) return message;
    let msg = message;
    for (let i = 0; i < 5; i++) {
        const t = getContentType(msg);
        if (t === 'viewOnceMessage' || t === 'viewOnceMessageV2' || t === 'viewOnceMessageV2Extension') {
            msg = msg[t].message;
        } else if (t === 'ephemeralMessage') {
            msg = msg.ephemeralMessage.message;
        } else if (t === 'documentWithCaptionMessage') {
            msg = msg.documentWithCaptionMessage.message;
        } else break;
    }
    return msg;
}

function extractText(message) {
    if (!message) return '';
    const type = getContentType(message);
    const c = message[type];
    switch (type) {
        case 'conversation': return message.conversation || '';
        case 'extendedTextMessage': return c?.text || '';
        case 'imageMessage':
        case 'videoMessage':
        case 'documentMessage': return c?.caption || '';
        case 'buttonsResponseMessage': return c?.selectedButtonId || c?.selectedDisplayText || '';
        case 'listResponseMessage': return c?.singleSelectReply?.selectedRowId || c?.title || '';
        case 'templateButtonReplyMessage': return c?.selectedId || c?.selectedDisplayText || '';
        case 'interactiveResponseMessage': {
            try {
                const p = JSON.parse(c?.nativeFlowResponseMessage?.paramsJson || '{}');
                return p.id || p.display_text || '';
            } catch { return ''; }
        }
        default: return c?.text || c?.caption || '';
    }
}

function normJid(jid = '') {
    return String(jid).replace(/:\d+/, '').replace(/@.+$/, '');
}

function buildQuoted(Hanz, m, ctxInfo) {
    if (!ctxInfo?.quotedMessage) return null;

    const qmsg = unwrap(ctxInfo.quotedMessage);
    const mtype = getContentType(qmsg);
    const inner = qmsg?.[mtype];
    const participant = ctxInfo.participant || m.chat;

    const isFromBot = normJid(participant) === normJid(Hanz.user?.id || '') ||
                      (Hanz.user?.lid && normJid(participant) === normJid(Hanz.user.lid));

    const key = {
        remoteJid: ctxInfo.remoteJid || m.chat,
        fromMe: isFromBot,
        id: ctxInfo.stanzaId,
        participant,
    };

    const q = {
        key,
        id: ctxInfo.stanzaId,
        chat: key.remoteJid,
        sender: participant,
        fromMe: key.fromMe,
        isBaileys: String(ctxInfo.stanzaId || '').startsWith('BAE5') || String(ctxInfo.stanzaId || '').length === 16,
        mtype,
        message: qmsg,
        msg: typeof inner === 'object' ? inner : qmsg,
        mimetype: (typeof inner === 'object' && inner?.mimetype) || '',
        text: extractText(qmsg),
        body: extractText(qmsg),
        name: ctxInfo.pushName || '',
        mentionedJid: inner?.contextInfo?.mentionedJid || [],
        viewOnce: !!inner?.viewOnce,
        isAnimated: !!inner?.isAnimated,
    };

    q.fakeObj = { key, message: qmsg };

    q.download = async (asStream = false) => downloadMediaMessage(
        { key, message: qmsg },
        asStream ? 'stream' : 'buffer',
        {},
        { logger: Hanz.logger, reuploadRequest: Hanz.updateMediaMessage },
    );

    q.delete = () => Hanz.sendMessage(key.remoteJid, { delete: key });
    q.reply = (text, chatId, options) => Hanz.sendMessage(chatId || key.remoteJid,
        typeof text === 'string' ? { text } : text, { quoted: q.fakeObj, ...options });
    q.copyNForward = (jid, forceForward = true) =>
        Hanz.copyNForward(jid || key.remoteJid, q.fakeObj, forceForward);

    return q;
}

/**
 * @param {*} Hanz socket baileys
 * @param {*} msg raw message dari messages.upsert
 */
function serialize(Hanz, msg) {
    if (!msg) return msg;

    const m = {};
    m.key = msg.key;
    m.id = msg.key.id;
    m.chat = msg.key.remoteJid;
    m.isGroup = String(m.chat).endsWith('@g.us');
    m.fromMe = !!msg.key.fromMe;
    m.isBot = m.fromMe;

    const rawSender = m.fromMe
        ? (Hanz.user?.id || m.chat)
        : (m.isGroup ? (msg.key.participant || msg.participant) : m.chat);

    m.sender = jidNormalizedUser(rawSender || m.chat);
    m.senderAlt = msg.key.senderPn || msg.key.participantAlt || null;
    m._normSender = normJid(m.senderAlt || m.sender);
    m.senderNumber = m._normSender;
    m.to = m.chat;
    m.pushName = msg.pushName || 'User';
    m.name = m.pushName;
    m.messageTimestamp = msg.messageTimestamp;

    m.message = unwrap(msg.message);
    m.mtype = getContentType(m.message);
    m.type = m.mtype;
    const inner = m.message?.[m.mtype];
    m.msg = (typeof inner === 'object' && inner !== null) ? inner : m.message;
    m.mime = m.msg?.mimetype || '';
    m.mimetype = m.mime;
    m.extension = (m.mime.split('/')[1] || '').split(';')[0];

    m.body = extractText(m.message);
    m.text = m.body;
    m.args = m.body.trim().split(/\s+/).slice(1);

    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
    m.isMedia = /image|video|audio|sticker|document/.test(m.mtype || '');
    m.isImage = m.mtype === 'imageMessage';
    m.isVideo = m.mtype === 'videoMessage';
    m.isAudio = m.mtype === 'audioMessage';
    m.isDocument = m.mtype === 'documentMessage';
    m.isSticker = m.mtype === 'stickerMessage';
    m.isGif = m.isVideo && !!m.msg?.gifPlayback;

    m.quoted = buildQuoted(Hanz, m, m.msg?.contextInfo);
    m.isQuoted = !!m.quoted;
    if (m.quoted) {
        m.quoted.isImage = m.quoted.mtype === 'imageMessage';
        m.quoted.isVideo = m.quoted.mtype === 'videoMessage';
        m.quoted.isAudio = m.quoted.mtype === 'audioMessage';
        m.quoted.isDocument = m.quoted.mtype === 'documentMessage';
        m.quoted.isSticker = m.quoted.mtype === 'stickerMessage';
    }

    m.reply = async (content, options = {}) => {
        let payload;
        if (typeof content === 'string') payload = { text: content };
        else if (Buffer.isBuffer(content)) payload = { image: content };
        else payload = content;
        return Hanz.sendMessage(m.chat, payload, { quoted: msg, ...options });
    };

    m.replyS = m.reply;

    // Shortcut kirim media : dipakai banyak plugin lama (m.replyImage(buf/url, caption)).
    const replyMedia = (key) => async (content, caption = '', options = {}) => {
        const payload = typeof content === 'string' && /^https?:\/\//.test(content)
            ? { [key]: { url: content }, caption, ...options }
            : { [key]: content, caption, ...options };
        return Hanz.sendMessage(m.chat, payload, { quoted: msg });
    };
    m.replyImage = replyMedia('image');
    m.replyVideo = replyMedia('video');
    m.replyAudio = async (content, options = {}) => Hanz.sendMessage(
        m.chat, { audio: typeof content === 'string' && /^https?:\/\//.test(content) ? { url: content } : content, mimetype: 'audio/mp4', ...options },
        { quoted: msg },
    );
    m.replyDocument = async (content, filename = 'file', mimetype = 'application/octet-stream', options = {}) =>
        Hanz.sendMessage(m.chat, { document: typeof content === 'string' && /^https?:\/\//.test(content) ? { url: content } : content, fileName: filename, mimetype, ...options }, { quoted: msg });
    m.replySticker = async (content, options = {}) => Hanz.sendMessage(
        m.chat, { sticker: typeof content === 'string' && /^https?:\/\//.test(content) ? { url: content } : content, ...options },
        { quoted: msg },
    );

    // Ambil buffer media dari quoted message, atau dari pesan itu sendiri
    // kalau tidak ada quoted : dipakai plugin yang butuh gambar/video input.
    m.resolveMediaTarget = async (asStream = false) => {
        if (m.quoted && m.quoted.download) return m.quoted.download(asStream);
        if (m.isMedia) return m.download(asStream);
        return null;
    };

    m.react = async (emoji) => {
        try { return await Hanz.sendMessage(m.chat, { react: { text: emoji, key: m.key } }); }
        catch { return null; }
    };

    m.download = async (asStream = false) => downloadMediaMessage(
        msg,
        asStream ? 'stream' : 'buffer',
        {},
        { logger: Hanz.logger, reuploadRequest: Hanz.updateMediaMessage },
    );

    m.delete = () => Hanz.sendMessage(m.chat, { delete: m.key });
    m.copy = () => msg;
    m.raw = msg;

    return m;
}

module.exports = { serialize, extractText, unwrap, normJid };

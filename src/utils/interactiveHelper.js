const { generateWAMessageFromContent, proto, isJidGroup } = require('@itsliaaa/baileys');
const { getImageAuto } = require('./assets');

/**
 * SEMUA tombol wajib ada fotonya.
 * Kalau pemanggil tidak mengirim imageSource, foto dipilih otomatis
 * (beda-beda tergantung nama command/menu-nya).
 */
function autoImage(content = {}) {
    if (content.imageSource) return content.imageSource;
    if (content.image) return content.image;
    try { return getImageAuto(content.imageKey || content.category || 'button'); }
    catch { return null; }
}

function buildInteractiveNodes(buttonType = 'mixed') {
    return [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: buttonType } }]
        }]
    }];
}

function buildContextInfo(quoted, extra = {}) {
    const base = {};

    if (quoted) {
        try {
            const { key } = quoted;
            base.stanzaId      = key.id;
            base.participant   = key.participant || key.remoteJid;
            base.quotedMessage = quoted.message;
        } catch { /* skip */ }
    }

    const merged = { ...base, ...extra };
    return Object.keys(merged).length ? merged : null;
}

function buildMessage(jid, interactiveMsg) {
    return generateWAMessageFromContent(jid, proto.Message.fromObject({
        viewOnceMessage: {
            message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: interactiveMsg,
            }
        }
    }), { userJid: jid });
}

async function relayInteractive(Hanz, jid, message, buttonType) {
    const additionalNodes = buildInteractiveNodes(buttonType);
    if (!isJidGroup(jid)) additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    return Hanz.relayMessage(jid, message.message, { messageId: message.key.id, additionalNodes });
}

async function sendButtons(Hanz, jid, content) {
    const { text, footer = '', buttons = [], quoted, contextInfo: extra = {} } = content;

    // selalu tampil dengan foto
    const img = autoImage(content);
    if (img) {
        return sendInteractiveWithImage(Hanz, jid, {
            text, footer, quoted, contextInfo: extra,
            imageSource: img,
            buttons: buttons.map(btn => (btn.name ? btn : {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id }),
            })),
        });
    }

    const contextInfo = buildContextInfo(quoted, extra);

    const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
        body: { text },
        footer: { text: footer },
        header: { hasMediaAttachment: false },
        nativeFlowMessage: {
            buttons: buttons.map(btn => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id })
            })),
            messageParamsJson: ''
        },
        ...(contextInfo ? { contextInfo } : {})
    });

    return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'quick_reply');
}

async function sendListMessage(Hanz, jid, content) {
    const { text, footer = '', buttonTitle = '📂 Pilih', sections = [], quoted, contextInfo: extra = {} } = content;

    const imgList = autoImage(content);
    if (imgList) {
        return sendInteractiveWithImage(Hanz, jid, {
            text, footer, quoted, contextInfo: extra,
            imageSource: imgList,
            buttons: [{
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: buttonTitle,
                    sections: sections.map(sec => ({
                        title: sec.title,
                        rows: sec.rows.map(row => ({
                            header: row.title, title: row.title,
                            description: row.description || '', id: row.id,
                        })),
                    })),
                }),
            }],
        });
    }

    const contextInfo = buildContextInfo(quoted, extra);

    const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
        body: { text },
        footer: { text: footer },
        header: { hasMediaAttachment: false },
        nativeFlowMessage: {
            buttons: [{
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: buttonTitle,
                    sections: sections.map(sec => ({
                        title: sec.title,
                        rows: sec.rows.map(row => ({
                            header: row.title,
                            title: row.title,
                            description: row.description || '',
                            id: row.id
                        }))
                    }))
                })
            }],
            messageParamsJson: ''
        },
        ...(contextInfo ? { contextInfo } : {})
    });

    return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'single_select');
}

async function sendInteractiveMessage(Hanz, jid, content) {
    const { text, footer = '', buttons = [], quoted, contextInfo: extra = {} } = content;

    const imgInt = autoImage(content);
    if (imgInt && !content.__noImage) {
        return sendInteractiveWithImage(Hanz, jid, {
            text, footer, buttons, quoted, contextInfo: extra, imageSource: imgInt,
        });
    }

    const contextInfo = buildContextInfo(quoted, extra);

    const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
        body: { text },
        footer: { text: footer },
        header: { hasMediaAttachment: false },
        nativeFlowMessage: { buttons, messageParamsJson: '' },
        ...(contextInfo ? { contextInfo } : {})
    });

    return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'mixed');
}

async function sendButtonWithImage(Hanz, jid, content) {
    const { text, footer = '', buttons = [], imageUrl, quoted, contextInfo: extra = {} } = content;
    const contextInfo = buildContextInfo(quoted, extra);

    try {
        const axios = require('axios');
        const { prepareWAMessageMedia } = require('@itsliaaa/baileys');

        const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const media = await prepareWAMessageMedia({ image: Buffer.from(data) }, { upload: Hanz.waUploadToServer });

        const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
            body: { text },
            footer: { text: footer },
            header: { hasMediaAttachment: true, ...media },
            nativeFlowMessage: {
                buttons: buttons.map(btn => ({
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id })
                })),
                messageParamsJson: ''
            },
            ...(contextInfo ? { contextInfo } : {})
        });

        return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'quick_reply');
    } catch (err) {
        console.error('Error button with image, fallback ke sendButtons:', err.message);
        return sendInteractiveMessage(Hanz, jid, {
            text, footer, quoted, __noImage: true,
            buttons: buttons.map(btn => (btn.name ? btn : {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id }),
            })),
        });
    }
}

async function sendInteractiveWithImage(Hanz, jid, content) {
    const { text, footer = '', buttons = [], imageSource, quoted, contextInfo: extra = {} } = content;
    const contextInfo = buildContextInfo(quoted, extra);

    try {
        const { prepareWAMessageMedia } = require('@itsliaaa/baileys');

        let mediaInput;
        if (Buffer.isBuffer(imageSource)) {
            mediaInput = { image: imageSource };
        } else if (imageSource?.url) {
            const axios = require('axios');
            const { data } = await axios.get(imageSource.url, { responseType: 'arraybuffer' });
            mediaInput = { image: Buffer.from(data) };
        } else {
            throw new Error('imageSource harus Buffer atau { url: "..." }');
        }

        const media = await prepareWAMessageMedia(mediaInput, { upload: Hanz.waUploadToServer });

        const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
            body: { text },
            footer: { text: footer },
            header: { hasMediaAttachment: true, ...media },
            nativeFlowMessage: { buttons, messageParamsJson: '' },
            ...(contextInfo ? { contextInfo } : {})
        });

        return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'mixed');
    } catch (err) {
        console.error('Error sendInteractiveWithImage, fallback ke sendInteractive:', err.message);
        return sendInteractiveMessage(Hanz, jid, { text, footer, buttons, quoted, __noImage: true });
    }
}

/** Perkecil foto jadi JPEG ringan untuk thumbnail (dipakai externalAdReply). */
async function toThumbnail(buf, size = 640) {
    if (!Buffer.isBuffer(buf)) return null;
    try {
        const sharp = require('sharp');
        return await sharp(buf).resize(size, size, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer();
    } catch {
        return buf.length <= 150 * 1024 ? buf : null;
    }
}

/**
 * Satu pesan: VIDEO (GIF autoplay) sebagai header + teks + tombol.
 * Foto (opsional) ditempel sebagai thumbnail besar lewat externalAdReply.
 *
 * Beda dengan sendInteractiveWithImage, fungsi ini MELEMPAR error kalau
 * gagal (tidak diam-diam turun ke teks polos), supaya pemanggil bisa
 * memilih fallback sendiri.
 */
async function sendInteractiveWithVideo(Hanz, jid, content) {
    const {
        text, footer = '', buttons = [], videoSource, thumbnail = null,
        adTitle = '', adBody = '', adUrl = '',
        gifPlayback = true, quoted, contextInfo: extra = {},
    } = content;

    if (!Buffer.isBuffer(videoSource)) throw new Error('videoSource harus Buffer mp4');

    const { prepareWAMessageMedia } = require('@itsliaaa/baileys');
    const media = await prepareWAMessageMedia(
        { video: videoSource, mimetype: 'video/mp4', gifPlayback: !!gifPlayback },
        { upload: Hanz.waUploadToServer },
    );
    if (!media || !media.videoMessage) throw new Error('gagal menyiapkan media video');

    const ctxExtra = { ...extra };
    const thumb = await toThumbnail(thumbnail);
    if (thumb) {
        ctxExtra.externalAdReply = {
            title: adTitle,
            body: adBody,
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: false,
            thumbnail: thumb,
            sourceUrl: adUrl || '',
        };
    }
    const contextInfo = buildContextInfo(quoted, ctxExtra);

    const interactiveMsg = proto.Message.InteractiveMessage.fromObject({
        body: { text },
        footer: { text: footer },
        header: { hasMediaAttachment: true, ...media },
        nativeFlowMessage: { buttons, messageParamsJson: '' },
        ...(contextInfo ? { contextInfo } : {}),
    });

    return relayInteractive(Hanz, jid, buildMessage(jid, interactiveMsg), 'mixed');
}

module.exports = { sendButtons, sendListMessage, sendInteractiveMessage, sendButtonWithImage, sendInteractiveWithImage, sendInteractiveWithVideo };
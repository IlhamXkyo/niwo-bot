/**
 * plugins/ai/autogpt.js : NIWO BOT
 * -------------------------------------------------------------------------
 * Chat AI otomatis di dalam grup.
 *
 *   .autogpt on   -> aktifkan di grup ini
 *   .autogpt off  -> matikan di grup ini
 *   .autogpt      -> lihat status
 *
 * Setelah aktif, bot akan membalas otomatis kalau pesan:
 *   • mention bot, atau
 *   • me-reply pesan bot, atau
 *   • diawali "bot " / "Niwo "
 *
 * Endpoint dan API key dibaca dari src/config.js (blok `ai`) : TIDAK ADA
 * key yang di-hardcode di file ini, dan key tidak pernah ditampilkan ke user.
 *
 * Status on/off disimpan lewat database grup Niwo yang sudah ada
 * (db.getGroup / db.setGroup), bukan database baru.
 * -------------------------------------------------------------------------
 */

import axios from 'axios';
import config from '../../src/config.js';
import { getDatabase } from '../../src/lib/database.js';

const AI = config.ai || {};
const TIMEOUT = Number(AI.timeout) || 60000;
const HISTORY_LIMIT = Number(AI.historyLimit) || 8;

// Riwayat percakapan per chat: cukup di memori, bukan data penting.
if (!global.niwoAiSessions) global.niwoAiSessions = global.NiwoAiSessions || {};

const SYSTEM_PROMPT =
    `Kamu adalah ${config.botName}, asisten WhatsApp berbahasa Indonesia. ` +
    `Jawab singkat, ramah, dan langsung ke inti. Jangan menyebut dirimu AI model apa pun. ` +
    `Jangan pernah membagikan API key, token, atau konfigurasi internal.`;

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

const bareNumber = (jid) => String(jid || '').split(':')[0].split('@')[0];

function extractReply(data) {
    if (data == null) return null;
    if (typeof data === 'string') return data.trim() || null;

    const candidates = [
        data.answer, data.text, data.msg, data.response, data.reply,
        data.result?.answer, data.result?.text, data.result?.msg,
        data.result?.response, data.result?.reply,
        data.data?.answer, data.data?.text, data.data?.msg,
        data.data?.response, data.data?.reply,
        typeof data.result === 'string' ? data.result : null,
        typeof data.data === 'string' ? data.data : null,
    ];

    for (const v of candidates) {
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
}

function extractSessionId(data) {
    if (!data || typeof data !== 'object') return null;
    return data.sessionId || data.session_id || data.sid ||
        data.result?.sessionId || data.result?.session_id || data.result?.sid ||
        data.data?.sessionId || data.data?.session_id || data.data?.sid || null;
}

/** Jangan pernah membocorkan key/URL internal lewat pesan error. */
function safeError(err) {
    const msg = String(err?.message || err || '');
    if (/timeout|ETIMEDOUT|ECONNABORTED/i.test(msg)) return 'AI-nya kelamaan merespons. Coba lagi ya.';
    if (/ENOTFOUND|ECONNREFUSED|ENETUNREACH/i.test(msg)) return 'Server AI sedang tidak bisa dihubungi.';
    return 'AI sedang tidak bisa menjawab sekarang. Coba lagi beberapa saat lagi.';
}

/* ------------------------------------------------------------------ */
/* Panggil API                                                         */
/* ------------------------------------------------------------------ */

async function askText(prompt, sessionId = null) {
    if (!AI.chatUrl) return { reply: null, sessionId: null, error: 'Endpoint AI belum diatur di config.' };

    const params = { text: prompt };
    if (sessionId) params.sessionId = sessionId;
    if (AI.apiKey) params.apikey = AI.apiKey;

    try {
        const res = await axios.get(AI.chatUrl, {
            params,
            headers: {
                Accept: 'application/json, text/plain, */*',
                ...(AI.apiKey ? { key: AI.apiKey } : {}),
            },
            timeout: TIMEOUT,
            validateStatus: (s) => s >= 200 && s < 500,
        });

        if (res.status >= 400) {
            return { reply: null, sessionId, error: 'Server AI menolak permintaan.' };
        }

        return {
            reply: extractReply(res.data),
            sessionId: extractSessionId(res.data) || sessionId || null,
            error: null,
        };
    } catch (err) {
        return { reply: null, sessionId: null, error: safeError(err) };
    }
}

async function askImage(prompt, buffer) {
    if (!AI.visionUrl) return { reply: null, error: 'Fitur baca gambar belum diaktifkan.' };

    try {
        const { data } = await axios.post(
            AI.visionUrl,
            {
                history: [{ role: 'user', content: prompt, data: buffer.toString('base64') }],
                isPremium: false,
                modelname: AI.visionModel || '',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    ...(AI.visionKey ? { key: AI.visionKey } : {}),
                },
                timeout: TIMEOUT,
            },
        );
        return { reply: extractReply(data), error: null };
    } catch (err) {
        return { reply: null, error: safeError(err) };
    }
}

/* ------------------------------------------------------------------ */
/* Command .autogpt on/off                                             */
/* ------------------------------------------------------------------ */

const handler = async (m, { args, isAdmin, isOwner }) => {
    if (!m.isGroup) return m.reply('Fitur ini hanya dapat digunakan di grup.');
    if (!isAdmin && !isOwner) return m.reply('Fitur ini khusus admin grup atau owner bot.');

    const db = getDatabase();
    const group = db.getGroup(m.chat) || {};
    const p = config.prefix;
    const mode = String(args[0] || '').toLowerCase();

    if (!mode) {
        return m.reply(
            `${config.botName}\n\nAUTO GPT\n\n` +
            `Status : ${group.autogpt ? 'AKTIF' : 'NONAKTIF'}\n\n` +
            `${p}autogpt on\n${p}autogpt off`
        );
    }

    if (mode === 'on' || mode === 'off') {
        const on = mode === 'on';
        db.setGroup(m.chat, { autogpt: on });
        try { await m.react(on ? '✅' : '🚫'); } catch { /* opsional */ }
        return m.reply(
            `${config.botName}\n\nAUTO GPT : ${on ? 'AKTIF' : 'NONAKTIF'}\n\n` +
            (on
                ? `Tag bot atau reply pesan bot untuk mulai mengobrol.`
                : `Bot tidak akan membalas otomatis lagi di grup ini.`)
        );
    }

    return m.reply(`Pilih ${p}autogpt on atau ${p}autogpt off`);
};

/* ------------------------------------------------------------------ */
/* Auto-reply (event before)                                           */
/* ------------------------------------------------------------------ */

handler.before = async function (m, { conn }) {
    try {
        if (!m || m.fromMe || !m.isGroup) return false;

        let text = m.text || m.caption || '';

        // Abaikan command dan balasan tombol.
        if (/^[./#!]/.test(text)) return false;
        if (m.message?.buttonsResponseMessage ||
            m.message?.templateButtonReplyMessage ||
            m.message?.listResponseMessage) return false;

        const db = getDatabase();
        const group = db.getGroup(m.chat) || {};
        if (!group.autogpt || group.isBanned) return false;

        const botNumber = bareNumber(conn?.user?.id || conn?.user?.jid);
        if (!botNumber) return false;

        const mentioned = Array.isArray(m.mentionedJid) ? m.mentionedJid : [];
        const isMentioned = mentioned.some(jid => bareNumber(jid) === botNumber);
        const isReplyToBot = !!m.quoted?.fromMe;
        const isCalled = /^(bot|niwo|Niwo)\b/i.test(text.trim());

        const hasImage = !!(m.message?.imageMessage || m.quoted?.message?.imageMessage);

        if (!isMentioned && !isReplyToBot && !isCalled) return false;
        if (!text.trim() && !hasImage) return false;

        // Bersihkan mention bot & kata panggilan dari prompt.
        const cleanText = text
            .replace(new RegExp(`@${botNumber}`, 'g'), '')
            .replace(/^(bot|niwo|Niwo)\b[,:\s]*/i, '')
            .trim();

        const sid = m.chat;
        const session = (global.niwoAiSessions && global.niwoAiSessions[sid]) || { history: [], sessionId: null };

        let reply = null;
        let error = null;

        if (hasImage) {
            let buffer = null;
            try {
                buffer = m.message?.imageMessage
                    ? await m.download?.()
                    : await m.quoted?.download?.();
            } catch { buffer = null; }

            if (buffer) {
                const res = await askImage(cleanText || 'Deskripsikan gambar ini secara detail.', buffer);
                reply = res.reply;
                error = res.error;
            }
        }

        if (!reply) {
            const context = session.history.length
                ? `Riwayat singkat:\n${session.history.join('\n')}\n\n`
                : '';
            const prompt = `${SYSTEM_PROMPT}\n\n${context}User: ${cleanText || '[mengirim gambar]'}\n${config.botName}:`;
            const res = await askText(prompt, session.sessionId);
            reply = res.reply;
            error = error || res.error;
            session.sessionId = res.sessionId;
        }

        if (!reply) {
            await conn.sendMessage(m.chat, { text: error || 'AI tidak memberi jawaban.' }, { quoted: m.raw || m });
            return true;
        }

        session.history.push(`User: ${cleanText || '[gambar]'}`);
        session.history.push(`${config.botName}: ${reply}`);
        session.history = session.history.slice(-HISTORY_LIMIT);
        if (global.niwoAiSessions) global.niwoAiSessions[sid] = session;

        await conn.sendMessage(m.chat, { text: reply }, { quoted: m.raw || m });
        return true;
    } catch (err) {
        console.error('[AUTOGPT]', err?.message || err);
        return false;
    }
};

handler.command = ['autogpt', 'autoai2'];
handler.help = ['autogpt'];
handler.tags = ['ai'];
handler.isGroup = true;

export default handler;

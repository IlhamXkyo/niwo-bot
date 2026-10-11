// plugins/owner/crm.js
// Niwo Bot - CRM Relay

const config = {
    name: 'crm',
    alias: ['crelay'],
    category: 'owner',

    description: 'Membuat file CRM relay dari pesan yang direply',
    usage: '.crm (reply pesan)',
    example: '.crm',

    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,

    cooldown: 0,
    energi: 0,
    isEnabled: true
};

// =========================
// AMBIL TEXT PESAN
// =========================
function getText(m) {
    return String(
        m?.text ||
        m?.body ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        ''
    ).trim();
}

// =========================
// CEK VIEW ONCE
// =========================
function crmHasViewOnce(obj, visited = new WeakSet()) {
    if (!obj || typeof obj !== 'object') return false;

    if (visited.has(obj)) return false;
    visited.add(obj);

    if (
        obj.viewOnceMessage ||
        obj.viewOnceMessageV2 ||
        obj.viewOnceMessageV2Extension
    ) {
        return true;
    }

    for (const value of Object.values(obj)) {
        if (crmHasViewOnce(value, visited)) {
            return true;
        }
    }

    return false;
}

// =========================
// HANDLER
// =========================
async function handler(
    m,
    {
        sock,
        config: botConfig,
        isOwner
    }
) {
    const from = m.chat;

    // =========================
    // CEK OWNER
    // =========================
    if (!isOwner) {
        return m.reply(
            '❌ Fitur khusus owner/pemilik.'
        );
    }

    // =========================
    // CEK REPLY
    // =========================
    if (!m.quoted) {
        return m.reply(
            '❌ Reply pesan target dulu, lalu kirim *.crm*.'
        );
    }

    // =========================
    // CEK VIEW ONCE
    // =========================
    if (crmHasViewOnce(m.quoted)) {
        return m.reply(
            '❌ Pesan view-once tidak bisa disimpan.'
        );
    }

    // =========================
    // BUAT CRM
    // =========================
    try {
        const crmPayload = JSON.parse(
            JSON.stringify(m.quoted)
        );

        const crmData = {
            type: 'bot-crm-relay',
            version: 1,
            createdAt: new Date().toISOString(),
            creator:
                botConfig?.botname ||
                global.config?.botname ||
                'Rinn MD',
            payload: crmPayload
        };

        const crmCode =
            `module.exports = ${JSON.stringify(
                crmData,
                null,
                2
            )};\n`;

        // =========================
        // KIRIM FILE
        // =========================
        await sock.sendMessage(
            from,
            {
                document: Buffer.from(crmCode),
                mimetype: 'application/javascript',
                fileName: 'relay.js',
                caption:
                    `✅ *CRM berhasil dibuat*\n\n` +
                    `Reply file ini lalu kirim:\n` +
                    `*.runcrm*`
            },
            {
                quoted: m
            }
        );

        // =========================
        // REACTION
        // =========================
        try {
            await sock.sendMessage(from, {
                react: {
                    text: '✅',
                    key: m.key
                }
            });
        } catch {}

    } catch (e) {
        console.error('CRM ERROR:', e);

        // =========================
        // ADMIN LOG
        // =========================
        try {
            if (
                typeof global.sendAdminLog === 'function'
            ) {
                await global.sendAdminLog(
                    sock,
                    'crm',
                    m.sender?.split('@')[0] ||
                        m.sender,
                    e
                );
            }
        } catch {}

        return m.reply(
            '❌ Gagal membuat CRM.\n\n' +
            (e?.message || String(e))
        );
    }
}

export default {
    config,
    handler
};
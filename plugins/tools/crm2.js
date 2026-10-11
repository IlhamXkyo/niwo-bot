/**
 * Plugin: crm2.js
 * Command: .crm2 (reply pesan)
 *
 * Niwo Bot / ESM
 * Fungsi:
 * - Ambil pesan yang di-reply
 * - Unwrap pesan yang dibungkus
 * - Relay ulang pesan menggunakan generateWAMessageFromContent
 * - Generate file JS berisi kode mentah relayMessage
 * - Nama file mengikuti tipe pesan
 */

import {
    generateWAMessageFromContent
} from '@itsliaaa/baileys';

import {
    mkdirSync,
    writeFileSync,
    readFileSync
} from 'fs';

import path from 'path';

// =====================================================
// UNWRAP MESSAGE
// =====================================================

function unwrap(content) {
    if (!content || typeof content !== 'object') {
        return content;
    }

    if (content.ephemeralMessage?.message) {
        return unwrap(content.ephemeralMessage.message);
    }

    if (content.viewOnceMessage?.message) {
        return unwrap(content.viewOnceMessage.message);
    }

    if (content.viewOnceMessageV2?.message) {
        return unwrap(content.viewOnceMessageV2.message);
    }

    if (content.viewOnceMessageV2Extension?.message) {
        return unwrap(
            content.viewOnceMessageV2Extension.message
        );
    }

    if (content.documentWithCaptionMessage?.message) {
        return unwrap(
            content.documentWithCaptionMessage.message
        );
    }

    return content;
}

// =====================================================
// NORMALIZE FOR RELAY
// =====================================================

function normalizeForRelay(rawContent) {
    const content = unwrap(rawContent);

    if (
        typeof content?.conversation === 'string'
    ) {
        const {
            conversation,
            ...rest
        } = content;

        return {
            ...rest,
            extendedTextMessage: {
                text: conversation
            }
        };
    }

    return content;
}

// =====================================================
// JAVASCRIPT LITERAL GENERATOR
// =====================================================

function toJsLiteral(
    value,
    indent = 2,
    seen = new WeakSet(),
    depth = 0
) {
    if (value === null) {
        return 'null';
    }

    if (value === undefined) {
        return 'undefined';
    }

    if (typeof value === 'string') {
        return JSON.stringify(value);
    }

    if (
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return String(value);
    }

    if (typeof value === 'bigint') {
        return `${value.toString()}n`;
    }

    if (
        Buffer.isBuffer(value) ||
        value instanceof Uint8Array
    ) {
        return JSON.stringify(
            Buffer.from(value).toString('base64')
        );
    }

    if (typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (depth > 40) {
        return '"[MaxDepth]"';
    }

    if (seen.has(value)) {
        return '"[Circular]"';
    }

    seen.add(value);

    const pad = ' '.repeat(indent);

    const padClose = ' '.repeat(
        Math.max(indent - 2, 0)
    );

    let result;

    // ARRAY
    if (Array.isArray(value)) {
        if (!value.length) {
            result = '[]';
        } else {
            const items = value.map(
                (v) =>
                    pad +
                    toJsLiteral(
                        v,
                        indent + 2,
                        seen,
                        depth + 1
                    )
            );

            result =
                `[\n` +
                items.join(',\n') +
                `\n${padClose}]`;
        }
    }

    // OBJECT
    else {
        const keys = Object.keys(value)
            .filter(
                (k) =>
                    typeof value[k] !== 'function' &&
                    value[k] !== undefined
            );

        if (!keys.length) {
            result = '{}';
        } else {
            const lines = keys.map((k) => {
                const keyStr =
                    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)
                        ? k
                        : JSON.stringify(k);

                return (
                    `${pad}${keyStr}: ` +
                    toJsLiteral(
                        value[k],
                        indent + 2,
                        seen,
                        depth + 1
                    )
                );
            });

            result =
                `{\n` +
                lines.join(',\n') +
                `\n${padClose}}`;
        }
    }

    seen.delete(value);

    return result;
}

// =====================================================
// PROPERTIES ADDED BY MESSAGE FRAMEWORK
// =====================================================

const FRAMEWORK_DECORATED_KEYS = new Set([
    'mtype',
    'id',
    'chat',
    'isBaileys',
    'sender',
    'fromMe',
    'mentionedJid',
    'fakeObj',
    'delete',
    'copyNForward',
    'download',
    'key',
    'participant',
    'text',
    'body',
    'name',
    'pushName',
    'viewonce',
    'download1'
]);

// =====================================================
// REMOVE FRAMEWORK PROPERTIES
// =====================================================

function stripFrameworkProps(content) {
    if (
        !content ||
        typeof content !== 'object'
    ) {
        return content;
    }

    const out = {};

    for (const k of Object.keys(content)) {
        if (
            FRAMEWORK_DECORATED_KEYS.has(k)
        ) {
            continue;
        }

        if (
            typeof content[k] === 'function'
        ) {
            continue;
        }

        out[k] = content[k];
    }

    return out;
}

// =====================================================
// BUILD RAW RELAY CODE
// =====================================================

function buildReadableSendCode(content) {
    try {
        const clean =
            stripFrameworkProps(content);

        return (
            `=> conn.relayMessage(\n` +
            `  m.chat,\n` +
            `  ${toJsLiteral(clean)},\n` +
            `  {}\n` +
            `)`
        );
    } catch (err) {
        return (
            `// Gagal generate relay_code: ` +
            `${err?.message || err}`
        );
    }
}

// =====================================================
// GET MESSAGE TYPE
// =====================================================

function typeNameFromContent(content) {
    const clean =
        stripFrameworkProps(content);

    const key =
        Object.keys(clean)[0] ||
        'UnknownMessage';

    return (
        key.charAt(0).toUpperCase() +
        key.slice(1)
    );
}

// =====================================================
// BUILD JS FILE
// =====================================================

function buildRelayCodeFile(
    rawQuotedContent
) {
    const dir = path.join(
        process.cwd(),
        'debug'
    );

    mkdirSync(dir, {
        recursive: true
    });

    const typeName =
        typeNameFromContent(
            rawQuotedContent
        );

    const filename =
        `${typeName}.js`;

    const filepath =
        path.join(dir, filename);

    const code =
        buildReadableSendCode(
            rawQuotedContent
        );

    writeFileSync(
        filepath,
        code,
        'utf-8'
    );

    return {
        filepath,
        filename
    };
}

// =====================================================
// NIWO CONFIG
// =====================================================

const config = {
    name: 'crm2',

    alias: ['crmrelay'],

    category: 'tools',

    description:
        'Relay pesan yang direply dan membuat kode relay JS',

    usage:
        '.crm2 (reply pesan)',

    example:
        '.crm2',

    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,

    cooldown: 0,
    energi: 0,

    isEnabled: true
};

// =====================================================
// HANDLER
// =====================================================

async function handler(
    m,
    {
        sock
    }
) {
    // =================================================
    // AMBIL QUOTED MESSAGE
    // =================================================

    const rawQuoted =
        m.quoted?.message ||
        m.msg?.contextInfo?.quotedMessage;

    if (!rawQuoted) {
        await sock.sendMessage(
            m.chat,
            {
                text:
                    '❌ Reply pesan yang mau di-relay dulu, lalu ketik *.crm2*.'
            },
            {
                quoted: m
            }
        );

        return;
    }

    // =================================================
    // UNWRAP
    // =================================================

    const unwrapped =
        unwrap(rawQuoted);

    if (
        !unwrapped ||
        typeof unwrapped !== 'object' ||
        !Object.keys(unwrapped).length
    ) {
        await sock.sendMessage(
            m.chat,
            {
                text:
                    '❌ Jenis pesan ini belum didukung untuk di-relay.'
            },
            {
                quoted: m
            }
        );

        return;
    }

    try {
        // =============================================
        // NORMALIZE CONTENT
        // =============================================

        const relayContent =
            normalizeForRelay(
                rawQuoted
            );

        // =============================================
        // GENERATE WA MESSAGE
        // =============================================

        const relayMsg =
            generateWAMessageFromContent(
                m.chat,
                relayContent,
                {
                    userJid:
                        sock.user?.id,
                    quoted: m
                }
            );

        // =============================================
        // RELAY MESSAGE
        // =============================================

        await sock.relayMessage(
            relayMsg.key.remoteJid,
            relayMsg.message,
            {
                messageId:
                    relayMsg.key.id
            }
        );

        // =============================================
        // GENERATE JS FILE
        // =============================================

        const {
            filepath,
            filename
        } =
            buildRelayCodeFile(
                unwrapped
            );

        // =============================================
        // SEND FILE
        // =============================================

        await sock.sendMessage(
            m.chat,
            {
                document:
                    readFileSync(filepath),

                fileName:
                    filename,

                mimetype:
                    'text/javascript',

                caption:
                    `📄 ${filename}`
            },
            {
                quoted: m
            }
        );

    } catch (err) {
        console.error(
            '[CRM2 ERROR]',
            err
        );

        await sock.sendMessage(
            m.chat,
            {
                text:
                    `❌ Gagal relay pesan.\n\n` +
                    `${err?.message || err}`
            },
            {
                quoted: m
            }
        );
    }
}

// =====================================================
// EXPORT NIWO
// =====================================================

export default {
    config,
    handler
};
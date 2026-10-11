// plugins/wareact.js

import crypto from 'crypto'

const API_URL = 'https://keyyss-react.web.id/api/react'

const config = {
    name: 'wareact',
    alias: ['rch', 'reactch'],
    category: 'tools',

    description: 'Kirim reaction ke posting WhatsApp Channel',
    usage: '.wareact <url> <emoji>',
    example:
        '.wareact https://whatsapp.com/channel/0029xxxx/123 😂,😭,👍',

    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,

    cooldown: 5,
    energi: 0,
    isEnabled: true
}

// =========================
// TEXT
// =========================

function getText(m) {
    return String(
        m?.text ||
        m?.body ||
        m?.message?.conversation ||
        m?.message?.extendedTextMessage?.text ||
        ''
    ).trim()
}

// =========================
// PARSE COMMAND
// =========================

function getCommand(text) {
    return (
        text
            .match(/^[.!#/$]([^\s]+)/)?.[1]
            ?.toLowerCase() || ''
    )
}

function parseCommand(text) {
    const match = text.match(
        /^[.!#/$]?(?:wareact|rch|reactch)\s+(\S+)(?:\s+([\s\S]*))?$/i
    )

    if (!match) return null

    return {
        url: match[1],
        emojiText: String(
            match[2] || ''
        ).trim()
    }
}

// =========================
// EMOJI
// =========================

function parseEmojis(input) {
    if (!input) return '😂'

    const emojis = input
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)

    return emojis.length
        ? emojis.join(',')
        : '😂'
}

// =========================
// BOT
// =========================

class KeyyssReactBot {

    constructor() {
        this.deviceFingerprint =
            `DEV_${crypto
                .randomBytes(4)
                .toString('hex')}`
    }

    async sendReaction(url, emojis) {

        const response = await fetch(
            API_URL,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    'Accept':
                        'application/json',

                    'X-Device-Fingerprint':
                        this.deviceFingerprint
                },

                body: JSON.stringify({
                    url,

                    deviceFingerprint:
                        this.deviceFingerprint,

                    emojis
                })
            }
        )

        const raw =
            await response.text()

        let data

        try {
            data = JSON.parse(raw)
        } catch {
            data = {
                raw
            }
        }

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}: ${
                    data?.message ||
                    data?.error ||
                    raw ||
                    'Unknown error'
                }`
            )
        }

        return {
            status: true,
            data
        }
    }
}

// =========================
// RESULT
// =========================

function formatResult(
    result,
    url,
    emojis
) {
    const data =
        result?.data || {}

    let text =
        `✅ *REACTION BERHASIL!*\n\n`

    text +=
        `🔗 *Target:* ${url}\n`

    text +=
        `😀 *Emoji:* ${emojis}\n`

    if (
        data?.newLimit !==
        undefined
    ) {
        text +=
            `📊 *Limit:* ${data.newLimit}\n`
    }

    if (
        data?.cooldownRemainingSeconds !==
        undefined
    ) {
        text +=
            `⏳ *Cooldown:* ${
                data.cooldownRemainingSeconds
            }s\n`
    }

    if (data?.message) {
        text +=
            `💬 *Message:* ${
                data.message
            }\n`
    }

    return text
}

// =========================
// HANDLER
// =========================

async function handler(m, { sock }) {

    const text =
        getText(m)

    const command =
        getCommand(text)

    if (
        ![
            'wareact',
            'rch',
            'reactch'
        ].includes(command)
    ) {
        return
    }

    const parsed =
        parseCommand(text)

    if (!parsed) {
        return m.reply(
            `❌ *Format salah!*\n\n` +
            `Contoh:\n` +
            `.wareact https://whatsapp.com/channel/0029xxxx/123 😂,😭,👍`
        )
    }

    const {
        url,
        emojiText
    } = parsed

    // =========================
    // VALIDASI URL
    // =========================

    if (
        !/^https?:\/\/(?:www\.)?whatsapp\.com\/channel\//i
            .test(url)
    ) {
        return m.reply(
            '❌ URL harus berupa link WhatsApp Channel yang valid.'
        )
    }

    const emojis =
        parseEmojis(emojiText)

    await m.reply(
        `⏳ *Memproses reaction...*\n\n` +
        `🔗 Target: ${url}\n` +
        `😀 Emoji: ${emojis}`
    )

    try {

        const bot =
            new KeyyssReactBot()

        const result =
            await bot.sendReaction(
                url,
                emojis
            )

        if (
            !result?.status
        ) {
            throw new Error(
                'API tidak mengembalikan status berhasil.'
            )
        }

        await m.reply(
            formatResult(
                result,
                url,
                emojis
            )
        )

    } catch (error) {

        console.error(
            '[WAREACT ERROR]',
            error
        )

        await m.reply(
            `❌ *Reaction gagal!*\n\n` +
            `> ${
                error?.message ||
                'Unknown error'
            }`
        )
    }
}

export default {
    config,
    handler
}
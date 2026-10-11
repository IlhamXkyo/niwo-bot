// plugins/runcrm.js

const config = {
    name: 'runcrm',
    alias: [],
    category: 'owner',

    description: 'Menjalankan relay CRM dari file relay',
    usage: '.runcrm (reply file relay.js)',
    example: '.runcrm',

    isOwner: true,
    isPremium: false,
    isGroup: false,
    isPrivate: false,

    cooldown: 0,
    energi: 0,
    isEnabled: true
}

// =========================
// CLEAN RELAY CODE
// =========================

function rcCleanCode(t) {
    t = String(t || '').trim()

    t = t
        .replace(/^export\s+default\s+/i, '')
        .replace(/^module\.exports\s*=\s*/i, '')
        .trim()

    if (t.endsWith(';')) {
        t = t.slice(0, -1).trim()
    }

    return t
}

// =========================
// PARSE RELAY FILE
// =========================

function rcParseRelayFile(t) {
    const clean = rcCleanCode(t)

    let json

    try {
        json = JSON.parse(clean)
    } catch {
        throw new Error(
            'Isi file relay bukan JSON yang valid.'
        )
    }

    const payload =
        json.payload ||
        json.message ||
        json.msg ||
        null

    if (
        !payload ||
        typeof payload !== 'object'
    ) {
        throw new Error(
            'Payload relay tidak ditemukan.'
        )
    }

    return payload
}

// =========================
// FIX INTERACTIVE MESSAGE
// =========================

function rcFixInteractiveMessage(payload) {
    if (!payload?.interactiveMessage) {
        return payload
    }

    const msg =
        JSON.parse(JSON.stringify(payload))

    const interactive =
        msg.interactiveMessage

    // body.footer -> footer
    if (
        interactive.body?.footer &&
        !interactive.footer
    ) {
        interactive.footer =
            interactive.body.footer

        delete interactive.body.footer
    }

    // body.nativeFlowMessage
    // -> nativeFlowMessage
    if (
        interactive.body?.nativeFlowMessage &&
        !interactive.nativeFlowMessage
    ) {
        interactive.nativeFlowMessage =
            interactive.body.nativeFlowMessage

        delete interactive.body.nativeFlowMessage
    }

    // body.header -> header
    if (
        interactive.body?.header &&
        !interactive.header
    ) {
        interactive.header =
            interactive.body.header

        delete interactive.body.header
    }

    // Pastikan body object
    if (
        !interactive.body ||
        typeof interactive.body !== 'object'
    ) {
        interactive.body = {
            text: String(
                interactive.body || ''
            )
        }
    }

    // Pastikan nativeFlowMessage
    if (
        interactive.nativeFlowMessage &&
        typeof interactive.nativeFlowMessage === 'object'
    ) {
        if (
            !interactive.nativeFlowMessage
                .messageParamsJson
        ) {
            interactive.nativeFlowMessage
                .messageParamsJson = '{}'
        }

        // Fix buttonParamsJson
        if (
            Array.isArray(
                interactive
                    .nativeFlowMessage
                    .buttons
            )
        ) {
            interactive
                .nativeFlowMessage
                .buttons =
                interactive
                    .nativeFlowMessage
                    .buttons
                    .map(button => {

                        if (
                            button?.buttonParamsJson &&
                            typeof button.buttonParamsJson !==
                                'string'
                        ) {
                            button.buttonParamsJson =
                                JSON.stringify(
                                    button.buttonParamsJson
                                )
                        }

                        return button
                    })
        }
    } else {
        interactive.nativeFlowMessage = {
            messageParamsJson: '{}'
        }
    }

    return msg
}

// =========================
// WRAP INTERACTIVE
// =========================

function rcWrapInteractive(payload) {
    if (!payload?.interactiveMessage) {
        return payload
    }

    return {
        viewOnceMessage: {
            message: {
                interactiveMessage:
                    payload.interactiveMessage
            }
        }
    }
}

// =========================
// RELAY CRM
// =========================

async function rcRelayCrmMessage(
    sock,
    jid,
    payload
) {
    const fixed =
        rcFixInteractiveMessage(payload)

    const wrapped =
        rcWrapInteractive(fixed)

    // =========================
    // INTERACTIVE
    // =========================

    if (
        wrapped?.viewOnceMessage
            ?.message
            ?.interactiveMessage
    ) {
        await sock.relayMessage(
            jid,
            wrapped,
            {
                messageId:
                    `CRM-${Date.now()}`
            }
        )

        return
    }

    // =========================
    // MESSAGE BIASA
    // =========================

    await sock.relayMessage(
        jid,
        fixed,
        {
            messageId:
                `CRM-${Date.now()}`
        }
    )
}

// =========================
// GET QUOTED TARGET
// =========================

function getTarget(m) {
    let target = null

    if (
        typeof m.resolveMediaTarget ===
        'function'
    ) {
        try {
            target =
                m.resolveMediaTarget()
        } catch {}
    }

    if (!target && m.quoted) {
        target = m.quoted
    }

    return target
}

// =========================
// HANDLER
// =========================

async function handler(m, { sock }) {

    try {

        // =========================
        // AMBIL FILE
        // =========================

        const target =
            getTarget(m)

        if (!target) {
            return m.reply(
                `Reply file relay.js hasil dari *crm*, lalu kirim:\n\n` +
                `*.runcrm*`
            )
        }

        if (
            typeof target.download !==
            'function'
        ) {
            throw new Error(
                'Target tidak memiliki fungsi download.'
            )
        }

        const rcBuf =
            await target.download()

        if (!rcBuf) {
            throw new Error(
                'Gagal mengunduh file relay.js.'
            )
        }

        const rcRaw =
            Buffer.isBuffer(rcBuf)
                ? rcBuf.toString('utf8')
                : String(rcBuf)

        // =========================
        // PARSE
        // =========================

        const rcPayload =
            rcParseRelayFile(rcRaw)

        // =========================
        // RELAY
        // =========================

        await rcRelayCrmMessage(
            sock,
            m.chat,
            rcPayload
        )

        // =========================
        // REACTION
        // =========================

        try {
            await sock.sendMessage(
                m.chat,
                {
                    react: {
                        text: '✅',
                        key: m.key
                    }
                }
            )
        } catch {}

    } catch (e) {

        console.error(
            '[RUNCRM ERROR]',
            e
        )

        // =========================
        // ADMIN LOG
        // =========================

        try {
            if (
                typeof global.sendAdminLog ===
                'function'
            ) {
                await global.sendAdminLog(
                    sock,
                    'runcrm',
                    m.sender?.split('@')[0] ||
                        m.sender,
                    e
                )
            }
        } catch {}

        return m.reply(
            `❌ *Gagal menjalankan CRM.*\n\n` +
            `${e?.message || String(e)}`
        )
    }
}

export default {
    config,
    handler
}
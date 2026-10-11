/*
 * niwoCompat.js / hiyukiCompat.js
 * -------------------------------------------------------------------------
 * Adapter plugin canvas (export { config, handler },
 * handler(m, { sock }) pake m.args/m.text/m.reply()/m.react()) bisa langsung
 * jalan di atas plugin loader.
 * -------------------------------------------------------------------------
 */

export function wrapNiwo(pluginConfig, niwoHandler) {
    const handler = async (m, extra) => {
        const { conn, usedPrefix, command, text, args } = extra

        // lengkapi properti yg biasa dipake plugin gaya HIYUKI tapi
        // gak otomatis ada di objek `m` bawaan SxcWaMdV2
        if (m.args === undefined) m.args = args || []
        if (m.text === undefined) m.text = text || ''
        if (m.prefix === undefined) m.prefix = usedPrefix || '.'
        if (typeof m.react !== 'function') {
            m.react = async (emoji) => {
                try {
                    return await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
                } catch (e) {
                    // reaction bukan fitur kritikal, jangan sampe bikin command gagal
                    return null
                }
            }
        }

        // sock = socket baileys yg sama kayak conn
        return niwoHandler(m, { sock: conn, conn, usedPrefix, command, text, args })
    }

    const aliases = Array.isArray(pluginConfig?.alias) ? pluginConfig.alias : []
    const baseCommand = pluginConfig?.name || 'canvas'
    handler.command = Array.from(new Set([baseCommand, ...aliases].filter(Boolean)))
    handler.help = [pluginConfig?.example || pluginConfig?.usage || baseCommand]
    handler.tags = [pluginConfig?.category || 'canvas']
    handler.isOwner = !!pluginConfig?.isOwner
    handler.isPremium = !!pluginConfig?.isPremium
    handler.isGroup = !!pluginConfig?.isGroup
    handler.isPrivate = !!pluginConfig?.isPrivate
    handler.limit = typeof pluginConfig?.energi === 'number' ? pluginConfig.energi : 0
    handler.description = pluginConfig?.description || ''

    return handler
}

export const wrapHiyuki = wrapNiwo
export default wrapNiwo

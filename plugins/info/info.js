/**
 * plugins/info/info.js : NIWO BOT
 * -------------------------------------------------------------------------
 *   .info : identitas bot. Ringkas, tanpa informasi tambahan.
 * -------------------------------------------------------------------------
 */

import config from '../../src/config.js';
import assetsDefault from '../../src/utils/assets.js';
import { brandHeader, box, item } from '../../src/lib/theme.js';

const { getMenuImage } = assetsDefault;

const handler = async (m, { conn }) => {
    const dev = config.developer || {};

    const text = [
        brandHeader(config.botName),
        ``,
        box(`📌 INFO BOT`, [
            item(`Developer : ${dev.name || config.ownerName}`),
            item(`Kontak    : ${dev.number || '-'}`),
            item(`Tentang   : Halo, saya ${dev.name || config.ownerName}.`),
        ]),
    ].join('\n');

    const img = getMenuImage('logo');
    if (img) {
        return conn.sendMessage(m.chat, { image: img, caption: text }, { quoted: m.raw || m });
    }
    return m.reply(text);
};

handler.command = ['info', 'botinfo'];
handler.help = ['info'];
handler.tags = ['info'];

export default handler;

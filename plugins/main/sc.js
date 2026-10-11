/**
 * plugins/main/sc.js : NIWO BOT
 * -------------------------------------------------------------------------
 *   .sc / .script / .sourcecode / .credit / .developer
 *
 * Identitas source & developer. Memakai foto menu NIWO BOT yang sudah ada
 * (src/media/menu/logo.png) : bukan gambar dari script lain.
 *
 * Tidak ada credential, API key, atau token yang ditampilkan di sini.
 * -------------------------------------------------------------------------
 */

import config from '../../src/config.js';
import assetsDefault from '../../src/utils/assets.js';
import interactiveDefault from '../../src/utils/interactiveHelper.js';
import { isButtonEnabled, buttonStatusText } from '../../src/lib/buttonState.js';
import { brandHeader, box, item } from '../../src/lib/theme.js';

const { getMenuImage } = assetsDefault;
const { sendInteractiveWithImage } = interactiveDefault;

const handler = async (m, { conn }) => {
    const dev = config.developer || {};
    const waLink = dev.waLink || (dev.number ? `https://wa.me/${dev.number}` : null);

    const text = [
        brandHeader(config.botName),
        ``,
        box(`📜 SCRIPT`, [
            item(`Developer : ${dev.name || config.ownerName}`),
            item(`Kontak    : ${dev.number || '-'}`),
            item(`YouTube   : ${dev.youtube || '-'}`),
            item(`Prefix    : ${config.prefix}`),
            item(`Button    : ${buttonStatusText()}`),
        ]),
        ``,
        `Script ini dikembangkan dan dirawat oleh ${dev.name || config.ownerName}.`,
        `Untuk pemesanan, kerja sama, atau kendala, hubungi kontak di atas.`,
    ].join('\n');

    const buttons = [];
    if (waLink) {
        buttons.push({
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({ display_text: '💬 HUBUNGI DEVELOPER', url: waLink }),
        });
    }
    if (dev.youtube) {
        buttons.push({
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({ display_text: '📺 YOUTUBE DEVELOPER', url: dev.youtube }),
        });
    }
    buttons.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: '🏠 MENU UTAMA', id: 'menu' }),
    });

    // Foto SC tetap dikirim di kedua mode; yang berubah hanya tombolnya.
    const img = getMenuImage('logo');

    if (isButtonEnabled()) {
        try {
            return await sendInteractiveWithImage(conn, m.chat, {
                imageSource: img,
                text,
                footer: config.footerTxt,
                quoted: m.raw || m,
                buttons,
            });
        } catch { /* fallback ke bawah */ }
    }

    const plain = waLink
        ? `${text}\n\nHubungi developer : ${waLink}`
        : text;

    if (img) {
        return conn.sendMessage(m.chat, { image: img, caption: plain }, { quoted: m.raw || m });
    }
    return m.reply(plain);
};

handler.command = ['sc', 'script', 'sourcecode', 'source', 'credit', 'developer', 'dev'];
handler.help = ['sc'];
handler.tags = ['info'];

export default handler;

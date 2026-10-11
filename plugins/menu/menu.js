/**
 * plugins/menu/menu.js : NIWO BOT  ❄️
 * -------------------------------------------------------------------------
 * SATU sistem menu untuk semua output menu. Tidak ada jalur kedua.
 *
 *   .menu                menu utama (VIDEO GIF menggantikan FOTO + teks/tombol)
 *   .menu <kategori>     isi satu kategori
 *   .menu <nomor>        isi kategori berdasarkan nomor di menu utama
 *   .allmenu             SEMUA fitur, satu tampilan penuh
 *   .sc                  SCRIPT : identitas source & developer
 *   .vn                  info fitur VN (voice note menu)
 *   .listasset           foto/video/audio menu yang tersedia
 *   .plugininfo          status loader plugin
 *
 * TAMPILAN .menu (lihat config.menuVideo):
 *   • Menu utama TIDAK PAKAI FOTO SAMA SEKALI : video menggantikan posisi
 *     foto: satu pesan, video jadi header/thumbnail, teks + tombol di bawahnya.
 *   • Video gagal dimuat / gagal terkirim -> menu tetap terkirim (video GIF
 *     biasa lalu teks polos), tetap tanpa foto.
 *   • Video hanya di menu utama; submenu & ALL MENU tetap foto + teks + tombol.
 *
 * Tema teks & tombol ada di src/lib/theme.js (TEMA) + ICON/THEME di bawah.
 *
 * Aturan yang tetap dipegang:
 *   • Tombol HUBUNGI DEVELOPER / YOUTUBE HANYA muncul di menu utama.
 *   • Jumlah fitur & kategori dihitung otomatis dari command registry.
 *   • Kategori "games" tidak ada : semua game masuk ke GAME.
 *   • AUTO GANTI (.setfotomenu dkk) tetap berfungsi apa adanya.
 * -------------------------------------------------------------------------
 */

import configDefault from '../../src/config.js';
import helperDefault from '../../src/utils/helper.js';
import bridge from '../../src/utils/pluginBridge.js';
import loader from '../../src/utils/PluginLoader.js';
import assetsDefault from '../../src/utils/assets.js';
import interactiveDefault from '../../src/utils/interactiveHelper.js';
import { isButtonEnabled, buttonStatusText } from '../../src/lib/buttonState.js';
import { TEMA, brandHeader, box, item, greeting, waktuWIB } from '../../src/lib/theme.js';

const config = configDefault;
const { formatUptime } = helperDefault;
const { getMenuImage, getAudio, getMenuVideo, prefetchMenuVideo, listAssets } = assetsDefault;
const { sendInteractiveWithImage, sendInteractiveWithVideo } = interactiveDefault;

// Panaskan cache video di background supaya .menu pertama tidak menunggu download.
setTimeout(() => prefetchMenuVideo(config.menuVideo || {}), 3000).unref?.();

/* ------------------------------------------------------------------ */
/* Kategori                                                             */
/* ------------------------------------------------------------------ */

const LABEL = {
    ai: 'AI & CHAT',
    download: 'DOWNLOAD',
    group: 'GROUP',
    fun: 'FUN MENU',
    game: 'GAME',
    tools: 'TOOLS',
    owner: 'OWNER',
    maker: 'MAKER',
    cek: 'CEK-CEKAN',
    user: 'USER',
    canvas: 'CANVAS',
    info: 'INFO',
    primbon: 'PRIMBON',
    religi: 'RELIGI',
    rpg: 'RPG',
    sticker: 'STICKER',
    media: 'MEDIA',
    anime: 'ANIME',
};

// Icon per kategori : WhatsApp list row tidak bisa pakai foto
// per baris, jadi dipakai emoji sebagai pengganti icon.
const ICON = {
    ai: '🧠',
    download: '⬇️',
    group: '👥',
    fun: '🎈',
    game: '🎮',
    tools: '🧰',
    owner: '👑',
    maker: '🎨',
    cek: '🔎',
    user: '🙋',
    canvas: '🖌️',
    info: '📌',
    primbon: '🔮',
    religi: '🕌',
    rpg: '🗡️',
    sticker: '🏷️',
    media: '🎬',
    anime: '🍥',
};
const iconOf = (cat) => ICON[cat] || '📁';

// Urutan tetap seperti yang diminta. Kategori lain (kalau ada) menyusul
// di belakang secara abjad, jadi fitur baru tidak pernah hilang dari menu.
const CATEGORY_ORDER = [
    'ai', 'download', 'group', 'fun', 'game', 'tools', 'owner',
    'maker', 'cek', 'user', 'canvas', 'info', 'primbon', 'religi', 'rpg',
];

// Kategori kembar / bertopik sama digabung supaya tidak pernah muncul dua kali.
const CATEGORY_MERGE = {
    games: 'game',          // GAMES -> GAME (tidak boleh terpisah)
    downloader: 'download',
    linode: 'panel',
    vps: 'panel',
    fake: 'fun',
    anime: 'fun',
    search: 'tools',
    sticker: 'tools',
    islamic: 'religi',
    islami: 'religi',
    alkitab: 'religi',
    prombon: 'primbon',
    main: 'info',
    general: 'info',
    economy: 'game',
    extra: 'tools',
    media: 'tools',
    am: 'maker',
};

const HIDDEN_CATEGORY = ['events', 'menu'];

// Batas panjang SATU pesan ALL MENU. Dinaikkan jauh (dari 3500) supaya
// foto + teks + tombol SELALU jadi satu pesan saja : tidak pecah jadi
// pesan susulan yang polos tanpa foto/tombol. Batas WhatsApp sendiri
// untuk teks/caption ada di kisaran puluhan ribu karakter, jadi angka
// ini masih jauh di bawahnya dan hanya jaga-jaga untuk kasus ekstrem.
const MAX_BODY = 60000;

/* ------------------------------------------------------------------ */
/* Registry -> kategori                                                 */
/* ------------------------------------------------------------------ */

function collectCategories() {
    const data = {};

    const add = (rawCat, cmd) => {
        const cat = CATEGORY_MERGE[rawCat] || rawCat;
        if (HIDDEN_CATEGORY.includes(cat)) return;
        (data[cat] ||= new Set()).add(cmd);
    };

    for (const [cat, cmds] of Object.entries(bridge.byCategory())) {
        if (HIDDEN_CATEGORY.includes(cat)) continue;
        for (const c of cmds) add(cat, c);
    }

    for (const [file, cmds] of Object.entries(loader.commandsByFile())) {
        const cat = file.toLowerCase();
        if (cat === 'menu') continue;
        for (const c of cmds) {
            if (c.endsWith('menu') || ['listasset', 'plugininfo', 'allfitur'].includes(c)) continue;
            add(cat, c);
        }
    }

    const keys = Object.keys(data);
    const ordered = [
        ...CATEGORY_ORDER.filter(k => keys.includes(k)),
        ...keys.filter(k => !CATEGORY_ORDER.includes(k)).sort(),
    ];

    const out = {};
    for (const k of ordered) {
        const arr = [...data[k]].sort();
        if (arr.length) out[k] = arr;
    }
    return out;
}

const labelOf = (cat) => LABEL[cat] || cat.toUpperCase();

/** Jumlah command dihitung dari registry, tidak pernah di-hardcode. */
function totalCommands() {
    return bridge.commands.size + loader.commandList().length;
}

/** Terima nama kategori maupun labelnya ("cek-cekan", "fun menu", "ai & chat"). */
function resolveCategory(raw, cats) {
    if (!raw) return null;
    const key = String(raw).toLowerCase().trim().replace(/menu$/, '').trim();
    if (!key) return null;

    if (/^\d+$/.test(key)) return Object.keys(cats)[Number(key) - 1] || null;

    const direct = CATEGORY_MERGE[key] || key;
    if (cats[direct]) return direct;

    const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const cat of Object.keys(cats)) {
        if (flat(cat) === flat(key) || flat(labelOf(cat)) === flat(key)) return cat;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* Teks : tema salju ❄️                                                  */
/* ------------------------------------------------------------------ */

function infoHeader(m, cats) {
    const user = String(m.sender || '').split('@')[0];
    return [
        brandHeader(config.botName),
        ``,
        `${greeting()}, @${user} 👋`,
        `_${waktuWIB()}_`,
        ``,
        box(`INFO SISTEM`, [
            item(`Owner    : ${config.ownerName}`),
            item(`Prefix   : [ ${config.prefix} ]`),
            item(`Mode     : ${global.botMode || config.botMode}`),
            item(`Runtime  : ${formatUptime(process.uptime())}`),
            item(`Fitur    : ${totalCommands()} perintah aktif`),
            item(`Kategori : ${Object.keys(cats).length} kategori`),
        ]),
    ].join('\n');
}

/**
 * Teks menu utama.
 */
function mainMenuText(m, cats, buttonsOn) {
    const p = config.prefix;
    const parts = [infoHeader(m, cats), ``];

    if (!buttonsOn) {
        parts.push(
            box(`DAFTAR KATEGORI`, [
                item(`📋 ALL MENU : ${p}allmenu`),
                ...Object.keys(cats).map((cat) => item(`${iconOf(cat)} ${labelOf(cat)} : ${p}menu ${cat}`)),
            ]),
            ``,
            box(`NAVIGASI`, [
                item(`${p}menu <kategori> : Buka satu kategori`),
                item(`${p}allmenu         : Tampilkan semua fitur`),
                item(`${p}lms             : Portal Mahasiswa Kampus`),
                item(`${p}sc              : Info script bot`),
            ]),
            ``,
        );
    } else {
        parts.push(
            box(`CARA PAKAI`, [
                item(`Tekan tombol *BUKA MENU* di bawah`),
                item(`Atau ketik *${p}allmenu* untuk melihat semua fitur`),
                item(`Ketik *${p}lms* untuk akses portal kampus`),
            ]),
            ``,
        );
    }

    // Kontak developer (nama/nomor WhatsApp) SENGAJA tidak pernah ditulis
    // di menu utama : hanya lewat tombol "HUBUNGI DEVELOPER" kalau memang
    // diaktifkan (config.showDeveloperContact).
    return parts.join('\n');
}

function categoryText(cat, cmds) {
    const p = config.prefix;
    return [
        brandHeader(config.botName),
        ``,
        box(`${iconOf(cat)} ${labelOf(cat)}`, cmds.map((c) => item(`${p}${c}`))),
        ``,
        `${cmds.length} fitur • ${p}menu untuk kembali`,
    ].join('\n');
}

/** Pagination terkontrol : memotong di batas baris, tidak pernah di tengah kata. */
function paginate(text, max = MAX_BODY) {
    if (text.length <= max) return [text];
    const pages = [];
    let buf = '';
    for (const line of text.split('\n')) {
        if (buf && (buf.length + line.length + 1) > max) { pages.push(buf.trimEnd()); buf = ''; }
        buf += line + '\n';
    }
    if (buf.trim()) pages.push(buf.trimEnd());
    return pages;
}

/* ------------------------------------------------------------------ */
/* Tombol: tema NIWO BOT                                                */
/* ------------------------------------------------------------------ */

/** Kategori mana yang boleh muncul sebagai button (config.buttonConfig). */
function buttonableCategories(cats) {
    const bc = config.buttonConfig || {};
    return Object.keys(cats).filter((cat) => bc[cat] !== false);
}

const quick = (display_text, id) => ({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text, id }),
});

const selectButton = (title, sections) => ({
    name: 'single_select',
    buttonParamsJson: JSON.stringify({ title, sections }),
});

/**
 * Baris "AKSES CEPAT": ALL MENU, SCRIPT, VN, CHAT AI, DOWNLOAD, AUTO GANTI.
 * Semua id adalah command yang sudah ada & tetap berfungsi apa adanya.
 */
function quickAccessRows(cats) {
    const rows = [
        { header: '', title: '📋 ALL MENU', description: `${totalCommands()} fitur, satu tampilan penuh`, id: 'allmenu' },
        { header: '', title: '🎓 PORTAL LMS', description: 'Portal Mahasiswa ITB Stikom Ambon', id: 'lms' },
        { header: '', title: '🏷️ STICKER MAKER', description: 'Buat stiker WebP instan', id: 'menu sticker' },
    ];
    if (cats.download) rows.push({ header: '', title: '⬇️ DOWNLOADER', description: 'TikTok, YouTube, Mediafire', id: 'menu download' });
    if (cats.tools) rows.push({ header: '', title: '🧰 TOOLS & UTILITAS', description: 'QR Code, Speedtest, Wiki, dll', id: 'menu tools' });
    if (cats.game) rows.push({ header: '', title: '🎮 MINI GAMES', description: 'Tebak-tebakan & Mini Games', id: 'menu game' });
    return rows;
}

/**
 * Section(s) KATEGORI
 */
function kategoriSections(cats) {
    const catRows = buttonableCategories(cats).map((cat) => ({
        header: '',
        title: `${iconOf(cat)} ${labelOf(cat)}`,
        description: `• ${cats[cat].length} fitur aktif`,
        id: `menu ${cat}`,
    }));
    const kategoriRows = [
        { header: '', title: '📋 ALL MENU', description: 'Tampilkan semua fitur sekaligus', id: 'allmenu' },
        ...catRows,
    ];

    const sections = [];
    let page = 0;
    for (let i = 0; i < kategoriRows.length; i += 10) {
        page++;
        sections.push({
            title: page === 1 ? '📂 KATEGORI MENU' : `📂 KATEGORI HALAMAN ${page}`,
            rows: kategoriRows.slice(i, i + 10),
        });
    }
    return sections;
}

/**
 * HUBUNGI DEVELOPER / YOUTUBE
 */
function devButtons() {
    const dev = config.developer || {};
    const buttons = [];
    if (config.showDeveloperContact === false) return buttons;

    const wa = dev.waLink || (dev.number ? `https://wa.me/${dev.number}` : null);
    if (wa) {
        buttons.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '💬 HUBUNGI DEVELOPER', url: wa }) });
    }
    if (dev.youtube) {
        buttons.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📺 YOUTUBE DEVELOPER', url: dev.youtube }) });
    }
    return buttons;
}

/** Tombol menu utama: BUKA MENU + ALL MENU + LMS + dev buttons. */
function mainMenuButtons(cats) {
    return [
        selectButton('⚡ BUKA MENU', [
            { title: '⚡ AKSES CEPAT', rows: quickAccessRows(cats) },
            ...kategoriSections(cats),
        ]),
        quick('📋 ALL MENU', 'allmenu'),
        quick('🎓 LMS KAMPUS', 'lms'),
        ...devButtons(),
    ];
}

/**
 * Tombol halaman kategori & ALL MENU
 */
function categoryButtons(cats) {
    return [
        selectButton('📂 PILIH KATEGORI', kategoriSections(cats)),
        quick('🏠 MENU UTAMA', 'menu'),
    ];
}

/* ------------------------------------------------------------------ */
/* Pengirim : satu pintu untuk semua output menu                        */
/* ------------------------------------------------------------------ */

/**
 * Kirim satu blok FOTO + teks (+ tombol kalau mode button AKTIF).
 * Foto selalu dibaca ulang, jadi ganti foto langsung kena.
 */
async function sendBlock(conn, m, { imageKey, text, buttons = null }) {
    const mentions = m.sender ? [m.sender] : [];
    const img = getMenuImage(imageKey);
    const quoted = m.raw || m;

    if (buttons && isButtonEnabled()) {
        try {
            return await sendInteractiveWithImage(conn, m.chat, {
                imageSource: img,
                text,
                footer: config.footerTxt,
                quoted,
                contextInfo: { mentionedJid: mentions },
                buttons,
            });
        } catch {
            // Perangkat tidak mendukung interactive: turun ke foto + caption.
        }
    }

    if (img) {
        return conn.sendMessage(m.chat, { image: img, caption: text, mentions }, { quoted });
    }
    return conn.sendMessage(m.chat, { text, mentions }, { quoted });
}

/**
 * VIDEO GIF di atas menu utama (pesan tersendiri, layout 'stack').
 * Autoplay + loop karena gifPlayback. Return true kalau terkirim.
 * Kegagalan apa pun hanya dicatat : menu tetap lanjut tanpa video.
 */
async function sendMenuVideo(conn, m) {
    const cfg = config.menuVideo || {};
    const video = await getMenuVideo(cfg);
    if (!video) return false;
    try {
        await conn.sendMessage(m.chat, {
            video,
            mimetype: 'video/mp4',
            gifPlayback: cfg.gifPlayback !== false,
            caption: cfg.caption || '',
        }, { quoted: m.raw || m });
        return true;
    } catch (err) {
        console.log(`[MENU-VIDEO] gagal kirim video: ${err.message}`);
        return false;
    }
}

/**
 * SATU pesan interactive : video jadi header (TANPA foto sama sekali,
 * tidak ada thumbnail foto ditempel). Return null kalau gagal (pemanggil
 * turun ke fallback video-biasa + teks polos, tetap tanpa foto).
 */
async function sendSingleMenu(conn, m, { text, buttons }) {
    const cfg = config.menuVideo || {};
    const video = await getMenuVideo(cfg);
    if (!video) return null;
    try {
        return await sendInteractiveWithVideo(conn, m.chat, {
            videoSource: video,
            gifPlayback: cfg.gifPlayback !== false,
            adTitle: config.botName,
            adBody: config.footerTxt,
            adUrl: config.channelLink || '',
            text,
            footer: config.footerTxt,
            quoted: m.raw || m,
            contextInfo: { mentionedJid: m.sender ? [m.sender] : [] },
            buttons: buttons || [],
        });
    } catch (err) {
        console.log(`[MENU-VIDEO] menu video-only gagal (${err.message}), fallback teks`);
        return null;
    }
}

/**
 * VN menu : FITUR LAMA, tidak dihapus. Default MATI (config.menuVoiceNote).
 */
async function maybeSendVoiceNote(conn, m, key) {
    if (!config.menuVoiceNote) return;
    try {
        if (getAudio(key)) await conn.sendAudioMenu(m.chat, key, m.raw || m);
    } catch { /* audio opsional, tidak boleh bikin menu gagal */ }
}

/* ------------------------------------------------------------------ */
/* Tampilan                                                             */
/* ------------------------------------------------------------------ */

async function mainMenu(conn, m) {
    const cats = collectCategories();
    const buttonsOn = isButtonEnabled();
    const payload = {
        text: mainMenuText(m, cats, buttonsOn),
        buttons: buttonsOn ? mainMenuButtons(cats) : null,
    };

    const cfg = config.menuVideo || {};
    let sent = null;

    // Jika video diaktifkan di config, coba kirim format video
    if (cfg.enabled && buttonsOn) {
        sent = await sendSingleMenu(conn, m, payload);
    }

    // Jika video dimatikan atau gagal terkirim, gunakan foto menu (cepat dan stabil seperti allmenu)
    if (!sent) {
        sent = await sendBlock(conn, m, {
            imageKey: 'menu',
            text: payload.text,
            buttons: payload.buttons,
        });
    }

    await maybeSendVoiceNote(conn, m, 'menu');
    return sent;
}

async function categoryMenu(conn, m, cat) {
    const cats = collectCategories();
    const cmds = cats[cat];
    if (!cmds) return mainMenu(conn, m);

    const pages = paginate(categoryText(cat, cmds));
    const buttonsOn = isButtonEnabled();

    await sendBlock(conn, m, {
        imageKey: cat,
        text: pages[0],
        buttons: buttonsOn ? categoryButtons(cats) : null,
    });
    for (let i = 1; i < pages.length; i++) {
        await conn.sendMessage(m.chat, { text: pages[i] }, { quoted: m.raw || m });
    }
}

/**
 * ALL MENU : SELALU satu tampilan penuh berisi SEMUA kategori & SEMUA
 * fitur, apa pun status mode button. MAX_BODY dinaikkan jauh supaya
 * tidak pecah jadi pesan susulan dalam kondisi normal.
 */
async function allMenu(conn, m) {
    const cats = collectCategories();
    const p = config.prefix;

    let body = [
        brandHeader(config.botName),
        ``,
        box(`❄️ ALL MENU : SEMUA FITUR`, [
            item(`Fitur    : ${totalCommands()} command`),
            item(`Kategori : ${Object.keys(cats).length} menu`),
            item(`Button   : ${buttonStatusText()}`),
        ]),
        ``,
    ].join('\n');

    for (const [cat, cmds] of Object.entries(cats)) {
        body += `\n${box(`${iconOf(cat)} ${labelOf(cat)}`, cmds.map((c) => item(`${p}${c}`)))}\n`;
    }
    body += `\nKetik ${p}menu untuk kembali ke menu utama.`;

    const pages = paginate(body);
    const total = pages.length;
    const buttonsOn = isButtonEnabled();

    for (let i = 0; i < total; i++) {
        const head = total > 1 ? `${config.botName} : ALL MENU ${i + 1}/${total}\n\n` : '';
        const text = i === 0 ? pages[i] : head + pages[i];

        if (i === 0) {
            await sendBlock(conn, m, {
                imageKey: 'allmenu',
                text,
                buttons: buttonsOn ? categoryButtons(cats) : null,
            });
        } else {
            await conn.sendMessage(m.chat, { text }, { quoted: m.raw || m });
        }
    }
}

/* ------------------------------------------------------------------ */
/* Handler                                                              */
/* ------------------------------------------------------------------ */

const handler = async (m, { conn, args, command }) => {
    switch (command) {
        case 'menu': {
            const cats = collectCategories();
            const cat = resolveCategory(args.join(' '), cats);
            return cat ? categoryMenu(conn, m, cat) : mainMenu(conn, m);
        }

        case 'allmenu':
        case 'allfitur':
            return allMenu(conn, m);

        case 'vn': {
            const p = config.prefix;
            const status = config.menuVoiceNote ? 'AKTIF' : 'NONAKTIF';
            return m.reply([
                brandHeader(config.botName),
                ``,
                box(`🎧 VN : VOICE NOTE MENU`, [
                    item(`Status : ${status}`),
                ]),
                ``,
                `VN adalah suara yang otomatis ikut terkirim saat ${p}menu dibuka. ` +
                `Fitur ini tidak dihapus : hanya default MATI supaya ${p}menu tetap ` +
                `bersih (video + foto + tombol).`,
                ``,
                `Owner bisa mengaktifkannya lewat "menuVoiceNote" di src/config.js.`,
            ].join('\n'));
        }

        case 'listasset': {
            const a = listAssets();
            const list = (arr) => (arr.length ? arr.map((x) => item(x)) : [item('(kosong)')]);
            return m.reply([
                brandHeader(config.botName),
                ``,
                box(`🖼️ FOTO MENU (src/media/menu)`, list(a.images)),
                ``,
                box(`🎞️ VIDEO MENU (src/media/video)`, list(a.videos || [])),
                ``,
                box(`🎧 AUDIO VN (src/media/audio)`, list(a.audios)),
                ``,
                `Nama file = nama kategori. Ganti foto: ${config.prefix}setfotomenu`,
                `Video lokal: taruh di src/media/video/menu.mp4`,
            ].join('\n'));
        }

        case 'plugininfo': {
            const gagal = bridge.failed;
            return m.reply([
                brandHeader(config.botName),
                ``,
                box(`⚙️ STATUS PLUGIN`, [
                    item(`File fitur dimuat : ${bridge.loaded}`),
                    item(`Total command     : ${bridge.commands.size}`),
                    item(`Kategori          : ${Object.keys(collectCategories()).length}`),
                    item(`Event (before)    : ${bridge.before.length}`),
                    item(`Gagal dimuat      : ${gagal.length}`),
                ]),
                gagal.length ? `\n${gagal.slice(0, 20).map((f) => `- ${f.file}\n  ${f.error}`).join('\n')}` : '',
            ].join('\n'));
        }
    }
};

handler.command = ['menu', 'allmenu', 'allfitur', 'vn', 'listasset', 'plugininfo'];
handler.help = ['menu', 'allmenu', 'vn'];
handler.tags = ['menu'];

export default handler;

/**
 * src/config.js: NIWO BOT
 * ---------------------------------------------------------------------
 * File konfigurasi utama NIWO BOT.
 * ---------------------------------------------------------------------
 */

module.exports = {
    // ============================================================
    // IDENTITAS BOT
    // ============================================================
    botName: 'niwo bot',
    bot: {
        name: 'niwo bot',
    },
    ownerName: 'ilham',
    footerTxt: 'niwo bot (ilham)',
    prefix: '.',

    // ============================================================
    // IDENTITAS DEVELOPER / OWNER
    // ============================================================
    developer: {
        name: 'ilham',
        number: '6285217124804',
        waLink: 'https://wa.me/6285217124804',
        youtube: '',
    },

    // ============================================================
    // OWNER / AKSES
    // ============================================================
    superOwner: '6285217124804',
    coOwner: [
        '6285217124804',
    ],

    // Mode bot: 'public' -> semua orang | 'self' -> hanya owner
    botMode: 'public',

    // Otomatis centang biru pesan yang masuk
    autoRead: true,

    // Tampilkan indikator "mengetik..." saat membalas
    autoTyping: true,

    // Folder penyimpanan sesi login
    authFolder: './src/database/session',

    // Saluran / Newsletter WhatsApp (kosongkan jika tidak dipakai)
    channelId: '',
    channelLink: '',

    // ============================================================
    // SETELAN UNTUK FITUR DI FOLDER /plugins
    // ============================================================
    apiBaseUrl: '',
    apikey: '',
    apikeyExtra: {},

    // ============================================================
    // AI / AUTOGPT
    // ============================================================
    ai: {
        chatUrl: 'https://api.neosoft.best/api/ai/gemini',
        visionUrl: 'https://askme.matlubapps.com/ask-me',
        visionModel: 'gpt_4__1_nano',
        apiKey: '',
        visionKey: '',
        timeout: 60000,
        historyLimit: 8,
    },

    // Info umum
    info: {
        website: 'niwo bot',
        owner: 'ilham',
    },

    // Identitas stiker
    stickerPackname: 'niwo bot',
    stickerAuthor: 'ilham',
    sticker: {
        packname: 'niwo bot',
        author: 'ilham',
    },
    saluran: {
        id: '',
        name: 'niwo bot',
        link: '',
    },

    // ============================================================
    // MEDIA MENU
    // ============================================================
    menuVoiceNote: false,

    menuVideo: {
        enabled: false,
        url: 'https://files.catbox.moe/6m5krd.mp4',
        gifPlayback: true,
        caption: '❄️ ɴɪᴡᴏ ʙᴏᴛ',
    },

    menuLayout: 'single',

    // ============================================================
    // BUTTON PER-KATEGORI
    // ============================================================
    buttonConfig: {
        ai: true,
        download: true,
        group: true,
        fun: true,
        game: true,
        tools: true,
        owner: true,
        maker: true,
        cek: true,
        user: true,
        canvas: true,
        info: true,
        primbon: true,
        religi: true,
        rpg: true,
    },

    showDeveloperContact: true,
};

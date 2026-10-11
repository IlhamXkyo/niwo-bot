const makeWASocket = require('@itsliaaa/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    delay
} = require('@itsliaaa/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const udpClient = dgram.createSocket('udp4');
function sendPetEvent(eventStr) {
    try {
        udpClient.send(eventStr, 65432, '127.0.0.1');
    } catch(e){}
}

const chalk = require('chalk');
const figlet = require('figlet');
const Spinnies = require('spinnies');

const config = require('./src/config.js');

// ============================================================
// SETUP FFMPEG & FFPROBE PATH
// ============================================================
try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller && ffmpegInstaller.path) {
        const ffmpegDir = path.dirname(ffmpegInstaller.path);
        process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH}`;
        try {
            const fluentFfmpeg = require('fluent-ffmpeg');
            fluentFfmpeg.setFfmpegPath(ffmpegInstaller.path);
        } catch {}
    }
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller && ffprobeInstaller.path) {
        const ffprobeDir = path.dirname(ffprobeInstaller.path);
        process.env.PATH = `${ffprobeDir}${path.delimiter}${process.env.PATH}`;
        try {
            const fluentFfmpeg = require('fluent-ffmpeg');
            fluentFfmpeg.setFfprobePath(ffprobeInstaller.path);
        } catch {}
    }
} catch (e) {}

const plugins = require('./src/utils/PluginLoader');
const bridge = require('./src/utils/pluginBridge');
const { initGlobals } = require('./src/utils/globals');
const { patchConn } = require('./src/utils/connPatch');
const logger = P({ level: 'silent' });

const _origConsoleLog = console.log;
const _origConsoleError = console.error;
const _origConsoleWarn = console.warn;
const _origConsoleInfo = console.info;

function filterLog(args) {
    if (!args || !args[0]) return false;
    const str = String(args[0]);
    if (str.includes('Closing session') || 
        str.includes('Session error') || 
        str.includes('Bad MAC') || 
        str.includes('Failed to decrypt') || 
        str.includes('MessageCounterError') || 
        str.includes('Closing open session in favor of incoming prekey bundle')) {
        return true;
    }
    return false;
}

console.log = function (...args) {
    if (filterLog(args)) return;
    _origConsoleLog.apply(console, args);
};
console.error = function (...args) {
    if (filterLog(args)) return;
    _origConsoleError.apply(console, args);
};
console.warn = function (...args) {
    if (filterLog(args)) return;
    _origConsoleWarn.apply(console, args);
};
console.info = function (...args) {
    if (filterLog(args)) return;
    _origConsoleInfo.apply(console, args);
};

const spinnies = new Spinnies({
    color: "blue",
    succeedColor: "green",
    spinner: {
        interval: 120,
        frames: [
            "M", "Me", "Men", "Menu", "Menun", "Menung", "Menungg", "Menunggu ",
            "Menunggu P", "Menunggu Pes", "Menunggu Pesa", "Menunggu Pesan",
            "Menunggu Pesan.", "Menunggu Pesan..", "Menunggu Pesan...",
            "Menunggu Pesan..", "Menunggu Pesan.", "Menunggu Pesan",
            "Menunggu Pesa", "Menunggu Pes", "Menunggu Pe", "Menunggu P",
            "Menunggu", "Menungg", "Menung", "Menun", "Menu", "Men", "Me", "M"
        ]
    }
});

function question(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

function printBanner() {
    console.clear();
    console.log(
        chalk.cyanBright(
            figlet.textSync("NIWO BOT", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default",
                width: 80,
                whitespaceBreak: false,
            })
        )
    );
    console.log(chalk.cyan("================================================="));
    console.log(chalk.cyanBright(" ❄  NIWO BOT — Owner: ilham (085217124804)"));
    console.log(chalk.cyan(" • Mode: Local Laptop"));
    console.log(chalk.cyan("================================================="));
    console.log(chalk.yellow("INFO:"), chalk.green("Jika code pairing tidak muncul tekan enter 1-2x lagi\n"));
}

let phoneNumber = null;
let isFirstConnect = true;
global.conns = global.conns || {};
let pairingRequests = {};

async function startBot(authFolder = config.authFolder, isMain = true, customPhone = null) {
    if (isFirstConnect && isMain) {
        printBanner();
        isFirstConnect = false;
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    let version;
    try {
        ({ version } = await fetchLatestBaileysVersion());
    } catch {
        version = [2, 3000, 1015901307];
    }

    const Welper = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Linux', 'Firefox', '120.0'],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
    });

    const instanceKey = path.basename(authFolder);
    global.conns[instanceKey] = Welper;

    patchConn(Welper);

    Welper.ev.on('creds.update', saveCreds);

    const originalSendMessage = Welper.sendMessage;
    Welper.sendMessage = async (...args) => {
        sendPetEvent('typing');
        return originalSendMessage.apply(Welper, args);
    };

    const messageHandler = require('./src/handlers/messageHandler');
    Welper.ev.on('messages.upsert', (m) => {
        sendPetEvent('alert');
        messageHandler(Welper, m, isMain);
    });
    Welper.ev.on('group-participants.update', (update) => {
        messageHandler.handleGroupParticipants(Welper, update);
    });

    let pairingReady = null;
    let pairingReadyResolve = null;

    if (!Welper.authState.creds.registered && isMain) {
        pairingReady = new Promise(resolve => { pairingReadyResolve = resolve; });
    }

    Welper.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'connecting' && pairingReadyResolve) {
            setTimeout(() => {
                if (pairingReadyResolve) {
                    const fn = pairingReadyResolve;
                    pairingReadyResolve = null;
                    fn();
                }
            }, 5000);
        }

        if (connection === 'close') {
            if (isMain) {
                try { spinnies.remove("waiting"); } catch (e) { }
            }

            const statusCode = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode
                : null;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log(chalk.red(`\n[!] Sesi ${instanceKey} keluar/logged out.`));
                if (isMain) process.exit(0);
                delete global.conns[instanceKey];

                try { fs.rmSync(authFolder, { recursive: true, force: true }); } catch (e) { }
                return;
            }

            const isNormalRestart = statusCode === 515 || statusCode === 408;

            if (isMain && !Welper.authState.creds.registered) {
                console.log(chalk.red(`\n[!] Koneksi terputus (${statusCode}) saat proses pairing belum selesai.`));
                console.log(chalk.yellow('[!] Silakan jalankan ulang "npm start" secara manual dan coba pairing lagi.'));
                process.exit(1);
            }

            if (!isNormalRestart && isMain) {
                console.log(chalk.yellow(`[!] Koneksi utama terputus (${statusCode}), mencoba menghubungkan kembali...`));
            }

            await delay(3000);
            startBot(authFolder, isMain, customPhone);

        } else if (connection === 'open') {
            const name = Welper.user?.name || Welper.user?.id?.split(':')[0] || 'Unknown';

            if (isMain) {
                console.log(chalk.green(`\nSTATUS: Bot Utama Berhasil Terhubung!`));
                console.log(chalk.white(` • ID/No   : ${name}`));
                console.log(chalk.white(` • Prefix  : ${config.prefix}`));
                console.log(chalk.white(` • Commands: ${plugins.commandList().length} core + ${bridge.commands.size} plugin = ${plugins.commandList().length + bridge.commands.size} fitur aktif`));
                console.log(chalk.white(` • Kategori: ${bridge.categories.size} menu`));
                
                try { spinnies.remove("waiting"); } catch (e) { }
                spinnies.add("waiting", { text: "." });

                autoLoadJadibot();
                messageHandler.resolveOwnerLids(Welper).catch(() => { });

                // Foto profil bot mengikuti foto menu utama jika ada
                try {
                    const { syncBotProfileFromMenuImage } = require('./src/utils/profileSync');
                    syncBotProfileFromMenuImage(Welper).catch(() => { });
                } catch (e) { }

                if (config.channelId) {
                    try {
                        await Welper.newsletterFollow(config.channelId);
                    } catch (e) { }
                }
            } else {
                console.log(chalk.green(`\n[JADIBOT] Clone Bot +${instanceKey} Berhasil Terhubung!`));

                if (config.channelId) {
                    try {
                        await Welper.newsletterFollow(config.channelId);
                    } catch (e) { }
                }
            }
        }
    });

    if (!Welper.authState.creds.registered) {
        if (isMain) {
            if (!phoneNumber) {
                console.log(chalk.cyan('=== NIWO BOT PAIRING ==='));
                console.log(chalk.white('Format nomor gunakan kode negara, contoh: 6285217124804\n'));

                const input = await question(chalk.green('📱 Masukkan Nomor WhatsApp: '));
                phoneNumber = input.replace(/\D/g, '');

                if (!phoneNumber.match(/^\d{10,15}$/)) {
                    console.log(chalk.red('❌ Nomor tidak valid! Aplikasi dihentikan.'));
                    process.exit(1);
                }
            }

            console.log(chalk.gray('⏳ Menunggu koneksi ke server WhatsApp...'));
            await pairingReady;

            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const pairingCode = await Welper.requestPairingCode(phoneNumber);
                    const formattedCode = pairingCode.match(/.{1,4}/g)?.join('-') || pairingCode;
                    console.log(chalk.magenta(`\n[➔] PAIRING CODE ANDA: `) + chalk.white.bold(formattedCode));
                    console.log(chalk.gray('Silakan masukkan kode di atas pada menu: Linked Devices -> Link with phone number\n'));
                    break;
                } catch (err) {
                    console.log(chalk.yellow(`[!] Percobaan ${attempt}/3 gagal: ${err.message}`));
                    if (attempt >= 3) {
                        console.log(chalk.red('❌ Gagal generate pairing code setelah 3 percobaan.'));
                        process.exit(1);
                    }
                    await delay(5000);
                }
            }
        } else if (customPhone) {
            setTimeout(async () => {
                try {
                    await delay(3000);
                    const code = await Welper.requestPairingCode(customPhone);
                    const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;
                    if (pairingRequests[customPhone]?.resolve) {
                        const cb = pairingRequests[customPhone];
                        delete pairingRequests[customPhone];
                        cb.resolve(formattedCode);
                    }
                } catch (err) {
                    if (pairingRequests[customPhone]?.reject) {
                        const cb = pairingRequests[customPhone];
                        delete pairingRequests[customPhone];
                        cb.reject(err);
                    }
                }
            }, 1000);
        }
    }

    return Welper;
}

global.createNewBotInstance = async (targetPhone) => {
    const sessionPath = path.join(__dirname, 'src', 'database', 'jadibot', targetPhone);

    if (fs.existsSync(path.join(sessionPath, 'creds.json'))) {
        const creds = JSON.parse(fs.readFileSync(path.join(sessionPath, 'creds.json'), 'utf-8'));
        if (creds.registered) {

            if (global.conns[targetPhone]) {
                throw new Error("Bot dengan nomor tersebut sudah aktif dan terhubung.");
            }
            await startBot(sessionPath, false, targetPhone);
            throw new Error("Session lama ditemukan dan otomatis dihubungkan kembali tanpa pairing ulang.");
        }
    }

    return new Promise((resolve, reject) => {
        pairingRequests[targetPhone] = { resolve, reject };

        startBot(sessionPath, false, targetPhone).catch(err => {
            delete pairingRequests[targetPhone];
            reject(err);
        });
    });
};

function autoLoadJadibot() {
    const sessionsDir = path.join(__dirname, 'src', 'database', 'jadibot');

    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }

    const folders = fs.readdirSync(sessionsDir);
    folders.forEach(folder => {
        const fullPath = path.join(sessionsDir, folder);
        if (fs.statSync(fullPath).isDirectory()) {

            if (fs.existsSync(path.join(fullPath, 'creds.json'))) {
                console.log(chalk.blue(`[AUTOLOAD] Menghidupkan kembali clone bot: +${folder}`));
                startBot(fullPath, false, folder).catch(() => { });
            }
        }
    });
}

process.on('uncaughtException', (err) => console.error(chalk.red('[Error Uncaught]:'), err.message));
process.on('unhandledRejection', (reason) => console.error(chalk.red('[Error Rejection]:'), reason));

// ============================================================
// BOOTSTRAP
// ============================================================
(async () => {
    try {
        initGlobals();
        printBanner();
        isFirstConnect = false;

        console.log(chalk.gray('[BOOT] Memuat fitur dari folder /plugins ...'));
        await bridge.init();

        plugins.init();

        await startBot();
    } catch (err) {
        console.error(chalk.red('[Fatal Error]:'), err);
        process.exit(1);
    }
})();
const fs = require('fs');
const path = require('path');
const config = require('../config');

if (global.botMode === undefined) global.botMode = config.botMode;
const plugins = require('../utils/PluginLoader');
const chalk = require('chalk');
const readline = require('readline');
const { getContentType } = require('@itsliaaa/baileys');
const { sendButtons, sendListMessage, sendInteractiveMessage, sendButtonWithImage, sendInteractiveWithImage } = require('../utils/interactiveHelper');
const { fakeOrder } = require('../utils/fquoted');
const bridge = require('../utils/pluginBridge');
const { serialize } = require('../utils/serialize');
const { patchConn } = require('../utils/connPatch');
const { initGlobals } = require('../utils/globals');
const antigravityBridgeRaw = require('../lib/antigravityBridge');
const antigravityBridge = antigravityBridgeRaw.default || antigravityBridgeRaw;

initGlobals();

const superOwnerLidCache = new Set();
const coOwnerLidCache = new Set();

// ============================================================
// AUTO AI (chat bebas tanpa prefix) : aktif di DM, opsional di grup
// via ".autoai on/off" (lihat src/commands/group.js)
// ============================================================
const AUTOAI_PERSONA = `Lu adalah aNdri, asisten chat gen-z yang natural, luwes, dan nyambung konteks. Wajib pakai gw/lu. Jangan pernah nyebut nama model, provider, engine, API, atau platform asli. Kalau user nanya identitas (siapa lu), jawab: "gw ANDRI BOT dari aNdri". Tetap hindari pengulangan kata aNdri berlebihan. Gaya jawaban: mulai dari inti 1-2 kalimat yang langsung jawab pertanyaan user, lalu lanjut detail seperlunya. Kalau user minta "detail", "lengkap", "komprehensif", atau "step by step", jawab panjang, terstruktur, dan mendalam plus contoh praktis. Dilarang jawaban template, dilarang muter, dilarang ambigu, dilarang formal kaku. Boleh tajem tapi tetap sopan dan relevan, jangan toxic. Kalau user curhat, respon empatik dan manusiawi, jangan robotik. Emoji adaptif, maksimal 1, jangan spam. Dilarang em dash. Dilarang markdown seperti *, **, #, tabel, quote block. Output wajib teks biasa rapi.`;

async function handleAutoAi(Hanz, msg, sender, text) {
    const groupOn = isGroup(sender) && global.autoAiGroups?.get(sender);
    if (isGroup(sender) && !groupOn) return; // di grup, default OFF sampai di-toggle .autoai on
    if (!text || !text.trim() || text.trim().length < 2) return;

    // Apikey belum diisi (masih placeholder bawaan config.js) -> jangan coba fetch,
    // biar gak spam error tiap ada chat masuk.
    if (!global.apikey?.jereapi || global.apikey.jereapi === 'ISI_APIKEY_KAMU') return;

    try {
        const userName = msg.pushName || 'Sobat';
        const prompt = `${AUTOAI_PERSONA}\n\n${userName}: ${text.trim()}`;

        const res = await fetch(`${global.web}/api/ai/glm-ai?apikey=${global.apikey.jereapi}&text=${encodeURIComponent(prompt)}&session=${encodeURIComponent(sender)}`);

        const raw = await res.text();
        let json;
        try {
            json = JSON.parse(raw);
        } catch {
            // API balikin HTML/halaman error (bukan JSON) -> diemin aja, jangan crash.
            console.log(chalk.red('Error Auto AI:'), `respons bukan JSON (status ${res.status}). Cek apikey/endpoint global.web di src/config.js.`);
            return;
        }

        const result = json?.result ?? json?.data ?? json?.answer;
        const reply = typeof result === 'object' ? (result?.response || result?.reply || result?.message || result?.answer) : result;

        if (reply) await Hanz.sendMessage(sender, { text: String(reply).trim() }, { quoted: msg });
    } catch (err) {
        console.log(chalk.red('Error Auto AI:'), err.message);
    }
}

const COOLDOWN_MS = 5000;
const COOLDOWN_EXEMPT = new Set([
    'menu', 'ping',
    'generalmenu', 'ownermenu', 'ffmpegmenu',
    'downloadmenu', 'toolsmenu', 'jadibotmenu',
    'funmenu', 'groupmenu',
    'afk', 'welcome', 'goodbye', 'antilink',
]);
const cooldownMap = new Map();

// Guard anti-double-process: kadang Baileys/WA ngirim ulang event messages.upsert
// buat message ID yang sama (retry socket, dsb) -> tanpa ini command bisa
// kejalanin 2x dari 1x kirim/tap.
const processedMsgIds = new Map();
const PROCESSED_TTL_MS = 60 * 1000;
function alreadyProcessed(id) {
    if (!id) return false;
    const now = Date.now();
    for (const [k, t] of processedMsgIds) if (now - t > PROCESSED_TTL_MS) processedMsgIds.delete(k);
    if (processedMsgIds.has(id)) return true;
    processedMsgIds.set(id, now);
    return false;
}

const welcomeGroups = new Map();
const goodbyeGroups = new Map();
const antilinkGroups = new Map();

global.welcomeGroups = welcomeGroups;
global.goodbyeGroups = goodbyeGroups;
global.antilinkGroups = antilinkGroups;

global.afkUsers = global.afkUsers || new Map();

setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of cooldownMap) {
        if (now - timestamp > COOLDOWN_MS) cooldownMap.delete(key);
    }
}, 5 * 60 * 1000);

function getExtraOwners() {
    try {
        const settingsPath = path.join(process.cwd(), 'database', 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data.extraOwners)) {
                return data.extraOwners.map(n => String(n).replace(/\D/g, '')).filter(Boolean);
            }
        }
    } catch {}
    return [];
}

async function resolveOwnerLids(Hanz) {
    const resolveList = [
        { numbers: [].concat(config.superOwner), cache: superOwnerLidCache, label: 'SUPER' },
        { numbers: [].concat(config.coOwner || []).concat(getExtraOwners()), cache: coOwnerLidCache, label: 'CO' },
    ];
    for (const { numbers, cache, label } of resolveList) {
        for (const nomor of numbers.map(n => n.replace(/\D/g, '')).filter(Boolean)) {
            try {
                const [result] = await Hanz.onWhatsApp(nomor);
                if (result?.exists && result?.lid) {
                    const lidNum = result.lid.replace(/\D/g, '').replace(/@.+$/, '').split(':')[0];
                    cache.add(lidNum);
                    console.log(chalk.cyan(`[${label}-OWNER-LID] ${nomor} -> ${lidNum}@lid`));
                }
            } catch (e) {
                console.log(chalk.yellow(`[${label}-OWNER-LID] Gagal resolve ${nomor}: ${e.message}`));
            }
        }
    }
}

function extractMessageText(message) {
    if (!message) return null;
    const type = getContentType(message);
    switch (type) {
        case 'conversation': return message.conversation;
        case 'extendedTextMessage': return message.extendedTextMessage?.text;
        case 'imageMessage': return message.imageMessage?.caption;
        case 'videoMessage': return message.videoMessage?.caption;
        case 'buttonsResponseMessage': return message.buttonsResponseMessage?.selectedButtonId;
        case 'listResponseMessage': return message.listResponseMessage?.singleSelectReply?.selectedRowId;
        case 'templateButtonReplyMessage': return message.templateButtonReplyMessage?.selectedId;
        case 'interactiveResponseMessage': {
            const paramsJson = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
            if (paramsJson) {
                try {
                    const parsed = JSON.parse(paramsJson);
                    return parsed.id;
                } catch {
                    return null;
                }
            }
            return null;
        }
        default: return null;
    }
}

function isInteractiveMsg(msg) {
    if (!msg || !msg.message) return false;
    const m = msg.message;
    return !!(m.buttonsResponseMessage || m.listResponseMessage || m.templateButtonReplyMessage || m.interactiveResponseMessage);
}

function isGroup(jid) { return jid.endsWith('@g.us'); }
function isFromMe(msg) { return msg.key.fromMe; }

function getSenderNumber(sender, msg) {
    const candidates = [
        msg?.key?.senderPn,
        msg?.key?.participantAlt,
        msg?.key?.remoteJidAlt,
        msg?.key?.participant,
        msg?.key?.remoteJid,
        sender,
    ];
    const raw = candidates.find(v => v && !v.endsWith('@lid')) || candidates.find(v => v) || '';
    return raw.replace(/\D/g, '').replace(/@.+$/, '').split(':')[0];
}

function isSuperOwner(sender, msg) {
    const superOwners = [].concat(config.superOwner).map(n => n.replace(/\D/g, ''));
    const senderNumber = getSenderNumber(sender, msg);
    const fromMe = msg?.key?.fromMe || false;
    return superOwners.some(n => n === senderNumber) || superOwnerLidCache.has(senderNumber) || fromMe;
}

function isCoOwner(sender, msg) {
    const coOwners = [].concat(config.coOwner || []).map(n => n.replace(/\D/g, ''));
    const extraOwners = getExtraOwners();
    const allCoOwners = [...coOwners, ...extraOwners];
    const senderNumber = getSenderNumber(sender, msg);
    return allCoOwners.some(n => n === senderNumber) || coOwnerLidCache.has(senderNumber);
}

function isOwner(sender, msg) {
    return isSuperOwner(sender, msg) || isCoOwner(sender, msg);
}

function parseCommand(text, isGroupChat = false, isInteractive = false) {
    const { prefix } = config;

    if (text.startsWith(prefix)) {
        const args = text.slice(prefix.length).trim().split(/ +/);
        const name = args.shift().toLowerCase();
        return { name, args, fullArgs: args.join(' '), raw: text, hasPrefix: true };
    }

    const words = text.trim().split(/ +/);
    const name = words[0].toLowerCase();
    const isEssential = ['menu', 'allmenu', 'sc', 'vn', 'help', 'ping'].includes(name);

    if (isInteractive || !isGroupChat || isEssential) {
        if (plugins.has(name) || bridge.has(name)) {
            const args = words.slice(1);
            return { name, args, fullArgs: args.join(' '), raw: text, hasPrefix: false };
        }
    }

    return null;
}

async function handleMessages(Hanz, m, isMain = true) {
    for (const msg of m.messages) {
        if (!msg.message) continue;

        const fromMe = isFromMe(msg);
        const sender = msg.key.remoteJid;

        const checkOwner = isOwner(sender, msg);
        const checkSuperOwner = isSuperOwner(sender, msg);
        const checkCoOwner = isCoOwner(sender, msg);

        if (!fromMe && global.botMode === 'self' && !checkOwner) continue;

        patchConn(Hanz);
        antigravityBridge.setGlobalHanz?.(Hanz);

        // objek `m` gaya plugin (dipakai semua fitur di folder /plugins)
        let mSer = null;
        try { mSer = serialize(Hanz, msg); } catch (e) { mSer = null; }

        const text = extractMessageText(msg.message);
        if (!text) {
            // pesan tanpa teks (mis. media polos) tetap dilempar ke event plugin
            if (mSer) { try { await bridge.runBefore(Hanz, mSer, { isOwner: checkOwner }); } catch { } }
            continue;
        }

        if (!fromMe) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);

            console.log(
                chalk.blue(`[INBOUND] `) +
                chalk.cyan(sender) +
                chalk.white(`: ${text}`)
            );
        }

        if (config.autoRead) await Hanz.readMessages([msg.key]);
        if (config.autoTyping && !isGroup(sender)) await Hanz.sendPresenceUpdate('composing', sender);

        if (isGroup(sender) && global.antilinkGroups?.get(sender) && !checkOwner) {
            const linkRegex = /https?:\/\/|wa\.me\/|chat\.whatsapp\.com\/|bit\.ly\/|t\.me\//i;
            if (linkRegex.test(text)) {
                try {
                    await Hanz.sendMessage(sender, { delete: msg.key });
                    await Hanz.sendMessage(sender, {
                        text: `@${getSenderNumber(sender, msg)} dilarang mengirim link di grup ini!`,
                        mentions: [msg.key.participant || sender]
                    });
                } catch { }
                continue;
            }
        }

        if (isGroup(sender) && global.afkUsers?.size > 0) {
            const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            for (const jid of mentioned) {
                const num = jid.split('@')[0];
                if (global.afkUsers.has(num)) {
                    const { reason, time } = global.afkUsers.get(num);
                    const elapsed = Math.floor((Date.now() - time) / 1000);
                    const dur = elapsed < 60 ? `${elapsed} detik` : elapsed < 3600 ? `${Math.floor(elapsed/60)} menit` : `${Math.floor(elapsed/3600)} jam`;
                    await Hanz.sendMessage(sender, {
                        text: `@${num} sedang AFK selama ${dur}\nAlasan: ${reason}`,
                        mentions: [jid]
                    });
                }
            }
        }

        if (!fromMe && global.afkUsers?.has(getSenderNumber(sender, msg))) {
            const num = getSenderNumber(sender, msg);
            global.afkUsers.delete(num);
            await Hanz.sendMessage(sender, {
                text: `Selamat datang kembali @${num}! Status AFK kamu telah dihapus.`,
                mentions: [msg.key.participant || sender]
            });
        }

        
        // ============================================
        // FITUR GAME TEBAK-TEBAKAN (TANPA PREFIX)
        // ============================================
        global.tebakan = global.tebakan || {};
        if (global.tebakan[sender]) {
            const answer = global.tebakan[sender].jawaban.toLowerCase();
            const userAnswer = text.toLowerCase();
            
            if (userAnswer === answer) {
                await Hanz.sendMessage(sender, { text: '✅ Jawaban lu Bener! Mantap bos!' }, { quoted: msg });
                clearTimeout(global.tebakan[sender].waktu);
                delete global.tebakan[sender];
                continue; 
            } else if (userAnswer === 'nyerah') {
                await Hanz.sendMessage(sender, { text: `Yah nyerah... Jawabannya adalah: *${answer}*` }, { quoted: msg });
                clearTimeout(global.tebakan[sender].waktu);
                delete global.tebakan[sender];
                continue;
            }
        }

        // ==== EVENT PLUGIN (jawaban game, anti-*, auto response tombol, dll) ====
        if (mSer) {
            try {
                const stopped = await bridge.runBefore(Hanz, mSer, {
                    isOwner: checkOwner,
                    isSuperOwner: checkSuperOwner,
                });
                if (stopped) continue;
            } catch { /* event tidak boleh mematikan bot */ }
        }

        let command = parseCommand(text, isGroup(sender), isInteractiveMsg(msg));

        // Prefix doang tanpa nama command (mis. cuma ".") -> anggap BUKAN command,
        // biar nggak nyasar ke "Command * tidak ditemukan" atau ke Auto AI di bawah.
        if (command && !command.name) command = null;

        if (command) {
            const handler = plugins.get(command.name);

            // Cegah command yang sama, dari message yang sama, kejalan 2x
            // (mis. gara-gara WA/Baileys re-deliver event, atau double-tap tombol).
            const dedupeKey = `${msg.key?.id}:${command.name}`;
            if (alreadyProcessed(dedupeKey)) continue;

            if (handler) {
                if (!checkSuperOwner && !checkOwner && !COOLDOWN_EXEMPT.has(command.name)) {
                    const cooldownKey = `${sender}:${command.name}`;
                    const lastUsed = cooldownMap.get(cooldownKey) || 0;
                    const remaining = COOLDOWN_MS - (Date.now() - lastUsed);

                    if (remaining > 0) {
                        await Hanz.sendMessage(sender, {
                            text: `⏳ Sabar dulu! Tunggu *${(remaining / 1000).toFixed(1)} detik* lagi sebelum pakai command ini.`
                        }, { quoted: msg });
                        continue;
                    }

                    cooldownMap.set(cooldownKey, Date.now());
                }

                const cmdArgs = command.args.length ? ' ' + command.args.join(' ') : '';

                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);

                console.log(
                    chalk.green(`[EXECUTE] `) +
                    chalk.yellow(`${command.name}${cmdArgs}`)
                );

                try {
                    await handler({
                        Hanz, msg, sender,
                        senderNumber: getSenderNumber(sender, msg),
                        pushname: msg.pushName || 'Kak',
                        isGroup: isGroup(sender),
                        isOwner: checkOwner,
                        isSuperOwner: checkSuperOwner,
                        isCoOwner: checkCoOwner,
                        command, text,
                        fakeOrder,
                        isMain,
                        reply: (content) => Hanz.sendMessage(sender, content, { quoted: msg }),
                        replyFake: (content) => Hanz.sendMessage(sender, content, { quoted: fakeOrder }),
                        send: (content) => Hanz.sendMessage(sender, content),
                        // imageKey dipakai supaya tiap command dapat FOTO tombol yang berbeda
                        sendButtons: (content) => sendButtons(Hanz, sender, { imageKey: command.name, ...content }),
                        sendList: (content) => sendListMessage(Hanz, sender, { imageKey: command.name, ...content }),
                        sendInteractive: (content) => sendInteractiveMessage(Hanz, sender, { imageKey: command.name, ...content }),
                        sendButtonWithImage: (content) => sendButtonWithImage(Hanz, sender, content),
                        sendInteractiveWithImage: (content) => sendInteractiveWithImage(Hanz, sender, content),
                        react: (emoji) => Hanz.sendMessage(sender, { react: { text: emoji, key: msg.key } }),
                    });
                } catch (err) {
                    readline.clearLine(process.stdout, 0);
                    readline.cursorTo(process.stdout, 0);

                    console.error(
                        chalk.red(`[RUN-ERROR] `) +
                        chalk.yellow(`[${command.name}]: `) +
                        chalk.red(err.message)
                    );
                    await Hanz.sendMessage(sender, { text: '❌ Terjadi kesalahan saat menjalankan perintah.' });
                }
            } else if (bridge.has(command.name)) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);

                console.log(
                    chalk.green(`[PLUGIN] `) +
                    chalk.yellow(`${command.name}${command.args.length ? ' ' + command.args.join(' ') : ''}`)
                );

                if (!checkOwner && !COOLDOWN_EXEMPT.has(command.name)) {
                    const cooldownKey = `${sender}:${command.name}`;
                    const lastUsed = cooldownMap.get(cooldownKey) || 0;
                    const remaining = COOLDOWN_MS - (Date.now() - lastUsed);
                    if (remaining > 0) {
                        await Hanz.sendMessage(sender, {
                            text: `⏳ Sabar dulu! Tunggu *${(remaining / 1000).toFixed(1)} detik* lagi.`
                        }, { quoted: msg });
                        continue;
                    }
                    cooldownMap.set(cooldownKey, Date.now());
                }

                await bridge.exec({
                    Hanz, msg,
                    m: mSer,
                    commandName: command.name,
                    text: command.fullArgs,
                    args: command.args,
                    isOwner: checkOwner,
                    isSuperOwner: checkSuperOwner,
                });
            } else {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);

                console.log(
                    chalk.magenta(`[NOT-FOUND] `) +
                    chalk.white(`Command `) +
                    chalk.yellow(`*${command.name}*`) +
                    chalk.white(` tidak terdaftar.`)
                );
                if (!isGroup(sender)) {
                    await Hanz.sendMessage(sender, { text: `❓ Command *${command.name}* tidak ditemukan.` });
                }
            }
        } else if (!text.startsWith(config.prefix)) {
            // Cek rute Antigravity Remote C2 Bridge
            // Berlaku untuk Owner (DM / Grup sesuai mode) ATAU Member di grup yang diaktifkan .chatai (hanya saat tag/reply)
            const isBridgeActive = antigravityBridge.getBridgeMode() !== 'off';
            const isWhitelistedGroup = isGroup(sender) && antigravityBridge.isChatAiGroup(sender);
            const canTriggerBridge = checkOwner || isWhitelistedGroup;

            if (!fromMe && isBridgeActive && canTriggerBridge) {
                const botJid = Hanz.user?.id || '';
                const botLid = Hanz.user?.lid || '';
                const mentionedJid = mSer?.mentionedJid || msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const routing = antigravityBridge.evaluateGroupRouting({
                    mode: antigravityBridge.getBridgeMode(),
                    isGroup: isGroup(sender),
                    text,
                    quoted: mSer?.quoted || null,
                    botJid,
                    botLid,
                    mentionedJid,
                });

                console.log(chalk.cyan(`[ANTIGRAVITY-ROUTE] shouldRoute=${routing.shouldRoute} isOwner=${checkOwner} isChatAiGroup=${isWhitelistedGroup} reason=${routing.reason} text="${text}"`));

                if (routing.shouldRoute) {
                    await antigravityBridge.handleInbound({
                        Hanz,
                        msg,
                        sender,
                        text,
                        mSer,
                        isOwner: checkOwner,
                        senderNumber: getSenderNumber(sender, msg)
                    });
                    return;
                }
            }

            // Bukan command sama sekali (nggak diawali prefix) -> coba lempar ke Auto AI.
            // Kalau text diawali prefix tapi nggak match apa-apa (mis. cuma "."),
            // sengaja DIDIAMKAN, jangan sampai ke sini.
            await handleAutoAi(Hanz, msg, sender, text);
        }


        if (config.autoTyping && !isGroup(sender)) await Hanz.sendPresenceUpdate('paused', sender);
    }
}

/**
 * Event member masuk/keluar grup.
 *
 * Welcome memakai src/lib/welcomeSystem.js (konfigurasi per grup tersimpan
 * di database NIWO BOT, mendukung mode text/mention/foto + placeholder).
 * Kegagalan welcome tidak boleh menghentikan event lainnya.
 */
async function handleGroupParticipants(Hanz, update) {
    const { id: groupJid, participants, action } = update;
    if (!groupJid || !Array.isArray(participants)) return;

    let welcomeSystem = null;
    if (action === 'add') {
        try {
            welcomeSystem = await import('../lib/welcomeSystem.js');
        } catch (err) {
            console.error('[WELCOME] gagal memuat welcomeSystem:', err?.message || err);
        }
    }

    // Metadata diambil sekali saja, dipakai untuk semua member baru.
    let metadata = null;
    if (action === 'add' && welcomeSystem) {
        try { metadata = await Hanz.groupMetadata(groupJid); } catch { metadata = null; }
    }

    for (const jid of participants) {
        const number = String(jid).split('@')[0];

        if (action === 'add' && welcomeSystem) {
            try {
                await welcomeSystem.sendWelcome(Hanz, groupJid, jid, metadata);
            } catch (err) {
                console.error('[WELCOME]', err?.message || err);
            }
        }

        if (action === 'remove' && global.goodbyeGroups?.get(groupJid)) {
            try {
                await Hanz.sendMessage(groupJid, {
                    text: `Sampai jumpa @${number}, semoga sukses!`,
                    mentions: [jid]
                });
            } catch (err) {
                console.error('[GOODBYE]', err?.message || err);
            }
        }
    }
}

module.exports = handleMessages;
module.exports.resolveOwnerLids = resolveOwnerLids;
module.exports.handleGroupParticipants = handleGroupParticipants;
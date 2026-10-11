/**
 * pluginBridge.js
 * -------------------------------------------------------------------------
 * Jembatan antara core NIWO BOT (CommonJS, src/commands) dengan ratusan
 * fitur di folder /plugins yang formatnya ESM:
 *
 *      export default handler
 *      handler.command = ['ping']
 *      handler.tags    = ['tools']
 *
 * Bridge ini:
 *  - memuat semua file /plugins/<kategori>/*.js
 *  - mendaftarkan seluruh command-nya ke registry
 *  - menyulap ctx NIWO BOT jadi (m, { conn, usedPrefix, command, text, args })
 *  - menjalankan handler.before (event plugin: game jawaban, anti-*, dll)
 * -------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { pathToFileURL } = require('url');

const config = require('../config');
const { serialize } = require('./serialize');
const { patchConn } = require('./connPatch');

const PLUGIN_DIR = path.join(__dirname, '..', '..', 'plugins');

// src/lib/*.js format-nya ESM (package.json { type: module } di folder itu),
// sedangkan file ini CommonJS -> tidak bisa require() langsung, harus
// dynamic import(). Diisi sekali di init(), dipakai belakangan oleh plugin
// format lama yang destructure `{ db }` dari argumen kedua handler.
let legacyDb = null;

/**
 * Sebagian besar plugin di /plugins format-nya native Niwo Bot:
 *      export default handler; handler.command = ['ping']
 * Sebagian lain (hasil import dari proyek lain) format-nya "legacy":
 *      const config = { name, alias, category, isOwner, ... };
 *      async function handler(m, { sock, ... }) { ... }
 *      export default { config, handler };
 * normalizeModule() menyeragamkan keduanya jadi satu bentuk handler yang
 * sama-sama punya .command / .tags / .isOwner / dst, supaya sisa bridge
 * (register, exec, permission check) tidak perlu tahu bedanya.
 */
function normalizeModule(mod, fallbackCategory) {
    const raw = mod.default || mod.handler || mod;
    if (!raw) return null;

    // Format legacy: { config: {...}, handler: fn }
    const looksLegacy = raw && typeof raw === 'object' && typeof raw.handler === 'function'
        && raw.config && typeof raw.config === 'object' && !Array.isArray(raw.command);

    if (!looksLegacy) return raw; // sudah format native, dipakai apa adanya

    const pc = raw.config;
    if (pc.isEnabled === false) return null;

    const names = [pc.name, ...(Array.isArray(pc.alias) ? pc.alias : [])]
        .filter(n => typeof n === 'string' && n.trim());
    if (!names.length) return null;

    const wrapped = async (m, extra) => {
        // Adaptasi m & extra ke bentuk yang diharapkan plugin legacy:
        // m.text di sini artinya "teks setelah command" (bukan full body),
        // sama seperti m.text di proyek asalnya.
        m.prefix = extra.usedPrefix || config.prefix;
        m.command = extra.command;
        m.fullArgs = extra.text || '';
        m.text = extra.text || '';
        m.isOwner = !!extra.isOwner;
        m.isAdmin = !!extra.isAdmin;
        m.isBotAdmin = !!extra.isBotAdmin;
        m.isCommand = true;
        m.groupMetadata = extra.groupMetadata;
        m.participants = extra.participants;

        return raw.handler(m, {
            ...extra,
            sock: extra.conn,
            config: config,
            db: legacyDb,
            plugin: pc,
        });
    };

    wrapped.command = names;
    wrapped.tags = [pc.category || fallbackCategory];
    wrapped.isOwner = !!pc.isOwner;
    wrapped.isGroup = !!pc.isGroup;
    wrapped.isPrivate = !!pc.isPrivate;
    wrapped.isAdmin = !!pc.isAdmin;
    wrapped.isBotAdmin = !!pc.isBotAdmin;
    wrapped.help = [pc.name];
    wrapped.description = pc.description || '';
    wrapped._legacyCategory = pc.category || fallbackCategory;
    return wrapped;
}

class PluginBridge {
    constructor() {
        this.commands = new Map();   // nama command -> { handler, file, category }
        this.categories = new Map(); // kategori -> Set(nama command utama)
        this.before = [];            // { file, fn }
        this.loaded = 0;
        this.failed = [];
        this.groupCache = new Map();
    }

    _walk(dir) {
        const out = [];
        if (!fs.existsSync(dir)) return out;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...this._walk(full));
            else if (entry.name.endsWith('.js')) out.push(full);
        }
        return out;
    }

    async init({ silent = false } = {}) {
        if (!legacyDb) {
            try {
                const dbPath = path.join(__dirname, '..', 'lib', 'database.js');
                const dbMod = await import(pathToFileURL(dbPath).href);
                legacyDb = (dbMod.getDatabase || dbMod.default?.getDatabase)?.();
            } catch (err) {
                if (!silent) console.log(chalk.yellow(`[PLUGIN] gagal load src/lib/database.js: ${err.message}`));
            }
        }

        const files = this._walk(PLUGIN_DIR);

        for (const file of files) {
            const rel = path.relative(PLUGIN_DIR, file);
            const folderCategory = (rel.split(path.sep)[0] || 'lainnya').toLowerCase();

            try {
                const mod = await import(pathToFileURL(file).href);
                const handler = normalizeModule(mod, folderCategory);
                if (!handler) continue;
                const category = (handler._legacyCategory || folderCategory).toLowerCase();

                if (typeof handler.before === 'function') {
                    this.before.push({ file: rel, fn: handler.before, handler });
                }

                let names = handler.command;
                if (names instanceof RegExp) {
                    const src = names.source.replace(/^\^|\$$/g, '').replace(/[()]/g, '');
                    names = src.split('|').filter(n => /^[\w-]+$/.test(n));
                } else if (typeof names === 'string') {
                    names = [names];
                }
                if (!Array.isArray(names) || names.length === 0) continue;

                names = names.filter(n => typeof n === 'string' && n.trim()).map(n => n.toLowerCase().trim());
                if (!names.length) continue;

                let registeredAny = false;
                for (const name of names) {
                    if (this.commands.has(name)) continue; // command duplikat -> yang pertama menang
                    this.commands.set(name, { handler, file: rel, category, aliases: names });
                    registeredAny = true;
                }

                if (registeredAny) {
                    if (!this.categories.has(category)) this.categories.set(category, new Set());
                    this.categories.get(category).add(names[0]);
                    this.loaded++;
                }
            } catch (err) {
                this.failed.push({ file: rel, error: err.message });
            }
        }

        if (!silent) {
            console.log(chalk.green(`[PLUGIN] ${this.loaded} file fitur dimuat • `) +
                chalk.cyan(`${this.commands.size} command`) +
                chalk.green(` • ${this.categories.size} kategori`));
            if (this.before.length) {
                console.log(chalk.blue(`[PLUGIN] ${this.before.length} event handler (before) aktif`));
            }
            if (this.failed.length) {
                console.log(chalk.yellow(`[PLUGIN] ${this.failed.length} file gagal dimuat (lihat .plugininfo)`));
            }
        }
        return this;
    }

    has(name) { return this.commands.has(String(name).toLowerCase()); }
    get(name) { return this.commands.get(String(name).toLowerCase()) || null; }
    list() { return [...this.commands.keys()]; }

    /** { kategori: [command utama, ...] } terurut */
    byCategory() {
        const out = {};
        for (const [cat, set] of [...this.categories.entries()].sort()) {
            out[cat] = [...set].sort();
        }
        return out;
    }

    async _groupMeta(Hanz, jid) {
        const cached = this.groupCache.get(jid);
        if (cached && Date.now() - cached.at < 60000) return cached.data;
        try {
            const data = await Hanz.groupMetadata(jid);
            this.groupCache.set(jid, { at: Date.now(), data });
            return data;
        } catch { return null; }
    }

    _norm(jid = '') { return String(jid).replace(/:\d+/, '').replace(/@.+$/, ''); }

    async _extras(Hanz, m, ctx) {
        let groupMetadata = null, participants = [], isAdmin = false, isBotAdmin = false;

        if (m.isGroup) {
            groupMetadata = await this._groupMeta(Hanz, m.chat);
            participants = groupMetadata?.participants || [];
            const find = (jid) => participants.find(p =>
                [p.id, p.lid, p.jid].filter(Boolean).map(x => this._norm(x)).includes(this._norm(jid)));
            const me = find(Hanz.user?.id);
            const user = find(m.senderAlt || m.sender);
            isBotAdmin = me?.admin === 'admin' || me?.admin === 'superadmin';
            isAdmin = user?.admin === 'admin' || user?.admin === 'superadmin';
        }

        return {
            conn: Hanz,
            sock: Hanz,
            usedPrefix: config.prefix,
            command: ctx.commandName,
            text: ctx.text || '',
            args: ctx.args || [],
            groupMetadata,
            participants,
            isAdmin,
            isBotAdmin,
            isOwner: !!ctx.isOwner,
            isCreator: !!ctx.isSuperOwner,
            isROwner: !!ctx.isSuperOwner,
            isPrems: !!ctx.isOwner,
            isPremium: !!ctx.isOwner,
            isBot: false,
            participantsUpdate: [],
        };
    }

    /** Jalankan handler.before dari semua event plugin (jawaban game, anti-link, dll) */
    async runBefore(Hanz, m, ctx = {}) {
        if (!this.before.length) return false;
        let stop = false;

        for (const { file, fn } of this.before) {
            try {
                const extra = {
                    conn: Hanz,
                    sock: Hanz,
                    usedPrefix: config.prefix,
                    command: ctx.commandName || '',
                    text: m.text || '',
                    args: m.args || [],
                    isOwner: !!ctx.isOwner,
                    isAdmin: !!ctx.isAdmin,
                    isBotAdmin: !!ctx.isBotAdmin,
                    groupMetadata: null,
                    participants: [],
                };
                const res = await fn.call(Hanz, m, extra);
                if (res === true) stop = true;
            } catch (err) {
                if (err !== false) {
                    console.error(chalk.red(`[EVENT-ERROR] ${file}: ${err?.message || err}`));
                }
            }
        }
        return stop;
    }

    /**
     * Eksekusi command plugin.
     * ctx: { Hanz, msg, m?, commandName, text, args, isOwner, isSuperOwner }
     */
    async exec(ctx) {
        const { Hanz, msg, commandName } = ctx;
        const entry = this.get(commandName);
        if (!entry) return false;

        patchConn(Hanz);
        const m = ctx.m || serialize(Hanz, msg);
        const extra = await this._extras(Hanz, m, ctx);
        const h = entry.handler;

        // ---- validasi hak akses ----
        if (h.isOwner && !ctx.isOwner) {
            await m.reply('🚫 Fitur ini khusus *Owner* bot.');
            return true;
        }
        if (h.isGroup && !m.isGroup) {
            await m.reply('🚫 Fitur ini hanya bisa dipakai di dalam *grup*.');
            return true;
        }
        if (h.isPrivate && m.isGroup) {
            await m.reply('🚫 Fitur ini hanya bisa dipakai di *chat pribadi*.');
            return true;
        }
        if (h.isAdmin && !extra.isAdmin && !ctx.isOwner) {
            await m.reply('🚫 Fitur ini khusus *Admin grup*.');
            return true;
        }
        if (h.isBotAdmin && !extra.isBotAdmin) {
            await m.reply('🚫 Jadikan bot sebagai *Admin grup* dulu ya.');
            return true;
        }

        try {
            await h(m, extra);
        } catch (err) {
            if (err === false) return true;   // konvensi plugin: throw false = diam
            console.error(chalk.red(`[PLUGIN-ERROR] ${entry.file} (${commandName}): ${err?.message || err}`));
            try {
                await m.reply(`❌ Fitur *${commandName}* gagal dijalankan.\n\n*Alasan:* ${err?.message || 'kesalahan tidak diketahui'}`);
            } catch { /* abaikan */ }
        }
        return true;
    }
}

module.exports = new PluginBridge();

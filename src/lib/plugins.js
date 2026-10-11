/**
 * Plugin loader + collision-safe command registry.
 *
 * Prinsip registry:
 * 1. Semua canonical command didaftarkan lebih dulu.
 * 2. Canonical command tidak boleh ditimpa plugin lain.
 * 3. Bila canonical duplicate, plugin kedua mendapat command internal unik
 *    berbasis category + name (contoh: rpgdaily).
 * 4. Alias yang bertabrakan tidak menimpa command yang sudah ada.
 * 5. Alias yang kalah diberi fallback alias unik berbasis category + alias,
 *    sehingga fiturnya tetap bisa dipanggil tanpa menghapus handler.
 * 6. Hot reload membangun ulang registry sehingga hasilnya deterministik.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import chokidar from "chokidar";
import { normalizePlugin, syncGlobalPlugins } from "./featureRuntime.js";

const PLUGIN_DIR = path.join(process.cwd(), "plugins");
const plugins = new Map();
const aliases = new Map();
const cooldowns = new Map();
let watcher = null;

function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function clean(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-");
}

function uniqueCommand(base, used) {
  let candidate = clean(base) || "plugin";
  if (!used.has(candidate)) return candidate;
  for (let i = 2; i < 10000; i++) {
    const next = `${candidate}${i}`;
    if (!used.has(next)) return next;
  }
  return `${candidate}${Date.now()}`;
}

function pluginBase(plugin) {
  const category = clean(plugin?.config?.category || "plugin");
  const name = clean(plugin?.config?.name || "plugin");
  return `${category}${name}`;
}

function unregisterByFile(file) {
  for (const [name, plugin] of plugins) {
    if (plugin.__file === file) plugins.delete(name);
  }
  rebuildRegistry();
}

/** Register every loaded plugin with deterministic collision handling. */
function rebuildRegistry() {
  aliases.clear();

  const used = new Set();
  const loaded = [...plugins.values()].sort((a, b) =>
    String(a.__file || "").localeCompare(String(b.__file || ""))
  );

  // Rebuild from a clean map so temporary/stale keys never remain.
  plugins.clear();

  // Canonicals first. A duplicate canonical gets an internal unique name.
  for (const plugin of loaded) {
    const rawName = clean(plugin.config.name);
    const canonical = uniqueCommand(rawName || pluginBase(plugin), used);
    if (canonical !== rawName) {
      const previous = plugin.config.name;
      plugin.config.commandName = canonical;
      plugin.config.originalName = previous;
      plugin.config.collisionResolved = true;
      console.warn(
        `[plugins] ⚠ Canonical bentrok: "${previous}" pada ${path.relative(PLUGIN_DIR, plugin.__file)} → command unik "${canonical}".`
      );
    } else {
      plugin.config.commandName = canonical;
      plugin.config.originalName = plugin.config.originalName || canonical;
      plugin.config.collisionResolved = false;
    }
    plugin.__command = canonical;
    used.add(canonical);
    plugins.set(canonical, plugin);
  }

  // Build aliases after all canonical commands are reserved.
  for (const plugin of plugins.values()) {
    const canonical = plugin.__command;
    aliases.set(canonical, canonical);

    const rawAliases = Array.isArray(plugin.config.alias)
      ? plugin.config.alias
      : [plugin.config.alias];

    const finalAliases = [];
    const seen = new Set();

    for (const raw of rawAliases) {
      const alias = clean(raw);
      if (!alias || alias === canonical || seen.has(alias)) continue;
      seen.add(alias);

      // Alias sama dengan canonical plugin lain => canonical menang.
      const existingCanonical = plugins.has(alias) ? alias : null;
      if (existingCanonical && existingCanonical !== canonical) {
        const fallback = uniqueCommand(`${plugin.config.category}${alias}`, used);
        used.add(fallback);
        aliases.set(fallback, canonical);
        finalAliases.push(fallback);
        console.warn(
          `[plugins] ⚠ Alias bentrok: "${alias}" milik ${canonical}; canonical "${existingCanonical}" dipertahankan, fallback → "${fallback}".`
        );
        continue;
      }

      const existing = aliases.get(alias);
      if (existing && existing !== canonical) {
        const fallback = uniqueCommand(`${plugin.config.category}${alias}`, used);
        used.add(fallback);
        aliases.set(fallback, canonical);
        finalAliases.push(fallback);
        console.warn(
          `[plugins] ⚠ Alias bentrok: "${alias}" (${existing} vs ${canonical}); fallback → "${fallback}".`
        );
        continue;
      }

      aliases.set(alias, canonical);
      finalAliases.push(alias);
    }

    // Menjaga metadata supaya menu / plugin lama tahu alias final yang aktif.
    plugin.config.alias = [...new Set(finalAliases)];
    plugin.config.aliases = [canonical, ...plugin.config.alias];
  }

  syncGlobalPlugins(plugins);
}

async function loadOne(file, { silent = false } = {}) {
  try {
    // Jangan biarkan plugin stale tetap menempel saat hot reload.
    for (const [key, plugin] of plugins) {
      if (plugin.__file === file) plugins.delete(key);
    }

    const url = `${pathToFileURL(file).href}?update=${Date.now()}`;
    const mod = await import(url);
    const plugin = normalizePlugin(mod.default, mod);

    if (!plugin || typeof plugin.handler !== "function") {
      console.warn(
        `[plugins] ⚠ Skipped ${path.relative(PLUGIN_DIR, file)}: missing config.name atau handler()`
      );
      rebuildRegistry();
      return null;
    }

    plugin.__file = file;
    // Jangan langsung set berdasarkan name mentah; rebuildRegistry yang mengurus collision.
    const tempKey = `__loading__${Date.now()}_${Math.random().toString(16).slice(2)}`;
    plugins.set(tempKey, plugin);
    rebuildRegistry();

    if (!silent) {
      console.log(`[plugins] ✓ ${plugin.config.commandName} (${plugin.config.category})`);
    }
    return plugin;
  } catch (err) {
    console.error(
      `[plugins] ✗ Failed to load ${path.relative(PLUGIN_DIR, file)}:`,
      err?.stack || err?.message || err
    );
    return null;
  }
}

function printLoadSummary(fileCount) {
  const byCategory = new Map();
  for (const p of plugins.values()) {
    const cat = p.config.category;
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
  }
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const nameWidth = Math.max(...sorted.map(([cat]) => cat.length), "total".length) + 2;

  console.log("");
  console.log("🔌 Plugins loaded ──────────────────");
  for (const [cat, count] of sorted) console.log(`   ${cat.padEnd(nameWidth)}${count}`);
  console.log("   " + "─".repeat(nameWidth + 3));
  console.log(`   ${"total".padEnd(nameWidth)}${plugins.size}  (${fileCount} file)`);
  console.log("");
}

async function loadPlugins(opts = {}) {
  plugins.clear();
  aliases.clear();
  syncGlobalPlugins(plugins);

  const files = walk(PLUGIN_DIR);
  for (const file of files) await loadOne(file, { silent: true });
  rebuildRegistry();
  printLoadSummary(files.length);

  if (opts.watch && !watcher) {
    watcher = chokidar.watch(PLUGIN_DIR, { ignoreInitial: true });
    watcher
      .on("add", (file) => loadOne(file))
      .on("change", (file) => loadOne(file))
      .on("unlink", (file) => {
        for (const [key, plugin] of plugins) {
          if (plugin.__file === file) plugins.delete(key);
        }
        rebuildRegistry();
        console.log(`[plugins] ✗ Unloaded: ${path.relative(PLUGIN_DIR, file)}`);
      });
    console.log("[plugins] 👀 Watching for changes...");
  }

  rebuildRegistry();
  return plugins;
}

function getPluginByCommand(command) {
  const key = clean(command);
  const name = aliases.get(key);
  if (!name) return null;
  const plugin = plugins.get(name);
  return plugin?.config?.isEnabled === false ? null : plugin || null;
}

function getCommandsByCategory() {
  const result = {};
  for (const plugin of plugins.values()) {
    if (!plugin.config.isEnabled) continue;
    const cat = plugin.config.category;
    if (!result[cat]) result[cat] = [];
    result[cat].push(plugin.config);
  }
  return result;
}

function getCategories() {
  return [...new Set([...plugins.values()]
    .filter((p) => p.config.isEnabled)
    .map((p) => p.config.category))];
}

function getAllPlugins() {
  return [...plugins.values()];
}

function checkCooldown(pluginName, jid) {
  const plugin = plugins.get(pluginName);
  const cooldownSec = plugin?.config?.cooldown || 0;
  if (!cooldownSec) return 0;

  const key = `${pluginName}:${jid}`;
  const last = cooldowns.get(key) || 0;
  const elapsed = (Date.now() - last) / 1000;
  if (elapsed < cooldownSec) return Math.ceil(cooldownSec - elapsed);

  cooldowns.set(key, Date.now());
  return 0;
}

function getCommandRegistry() {
  const result = {};
  for (const [alias, canonical] of aliases) result[alias] = canonical;
  return result;
}

export {
  loadPlugins,
  getPluginByCommand,
  getCommandsByCategory,
  getCategories,
  getAllPlugins,
  checkCooldown,
  getCommandRegistry,
};

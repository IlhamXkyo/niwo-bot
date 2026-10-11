/**
 * featureRuntime.js
 * Compatibility/runtime bridge for Niwo Bot plugins.
 *
 * Handles plugin metadata normalization and optional interactive handlers
 * (replyHandler, answerHandler, registrationAnswerHandler, ...).
 * The bridge is deliberately defensive: a broken special handler never
 * crashes the global message dispatcher.
 */

const SPECIAL_HANDLER_NAMES = [
  "registrationAnswerHandler",
  "answerHandler",
  "replyHandler",
];

function toNameList(value) {
  const input = Array.isArray(value) ? value : [value];
  return input
    .flat(Infinity)
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizePlugin(plugin, moduleExports = {}) {
  if (!plugin || typeof plugin !== "object") return null;

  const rawConfig = plugin.config || {};
  const names = toNameList(rawConfig.name);
  if (!names.length) return null;

  const aliases = [
    ...toNameList(rawConfig.alias),
    ...names.slice(1),
  ];

  const seen = new Set();
  const uniqueAliases = aliases.filter((name) => {
    if (name === names[0] || seen.has(name)) return false;
    seen.add(name);
    return true;
  });

  const config = {
    ...rawConfig,
    name: names[0],
    aliases: names,
    alias: uniqueAliases,
    category: String(rawConfig.category || "lainnya").trim().toLowerCase(),
    isEnabled: rawConfig.isEnabled !== false,
  };

  const result = { ...plugin, config };

  for (const handlerName of SPECIAL_HANDLER_NAMES) {
    if (typeof result[handlerName] !== "function" && typeof moduleExports[handlerName] === "function") {
      result[handlerName] = moduleExports[handlerName];
    }
  }

  return result;
}

function syncGlobalPlugins(pluginMap) {
  const registry = {};
  for (const [name, plugin] of pluginMap) registry[name] = plugin;
  globalThis.plugins = registry;
  globalThis.pluginRegistry = registry;
  return registry;
}

function getSpecialHandlers(plugin) {
  if (!plugin) return [];
  return SPECIAL_HANDLER_NAMES
    .map((name) => ({ name, fn: plugin[name] }))
    .filter((entry) => typeof entry.fn === "function");
}

async function runSpecialHandlers(m, context, pluginMap) {
  if (!m || !pluginMap) return false;

  // Interactive handlers are intended for messages that are not ordinary
  // commands. Command messages should still flow to the normal command path.
  if (m.isCommand) return false;

  for (const plugin of pluginMap.values()) {
    if (!plugin?.config?.isEnabled) continue;

    for (const { name, fn } of getSpecialHandlers(plugin)) {
      try {
        let result;
        if (name === "answerHandler" || name === "registrationAnswerHandler") {
          result = await fn(m, context.sock);
        } else {
          result = await fn(m, context);
        }

        if (result === true) return true;
      } catch (err) {
        console.error(`[special:${name}] ${plugin.config.name}:`, err?.message || err);
      }
    }
  }

  return false;
}

export {
  SPECIAL_HANDLER_NAMES,
  toNameList,
  normalizePlugin,
  syncGlobalPlugins,
  getSpecialHandlers,
  runSpecialHandlers,
};

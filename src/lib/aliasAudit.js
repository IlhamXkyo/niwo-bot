/** Runtime audit helper: exposes command/alias collisions without crashing bot. */
import { getAllPlugins, getCommandRegistry } from "./plugins.js";

export function auditAliases() {
  const registry = getCommandRegistry();
  const reverse = new Map();
  for (const [alias, canonical] of Object.entries(registry)) {
    if (!reverse.has(alias)) reverse.set(alias, new Set());
    reverse.get(alias).add(canonical);
  }

  const collisions = [];
  for (const [alias, owners] of reverse) {
    if (owners.size > 1) collisions.push({ alias, owners: [...owners] });
  }

  return {
    plugins: getAllPlugins().length,
    commands: Object.keys(registry).length,
    collisions,
    ok: collisions.length === 0,
  };
}

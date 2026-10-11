import fs from "fs";
import os from "os";
import path from "path";
import { getAllPlugins } from "../../src/lib/plugins.js";

const config = {
  name: "botstats",
  alias: ["statsbot", "statusbot"],
  category: "owner",
  description: "Melihat statistik dan status bot",
  usage: ".botstats",
  example: ".botstats",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 2 : 0)} ${units[i]}`;
}

function formatUptime(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);
  const d = Math.floor(seconds / 86400);
  seconds %= 86400;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", m ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
}

function getDirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          if (entry.name === "session" || entry.name === "node_modules") continue;
          walk(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {}
    }
  };
  walk(dir);
  return total;
}

async function handler(m, { config: botConfig, db, uptime }) {
  try {
    const plugins = getAllPlugins().filter(p => p?.config?.isEnabled);
    const categories = new Set(plugins.map(p => p.config.category));
    const userCount = db.getUserCount?.() ?? Object.keys(db.getAllUsers?.() || {}).length;
    const groupCount = db.getGroupCount?.() ?? Object.keys(db.getAllGroups?.() || {}).length;
    const memory = process.memoryUsage();
    const load = os.loadavg?.() || [0, 0, 0];
    const botName = botConfig?.botName || botConfig?.bot?.name || "Niwo Bot";
    const dbSize = getDirSize(path.join(process.cwd(), "database"));

    const text =
      `━━● 〔 *BOT STATS* 〕 ●━━\n\n` +
      `〄 Bot          : *${botName}*\n` +
      `〄 Status       : *ONLINE*\n` +
      `〄 Uptime       : *${formatUptime(uptime)}*\n` +
      `〄 Plugins      : *${plugins.length}*\n` +
      `〄 Categories   : *${categories.size}*\n` +
      `〄 Users DB     : *${userCount.toLocaleString("id-ID")}*\n` +
      `〄 Groups DB    : *${groupCount.toLocaleString("id-ID")}*\n\n` +
      `━━● 〔 *SYSTEM* 〕 ●━━\n\n` +
      `〄 Node         : *${process.version}*\n` +
      `〄 Platform     : *${process.platform} ${process.arch}*\n` +
      `〄 RAM Process  : *${formatBytes(memory.rss)}*\n` +
      `〄 Heap Used    : *${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}*\n` +
      `〄 RAM Host     : *${formatBytes(os.totalmem() - os.freemem())} / ${formatBytes(os.totalmem())}*\n` +
      `〄 Load 1m      : *${Number(load[0] || 0).toFixed(2)}*\n` +
      `〄 Database     : *${formatBytes(dbSize)}*`;

    return m.reply(text);
  } catch (err) {
    console.error("[BOTSTATS ERROR]", err);
    return m.reply(`❌ Gagal mengambil statistik bot.\n\n${err?.message || err}`);
  }
}

export default { config, handler };

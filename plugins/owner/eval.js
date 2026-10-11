import { inspect } from "util";

const config = {
  name: "eval",
  alias: ["ev", ">"],
  category: "owner",
  description: "Eksekusi kode JS (owner only)",
  usage: ".eval <code>",
  example: ".eval m.chat",
  isOwner: true,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { sock, config: botConfig, db }) {
  if (!m.text) return m.reply(`Contoh: ${config.usage}`);

  try {
    let result = await eval(`(async () => { ${m.text.includes("return") ? m.text : `return ${m.text}`} })()`);
    if (typeof result !== "string") result = inspect(result);
    await m.reply(result);
  } catch (err) {
    await m.reply(`❌ ${err.message}`);
  }
}

export default { config, handler };

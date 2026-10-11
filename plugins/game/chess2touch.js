const config = {
  name: "chess2touch",
  alias: [],
  category: "game",
  description: "Plugin lama dinonaktifkan; gunakan .catur atau .chess",
  usage: ".catur",
  example: ".catur",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 0,
  energi: 0,
  isEnabled: false,
};

async function handler(m) {
  return m.reply("Gunakan .catur atau .chess untuk membuka game AI Rich.");
}

export default { config, handler };

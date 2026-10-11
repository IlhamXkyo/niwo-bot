import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "glowlogo",
  alias: ["glow", "logoglow"],
  category: "maker",
  description: "Membuat logo bercahaya (glow) dari teks",
  usage: ".glowlogo <teks>",
  example: ".glowlogo hiyuki",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 2,
  isEnabled: true,
};

async function handler(m, { sock }) {
  return runTextMaker(m, sock, {
    title: "GLOW LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("advancedglow", text),
  });
}

export default { config, handler };

import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "freefire",
  alias: ["ff", "fflogo", "freefirelogo"],
  category: "maker",
  description: "Membuat logo bergaya Free Fire dari teks",
  usage: ".freefire <teks>",
  example: ".freefire hiyuki",
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
    title: "FREE FIRE LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("glitchtext", text),
  });
}

export default { config, handler };

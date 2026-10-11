import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "neonlogo",
  alias: ["neon", "logoneon"],
  category: "maker",
  description: "Membuat logo bergaya neon dari teks",
  usage: ".neonlogo <teks>",
  example: ".neonlogo hiyuki",
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
    title: "NEON LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("multicoloredneon", text),
  });
}

export default { config, handler };

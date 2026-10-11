import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "glitchlogo",
  alias: ["glitch", "logoglitch"],
  category: "maker",
  description: "Membuat logo bergaya glitch dari teks",
  usage: ".glitchlogo <teks>",
  example: ".glitchlogo hiyuki",
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
    title: "GLITCH LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("pixelglitch", text),
  });
}

export default { config, handler };

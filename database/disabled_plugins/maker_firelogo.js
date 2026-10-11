import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "firelogo",
  alias: ["fire", "logofire", "apilogo"],
  category: "maker",
  description: "Membuat logo bergaya api dari teks",
  usage: ".firelogo <teks>",
  example: ".firelogo hiyuki",
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
    title: "FIRE LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("lighteffects", text),
  });
}

export default { config, handler };

import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "thunderlogo",
  alias: ["thunder", "logothunder", "petir"],
  category: "maker",
  description: "Membuat logo bergaya petir dari teks",
  usage: ".thunderlogo <teks>",
  example: ".thunderlogo hiyuki",
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
    title: "THUNDER LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("glowingtext", text),
  });
}

export default { config, handler };

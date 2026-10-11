import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "icelogo",
  alias: ["ice", "logoice", "eslogo"],
  category: "maker",
  description: "Membuat logo bertekstur es dari teks",
  usage: ".icelogo <teks>",
  example: ".icelogo hiyuki",
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
    title: "ICE LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("underwatertext", text),
  });
}

export default { config, handler };

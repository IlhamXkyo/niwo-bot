import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "silverlogo",
  alias: ["silver", "logosilver", "peraklogo"],
  category: "maker",
  description: "Membuat logo perak metalik dari teks",
  usage: ".silverlogo <teks>",
  example: ".silverlogo hiyuki",
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
    title: "SILVER LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("royaltext", text),
  });
}

export default { config, handler };

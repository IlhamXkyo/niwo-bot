import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "graffiti",
  alias: ["grafiti", "graffitilogo"],
  category: "maker",
  description: "Membuat tulisan bergaya graffiti dinding",
  usage: ".graffiti <teks>",
  example: ".graffiti hiyuki",
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
    title: "GRAFFITI",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("papercutstyle", text),
  });
}

export default { config, handler };

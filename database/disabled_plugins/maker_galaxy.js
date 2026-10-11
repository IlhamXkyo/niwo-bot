import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "galaxy",
  alias: ["galaxylogo", "galaksi"],
  category: "maker",
  description: "Membuat teks bertekstur galaksi",
  usage: ".galaxy <teks>",
  example: ".galaxy hiyuki",
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
    title: "GALAXY TEXT",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("galaxystyle", text),
  });
}

export default { config, handler };

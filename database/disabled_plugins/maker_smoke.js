import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "smoke",
  alias: ["smokelogo", "asaplogo"],
  category: "maker",
  description: "Membuat efek teks berasap",
  usage: ".smoke <teks>",
  example: ".smoke hiyuki",
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
    title: "SMOKE TEXT",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("effectclouds", text),
  });
}

export default { config, handler };

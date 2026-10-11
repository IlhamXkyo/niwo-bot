import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "lava",
  alias: ["lavalogo", "magma"],
  category: "maker",
  description: "Membuat teks bertekstur lava panas",
  usage: ".lava <teks>",
  example: ".lava hiyuki",
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
    title: "LAVA TEXT",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("effectclouds", text),
  });
}

export default { config, handler };

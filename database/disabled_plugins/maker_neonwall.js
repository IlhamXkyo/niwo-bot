import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "neonwall",
  alias: ["neondinding", "wallneon"],
  category: "maker",
  description: "Membuat tulisan neon di dinding dengan dua baris teks",
  usage: ".neonwall <teks1>|<teks2>",
  example: ".neonwall hiyuki|bot",
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
    title: "NEON WALL",
    name: config.name,
    example: "hiyuki|bot",
    minWords: 2,
    buildUrl: (text) => {
      const [t1, t2] = text.split("|").map((s) => s.trim());
      return ephotoUrl("makingneon", t1, { text2: t2 });
    },
  });
}

export default { config, handler };

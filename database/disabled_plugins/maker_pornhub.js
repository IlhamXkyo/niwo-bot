import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "phlogo",
  alias: ["logoph", "yellowbox"],
  category: "maker",
  description: "Membuat logo kotak kuning-hitam dua kata",
  usage: ".phlogo <teks1>|<teks2>",
  example: ".phlogo hiyuki|bot",
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
    title: "YELLOW BOX LOGO",
    name: config.name,
    example: "hiyuki|bot",
    minWords: 2,
    buildUrl: (text) => {
      const [t1, t2] = text.split("|").map((s) => s.trim());
      return ephotoUrl("blackpinkstyle", t1, { text2: t2 });
    },
  });
}

export default { config, handler };

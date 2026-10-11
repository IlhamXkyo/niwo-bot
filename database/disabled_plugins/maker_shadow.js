import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "shadowlogo",
  alias: ["shadow", "logoshadow"],
  category: "maker",
  description: "Membuat logo bayangan dengan dua baris teks",
  usage: ".shadowlogo <teks1>|<teks2>",
  example: ".shadowlogo hiyuki|bot",
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
    title: "SHADOW LOGO",
    name: config.name,
    example: "hiyuki|bot",
    minWords: 2,
    buildUrl: (text) => {
      const [t1, t2] = text.split("|").map((s) => s.trim());
      return ephotoUrl("deletingtext", t1, { text2: t2 });
    },
  });
}

export default { config, handler };

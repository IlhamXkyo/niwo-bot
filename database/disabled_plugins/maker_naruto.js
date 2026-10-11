import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "naruto",
  alias: ["narutologo", "logonaruto"],
  category: "maker",
  description: "Membuat logo bergaya Naruto dengan dua baris teks",
  usage: ".naruto <teks1>|<teks2>",
  example: ".naruto hiyuki|bot",
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
    title: "NARUTO LOGO",
    name: config.name,
    example: "hiyuki|bot",
    minWords: 2,
    buildUrl: (text) => {
      const [t1, t2] = text.split("|").map((s) => s.trim());
      return ephotoUrl("cartoonstyle", t1, { text2: t2 });
    },
  });
}

export default { config, handler };

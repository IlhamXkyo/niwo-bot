import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "goldlogo",
  alias: ["gold", "logogold", "emaslogo"],
  category: "maker",
  description: "Membuat logo emas mengkilap dari teks",
  usage: ".goldlogo <teks>",
  example: ".goldlogo hiyuki",
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
    title: "GOLD LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("luxurygold", text),
  });
}

export default { config, handler };

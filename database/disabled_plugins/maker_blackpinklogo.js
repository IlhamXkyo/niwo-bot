import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "blackpinklogo",
  alias: ["blackpink", "bplogo"],
  category: "maker",
  description: "Membuat logo bergaya BLACKPINK dari teks",
  usage: ".blackpinklogo <teks>",
  example: ".blackpinklogo hiyuki",
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
    title: "BLACKPINK LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("blackpinklogo", text),
  });
}

export default { config, handler };

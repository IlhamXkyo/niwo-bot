import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "avengers",
  alias: ["avengerslogo", "logoavengers"],
  category: "maker",
  description: "Membuat logo bergaya Avengers",
  usage: ".avengers <teks>",
  example: ".avengers hiyuki",
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
    title: "AVENGERS LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("1917style", text),
  });
}

export default { config, handler };

import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "marvel",
  alias: ["marvellogo", "logomarvel"],
  category: "maker",
  description: "Membuat logo bergaya intro Marvel Studios",
  usage: ".marvel <teks>",
  example: ".marvel hiyuki",
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
    title: "MARVEL LOGO",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("flagtext", text),
  });
}

export default { config, handler };

import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "sandwrite",
  alias: ["pasir", "tulispasir"],
  category: "maker",
  description: "Membuat tulisan di atas pasir pantai",
  usage: ".sandwrite <teks>",
  example: ".sandwrite hiyuki",
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
    title: "SAND WRITE",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("sandsummer", text),
  });
}

export default { config, handler };

import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "wooden",
  alias: ["woodlogo", "woodenlogo"],
  category: "maker",
  description: "Membuat teks berukir kayu",
  usage: ".wooden <teks>",
  example: ".wooden hiyuki",
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
    title: "WOODEN TEXT",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("summerbeach", text),
  });
}

export default { config, handler };

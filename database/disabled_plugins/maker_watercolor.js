import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "watercolor",
  alias: ["cat air", "watercolorlogo", "wclogo"],
  category: "maker",
  description: "Membuat teks bergaya lukisan cat air",
  usage: ".watercolor <teks>",
  example: ".watercolor hiyuki",
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
    title: "WATERCOLOR",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("watercolortext", text),
  });
}

export default { config, handler };

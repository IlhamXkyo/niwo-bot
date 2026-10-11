import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "quotemaker",
  alias: ["quotesmaker", "qmaker"],
  category: "maker",
  description: "Membuat gambar kutipan dari teks",
  usage: ".quotemaker <teks>",
  example: ".quotemaker hidup itu pilihan",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  return runTextMaker(m, sock, {
    title: "QUOTE MAKER",
    name: config.name,
    example: "hidup itu pilihan",
    buildUrl: (text) => ephotoUrl("writetext", text),
  });
}

export default { config, handler };

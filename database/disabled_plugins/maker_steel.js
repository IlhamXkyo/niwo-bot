import { runTextMaker, ephotoUrl } from "../../src/lib/makerHelper.js";

const config = {
  name: "steel",
  alias: ["baja", "steellogo", "metallogo"],
  category: "maker",
  description: "Membuat teks bertekstur baja",
  usage: ".steel <teks>",
  example: ".steel hiyuki",
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
    title: "STEEL TEXT",
    name: config.name,
    example: "hiyuki",
    buildUrl: (text) => ephotoUrl("logomaker", text),
  });
}

export default { config, handler };

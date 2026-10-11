const config = {
  name: "rules",
  alias: ["peraturan", "rule"],
  category: "main",
  description: "Peraturan penggunaan bot",
  usage: ".rules",
  example: ".rules",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { config: botConfig }) {
  const text = `📜 *PERATURAN ${botConfig.bot?.name || "BOT"}*

1️⃣ Dilarang spam command secara berlebihan.
2️⃣ Dilarang menyalahgunakan bot untuk hal ilegal.
3️⃣ Dilarang menyebarkan konten SARA/pornografi lewat bot.
4️⃣ Laporkan bug ke owner, jangan disebar duluan.
5️⃣ Owner berhak banned user yang melanggar tanpa pemberitahuan.

_Dengan menggunakan bot ini, kamu dianggap setuju dengan peraturan di atas._`;

  await m.reply(text);
}

export default { config, handler };
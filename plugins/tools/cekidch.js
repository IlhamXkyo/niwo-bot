const config = {
  name: "cekidch",
  alias: ["channelid", "idch"],
  category: "tools",
  description: "Mengecek ID asli WhatsApp Channel dari link",
  usage: ".cekidch <link channel>",
  example: ".cekidch https://whatsapp.com/channel/0029VbBxxxxxxxx",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true
};

async function handler(m, { sock }) {
  const input = String(m.text || "").trim();

  if (!input) {
    return m.reply(
      "Masukkan link WhatsApp Channel.\n\n" +
      "Contoh:\n" +
      ".cekidch https://whatsapp.com/channel/0029VbBxxxxxxxx"
    );
  }

  const match = input.match(
    /https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i
  );

  if (!match) {
    return m.reply(
      "Link Channel tidak valid.\n\n" +
      "Format:\n" +
      "https://whatsapp.com/channel/XXXXXXXX"
    );
  }

  const inviteCode = match[1];

  try {
    if (typeof sock.newsletterMetadata !== "function") {
      return m.reply(
        "Fitur newsletterMetadata tidak tersedia di library bot ini."
      );
    }

    const metadata = await sock.newsletterMetadata(
      "invite",
      inviteCode
    );

    const channelId = metadata?.id;

    if (!channelId || !String(channelId).endsWith("@newsletter")) {
      return m.reply("ID Channel tidak berhasil ditemukan.");
    }

    return m.reply(
      `ID CHANNEL\n\n` +
      `${channelId}`
    );
  } catch (err) {
    console.error("[cekidch]", err);

    return m.reply(
      "Gagal mengambil ID Channel.\n" +
      "Pastikan link Channel masih valid."
    );
  }
}

export default { config, handler };
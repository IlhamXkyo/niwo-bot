// plugins/owner/addmeta.js

const config = {
  name: "addmeta",
  alias: ["addai", "metaai", "tambahmeta"],
  category: "owner",
  description: "Tambah Meta AI ke grup",
  usage: ".addmeta (di grup)",
  isOwner: true,
  isPremium: false,
  isGroup: true,
  isPrivate: false,
  isAdmin: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

const SALURAN = {
  name: global.info?.namebot || global.botname || "Niwo Bot",
  id: "120363427915199733@newsletter"
};

const fkontak = {
  key: {
    participant: "0@s.whatsapp.net",
    remoteJid: "0@s.whatsapp.net",
    fromMe: false,
    id: "AddMeta"
  },
  message: {
    conversation: "ADD META AI"
  }
};

function sendForward(sock, jid, text, mentions = [], quoted = null) {
  return sock.sendMessage(
    jid,
    {
      text,
      contextInfo: {
        mentionedJid: mentions,
        forwardingScore: 9999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: SALURAN.id,
          newsletterName: SALURAN.name,
          serverMessageId: 127
        }
      }
    },
    { quoted }
  );
}

async function handler(m, { sock }) {
  const groupJid = m.chat;

  if (!groupJid?.endsWith("@g.us")) {
    return sendForward(
      sock,
      m.sender,
      "❌ Command ini hanya untuk grup!",
      [m.sender],
      fkontak
    );
  }

  await m.react("⏳");

  try {
    await sock.groupParticipantsUpdate(
      groupJid,
      ["867051314767696@bot"],
      "add"
    );

    await m.react("✅");

    return sendForward(
      sock,
      m.sender,
      "✅ *Meta AI berhasil ditambahkan!*",
      [m.sender],
      fkontak
    );
  } catch (e) {
    console.error("[ADDMETA ERROR]", e);

    await m.react("❌");

    return sendForward(
      sock,
      m.sender,
      `❌ Gagal!\n\n${e?.message || e}`,
      [m.sender],
      fkontak
    );
  }
}

export default { config, handler };
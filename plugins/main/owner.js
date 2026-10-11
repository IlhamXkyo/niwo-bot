// plugins/main/owner.js

import { AIRich, Toolkit } from "../../src/lib/MessageBuilder.js";

const config = {
  name: "owner",
  alias: ["creator"],
  category: "main",
  description: "Menampilkan informasi owner bot",
  usage: ".owner",
  example: ".owner",
  cooldown: 3,
  energi: 0
};

async function uploadImage(sock, url) {
  const result = await Toolkit.resolveMedia(
    sock,
    url,
    "image",
    {
      resolveUrl: true,
      result: "url"
    }
  );

  if (!result) {
    throw new Error(`Gagal upload gambar: ${url}`);
  }

  return result;
}

async function handler(m, { sock, config: botConfig }) {
  try {
    const botName = String(
      botConfig?.botName ??
      botConfig?.name ??
      "NIWO BOT"
    );

    let ownerName =
      botConfig?.namaowner ??
      botConfig?.ownerName ??
      "ilham";

    if (typeof ownerName === "object" && ownerName !== null) {
      ownerName =
        ownerName.name ??
        ownerName.nama ??
        ownerName.username ??
        ownerName.number ??
        ownerName.jid ??
        "dekzyy";
    }

    ownerName = String(ownerName || "dekzyy");

    let ownerNumber =
      botConfig?.superOwner ??
      botConfig?.ownerNumber ??
      botConfig?.owner ??
      "6285217124804";

    if (Array.isArray(ownerNumber)) {
      ownerNumber = ownerNumber[0];
    }

    if (typeof ownerNumber === "object" && ownerNumber !== null) {
      ownerNumber =
        ownerNumber.number ??
        ownerNumber.jid ??
        ownerNumber.id ??
        "";
    }

    ownerNumber = String(ownerNumber).replace(/[^0-9]/g, "");

    // ==============================
    // URL GAMBAR
    // ==============================
    const bannerSource =
      "https://files.catbox.moe/9u2sc9.png";

    const profileSource =
      "https://files.catbox.moe/bsp8mq.png";

    // ==============================
    // UPLOAD KE MEDIA WHATSAPP
    // ==============================
    const [bannerUrl, profileUrl] = await Promise.all([
      uploadImage(sock, bannerSource),
      uploadImage(sock, profileSource)
    ]);

    console.log("[OWNER] Banner:", bannerUrl);
    console.log("[OWNER] Profile:", profileUrl);

    const ai = new AIRich(sock);

    // ==============================
    // HEADER
    // ==============================
    ai.setTitle(botName);

    // ==============================
    // BANNER
    // ==============================
    ai.addSection({
      view_model: {
        primitive: {
          media: {
            url: bannerUrl,
            mime_type: "image/png",
            width: 16,
            height: 9
          },
          imagine_type: "IMAGE",
          status: {
            status: "READY"
          },
          __typename: "GenAIImaginePrimitive"
        },
        __typename: "GenAISingleLayoutViewModel"
      }
    });

    // ==============================
    // OWNER PROFILE
    // ==============================
    ai.addSection({
      view_model: {
        primitive: {
          __typename: "GenAICompactEntityPrimitive",

          title: ownerName,

          subtitle:
            `Owner of ❀ ${botName} ❀`,

          secondary_subtitle:
            "Creator • Developer • Owner",

          entity_id: ownerNumber,

          entity_url:
            ownerNumber
              ? `https://wa.me/${ownerNumber}`
              : "",

          entity_type: "PAGE",

          action_type: "FOLLOW",

          is_verified: true,

          image: {
            url: profileUrl,
            url_fallback: profileUrl
          }
        },

        __typename: "GenAISingleLayoutViewModel"
      }
    });

    // ==============================
    // DESCRIPTION
    // ==============================
    ai.addFOAText(
      "❀ NIWO BOT ❀\n\n" +
      `Created by ${ownerName} ✨`
    );

    // ==============================
    // FOOTER
    // ==============================
    ai.addMetadata("By Niwo Bot");

    await ai.send(m.chat, {
      quoted: m,
      bypassDownload: true
    });

  } catch (err) {
    console.error("[OWNER AIRICH ERROR]", err);

    await m.reply(
      `❌ Gagal menampilkan owner.\n\n` +
      `> ${err?.message || String(err)}`
    );
  }
}

export default {
  config,
  handler
};
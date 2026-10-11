import {
  generateWAMessageFromContent,
  proto,
} from "@itsliaaa/baileys";
import { randomUUID } from "node:crypto";

function makeLayout(children) {
  return {
    type: "Single",
    children,
  };
}

export function buildAIRichMessage(text, options = {}) {
  const content = String(text || "").trim();
  if (!content) throw new TypeError("AI Rich membutuhkan teks yang tidak kosong.");

  const title = String(options.title || "Niwo Bot").trim();
  const footer = String(options.footer || "").trim();
  const sections = [
    makeLayout({
      text: content,
      __typename: "GenAIMarkdownTextUXPrimitive",
    }),
  ];

  if (footer) {
    sections.push(
      makeLayout({
        text: footer,
        __typename: "GenAIMetadataTextPrimitive",
      }),
    );
  }

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: title,
        richResponseSourcesMetadata: { sources: [] },
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [
            {
              messageType: 2,
              messageText: content,
            },
          ],
          unifiedResponse: {
            data: Buffer.from(
              JSON.stringify({
                response_id: randomUUID(),
                sections,
              }),
            ).toString("base64"),
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: "0@bot" },
            forwardOrigin: 4,
          },
        },
      },
    },
  };
}

export function buildHTMLRichMessage(html, options = {}) {
  const payload = String(html || "").trim();
  if (!payload) throw new TypeError("AI Rich HTML membutuhkan konten.");

  const data = Buffer.from(JSON.stringify({
    __typename: "GenAIUnifiedResponse",
    response_id: randomUUID(),
    sections: [{
      __typename: "GenAIUnifiedResponseSection",
      view_model: {
        __typename: "GenAISingleLayoutViewModel",
        primitive: {
          __typename: "GenAIaeacdsnwHtmlPrimitive",
          payload,
          trusted_sources: [],
        },
      },
    }],
  })).toString("base64");

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: String(options.title || ""),
        botResponseId: randomUUID(),
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{
            messageType: 2,
            messageText: String(options.fallbackText || "Menu"),
          }],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: "0@bot" },
            forwardOrigin: 4,
          },
        },
      },
    },
  };
}

export async function sendHTMLRichMessage(sock, jid, html, options = {}) {
  const content = buildHTMLRichMessage(html, options);
  await sock.relayMessage(jid, content, {});
  return { mode: "html-rich" };
}

export async function sendAIRichMessage(sock, jid, text, options = {}) {
  const fallbackText = String(options.fallbackText || text || "").trim();

  try {
    if (typeof sock?.relayMessage !== "function") {
      throw new TypeError("relayMessage tidak tersedia");
    }

    const content = buildAIRichMessage(text, options);
    const message = generateWAMessageFromContent(jid, content, {
      quoted: options.quoted,
      userJid: sock.user?.id || sock.user?.jid,
    });

    await sock.relayMessage(jid, message.message, {
      messageId: message.key.id,
    });

    return { mode: "ai-rich", key: message.key };
  } catch (error) {
    if (!fallbackText || typeof sock?.sendMessage !== "function") throw error;

    const result = await sock.sendMessage(
      jid,
      { text: fallbackText },
      options.quoted ? { quoted: options.quoted } : {},
    );

    return { mode: "text-fallback", result, error };
  }
}

export async function sendCompatibleMenu(sock, jid, options = {}) {
  const text = String(options.text || "").trim();
  if (!text) throw new TypeError("Menu membutuhkan teks yang tidak kosong.");

  let content;
  if (options.video) {
    content = {
      video: options.video,
      caption: text,
      gifPlayback: options.gifPlayback === true,
    };
  } else if (options.image) {
    content = {
      image: options.image,
      caption: text,
    };
  } else {
    content = { text };
  }

  if (Array.isArray(options.mentions) && options.mentions.length) {
    content.mentions = options.mentions;
  }

  return sock.sendMessage(
    jid,
    content,
    options.quoted ? { quoted: options.quoted } : {},
  );
}

function toNativeButton(button) {
  if (button?.type === "single_select") {
    return {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: String(button.text || "Pilih"),
        sections: Array.isArray(button.sections) ? button.sections : [],
      }),
    };
  }

  // Tombol yang buka link di browser HP (dipake buat mini-game, dsb).
  // Ini API resmi native_flow Baileys : bukan trik/spoof apapun.
  if (button?.type === "cta_url") {
    return {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: String(button.text || "Buka"),
        url: String(button.url || ""),
        merchant_url: String(button.url || ""),
      }),
    };
  }

  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: String(button?.text || "Pilih"),
      id: String(button?.id || ""),
    }),
  };
}

export function buildInteractiveMessage(options = {}) {
  const text = String(options.text || "").trim();
  if (!text) throw new TypeError("Pesan interaktif membutuhkan teks.");

  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          ...(options.card?.title ? {
            externalAdReply: {
              title: String(options.card.title),
              body: String(options.card.body || ""),
              mediaType: 2,
              renderLargerThumbnail: true,
              showAdAttribution: false,
              ...(options.card.sourceUrl ? { sourceUrl: String(options.card.sourceUrl) } : {}),
            },
          } : {}),
        },
        interactiveMessage: {
          header: options.header || undefined,
          body: { text },
          footer: { text: String(options.footer || "") },
          nativeFlowMessage: {
            buttons: (options.buttons || []).map(toNativeButton),
            messageParamsJson: JSON.stringify({
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                button_title: String(options.buttonTitle || "Pilih Menu"),
              },
            }),
          },
        },
      },
    },
  };
}

export async function sendInteractiveMessage(sock, jid, options = {}) {
  try {
    if (typeof sock?.relayMessage !== "function") {
      throw new TypeError("relayMessage tidak tersedia");
    }

    const message = generateWAMessageFromContent(
      jid,
      buildInteractiveMessage(options),
      {
        quoted: options.quoted,
        userJid: sock.user?.id || sock.user?.jid,
      },
    );

    await sock.relayMessage(jid, message.message, {
      messageId: message.key.id,
    });
    return { mode: "interactive", key: message.key };
  } catch (error) {
    const fallbackText = String(options.fallbackText || options.text || "").trim();
    if (!fallbackText || typeof sock?.sendMessage !== "function") throw error;

    const result = await sock.sendMessage(
      jid,
      { text: fallbackText },
      options.quoted ? { quoted: options.quoted } : {},
    );
    return { mode: "text-fallback", result, error };
  }
}

export function supportsAIRich() {
  return Boolean(
    proto?.Message &&
      proto?.AIRichResponseMessage &&
      proto?.AIRichResponseUnifiedResponse,
  );
}

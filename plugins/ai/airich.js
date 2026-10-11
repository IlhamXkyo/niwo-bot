import config from "../../config.js";
import {
  sendAIRichMessage,
  supportsAIRich,
} from "../../src/lib/whatsappCompat.js";

const configPlugin = {
  name: "airich",
  alias: ["richai", "aichat"],
  category: "ai",
  description: "Chat AI gratis dengan tampilan AI Rich WhatsApp",
  usage: ".airich <pertanyaan>",
  example: ".airich jelaskan apa itu JavaScript",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 8,
  energi: 0,
  isEnabled: true
};

// Simpan percakapan per chat
global.airichHistory = global.airichHistory || new Map();

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";

function cleanMarkdown(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, block =>
      block.replace(/```/g, "")
    )
    .trim();
}

function getApiKey() {
  return (
    process.env.OPENROUTER_API_KEY ||
    config?.api?.openrouterKey ||
    ""
  ).trim();
}

async function askAI(prompt, chatId) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "API key OpenRouter belum dipasang.\n" +
      "Tambahkan openrouterKey di config.js."
    );
  }

  let history = global.airichHistory.get(chatId) || [];

  const messages = [
    {
      role: "system",
      content:
        "Kamu adalah Niwo Bot. Jawab dengan bahasa Indonesia yang santai, jelas, membantu, dan tidak terlalu bertele-tele."
    },
    ...history.slice(-10),
    {
      role: "user",
      content: prompt
    }
  ];

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/",
      "X-Title": "Niwo-Bot"
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false
    })
  });

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `OpenRouter response bukan JSON (HTTP ${response.status})`
    );
  }

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(msg);
  }

  const answer =
    data?.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("Response AI kosong.");
  }

  history.push(
    {
      role: "user",
      content: prompt
    },
    {
      role: "assistant",
      content: answer
    }
  );

  // Maksimal 20 message agar memory tidak membengkak
  global.airichHistory.set(
    chatId,
    history.slice(-20)
  );

  return answer;
}

async function sendRich(sock, m, answer) {
  const text =
    cleanMarkdown(answer) ||
    "Tidak ada jawaban dari AI.";

  if (!supportsAIRich()) return false;

  const result = await sendAIRichMessage(sock, m.chat, text, {
    title: "Niwo Bot",
    footer: "Jawaban AI dapat mengandung kekeliruan.",
    fallbackText: `〄 *AI RICH*\n\n${text}`,
    quoted: m.raw || m,
  });

  return result.mode === "ai-rich" || result.mode === "text-fallback";
}

async function handler(m, { sock }) {
  const prompt = String(m.text || "").trim();

  if (!prompt) {
    return m.reply(
      `〄 *AI RICH*\n\n` +
      `〄 ${m.prefix}airich <pertanyaan>\n\n` +
      `Contoh:\n` +
      `〄 ${m.prefix}airich jelaskan JavaScript\n\n` +
      `AI Rich sekarang menggunakan OpenRouter Free.`
    );
  }

  try {
    await m.react("🕐");

    const answer = await askAI(
      prompt,
      m.chat
    );

    const sent = await sendRich(
      sock,
      m,
      answer
    );

    if (!sent) {
      await m.reply(
        `〄 *AI RICH*\n\n${answer}`
      );
    }

    await m.react("✅");

  } catch (e) {
    console.error("[AI RICH ERROR]", e);

    await m.react("❌");

    return m.reply(
      `〄 *AI RICH ERROR*\n\n` +
      `〄 ${e?.message || "Terjadi kesalahan."}`
    );
  }
}

export default {
  config: configPlugin,
  handler
};
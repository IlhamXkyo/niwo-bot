// dashboard.js
// Real-Time Bot Dashboard
// RAM + CPU + Uptime realtime
// ESM Plugin - Niwo Bot

import os from 'os';
import crypto from 'crypto';
import axios from 'axios';

const config = {
  name: 'dashboard',
  alias: ['ping', 'pinglive', 'serverinfo', 'monitor'],
  category: 'info',
  description: 'Dashboard realtime CPU, RAM, uptime, OS, Node.js, dan latency.',
  usage: '.ping',
  example: '.ping',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true
};

function getTimestamp(m) {
  const t = m?.messageTimestamp;

  if (typeof t === 'number') {
    return t > 1e12 ? t : t * 1000;
  }

  if (typeof t === 'string' && t.trim()) {
    const n = Number(t);
    if (Number.isFinite(n)) {
      return n > 1e12 ? n : n * 1000;
    }
  }

  if (t && typeof t === 'object') {
    const n = Number(t.low);
    if (Number.isFinite(n)) {
      return n > 1e12 ? n : n * 1000;
    }
  }

  return Date.now();
}

function fillTemplate(html, values) {
  let out = String(html ?? '');

  for (const [key, value] of Object.entries(values)) {
    out = out.replace(new RegExp(key, 'g'), String(value));
  }

  return out;
}

function buildAIRich(html, responseId) {
  const unifiedResponse = {
    __typename: 'GenAIUnifiedResponse',
    response_id: responseId,

    sections: [
      {
        __typename: 'GenAIUnifiedResponseSection',

        view_model: {
          __typename: 'GenAISingleLayoutViewModel',

          primitive: {
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
            payload: html,
            trusted_sources: []
          }
        }
      }
    ]
  };

  const data = Buffer
    .from(JSON.stringify(unifiedResponse))
    .toString('base64');

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,

      botMetadata: {
        messageDisclaimerText: '',
        botResponseId: responseId
      }
    },

    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,

          submessages: [
            {
              messageType: 2,
              messageText: 'Server Monitor'
            }
          ],

          unifiedResponse: {
            data
          },

          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,

            forwardedAiBotMessageInfo: {
              botJid: '867051314767696@bot'
            },

            forwardOrigin: 4
          }
        }
      }
    }
  };
}

async function handler(m, { sock }) {
  try {
    if (!sock?.relayMessage) {
      throw new Error('sock.relayMessage tidak tersedia.');
    }

    // Template dashboard dari sumber asli
    const encoded =
      'aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL25veFh6YS9kYXRhL3JlZnMvaGVhZHMvbWFpbi9waW5nLmh0bWw=';

    const url = Buffer
      .from(encoded, 'base64')
      .toString('utf8');

    const { data: template } = await axios.get(url, {
      timeout: 15000,
      responseType: 'text'
    });

    // =========================
    // REALTIME SERVER DATA
    // =========================

    const msgTime = getTimestamp(m);

    const latency = Math.max(
      0,
      Date.now() - msgTime
    );

    const memory = process.memoryUsage();

    const heapUsed = (
      memory.heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const rssMem = (
      memory.rss /
      1024 /
      1024
    ).toFixed(2);

    const cpuCores =
      os.cpus()?.length || 1;

    const botUptime =
      process.uptime();

    const systemUptime =
      os.uptime();

    // =========================
    // MASUKKAN DATA KE HTML
    // =========================

    const html = fillTemplate(template, {
      '%LATENCY%': latency,

      '%PLATFORM%':
        os.platform(),

      '%OS_INFO%':
        `${os.platform()} ${os.release()}`,

      '%ARCH_INFO%':
        os.arch(),

      '%CPU_CORES%':
        cpuCores,

      '%HEAP_USED%':
        heapUsed,

      '%RSS_MEM%':
        rssMem,

      '%NODE_INFO%':
        `Node ${process.version}`,

      '%BOTUPTIME%':
        botUptime.toFixed(0),

      '%SYSTEMUPTIME%':
        systemUptime.toFixed(0)
    });

    // =========================
    // AIRICH RESPONSE
    // =========================

    const responseId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    const jid =
      m?.chat ||
      m?.key?.remoteJid;

    if (!jid) {
      throw new Error(
        'JID chat tidak ditemukan.'
      );
    }

    await sock.relayMessage(
      jid,

      buildAIRich(
        html,
        responseId
      ),

      {
        messageId: responseId
      }
    );

  } catch (e) {
    console.error(
      '[dashboard]',
      e
    );

    const errorText =
      `❌ Dashboard gagal dijalankan.\n\n` +
      `${e?.message || 'Unknown error'}`;

    if (
      typeof m?.reply === 'function'
    ) {
      await m.reply(errorText);

    } else if (
      m?.chat &&
      sock?.sendMessage
    ) {
      await sock.sendMessage(
        m.chat,
        {
          text: errorText
        },
        {
          quoted: m
        }
      );
    }
  }
}

export default {
  config,
  handler
};
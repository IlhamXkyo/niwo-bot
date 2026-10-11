/**
 * Mock Baileys WhatsApp Socket for E2E Testing.
 * Provides authentic socket simulation: sendMessage, sendButtons, relayMessage,
 * reaction dispatch, event emission, and message interception.
 */

const { EventEmitter } = require('events');

class MockWhatsAppSocket {
  constructor(options = {}) {
    this.user = {
      id: options.botJid || '6285217124804@s.whatsapp.net',
      jid: options.botJid || '6285217124804@s.whatsapp.net',
      name: options.botName || 'Niwo Bot'
    };
    this.ev = new EventEmitter();
    this.sentMessages = [];
    this.sentInteractive = [];
    this.sentReactions = [];
    this.interceptors = [];
  }

  generateMessageId() {
    return 'BAE5' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async sendMessage(jid, content, options = {}) {
    if (!jid) {
      throw new Error('MockSocket: Target JID is required.');
    }
    if (!content) {
      throw new Error('MockSocket: Message content is required.');
    }

    const id = this.generateMessageId();
    const entry = {
      id,
      jid,
      content,
      options,
      timestamp: Date.now()
    };

    this.sentMessages.push(entry);

    for (const interceptor of this.interceptors) {
      try {
        await interceptor(entry);
      } catch (err) {
        // Interceptor error logged without halting message dispatch
      }
    }

    return {
      key: {
        remoteJid: jid,
        fromMe: true,
        id
      },
      message: content
    };
  }

  async relayMessage(jid, message, options = {}) {
    if (!jid) {
      throw new Error('MockSocket: Relay target JID is required.');
    }

    const id = options.messageId || this.generateMessageId();
    const entry = {
      id,
      jid,
      message,
      options,
      timestamp: Date.now()
    };

    this.sentInteractive.push(entry);
    this.sentMessages.push({
      id,
      jid,
      content: message,
      options,
      timestamp: Date.now()
    });

    return {
      key: {
        remoteJid: jid,
        fromMe: true,
        id
      }
    };
  }

  async sendButtons(jid, title, footer, buttons = [], options = {}) {
    const payload = {
      title,
      footer,
      buttons,
      text: title
    };
    return this.sendMessage(jid, payload, options);
  }

  async sendMessageReaction(jid, reactionKey, emoji) {
    const entry = {
      jid,
      reactionKey,
      emoji,
      timestamp: Date.now()
    };
    this.sentReactions.push(entry);
    return entry;
  }

  onSend(interceptorFn) {
    if (typeof interceptorFn === 'function') {
      this.interceptors.push(interceptorFn);
    }
  }

  simulateIncomingMessage({
    sender,
    text,
    isGroup = false,
    groupJid = null,
    pushName = 'Tester',
    quoted = null
  }) {
    const remoteJid = isGroup ? (groupJid || '120363024829104857@g.us') : sender;
    const participant = isGroup ? sender : undefined;
    const msgId = this.generateMessageId();

    const rawMessage = {
      key: {
        remoteJid,
        fromMe: false,
        id: msgId,
        participant
      },
      pushName,
      message: {
        conversation: text
      },
      messageTimestamp: Math.floor(Date.now() / 1000)
    };

    if (quoted) {
      rawMessage.message.extendedTextMessage = {
        text,
        contextInfo: {
          participant: quoted.sender,
          stanzaId: quoted.id || this.generateMessageId(),
          quotedMessage: {
            conversation: quoted.text || ''
          }
        }
      };
    }

    const upsertEvent = {
      type: 'notify',
      messages: [rawMessage]
    };

    this.ev.emit('messages.upsert', upsertEvent);
    return rawMessage;
  }

  getLastMessage(jid = null) {
    if (!jid) {
      return this.sentMessages[this.sentMessages.length - 1] || null;
    }
    const filtered = this.sentMessages.filter(m => m.jid === jid);
    return filtered[filtered.length - 1] || null;
  }

  getAllMessages(jid = null) {
    if (!jid) {
      return [...this.sentMessages];
    }
    return this.sentMessages.filter(m => m.jid === jid);
  }

  getLastInteractive() {
    return this.sentInteractive[this.sentInteractive.length - 1] || null;
  }

  getLastReaction() {
    return this.sentReactions[this.sentReactions.length - 1] || null;
  }

  clear() {
    this.sentMessages = [];
    this.sentInteractive = [];
    this.sentReactions = [];
    this.interceptors = [];
  }
}

module.exports = {
  MockWhatsAppSocket
};

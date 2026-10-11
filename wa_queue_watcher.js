import fs from 'node:fs';
import path from 'node:path';
import { getPaths, readJsonSafe, withLock, appendResponse } from './bridge/ipc.js';

const bridgeDir = path.resolve(process.cwd(), 'bridge');
const paths = getPaths(bridgeDir);
const seenIds = new Set();

async function pollQueue() {
  while (true) {
    try {
      const rawData = await readJsonSafe(paths.queueFile, []);
      const messages = Array.isArray(rawData) ? rawData : (rawData.messages || []);
      const pending = messages.filter(m => (m.status || '').toLowerCase() === 'pending' && !seenIds.has(m.id));
      
      if (pending.length > 0) {
        const msg = pending[0]; // Process one at a time
        
        console.log(`[WA_MESSAGE] ${JSON.stringify({
          id: msg.id,
          sender: msg.sender,
          senderNumber: msg.senderNumber || String(msg.sender).replace(/[^0-9]/g, ''),
          pushName: msg.pushName || 'User',
          isOwner: Boolean(msg.isOwner),
          activeCharacter: msg.activeCharacter || 'sawako',
          chatType: msg.chatType || 'dm',
          groupJid: msg.groupJid || null,
          text: msg.text,
          mediaAttachment: msg.mediaAttachment || null
        })}`);

        // Exit immediately so Antigravity gets the notification!
        process.exit(0);
      }
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 400));
  }
}

pollQueue();

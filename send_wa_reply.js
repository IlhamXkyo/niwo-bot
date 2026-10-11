import { appendResponse, markCompleted } from './bridge/ipc.js';
import path from 'node:path';

const bridgeDir = path.resolve(process.cwd(), 'bridge');

async function main() {
  const queueId = process.argv[2];
  const targetJid = process.argv[3];
  const text = process.argv.slice(4).join(' ');

  if (!queueId || !targetJid || !text) {
    console.error("Usage: node send_wa_reply.js <queueId> <targetJid> <text>");
    process.exit(1);
  }

  try {
    await appendResponse({
      queueId,
      targetJid,
      text,
      mediaAttachment: process.env.MEDIA_PATH || null
    }, { bridgeDir });
    
    await markCompleted(queueId, null, { bridgeDir });
    console.log(`Successfully sent reply for ${queueId}`);
  } catch (e) {
    console.error("Error:", e);
    await markCompleted(queueId, e, { bridgeDir });
  }
}

main();

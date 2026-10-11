/**
 * Mock IPC Bridge Harness for E2E Testing.
 * Provides isolated, sandboxed directory management for wa_queue.json,
 * wa_response.json, bridge_heartbeat.json, and advisory file locks.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class MockIpcHarness {
  constructor(options = {}) {
    this.prefix = options.prefix || 'niwo-agy-bridge-test-';
    this.baseDir = null;
    this.queuePath = null;
    this.responsePath = null;
    this.heartbeatPath = null;
    this.lockPath = null;
    this.mediaDir = null;
    this.lockTtlMs = options.lockTtlMs || 5000;
  }

  setup() {
    this.baseDir = fs.mkdtempSync(path.join(os.tmpdir(), this.prefix));
    this.queuePath = path.join(this.baseDir, 'wa_queue.json');
    this.responsePath = path.join(this.baseDir, 'wa_response.json');
    this.heartbeatPath = path.join(this.baseDir, 'bridge_heartbeat.json');
    this.lockPath = path.join(this.baseDir, '.queue.lock');
    this.mediaDir = path.join(this.baseDir, 'media');

    fs.mkdirSync(this.mediaDir, { recursive: true });
    fs.writeFileSync(this.queuePath, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(this.responsePath, JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(
      this.heartbeatPath,
      JSON.stringify(
        {
          status: 'ALIVE',
          timestamp: Date.now(),
          pid: process.pid
        },
        null,
        2
      ),
      'utf8'
    );

    return this.baseDir;
  }

  async acquireLock(timeoutMs = 3000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        if (fs.existsSync(this.lockPath)) {
          const stats = fs.statSync(this.lockPath);
          if (Date.now() - stats.mtimeMs > this.lockTtlMs) {
            try {
              fs.unlinkSync(this.lockPath);
            } catch (unlinkErr) {
              // Ignore race in unlink
            }
          }
        }

        const fd = fs.openSync(this.lockPath, 'wx');
        fs.closeSync(fd);
        return true;
      } catch (err) {
        if (err.code === 'EEXIST') {
          await new Promise(r => setTimeout(r, 20));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Failed to acquire IPC file lock within ${timeoutMs}ms.`);
  }

  releaseLock() {
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
      }
    } catch (err) {
      // Ignore if lock file was already cleared
    }
  }

  async enqueueMessage(messageObject) {
    await this.acquireLock();
    try {
      let queue = [];
      if (fs.existsSync(this.queuePath)) {
        try {
          const content = fs.readFileSync(this.queuePath, 'utf8');
          queue = JSON.parse(content || '[]');
          if (!Array.isArray(queue)) queue = [];
        } catch (parseErr) {
          queue = [];
        }
      }

      const id = `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const entry = {
        id,
        sender: messageObject.sender,
        senderNumber: messageObject.senderNumber || String(messageObject.sender || '').replace(/[^0-9]/g, ''),
        pushName: messageObject.pushName || 'User',
        chatType: messageObject.chatType || 'private',
        groupJid: messageObject.groupJid || null,
        text: messageObject.text || '',
        quoted: messageObject.quoted || null,
        isOwner: Boolean(messageObject.isOwner),
        timestamp: Date.now(),
        status: 'PENDING'
      };

      queue.push(entry);

      const tempFile = path.join(this.baseDir, `.wa_queue.json.tmp.${Date.now()}`);
      fs.writeFileSync(tempFile, JSON.stringify(queue, null, 2), 'utf8');
      fs.renameSync(tempFile, this.queuePath);

      return id;
    } finally {
      this.releaseLock();
    }
  }

  async getPendingMessages() {
    await this.acquireLock();
    try {
      if (!fs.existsSync(this.queuePath)) return [];
      try {
        const content = fs.readFileSync(this.queuePath, 'utf8');
        const queue = JSON.parse(content || '[]');
        if (!Array.isArray(queue)) return [];
        return queue.filter(item => item.status === 'PENDING');
      } catch (parseErr) {
        return [];
      }
    } finally {
      this.releaseLock();
    }
  }

  async appendResponse(responseObject) {
    await this.acquireLock();
    try {
      let responses = [];
      if (fs.existsSync(this.responsePath)) {
        try {
          const content = fs.readFileSync(this.responsePath, 'utf8');
          responses = JSON.parse(content || '[]');
          if (!Array.isArray(responses)) responses = [];
        } catch (err) {
          responses = [];
        }
      }

      const id = `wa_res_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const entry = {
        id,
        queueId: responseObject.queueId,
        targetJid: responseObject.targetJid,
        text: responseObject.text || '',
        actions: responseObject.actions || [],
        stickerKey: responseObject.stickerKey || null,
        mediaAttachment: responseObject.mediaAttachment || null,
        timestamp: Date.now(),
        status: 'READY'
      };

      responses.push(entry);

      const tempFile = path.join(this.baseDir, `.wa_response.json.tmp.${Date.now()}`);
      fs.writeFileSync(tempFile, JSON.stringify(responses, null, 2), 'utf8');
      fs.renameSync(tempFile, this.responsePath);

      return id;
    } finally {
      this.releaseLock();
    }
  }

  async fetchResponses() {
    await this.acquireLock();
    try {
      if (!fs.existsSync(this.responsePath)) return [];
      let responses = [];
      try {
        const content = fs.readFileSync(this.responsePath, 'utf8');
        responses = JSON.parse(content || '[]');
        if (!Array.isArray(responses)) responses = [];
      } catch (parseErr) {
        responses = [];
      }

      const ready = responses.filter(r => r.status === 'READY');
      const remaining = responses.filter(r => r.status !== 'READY');

      const tempFile = path.join(this.baseDir, `.wa_response.json.tmp.${Date.now()}`);
      fs.writeFileSync(tempFile, JSON.stringify(remaining, null, 2), 'utf8');
      fs.renameSync(tempFile, this.responsePath);

      return ready;
    } finally {
      this.releaseLock();
    }
  }

  async updateHeartbeat(pid = process.pid) {
    const data = {
      status: 'ALIVE',
      timestamp: Date.now(),
      pid
    };
    const tempFile = path.join(this.baseDir, `.bridge_heartbeat.json.tmp.${Date.now()}`);
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, this.heartbeatPath);
  }

  async checkHeartbeat(maxAgeMs = 15000) {
    if (!fs.existsSync(this.heartbeatPath)) {
      return { alive: false, ageMs: Infinity };
    }
    try {
      const content = fs.readFileSync(this.heartbeatPath, 'utf8');
      const data = JSON.parse(content);
      const ageMs = Date.now() - (data.timestamp || 0);
      return {
        alive: data.status === 'ALIVE' && ageMs <= maxAgeMs,
        ageMs
      };
    } catch (err) {
      return { alive: false, ageMs: Infinity, error: err.message };
    }
  }

  formatWakeupLog(messageObject) {
    return `[ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE ID:${messageObject.id} FROM:${messageObject.sender} TEXT:${messageObject.text}`;
  }

  corruptQueueFile() {
    fs.writeFileSync(this.queuePath, '{{INVALID_CORRUPTED_JSON_CONTENT:::;;', 'utf8');
  }

  corruptHeartbeat() {
    fs.writeFileSync(this.heartbeatPath, 'MALFORMED_HEARTBEAT_DATA', 'utf8');
  }

  setStaleHeartbeat(staleOffsetMs = 25000) {
    const data = {
      status: 'ALIVE',
      timestamp: Date.now() - staleOffsetMs,
      pid: 1234
    };
    fs.writeFileSync(this.heartbeatPath, JSON.stringify(data, null, 2), 'utf8');
  }

  cleanup() {
    if (!this.baseDir) return;
    try {
      this.releaseLock();
      fs.rmSync(this.baseDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup error in temp directories
    }
  }
}

module.exports = {
  MockIpcHarness
};

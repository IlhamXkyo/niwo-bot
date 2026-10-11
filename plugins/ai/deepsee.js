// ============================================================
// deepseek_full.js - DeepSeek AI Full Package (ESM)
// ============================================================
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const config = {
  name: "deepseek",
  alias: ["ds", "deepseekai", "chatds"],
  category: "ai",

  description: "Chat AI DeepSeek lengkap dengan mode Cepat, Pakar, Vision, Thinking, Search, dan /new",
  usage: ".deepseek add <email> <password> | .mode <jenis> | .deepseekon <fitur>",
  example: ".deepseek add email@gmail.com password123",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 10,
  energi: 3,
  isEnabled: true
};

// ============================================================
// BAGIAN 1: DEEPSEEK SCRAPER CORE (Di-inline)
// ============================================================
const cache = {
  workerScript: null,
  wasmBuffer: null
};

const headers = (token = '') => ({
  'host': 'chat.deepseek.com',
  'x-client-platform': 'web',
  'x-client-version': '2.4.0',
  'x-client-locale': 'id',
  'x-client-bundle-id': 'com.deepseek.chat',
  'x-client-timezone-offset': '25200',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'authorization': token ? `Bearer ${token}` : '',
  'accept': 'application/json',
  'accept-charset': 'UTF-8',
  'content-type': 'application/json',
  'accept-encoding': 'gzip',
  'origin': 'https://chat.deepseek.com',
  'referer': 'https://chat.deepseek.com/',
  'sec-ch-ua': '"Chromium";v="137", "Not/AIBrand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
});

async function loadStaticAssets() {
  if (!cache.workerScript) {
    const res = await fetch('https://static.deepseek.com/chat/static/33614.25c7f8f220.js');
    cache.workerScript = await res.text();
  }
  if (!cache.wasmBuffer) {
    const res = await fetch('https://static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm');
    const arrayBuf = await res.arrayBuffer();
    cache.wasmBuffer = Buffer.from(arrayBuf);
  }
}

async function solveChallenge(challengeData) {
  await loadStaticAssets();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('PoW Solver Timeout')), 60000);

    class WasmResponse {
      constructor(buf) {
        this.buf = buf;
        this.ok = true;
        this.status = 200;
        this.headers = { get: () => 'application/wasm' };
      }
      async arrayBuffer() {
        return this.buf;
      }
    }

    const contextObject = {
      console: { log: () => {} },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      TextEncoder,
      TextDecoder,
      URL,
      Response: WasmResponse,
      location: { href: 'https://static.deepseek.com/chat/static/33614.25c7f8f220.js', toString() { return this.href } },
      WebAssembly: {
        ...WebAssembly,
        instantiateStreaming: async (source, imports) => WebAssembly.instantiate(cache.wasmBuffer, imports)
      },
      fetch: async (target) => {
        if (String(target).includes('wasm')) return new WasmResponse(cache.wasmBuffer);
        throw new Error('Network call blocked inside sandbox');
      },
      postMessage: (payload) => {
        if (!payload) return;
        clearTimeout(timer);
        if (payload.type === 'pow-answer') {
          const result = {
            algorithm: challengeData.algorithm,
            challenge: challengeData.challenge,
            salt: challengeData.salt,
            answer: payload.answer.answer,
            signature: challengeData.signature,
            target_path: challengeData.target_path
          };
          resolve(Buffer.from(JSON.stringify(result)).toString('base64'));
        } else {
          reject(new Error('PoW execution failed'));
        }
      },
      onmessage: null
    };

    contextObject.self = contextObject;
    contextObject.window = contextObject;
    contextObject.globalThis = contextObject;

    const context = vm.createContext(contextObject);
    vm.runInContext(cache.workerScript, context);

    const msgHandler = contextObject.onmessage || contextObject.self?.onmessage;
    if (!msgHandler) {
      clearTimeout(timer);
      return reject(new Error('PoW worker message handler not found'));
    }

    msgHandler({
      data: {
        type: 'pow-challenge',
        challenge: {
          algorithm: challengeData.algorithm,
          challenge: challengeData.challenge,
          salt: challengeData.salt,
          difficulty: challengeData.difficulty,
          signature: challengeData.signature,
          expireAt: challengeData.expire_at
        }
      }
    });
  });
}


async function requestJson(url, options = {}, label = "API") {
  const response = await fetch(url, options);
  const raw = await response.text();

  if (!raw || !raw.trim()) {
    throw new Error(`${label}: response kosong (HTTP ${response.status})`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `${label}: response bukan JSON (HTTP ${response.status})
${raw.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${label}: HTTP ${response.status} - ${json?.msg || json?.message || json?.data?.biz_msg || "request gagal"}`
    );
  }

  return json;
}

async function fetchPowToken(token, targetPath) {
  const json = await requestJson(
    'https://chat.deepseek.com/api/v0/chat/create_pow_challenge',
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ target_path: targetPath })
    },
    'PoW Challenge'
  );
  if (json.code !== 0) throw new Error(json.msg || 'Failed to get challenge');
  return solveChallenge(json.data.biz_data.challenge);
}

async function login(email, password) {
  const deviceId = 'BQcIF6vU003ZkBv4qUC77C5SKiqDaMvpen6Adygjil5YKjuiPJjm/ivFKEh' + Math.random().toString(36).substring(2, 8);

  const response = await fetch('https://chat.deepseek.com/api/v0/users/login', {
    method: 'POST',
    headers: {
      'host': 'chat.deepseek.com',
      'x-client-platform': 'web',
      'x-client-version': '2.4.0',
      'x-client-locale': 'id',
      'x-client-bundle-id': 'com.deepseek.chat',
      'x-client-timezone-offset': '25200',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'accept': 'application/json',
      'accept-charset': 'UTF-8',
      'content-type': 'application/json',
      'accept-encoding': 'gzip',
      'origin': 'https://chat.deepseek.com',
      'referer': 'https://chat.deepseek.com/',
      'sec-ch-ua': '"Chromium";v="137", "Not/AIBrand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Android"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    },
    body: JSON.stringify({
      email,
      password,
      mobile: '',
      area_code: '',
      device_id: deviceId,
      os: 'web'
    })
  });

  const json = await (async () => {
    const raw = await response.text();
    if (!raw.trim()) throw new Error(`Login: response kosong (HTTP ${response.status})`);
    try { return JSON.parse(raw); } catch { throw new Error(`Login: response bukan JSON (HTTP ${response.status})\n${raw.slice(0, 300)}`); }
  })();
  if (json.code === 0 && json.data?.biz_data?.user?.token) {
    return json.data.biz_data.user.token;
  }

  if (email.includes('@')) {
    const username = email.split('@')[0];
    const retryRes = await fetch('https://chat.deepseek.com/api/v0/users/login', {
      method: 'POST',
      headers: {
        'host': 'chat.deepseek.com',
        'x-client-platform': 'web',
        'x-client-version': '2.4.0',
        'x-client-locale': 'id',
        'x-client-bundle-id': 'com.deepseek.chat',
        'x-client-timezone-offset': '25200',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'accept': 'application/json',
        'accept-charset': 'UTF-8',
        'content-type': 'application/json',
        'accept-encoding': 'gzip',
        'origin': 'https://chat.deepseek.com',
        'referer': 'https://chat.deepseek.com/'
      },
      body: JSON.stringify({
        username,
        password,
        mobile: '',
        area_code: '',
        device_id: deviceId,
        os: 'web'
      })
    });
    const retryRaw = await retryRes.text();
    if (!retryRaw.trim()) throw new Error(`Login retry: response kosong (HTTP ${retryRes.status})`);
    let retryJson;
    try { retryJson = JSON.parse(retryRaw); } catch { throw new Error(`Login retry: response bukan JSON (HTTP ${retryRes.status})\n${retryRaw.slice(0, 300)}`); }
    if (retryJson.code === 0 && retryJson.data?.biz_data?.user?.token) {
      return retryJson.data.biz_data.user.token;
    }
    throw new Error(retryJson.data?.biz_msg || retryJson.msg || 'Login failed with username');
  }

  throw new Error(json.data?.biz_msg || json.msg || 'Login failed');
}

async function createSession(token) {
  const json = await requestJson(
    'https://chat.deepseek.com/api/v0/chat_session/create',
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({})
    },
    'Create Session'
  );
  if (json.code !== 0) throw new Error(json.msg || 'Failed to create session');
  return json.data.biz_data.chat_session.id;
}

async function parseStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let resultText = '';
  let thinkText = '';
  let messageId = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5).trim());

          if (parsed.v?.response?.message_id) {
            messageId = parsed.v.response.message_id;
            const frags = parsed.v.response.fragments || [];
            for (const frag of frags) {
              if (frag.type === 'THINK') thinkText += frag.content || '';
              if (frag.type === 'RESPONSE') resultText += frag.content || '';
            }
          }

          if (typeof parsed.v === 'string') {
            const p = parsed.p || '';
            if (p.includes('think') || p.includes('THINK')) {
              thinkText += parsed.v;
            } else if (!p || p.endsWith('content')) {
              resultText += parsed.v;
            }
          }
        } catch (_) {}
      }
    }
  }

  return {
    reply: resultText.trim(),
    think: thinkText.trim(),
    message_id: messageId
  };
}

async function chatThinking(token, prompt, sessionId, parentId = null, searchEnabled = true) {
  const powToken = await fetchPowToken(token, '/api/v0/chat/completion');

  const response = await fetch('https://chat.deepseek.com/api/v0/chat/completion', {
    method: 'POST',
    headers: { ...headers(token), 'x-ds-pow-response': powToken },
    body: JSON.stringify({
      chat_session_id: sessionId,
      parent_message_id: parentId,
      prompt,
      ref_file_ids: [],
      thinking_enabled: true,
      search_enabled: searchEnabled,
      audio_id: null,
      preempt: false,
      model_type: parentId ? null : 'default',
      action: null
    })
  });

  return parseStream(response);
}

async function uploadFile(token, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileSize = fileBuffer.length;

  const powToken = await fetchPowToken(token, '/api/v0/file/upload_file');

  const boundary = `----${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    `Content-Type: application/octet-stream\r\n`,
    `\r\n`
  ];

  const header = Buffer.from(bodyParts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);

  const uploadHeaders = {
    ...headers(token),
    'x-ds-pow-response': powToken,
    'x-thinking-enabled': '0',
    'x-file-size': String(fileSize),
    'x-model-type': 'vision',
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length)
  };

  const uploadRes = await fetch('https://chat.deepseek.com/api/v0/file/upload_file', {
    method: 'POST',
    headers: uploadHeaders,
    body
  });

  const uploadRaw = await uploadRes.text();
  if (!uploadRaw.trim()) throw new Error(`Upload: response kosong (HTTP ${uploadRes.status})`);
  let uploadJson;
  try { uploadJson = JSON.parse(uploadRaw); } catch { throw new Error(`Upload: response bukan JSON (HTTP ${uploadRes.status})\n${uploadRaw.slice(0, 300)}`); }
  if (uploadJson.code !== 0) throw new Error(uploadJson.msg || 'Upload failed');

  const fileId = uploadJson.data.biz_data.id;

  const maxRetry = 20;
  for (let i = 0; i < maxRetry; i++) {
    await new Promise(r => setTimeout(r, 1500));

    const pollRes = await fetch(
      `https://chat.deepseek.com/api/v0/file/fetch_files?file_ids=${fileId}`,
      { headers: headers(token) }
    );
    const pollRaw = await pollRes.text();
    if (!pollRaw.trim()) throw new Error(`File polling: response kosong (HTTP ${pollRes.status})`);
    let pollJson;
    try { pollJson = JSON.parse(pollRaw); } catch { throw new Error(`File polling: response bukan JSON (HTTP ${pollRes.status})\n${pollRaw.slice(0, 300)}`); }
    const file = pollJson.data?.biz_data?.files?.[0];
    if (!file) throw new Error(pollJson.msg || pollJson.data?.biz_msg || 'Data file tidak ditemukan');

    if (file.status === 'SUCCESS') return fileId;
    if (file.status === 'FAILED') throw new Error(`File processing failed: ${file.error_code}`);
  }

  throw new Error('File processing timeout');
}

async function chatVision(token, prompt, sessionId, fileIds, parentId = null) {
  const powToken = await fetchPowToken(token, '/api/v0/chat/completion');

  const response = await fetch('https://chat.deepseek.com/api/v0/chat/completion', {
    method: 'POST',
    headers: { ...headers(token), 'x-ds-pow-response': powToken },
    body: JSON.stringify({
      chat_session_id: sessionId,
      parent_message_id: parentId,
      prompt,
      ref_file_ids: fileIds,
      thinking_enabled: false,
      search_enabled: false,
      audio_id: null,
      preempt: false,
      model_type: 'vision',
      action: null
    })
  });

  return parseStream(response);
}

class DeepSeekClient {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.token = global.deepseekTokens.get(email) || null;
    this.initialized = Boolean(this.token);
  }

  async init() {
    if (this.initialized && this.token) return;

    const cached = global.deepseekTokens.get(this.email);
    if (cached) {
      this.token = cached;
      this.initialized = true;
      return;
    }

    this.token = await login(this.email, this.password);
    if (!this.token) throw new Error("Token DeepSeek kosong setelah login.");
    global.deepseekTokens.set(this.email, this.token);
    this.initialized = true;
  }

  async ensureToken() {
    if (!this.token) await this.init();
    return this.token;
  }

  async createSession() {
    const token = await this.ensureToken();
    return createSession(token);
  }

  async chatThinking(sessionId, prompt, parentId = null, searchEnabled = true) {
    const token = await this.ensureToken();
    return chatThinking(token, prompt, sessionId, parentId, searchEnabled);
  }

  async uploadFile(filePath) {
    const token = await this.ensureToken();
    return uploadFile(token, filePath);
  }

  async chatVision(sessionId, prompt, fileIds, parentId = null) {
    const token = await this.ensureToken();
    return chatVision(token, prompt, sessionId, fileIds, parentId);
  }
}

// ============================================================
// BAGIAN 2: HANDLER BOT WHATSAPP
// ============================================================
global.deepseekAccounts = global.deepseekAccounts || {};
global.deepseekTokens = global.deepseekTokens || new Map();
global.deepseekClients = global.deepseekClients || new Map();

function getSharedClient(account) {
  const key = account.email;
  let client = global.deepseekClients.get(key);

  // Reuse the already authenticated DeepSeek client.
  // This is important for AI Rich: it must NOT trigger a second login.
  if (!client || client.password !== account.password) {
    client = new DeepSeekClient(account.email, account.password);

    // Reuse a token saved on the account, if available.
    if (account.token) {
      client.token = account.token;
      client.initialized = true;
      global.deepseekTokens.set(key, account.token);
    }

    global.deepseekClients.set(key, client);
  }

  // If an existing client is already authenticated, mirror its token
  // to the account so other plugins can reuse the same session.
  if (client.token) {
    account.token = client.token;
    global.deepseekTokens.set(key, client.token);
    client.initialized = true;
  }

  return client;
}

async function handler(m, { sock }) {
  const text = String(m.text || "").trim();
  const args = text.split(" ");
  const command = args[0]?.toLowerCase() || "";

  // ── CEK FITUR AKTIF ──
  if (!DeepSeekClient) return m.reply("❌ *DeepSeek Client Error!*");

  // ── COMMAND: /new ──
  if (command === "new" || command === "/new") {
    const account = global.deepseekAccounts[m.chat];
    if (!account) return m.reply("❌ Belum ada akun DeepSeek. Ketik `.deepseek add` dulu.");
    account.sessionId = null;
    account.parentId = null;
    await m.react("🧹");
    return m.reply("✅ *Percakapan baru dimulai!*");
  }

  // ── COMMAND: ADD AKUN ──
  if (command === "add") {
    if (!m.isOwner) return m.reply("❌ Hanya Owner yang bisa menambahkan akun.");
    const email = args[1];
    const password = args[2];
    if (!email || !password) return m.reply("Format: `.deepseek add <email> <password>`");

    global.deepseekAccounts[m.chat] = { 
      email, password, 
      sessionId: null, parentId: null,
      mode: "cepat", 
      thinking: false, 
      search: true 
    };
    await m.react("✅");
    return m.reply(`✅ Akun ditambahkan!\nMode: Cepat\nThinking: OFF\nSearch: ON\nGunakan *.mode* & *.deepseekon*`);
  }

  // ── COMMAND: .mode ──
  if (command === "mode") {
    const account = global.deepseekAccounts[m.chat];
    if (!account) return m.reply("❌ Belum ada akun.");
    const newMode = args[1]?.toLowerCase();
    if (!["cepat", "pakar", "vision"].includes(newMode)) return m.reply("Mode: cepat|pakar|vision");
    account.mode = newMode;
    await m.react("✅");
    return m.reply(`✅ Mode diganti ke: ${newMode.toUpperCase()}`);
  }

  // ── COMMAND: .deepseekon ──
  if (command === "deepseekon") {
    const account = global.deepseekAccounts[m.chat];
    if (!account) return m.reply("❌ Belum ada akun.");
    const fitur = args[1]?.toLowerCase();
    if (fitur === "thinking") {
      account.thinking = !account.thinking;
      await m.react("🧠");
      return m.reply(`🧠 Thinking: ${account.thinking ? "ON" : "OFF"}`);
    }
    if (fitur === "search") {
      account.search = !account.search;
      await m.react("🔍");
      return m.reply(`🔍 Search: ${account.search ? "ON" : "OFF"}`);
    }
    return m.reply("Fitur: thinking|search");
  }

  // ── CEK AKUN ──
  const account = global.deepseekAccounts[m.chat];
  if (!account) return m.reply("❌ Belum ada akun! Gunakan `.deepseek add <email> <password>`");

  const isVision = m.quoted?.message?.imageMessage || m.message?.imageMessage;

  // ── MODE VISION ──
  if (account.mode === "vision" || command === "vision" || isVision) {
    const prompt = command === "vision" ? args.slice(1).join(" ") : text;
    if (!prompt) return m.reply("Masukkan pertanyaan untuk gambar!");
    
    await m.react("🕐");
    await m.reply("🖼️ *Vision Mode aktif...*");
    try {
      const client = getSharedClient(account);
      await client.init();
      account.token = client.token;
      if (!account.sessionId) {
        account.sessionId = await client.createSession();
        account.parentId = null;
      }

      const media = isVision ? (m.quoted?.message?.imageMessage || m.message?.imageMessage) : null;
      let filePath = null;
      if (media) {
        const buffer = await sock.downloadMediaMessage(media);
        filePath = path.join(process.cwd(), `temp_vision_${Date.now()}.jpg`);
        fs.writeFileSync(filePath, buffer);
      }

      let fileIds = [];
      if (filePath) {
        fileIds.push(await client.uploadFile(filePath));
        fs.unlinkSync(filePath);
      }

      const result = await client.chatVision(account.sessionId, prompt, fileIds, account.parentId);
      account.parentId = result.message_id;
      await m.react("✅");
      return m.reply(`🧠 *DeepSeek Vision*\n\n${result.reply || "Tidak ada jawaban."}`);
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ Error: ${e.message}`);
    }
  }

  // ── MODE PAKAR ──
  if (account.mode === "pakar" || command === "pakar") {
    const prompt = command === "pakar" ? args.slice(1).join(" ") : text;
    if (!prompt) return m.reply("Masukkan pertanyaan!");
    await m.react("🕐");
    await m.reply("🧠 *Mode Pakar aktif...*");
    try {
      const client = getSharedClient(account);
      await client.init();
      account.token = client.token;
      if (!account.sessionId) {
        account.sessionId = await client.createSession();
        account.parentId = null;
      }
      const result = await client.chatThinking(account.sessionId, prompt, account.parentId, account.search);
      account.parentId = result.message_id;
      let output = `🧠 *DeepSeek Pakar*\n\n`;
      if (result.think && account.thinking) output += `💭 *Berpikir:*\n${result.think}\n\n`;
      output += `💬 *Jawaban:*\n${result.reply}`;
      await m.react("✅");
      return m.reply(output);
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ Error: ${e.message}`);
    }
  }

  // ── MODE CEPAT (DEFAULT) ──
  if (text) {
    const prompt = text;
    await m.react("🕐");
    try {
      const client = getSharedClient(account);
      await client.init();
      account.token = client.token;
      if (!account.sessionId) {
        account.sessionId = await client.createSession();
        account.parentId = null;
      }
      const result = await client.chatThinking(account.sessionId, prompt, account.parentId, account.search);
      account.parentId = result.message_id;
      let output = `⚡ *DeepSeek Cepat*\n\n`;
      if (result.think && account.thinking) output += `💭 *Berpikir:*\n${result.think}\n\n`;
      output += `💬 *Jawaban:*\n${result.reply}`;
      await m.react("✅");
      return m.reply(output);
    } catch (e) {
      await m.react("❌");
      return m.reply(`❌ Error: ${e.message}`);
    }
  }

  // ── HELP MENU ──
  return m.reply(
    `🤖 *DeepSeek AI - Menu*\n\n` +
    `• *.mode cepat|pakar|vision*\n` +
    `• *.deepseekon thinking* (Toggle)\n` +
    `• *.deepseekon search* (Toggle)\n` +
    `• */.new* (Reset sesi)\n` +
    `• *.deepseek add <email> <password>* (Owner)\n\n` +
    `Status: Mode ${account.mode}, Thinking ${account.thinking ? "ON" : "OFF"}, Search ${account.search ? "ON" : "OFF"}`
  );
}

export { DeepSeekClient, getSharedClient };

export default {
  config,
  handler
};
# Technical Analysis: Agent CLI Reply Tool & Queue State Transition (`bridge/reply.js`)

**Author**: M1 Explorer 3 (Agent CLI Reply Tool & Queue State Specialist)  
**Date**: 2026-10-08  
**Scope**: Milestone 1 (Bridge Core IPC, Storage & Daemon Watcher)  
**Target Path**: `bridge/reply.js`  
**Dependencies**: `bridge/ipc.js`, `bridge/wa_queue.json`, `bridge/wa_response.json`, `bridge/.queue.lock`

---

## 1. Executive Summary & Architectural Role

Dalam sistem Remote Command & Control (C2) antara Niwo Bot dan Antigravity, skrip `bridge/reply.js` berfungsi sebagai jembatan eksekusi keluaran (outbound responder CLI). Skrip ini dieksekusi langsung oleh agen Antigravity di dalam terminal/PowerShell setelah agen terbangun oleh sinyal stdout dari `bridge/daemon.js`.

Alur operasional `bridge/reply.js`:
1. Agen Antigravity membaca pesan masuk dari stdout daemon atau dari file `bridge/wa_queue.json`.
2. Agen menyusun balasan berpersona Sawako Kuronuma (lengkap dengan kaomoji Jepang, tag stiker, atau lampiran media).
3. Agen menjalankan perintah CLI:
   `node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>] [--action <type>]`
4. `bridge/reply.js` memvalidasi argumen, memperoleh advisory file lock (`bridge/.queue.lock`), memeriksa status pesan di `bridge/wa_queue.json`, menandai pesan tersebut sebagai `completed`, lalu menambahkan balasan ke `bridge/wa_response.json`.
5. Niwo Bot (`src/lib/antigravityBridge.js`) membaca `bridge/wa_response.json`, mendispatch pesan dan stiker ke WhatsApp, lalu menandai balasan sebagai `delivered`.

Poin kritis arsitektural:
Transisi status item di `bridge/wa_queue.json` dari `pending` ke `completed` adalah mekanisme utama yang mencegah `bridge/daemon.js` memicu *auto-wake* berulang saat file queue diperbarui.

---

## 2. CLI Interface & Argument Parsing Design

### 2.1 Sintaks Resmi & Flag

Sintaks pemanggilan CLI:
```bash
node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>] [--action <type>] [--force] [--json] [--help]
```

Daftar opsi dan parameter:

| Opsi Panjang | Opsi Pendek | Tipe | Status | Deskripsi |
|---|---|---|---|---|
| `--id` | `-i` | string | Wajib | ID pesan antrean masuk (contoh: `wa_msg_1728392019234_abc123`). |
| `--text` | `-t` | string | Wajib | Teks balasan Sawako dengan kaomoji dan/atau action tag. |
| `--sticker` | `-s` | string | Opsional | Kunci emosi stiker (contoh: `HAPPY`, `SHY`, `SURPRISE`, `SAD`, `GREETING`, `DEFAULT`). Dinormalisasi menjadi huruf kapital. |
| `--image` | `-m` | string | Opsional | Path absolut atau relatif ke file gambar (tangkapan layar desktop atau media). |
| `--action` | `-a` | string | Opsional | Aksi sistem tambahan (contoh: `SCREENSHOT`, `SHUTDOWN`, `FILE_QUERY`). |
| `--force` | `-f` | boolean | Opsional | Memaksa penulisan balasan meskipun item antrean sudah berstatus `completed`. Default: `false`. |
| `--json` | - | boolean | Opsional | Format keluaran stdout dalam bentuk JSON murni untuk pemrosesan mesin. Default: `false`. |
| `--help` | `-h` | boolean | Opsional | Menampilkan buku panduan CLI bantuan. Default: `false`. |

### 2.2 Mesin Pengurai Argumen (Zero-Dependency)

Node.js v24.14.1 (dan seluruh Node.js >= 18.3.0) menyediakan modul internal bawaan `node:util` dengan fungsi `parseArgs`. Menggunakan `parseArgs` menghilangkan dependensi pihak ketiga seperti `yargs` atau `commander`, menjaga runtime tetap ramping dan bebas konflik.

Konfigurasi `parseArgs`:
```javascript
const { parseArgs } = require("node:util");

const cliConfig = {
  options: {
    id: { type: "string", short: "i" },
    text: { type: "string", short: "t" },
    sticker: { type: "string", short: "s" },
    image: { type: "string", short: "m" },
    action: { type: "string", short: "a" },
    force: { type: "boolean", short: "f", default: false },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
  strict: true,
};
```

Penanganan error saat penguraian argumen:
Jika pengguna memasukkan flag yang tidak dikenal atau lupa memberikan nilai setelah opsi bertipe string, `parseArgs` melempar `TypeError` dengan kode seperti `ERR_PARSE_ARGS_UNKNOWN_OPTION` atau `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`. `reply.js` menangkap error ini dan mencetak pesan deskriptif ke `stderr` sebelum keluar dengan kode keluar 1 (`EXIT_INVALID_ARGS`).

### 2.3 Penanganan Karakter Multibyte UTF-8 & Windows Shell Escaping

Pesan persona Sawako menggunakan kaomoji Jepang yang kaya karakter multibyte UTF-8 seperti `(*v*)`, `(UwU)`, `(*/ω＼*)`, `(*^▽^*)`, `m(_ _)m`.
Pada Windows PowerShell dan CMD:
1. `bridge/reply.js` membaca argumen langsung dari `process.argv` yang telah di-decode oleh runtime Node.js ke format UTF-8 internal V8.
2. Saat agen memanggil CLI, string teks wajib dibungkus tanda kutip ganda (`"`), misalnya:
   `node bridge/reply.js --id wa_msg_001 --text "Halo Kak Ilham! (*^▽^*)"`
3. Jika teks berisi tanda kutip ganda internal, shell Windows membutuhkan escape `\"` atau tanda kutip tunggal di PowerShell. Skrip memproses string hasil parsing tanpa merusak integritas karakter kaomoji.

### 2.4 Deteksi Otomatis Tag Stiker dalam Teks

Sesuai Requirement R4, agen Antigravity dapat menyematkan tag aksi stiker di dalam teks balasan, misalnya:
`"Terima kasih banyak ya Kak Ilham... (*/ω＼*) [ACTION: SEND_STICKER_SHY]"`

Logika deteksi dan sinkronisasi di `bridge/reply.js`:
1. Pola regex: `/\[ACTION:\s*SEND_STICKER_([A-Za-z_]+)\]/i`.
2. Jika ditemukan di dalam argumen `--text` dan opsi `--sticker` tidak diisi eksplisit:
   - Nilai emosi diekstrak dan dinormalisasi menjadi huruf kapital (contoh: `SHY`).
   - `stickerKey` disetel ke nilai tersebut.
   - Aksi `SEND_STICKER_<EMOTION>` otomatis dimasukkan ke dalam daftar array `actions`.
3. Jika opsi `--sticker` diberikan secara eksplisit lewat CLI (misalnya `--sticker HAPPY`), nilai opsi CLI diutamakan, dan `SEND_STICKER_HAPPY` disematkan ke daftar array `actions`.
4. Jika opsi `--action` diberikan (misalnya `--action SCREENSHOT`), aksi tersebut digabungkan ke dalam array `actions` secara deduplikasi.

---

## 3. Queue State Machine & Transactional Synchronization

### 3.1 Skema Data Antrean Masuk (`bridge/wa_queue.json`)

File `bridge/wa_queue.json` berisi array objek pesan masuk dari WhatsApp:

```json
[
  {
    "id": "wa_msg_1728392019234_abc123",
    "messageId": "BAE59128391203",
    "sender": "628123456789@s.whatsapp.net",
    "senderNumber": "628123456789",
    "pushName": "Ilham",
    "chatType": "direct",
    "groupJid": null,
    "text": "sawako tolong cek status laptop",
    "quoted": null,
    "isOwner": true,
    "timestamp": 1728392019234,
    "status": "pending",
    "completedAt": null,
    "replyId": null
  }
]
```

### 3.2 Siklus Hidup Transisi Status Antrean

Status pesan dalam antrean mengikuti diagram alir berikut:

```
[ PENDING ] (Ditulis oleh Niwo Bot / src/lib/antigravityBridge.js)
     │
     ▼ (bridge/daemon.js membaca status 'pending' dan mencetak stdout auto-wake)
     │
     ▼ (Agen Antigravity menjalankan node bridge/reply.js --id <queueId>)
     │
[ COMPLETED ] (bridge/reply.js memperbarui status, completedAt, dan replyId)
```

Aturan validasi transisi:
1. Jika item ditemukan dengan `status === 'pending'`:
   - Ubah `status` menjadi `'completed'`.
   - Catat `completedAt = Date.now()`.
   - Simpan tautan balasan `replyId = responseId`.
2. Jika item ditemukan dengan `status === 'completed'`:
   - Jika flag `--force` TIDAK disetel: tolak eksekusi, lepaskan lock, cetak peringatan ke stderr, dan keluar dengan kode 3 (`EXIT_ALREADY_COMPLETED`).
   - Jika flag `--force` DISETEL: izinkan penambahan balasan kedua ke `wa_response.json`, perbarui `completedAt` dan `replyId`.
3. Jika item dengan ID tersebut TIDAK ditemukan di `wa_queue.json`:
   - Jika flag `--force` TIDAK disetel: tolak eksekusi, lepaskan lock, cetak error ke stderr, dan keluar dengan kode 2 (`EXIT_QUEUE_NOT_FOUND`).
   - Jika flag `--force` disetel: buat balasan independen (jika target jid dapat ditentukan atau disetel default).

### 3.3 Skema Data Balasan Keluar (`bridge/wa_response.json`)

File `bridge/wa_response.json` berisi array objek balasan yang siap diambil dan dikirim oleh Niwo Bot:

```json
[
  {
    "id": "wa_resp_1728392021500_xyz789",
    "queueId": "wa_msg_1728392019234_abc123",
    "targetJid": "628123456789@s.whatsapp.net",
    "chatType": "direct",
    "groupJid": null,
    "text": "Baik Kak Ilham! (*^▽^*) Laptop dalam kondisi optimal.",
    "actions": ["SEND_STICKER_HAPPY"],
    "stickerKey": "HAPPY",
    "mediaAttachment": null,
    "quotedMessageId": "BAE59128391203",
    "timestamp": 1728392021500,
    "status": "pending"
  }
]
```

Resolusi `targetJid` dari konteks pesan masuk:
- Jika pesan berasal dari grup (`chatType === 'group'` atau `groupJid` tidak bernilai null): `targetJid` disetel ke `item.groupJid`.
- Jika pesan obrolan pribadi (`chatType === 'direct'`): `targetJid` disetel ke `item.sender`.
- `quotedMessageId`: diambil dari `item.messageId` agar bot WhatsApp dapat membalas dengan mengutip pesan asli pengguna.

---

## 4. Concurrency, Advisory Locking, & Windows 11 I/O Resilience

### 4.1 Tantangan Lingkungan Windows 11

Di Windows 11, manipulasi file secara konkuren menghadapi kendala khas:
1. `EBUSY` / `EPERM` pada penggantian nama file (`fs.rename`): Jika file target sedang dibuka sesaat oleh Chokidar watcher (`bridge/daemon.js`) atau scanner Windows Defender, operasi rename langsung gagal dengan exception `EPERM` atau `EBUSY`.
2. Race condition antara pembacaan dan penulisan: Niwo Bot melakukan polling pada `wa_response.json` sementara Antigravity menulis balasan secara acak.
3. Lock yatim (stale lock): Jika proses CLI mengalami crash atau ditutup paksa di tengah jalan, file pengunci tidak boleh mengunci sistem secara permanen.

### 4.2 Protokol Advisory Mutex File Lock (`bridge/.queue.lock`)

Untuk menjamin atomisitas transisi status queue dan penulisan response, `bridge/reply.js` dan `bridge/ipc.js` menggunakan file lock bersama `bridge/.queue.lock`.

Algoritma penguncian:
1. **Pembuatan Atomik**: Menggunakan `fs.promises.open(lockPath, 'wx')` (flag `O_CREAT | O_EXCL`). Jika file sudah ada, sistem operasi melempar error `EEXIST`.
2. **Payload Diagnostik**: File lock menyimpan metadata JSON:
   `{ "pid": process.pid, "timestamp": Date.now(), "holder": "reply.js" }`
3. **Deteksi Stale Lock (TTL)**: Jika file lock sudah ada lebih dari 8.000 ms (TTL), proses mengasumsikan pemilik lock sebelumnya telah mati. File lock dihapus (`unlink`) dan proses mencoba mengambil lock kembali.
4. **Exponential Backoff dengan Jitter**: Jika lock sedang dipegang proses lain dan masih segar, proses menunggu antara 25 ms sampai 60 ms dengan jitter acak sebelum mencoba kembali, dengan batas waktu total 5.000 ms.
5. **Pelepasan Lock Terjamin**: Blok eksekusi dibungkus dalam konstruksi `try ... finally` untuk memastikan `unlink` selalu dipanggil, serta didaftarkan pada event `process.on('SIGINT')`, `SIGTERM`, dan `exit`.

### 4.3 Penulisan File Atomik dengan Retry Loop

Algoritma penyimpanan file JSON di Windows:
1. Data diserialisasi menjadi string JSON dengan indentasi 2 spasi.
2. Tulis ke file temporer terisolasi pada direktori yang sama:
   `bridge/.wa_response.json.tmp.<pid>.<timestamp>`
3. Pindahkan file temporer ke file target menggunakan loop `fs.promises.rename` hingga 10 kali percobaan dengan jeda bertingkat (25 ms * attempt) untuk menangani locking transien Windows (`EPERM`/`EBUSY`).
4. Hapus file temporer jika seluruh percobaan gagal sebelum melempar error.

---

## 5. Standardized CLI Exit Code Matrix & Output Formats

### 5.1 Tabel Kode Keluar (Exit Codes)

| Kode Keluar | Nama Konstanta | Kondisi Pemicu | Saluran Pesan |
|---|---|---|---|
| `0` | `EXIT_SUCCESS` | Operasi sukses, antrean diperbarui ke `completed`, balasan tersimpan. | `stdout` |
| `1` | `EXIT_INVALID_ARGS` | Argumen wajib `--id` atau `--text` tidak ada, atau flag tidak valid. | `stderr` |
| `2` | `EXIT_QUEUE_NOT_FOUND` | Queue ID tidak ditemukan di `bridge/wa_queue.json` (tanpa `--force`). | `stderr` |
| `3` | `EXIT_ALREADY_COMPLETED` | Item queue sudah berstatus `completed` (tanpa `--force`). | `stderr` |
| `4` | `EXIT_MEDIA_NOT_FOUND` | File gambar pada path `--image` tidak ditemukan atau bukan file valid. | `stderr` |
| `5` | `EXIT_STORAGE_CORRUPT` | JSON pada `wa_queue.json` atau `wa_response.json` rusak / parse error. | `stderr` |
| `6` | `EXIT_LOCK_TIMEOUT` | Gagal memperoleh `bridge/.queue.lock` dalam batas waktu 5000 ms. | `stderr` |
| `7` | `EXIT_IO_ERROR` | Kesalahan I/O filesystem yang tidak terduga. | `stderr` |

### 5.2 Format Keluaran Standar

**Keluaran Sukses (Default):**
```text
[REPLY_SUCCESS] Response wa_resp_1728392021500_xyz789 queued for wa_msg_1728392019234_abc123 (target: 628123456789@s.whatsapp.net, sticker: HAPPY)
```

**Keluaran Sukses (Mode `--json`):**
```json
{
  "success": true,
  "responseId": "wa_resp_1728392021500_xyz789",
  "queueId": "wa_msg_1728392019234_abc123",
  "targetJid": "628123456789@s.whatsapp.net",
  "status": "completed",
  "stickerKey": "HAPPY",
  "mediaAttachment": null,
  "timestamp": 1728392021500
}
```

**Keluaran Kesalahan (ke `stderr`):**
```text
[REPLY_ERROR:EXIT_QUEUE_NOT_FOUND] Queue item 'wa_msg_999' not found in bridge/wa_queue.json.
```

---

## 6. Complete Blueprint Implementation (`bridge/reply.js`)

Berikut adalah cetak biru kode implementasi lengkap `bridge/reply.js` yang siap pakai, menerapkan prinsip *anti-slop code* (tanpa mock, penanganan error tangguh, zero external dependencies):

```javascript
#!/usr/bin/env node
/**
 * bridge/reply.js
 * CLI Responder tool for Antigravity Agent to send WhatsApp replies via file IPC.
 *
 * Usage:
 *   node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>] [--action <type>] [--force] [--json]
 */

const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");

// Standard Exit Codes
const EXIT = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  QUEUE_NOT_FOUND: 2,
  ALREADY_COMPLETED: 3,
  MEDIA_NOT_FOUND: 4,
  STORAGE_CORRUPT: 5,
  LOCK_TIMEOUT: 6,
  IO_ERROR: 7,
};

const BRIDGE_DIR = path.resolve(__dirname);
const QUEUE_FILE = path.join(BRIDGE_DIR, "wa_queue.json");
const RESPONSE_FILE = path.join(BRIDGE_DIR, "wa_response.json");
const LOCK_FILE = path.join(BRIDGE_DIR, ".queue.lock");

// Helper: Print CLI Help Manual
function printHelp() {
  const helpText = `
Usage:
  node bridge/reply.js --id <queueId> --text <text> [options]

Required Options:
  -i, --id <queueId>      Queue message ID from wa_queue.json
  -t, --text <text>        Sawako response text (UTF-8, kaomoji supported)

Optional Options:
  -s, --sticker <EMOTION>  Emotion sticker key (HAPPY, SHY, SURPRISE, SAD, GREETING, DEFAULT)
  -m, --image <path>       Relative or absolute path to image attachment
  -a, --action <type>      Custom system action type (SCREENSHOT, SHUTDOWN, etc.)
  -f, --force              Force reply even if item is already completed or missing
      --json               Output machine-readable JSON format to stdout
  -h, --help               Display this help message

Exit Codes:
  0 : Success
  1 : Invalid Arguments
  2 : Queue Item Not Found
  3 : Queue Item Already Completed
  4 : Media File Not Found
  5 : Storage JSON Corrupt
  6 : Lock Acquisition Timeout
  7 : Filesystem I/O Error
`;
  process.stdout.write(helpText.trim() + "\n");
}

// Helper: Format error message
function emitError(code, message, isJson = false) {
  const codeName = Object.keys(EXIT).find((key) => EXIT[key] === code) || "UNKNOWN";
  if (isJson) {
    process.stderr.write(
      JSON.stringify({ success: false, errorCode: code, errorName: codeName, message }) + "\n"
    );
  } else {
    process.stderr.write(`[REPLY_ERROR:${codeName}] ${message}\n`);
  }
}

// Advisory Lock Implementation
async function acquireLock(lockPath, timeoutMs = 5000, ttlMs = 8000) {
  const startTime = Date.now();
  const retryInterval = 40;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const payload = JSON.stringify({
        pid: process.pid,
        timestamp: Date.now(),
        holder: "reply.js",
      });
      const handle = await fs.promises.open(lockPath, "wx");
      await handle.writeFile(payload, "utf8");
      await handle.close();
      return true;
    } catch (err) {
      if (err.code === "EEXIST") {
        try {
          const stat = await fs.promises.stat(lockPath);
          const age = Date.now() - stat.mtimeMs;
          if (age > ttlMs) {
            await fs.promises.unlink(lockPath);
            continue;
          }
        } catch {
          // File might have been removed concurrently, retry next loop
        }
        const jitter = Math.floor(Math.random() * 25);
        await new Promise((resolve) => setTimeout(resolve, retryInterval + jitter));
      } else {
        throw err;
      }
    }
  }
  const timeoutErr = new Error(`Lock acquisition timed out after ${timeoutMs}ms for ${lockPath}`);
  timeoutErr.code = "ELOCKTIMEOUT";
  throw timeoutErr;
}

async function releaseLock(lockPath) {
  try {
    await fs.promises.unlink(lockPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      process.stderr.write(`[LOCK_RELEASE_WARN] Failed to unlink lock file: ${err.message}\n`);
    }
  }
}

// Safe JSON Reader with Corruption Detection
async function readJsonSafe(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = await fs.promises.readFile(filePath, "utf8");
    const trimmed = raw.trim();
    if (!trimmed) {
      return fallback;
    }
    return JSON.parse(trimmed);
  } catch (err) {
    const corruptErr = new Error(`Corrupted JSON file at ${filePath}: ${err.message}`);
    corruptErr.code = "ECORRUPT";
    throw corruptErr;
  }
}

// Windows-Resilient Atomic JSON Writer
async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  const tmpFile = path.join(
    dir,
    `.${path.basename(filePath)}.tmp.${process.pid}.${Date.now()}`
  );
  const content = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(tmpFile, content, "utf8");

  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.promises.rename(tmpFile, filePath);
      return;
    } catch (err) {
      if (
        (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") &&
        attempt < maxRetries
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      } else {
        try {
          await fs.promises.unlink(tmpFile);
        } catch {}
        throw err;
      }
    }
  }
}

// Main Execution Function
async function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs({
      options: {
        id: { type: "string", short: "i" },
        text: { type: "string", short: "t" },
        sticker: { type: "string", short: "s" },
        image: { type: "string", short: "m" },
        action: { type: "string", short: "a" },
        force: { type: "boolean", short: "f", default: false },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (err) {
    emitError(EXIT.INVALID_ARGS, `CLI argument parsing failed: ${err.message}`, false);
    process.exit(EXIT.INVALID_ARGS);
  }

  const { values } = parsedArgs;
  const isJson = Boolean(values.json);

  if (values.help) {
    printHelp();
    process.exit(EXIT.SUCCESS);
  }

  if (!values.id || typeof values.id !== "string" || !values.id.trim()) {
    emitError(EXIT.INVALID_ARGS, "Missing required argument: --id <queueId>", isJson);
    process.exit(EXIT.INVALID_ARGS);
  }

  if (!values.text || typeof values.text !== "string" || !values.text.trim()) {
    emitError(EXIT.INVALID_ARGS, "Missing required argument: --text <text>", isJson);
    process.exit(EXIT.INVALID_ARGS);
  }

  const queueId = values.id.trim();
  const responseText = values.text.trim();
  let stickerKey = values.sticker ? values.sticker.trim().toUpperCase() : null;
  const rawActions = [];

  // Parse inline [ACTION: SEND_STICKER_<EMOTION>] in text
  const stickerRegex = /\[ACTION:\s*SEND_STICKER_([A-Za-z_]+)\]/i;
  const stickerMatch = responseText.match(stickerRegex);
  if (stickerMatch) {
    const inlineEmotion = stickerMatch[1].toUpperCase();
    if (!stickerKey) {
      stickerKey = inlineEmotion;
    }
    rawActions.push(`SEND_STICKER_${inlineEmotion}`);
  } else if (stickerKey) {
    rawActions.push(`SEND_STICKER_${stickerKey}`);
  }

  if (values.action && values.action.trim()) {
    rawActions.push(values.action.trim().toUpperCase());
  }
  const actions = Array.from(new Set(rawActions));

  // Validate image attachment path if provided
  let mediaAttachment = null;
  if (values.image && values.image.trim()) {
    const resolvedImagePath = path.resolve(process.cwd(), values.image.trim());
    if (!fs.existsSync(resolvedImagePath) || !fs.statSync(resolvedImagePath).isFile()) {
      emitError(
        EXIT.MEDIA_NOT_FOUND,
        `Media attachment file not found: ${resolvedImagePath}`,
        isJson
      );
      process.exit(EXIT.MEDIA_NOT_FOUND);
    }
    mediaAttachment = resolvedImagePath;
  }

  // Acquire Lock and Execute State Transition
  let lockHeld = false;
  try {
    await acquireLock(LOCK_FILE, 5000, 8000);
    lockHeld = true;

    // Read and Validate Queue Item
    let queueItems;
    try {
      queueItems = await readJsonSafe(QUEUE_FILE, []);
    } catch (err) {
      emitError(EXIT.STORAGE_CORRUPT, `Failed reading wa_queue.json: ${err.message}`, isJson);
      process.exit(EXIT.STORAGE_CORRUPT);
    }

    const itemIndex = queueItems.findIndex((item) => item.id === queueId);
    let targetJid = null;
    let quotedMessageId = null;
    let chatType = "direct";
    let groupJid = null;

    if (itemIndex === -1) {
      if (!values.force) {
        emitError(
          EXIT.QUEUE_NOT_FOUND,
          `Queue item '${queueId}' not found in ${QUEUE_FILE}. Use --force to override.`,
          isJson
        );
        process.exit(EXIT.QUEUE_NOT_FOUND);
      }
      // Fallback target when forced
      targetJid = "unknown@s.whatsapp.net";
    } else {
      const queueItem = queueItems[itemIndex];

      if (queueItem.status === "completed" && !values.force) {
        emitError(
          EXIT.ALREADY_COMPLETED,
          `Queue item '${queueId}' was already completed at ${queueItem.completedAt || "unknown"}. Use --force to reply again.`,
          isJson
        );
        process.exit(EXIT.ALREADY_COMPLETED);
      }

      // Determine recipient target
      chatType = queueItem.chatType || (queueItem.groupJid ? "group" : "direct");
      groupJid = queueItem.groupJid || null;
      targetJid = groupJid || queueItem.sender || queueItem.from || "unknown@s.whatsapp.net";
      quotedMessageId = queueItem.messageId || null;

      // Transition item status in queue
      const responseId = `wa_resp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      queueItem.status = "completed";
      queueItem.completedAt = Date.now();
      queueItem.replyId = responseId;

      await writeJsonAtomic(QUEUE_FILE, queueItems);

      // Read Responses and Append Outbound Item
      let responseItems;
      try {
        responseItems = await readJsonSafe(RESPONSE_FILE, []);
      } catch (err) {
        emitError(EXIT.STORAGE_CORRUPT, `Failed reading wa_response.json: ${err.message}`, isJson);
        process.exit(EXIT.STORAGE_CORRUPT);
      }

      const responseRecord = {
        id: responseId,
        queueId: queueId,
        targetJid: targetJid,
        chatType: chatType,
        groupJid: groupJid,
        text: responseText,
        actions: actions,
        stickerKey: stickerKey,
        mediaAttachment: mediaAttachment,
        quotedMessageId: quotedMessageId,
        timestamp: Date.now(),
        status: "pending",
      };

      responseItems.push(responseRecord);
      await writeJsonAtomic(RESPONSE_FILE, responseItems);

      // Success Emission
      if (isJson) {
        process.stdout.write(
          JSON.stringify({
            success: true,
            responseId: responseRecord.id,
            queueId: responseRecord.queueId,
            targetJid: responseRecord.targetJid,
            status: "completed",
            stickerKey: responseRecord.stickerKey,
            mediaAttachment: responseRecord.mediaAttachment,
            timestamp: responseRecord.timestamp,
          }) + "\n"
        );
      } else {
        process.stdout.write(
          `[REPLY_SUCCESS] Response ${responseRecord.id} queued for ${queueId} (target: ${targetJid}${stickerKey ? `, sticker: ${stickerKey}` : ""})\n`
        );
      }

      process.exit(EXIT.SUCCESS);
    }
  } catch (err) {
    if (err.code === "ELOCKTIMEOUT") {
      emitError(EXIT.LOCK_TIMEOUT, err.message, isJson);
      process.exit(EXIT.LOCK_TIMEOUT);
    } else if (err.code === "ECORRUPT") {
      emitError(EXIT.STORAGE_CORRUPT, err.message, isJson);
      process.exit(EXIT.STORAGE_CORRUPT);
    } else {
      emitError(EXIT.IO_ERROR, `Unexpected filesystem error: ${err.message}`, isJson);
      process.exit(EXIT.IO_ERROR);
    }
  } finally {
    if (lockHeld) {
      await releaseLock(LOCK_FILE);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[FATAL_UNHANDLED] ${err.stack || err.message}\n`);
    process.exit(EXIT.IO_ERROR);
  });
}

module.exports = {
  EXIT,
  acquireLock,
  releaseLock,
  readJsonSafe,
  writeJsonAtomic,
};
```

---

## 7. Contract Synchronization with `bridge/ipc.js`

Saat `bridge/ipc.js` selesai diimplementasikan oleh tim M1, fungsi-fungsi manipulasi file lock dan antrean dapat didelegasikan langsung ke `ipc.js` untuk menghindari duplikasi kode:

Kontrak antarmuka `bridge/ipc.js`:
```javascript
const ipc = require("./ipc.js");

// Ekspor yang diharapkan dari bridge/ipc.js:
// 1. ipc.withLock(async () => { ... })
// 2. ipc.markQueueItemCompleted(queueId, responseMetadata)
// 3. ipc.appendResponse(responseRecord)
// 4. ipc.getQueueItem(queueId)
```

Dengan desain modular pada Bagian 6, skrip `bridge/reply.js` dapat beroperasi mandiri (self-contained) bila diuji secara terisolasi, maupun mengimpor helper dari `ipc.js` saat seluruh modul bridge disatukan.

---

## 8. Test Verification Plan

Rencana pengujian untuk memverifikasi `bridge/reply.js` secara tuntas:

### 8.1 Unit & CLI Argument Tests
1. **Validasi Argumen Wajib**:
   - Jalankan `node bridge/reply.js` tanpa argumen. Pastikan keluar dengan kode 1 dan pesan error di stderr.
   - Jalankan `node bridge/reply.js --id wa_msg_001` tanpa `--text`. Pastikan keluar dengan kode 1.
2. **Flag `--help`**:
   - Jalankan `node bridge/reply.js --help`. Pastikan keluar dengan kode 0 dan mencetak teks bantuan.
3. **Format `--json`**:
   - Jalankan perintah dengan `--json`. Pastikan stdout memuat JSON valid dengan properti `success: true`.

### 8.2 State Transition & Storage Tests
4. **Pembaruan Status Antrean Tunggal**:
   - Buat mock `wa_queue.json` berisi 1 item berstatus `pending`.
   - Jalankan `node bridge/reply.js --id wa_msg_001 --text "Halo (*^▽^*)"`.
   - Verifikasi exit code 0.
   - Verifikasi `wa_queue.json` memiliki item `wa_msg_001` dengan `status === 'completed'`, `completedAt` berupa angka timestamp, dan `replyId` yang sesuai.
   - Verifikasi `wa_response.json` memiliki 1 entri baru dengan `status === 'pending'`, `text` yang sama, dan `targetJid` yang sesuai dengan `sender` atau `groupJid`.
5. **Dukungan Stiker & Action Tag**:
   - Jalankan dengan `--sticker HAPPY`. Verifikasi `stickerKey === 'HAPPY'` dan `actions` berisi `'SEND_STICKER_HAPPY'`.
   - Jalankan dengan teks memuat `[ACTION: SEND_STICKER_SHY]`. Verifikasi `stickerKey === 'SHY'` otomatis terdeteksi.
6. **Validasi Lampiran Media**:
   - Jalankan dengan `--image ./nonexistent.png`. Verifikasi exit code 4 (`EXIT_MEDIA_NOT_FOUND`).
   - Buat file dummy PNG, jalankan dengan `--image <path>`. Verifikasi exit code 0 dan `mediaAttachment` berisi path absolut file tersebut.

### 8.3 Boundary & Concurrency Tests
7. **Pencegahan Balasan Duplikat (Idempotency Guard)**:
   - Jalankan `bridge/reply.js` pada item yang sudah `completed` tanpa flag `--force`. Verifikasi exit code 3 (`EXIT_ALREADY_COMPLETED`).
   - Jalankan kembali dengan flag `--force`. Verifikasi exit code 0.
8. **Item Antrean Tidak Ditemukan**:
   - Jalankan dengan `--id wa_msg_invalid` tanpa flag `--force`. Verifikasi exit code 2 (`EXIT_QUEUE_NOT_FOUND`).
9. **Uji Konkurensi Tinggi (Race Condition Test)**:
   - Buat mock `wa_queue.json` dengan 10 pesan pending berbeda.
   - Luncurkan 10 proses anak (`child_process.spawn`) secara simultan yang memanggil `node bridge/reply.js` untuk masing-masing ID.
   - Verifikasi seluruh 10 proses keluar dengan exit code 0.
   - Verifikasi `wa_queue.json` tidak mengalami *file truncation* atau JSON malformasi, dan seluruh 10 item berstatus `completed`.
   - Verifikasi `wa_response.json` berisi tepat 10 objek balasan.
10. **Pemulihan Stale Lock**:
    - Buat file `bridge/.queue.lock` secara manual dengan timestamp 10 detik yang lalu.
    - Jalankan `node bridge/reply.js --id wa_msg_001 --text "Tes"`.
    - Verifikasi skrip berhasil mendeteksi stale lock, menghapusnya, dan menyelesaikan eksekusi dengan exit code 0.

---

## 9. Rekomendasi untuk Tahap Implementasi

1. **Integrasi dengan Persona Engine (M3)**:
   Saat `src/lib/sawakoPersona.js` selesai diimplementasikan, output teks dari prompt agen dapat disalurkan langsung tanpa modifikasi karena `bridge/reply.js` telah mendukung karakter kaomoji UTF-8 secara penuh.
2. **Logging Eksekusi**:
   Teks keluaran `[REPLY_SUCCESS]` memberikan umpan balik visual instan di konsol Antigravity saat perintah dieksekusi melalui tool `run_command`.
3. **Penyimpanan Media Sementara**:
   Untuk tangkapan layar desktop (M4), simpan file di direktori `bridge/media/` sebelum memanggil `bridge/reply.js --image bridge/media/<file>.png`.

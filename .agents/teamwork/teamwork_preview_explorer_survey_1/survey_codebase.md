# Technical Survey: Codebase & Architecture Explorer (Niwo Bot C2 Bridge)

**Date**: 2026-10-08  
**Author**: Survey Explorer 1 (Codebase & Architecture Explorer)  
**Project Path**: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727`  
**Target Goal**: Analisis arsitektur sistem Niwo Bot untuk integrasi Antigravity Remote C2 Assistant (File IPC Bridge, Sawako Persona, Auto-Wake, & Sticker Automation).

---

## 1. Executive Summary

Proyek ini adalah bot WhatsApp multi-fungsi bernama **NIWO BOT** (versi 2.2.0, evolusi dari Hiyuki AI / Aurex MD) yang berjalan pada runtime Node.js menggunakan fork library Baileys (`@itsliaaa/baileys`). Bot ini dioperasikan pada sistem operasi Windows 11 di laptop pengguna (`Mode: Local Laptop`).

Kebutuhan integrasi C2 Assistant:
1. Menghubungkan sesi WhatsApp bot langsung ke sesi Antigravity aktif via IPC file-watcher (`wa_queue.json` dan `wa_response.json`).
2. Perintah kontrol `.gravity on` (dengan opsi tombol interaktif: *Chat only*, *Group only*, *Both*) dan `.gravity off` yang eksklusif untuk nomor Super Owner.
3. Intersepsi pesan otomatis: di chat pribadi untuk owner, dan di grup jika pesan me-reply bot atau menyebut bot.
4. Fallback otomatis jika Antigravity tertutup/tidak merespons, memunculkan tombol interaktif "Open Antigravity" yang mengeksekusi perintah Windows `start agy`.
5. Persona Sawako (Kimi ni Todoke) dengan kaomoji Jepang autentik (tanpa emoji modern) dan kemampuan trigger stiker WhatsApp emosional via action tag `[ACTION: SEND_STICKER_<NAMA>]`.

---

## 2. Directory Structure & Environment Mapping

### 2.1 File & Directory Tree

```
C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\
├── index.js                     # Entry point bot, bootstrap Baileys, lifecycle & connection handler
├── config.js                    # Shim root yang mengekspor ./src/config.js
├── appConfig.js                 # Shim alias untuk config.js
├── package.json                 # Metadata npm, script, dan daftar dependensi
├── CHANGES.md                   # Riwayat refaktor dan perubahan fitur UI/tombol
├── README.md                    # Dokumentasi bot dan panduan instalasi
├── assets/                      # Asset visual tambahan (brat, dll)
├── esmlib/                      # Library helper berbasis ESM
│   ├── sticker.js               # Generator & konverter WebP sticker (Sharp + EXIF Webpmux)
│   ├── converter.js             # Konverter media FFmpeg
│   └── simple.js                # Helper ekstraksi dan socket serialisasi ESM
├── lib/                         # Modul utilitas tingkat lanjut (ffmpeg, funData, mone, ytdlp)
├── database/                    # Penyimpanan data operasional JSON
│   ├── users.json               # Profil dan level user
│   ├── groups.json              # Konfigurasi proteksi & fitur per-grup
│   └── settings.json            # Konfigurasi sistem global (extraOwners, setting toggle)
├── plugins/                     # 23 kategori plugin ESM (ai, owner, tools, group, sticker, dll)
│   ├── ai/                      # Plugin AI (autogpt.js, gemini, dll)
│   ├── owner/                   # Plugin khusus Owner (eval, buttonmode, addowner, dll)
│   ├── sticker/                 # Plugin pembuatan stiker (sticker.js, smene, brat)
│   ├── group/                   # Plugin manajemen grup
│   └── ...                      # Kategori lainnya
├── src/
│   ├── config.js                # Konfigurasi sentral bot (identitas, nomor owner, prefix, authFolder)
│   ├── commands/                # Folder legacy command CJS (dimonitor PluginLoader, saat ini kosong)
│   ├── handlers/
│   │   └── messageHandler.js    # Pipeline pemrosesan pesan masuk Baileys (messages.upsert)
│   ├── lib/
│   │   ├── database.js          # Layer abstraksi database (users, groups, settings)
│   │   ├── buttonState.js       # Pengaturan status aktif tombol menu
│   │   └── welcomeSystem.js     # Manajemen pesan sambutan grup
│   ├── utils/
│   │   ├── PluginLoader.js      # Watcher & loader command legacy CJS (chokidar)
│   │   ├── pluginBridge.js      # Loader & normalizer plugin ESM di /plugins
│   │   ├── interactiveHelper.js # Builder pesan interaktif native flow Baileys (button/list/media)
│   │   ├── connPatch.js         # Monkey patch soket Baileys (reply, sendButton, sendFile, sendVoiceNote)
│   │   ├── serialize.js         # Serializer pesan Baileys ke format m objek standar
│   │   ├── globals.js           # Inisialisasi variabel global (global.db, global.apikey, dll)
│   │   └── assets.js            # Loader cache aset foto menu dan audio
│   ├── database/
│   │   ├── session/             # Multi-file auth Baileys (kredensial login aktif WhatsApp)
│   │   ├── jadibot/             # Multi-session untuk bot kloning
│   │   └── database.json        # Database legacy CJS
│   └── media/                   # Aset media lokal (audio, video, menu JPG/PNG)
└── tmp/                         # Folder sementara untuk pemrosesan media
```

### 2.2 Package Configuration & Dependencies

Berdasarkan `package.json`:
- **Engine**: Node.js `>=18.0.0` (Runtime aktif terverifikasi: **Node.js v24.14.1**).
- **Core Library**: `@itsliaaa/baileys: "latest"` (Fork Baileys dengan dukungan native flow interactive message).
- **Media Processing**:
  - `sharp: ^0.33.4` (Manipulasi citra cepat, resize, konversi WebP sticker).
  - `node-webpmux: ^3.1.9` (Injeksi metadata EXIF stiker WhatsApp: packName dan author).
  - `fluent-ffmpeg: ^2.1.3`, `@ffmpeg-installer/ffmpeg: ^1.1.0`, `@ffprobe-installer/ffprobe: ^2.1.2`.
- **System & Utilities**:
  - `chokidar: ^3.6.0` (File watcher dengan stabilitas tinggi).
  - `pino: ^9.0.0`, `chalk: ^4.1.2`, `figlet: ^1.7.0`, `spinnies: ^0.5.1`.
- **Executables di Sistem Host Windows**:
  - `where.exe agy` -> Terdeteksi pada: `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe`.
  - Berarti perintah Windows `start agy` valid dan dapat dieksekusi langsung dari Node.js melalui `child_process.exec`.

---

## 3. Bot Architecture & Runtime Pipeline

### 3.1 Siklus Hidup Entry Point (`index.js`)

1. **Setup Environment**:
   - Konfigurasi path FFmpeg dan FFprobe ke `process.env.PATH` (baris 23-42).
   - Filter log internal libsignal / Baileys (baris 55-84) untuk meredam noise dekripsi session.
2. **Bootstrap Sub-sistem** (baris 380-395):
   - `initGlobals()` di `./src/utils/globals.js`: Memuat `global.db`, config API, dan utility function.
   - `bridge.init()` di `./src/utils/pluginBridge.js`: Memindai rekursif seluruh file `.js` di `./plugins/`, melakukan normalisasi modul, dan mendaftarkan command serta handler `before`.
   - `plugins.init()` di `./src/utils/PluginLoader.js`: Memasang watcher Chokidar pada folder `./src/commands/`.
   - `startBot()`: Membuka koneksi soket Baileys.
3. **Session & Auth State**:
   - Auth menggunakan `useMultiFileAuthState(config.authFolder)` di mana `config.authFolder` bernilai `./src/database/session`.
   - Di dalam folder `./src/database/session/`, file `creds.json` **sudah ada dan berstatus `registered: true`** dengan identitas akun terautentikasi: `6282261921848:4@s.whatsapp.net` (nama: "Niwo").
   - Bot tidak memerlukan pairing ulang saat dijalankan.
4. **Patch Socket**:
   - Soket Baileys dibungkus oleh `patchConn(Welper)` di `./src/utils/connPatch.js`, menambahkan method bantuan seperti `Hanz.reply`, `Hanz.sendButton`, `Hanz.sendFile`, `Hanz.sendVoiceNote`, dan `Hanz.getName`.
5. **Event Listening**:
   - Event `messages.upsert` dialirkan langsung ke `./src/handlers/messageHandler.js`.
   - Event `group-participants.update` dialirkan ke `messageHandler.handleGroupParticipants`.

---

## 4. Message Inbound Pipeline & Routing Analysis

Pemrosesan pesan masuk berpusat pada fungsi `handleMessages(Hanz, m, isMain)` di `./src/handlers/messageHandler.js`:

```
[messages.upsert event]
         │
         ▼
[Validasi Pesan & Anti-Duplikasi]
   • Cek msg.message ada
   • Cek alreadyProcessed(id) (dedup TTL 60s)
         │
         ▼
[Identifikasi Pengirim & Hak Akses]
   • sender: remoteJid
   • isOwner(sender, msg) -> SuperOwner: 6285217124804 (Ilham) / coOwner / extraOwners
   • Bot mode check: jika 'self' dan bukan owner -> skip
         │
         ▼
[Serialisasi Objek Pesan]
   • mSer = serialize(Hanz, msg) (src/utils/serialize.js)
   • text = extractMessageText(msg.message)
         │
         ├────────────────────────────────────────────────────────┐
         ▼                                                        ▼
[Pesan Interaktif / Button Response]                      [Pesan Teks Normal]
   • buttonsResponseMessage -> selectedButtonId
   • listResponseMessage -> selectedRowId
   • interactiveResponseMessage -> paramsJson.id
         │                                                        │
         └─────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
                   [Event Hooks: bridge.runBefore]
                   Menjalankan seluruh handler.before plugin
                   (Game tebakan, anti-link, autogpt auto-reply)
                                   │
                     ┌─────────────┴─────────────┐
                     │ stopped === true          │ stopped === false
                     ▼                           ▼
              [Stop Pipeline]         [Parsing Perintah: parseCommand]
                                      • Cek prefix config.prefix ('.')
                                      • Cek interactive / direct essential
                                                 │
                               ┌─────────────────┴─────────────────┐
                               │ command ditemukan                 │ bukan command
                               ▼                                   ▼
                    [Eksekusi Command]                   [handleAutoAi fallback]
                    1. plugins.get (CJS)                 Jika pesan tanpa prefix
                    2. bridge.exec (ESM di /plugins)     dan bukan command
```

### 4.1 Ekstraksi Pesan Interaktif (Button & List)
Di `src/handlers/messageHandler.js` (baris 138-163):
```javascript
function extractMessageText(message) {
    if (!message) return null;
    const type = getContentType(message);
    switch (type) {
        case 'conversation': return message.conversation;
        case 'extendedTextMessage': return message.extendedTextMessage?.text;
        case 'imageMessage': return message.imageMessage?.caption;
        case 'videoMessage': return message.videoMessage?.caption;
        case 'buttonsResponseMessage': return message.buttonsResponseMessage?.selectedButtonId;
        case 'listResponseMessage': return message.listResponseMessage?.singleSelectReply?.selectedRowId;
        case 'templateButtonReplyMessage': return message.templateButtonReplyMessage?.selectedId;
        case 'interactiveResponseMessage': {
            const paramsJson = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
            if (paramsJson) {
                try {
                    const parsed = JSON.parse(paramsJson);
                    return parsed.id;
                } catch { return null; }
            }
            return null;
        }
        default: return null;
    }
}
```
Ketika pengguna menekan tombol interaktif WhatsApp, id tombol diekstraksi sebagai teks pesan utama. Jika id tombol diformat seperti `.gravity on chat` atau `.gravity wake`, pipeline secara otomatis mengenalinya sebagai perintah valid.

### 4.2 Pembuatan Pesan Interaktif Native Flow
Di `src/utils/interactiveHelper.js` dan `src/utils/connPatch.js`:
- Pesan tombol dibungkus menggunakan struktur protobuf `proto.Message.InteractiveMessage` di dalam `viewOnceMessage`.
- Tombol quick reply dibuat dengan parameter:
  `{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '...', id: '...' }) }`.
- Method `Hanz.sendButton(jid, { text, footer, buttons, image })` dapat dipanggil dari mana saja dan otomatis menyematkan header gambar serta merelay pesan interaktif ke penerima.

---

## 5. Plugin Architecture & System Extension

Di folder `./plugins/`, terdapat arsitektur modular berbasis ECMAScript Modules (ESM). Setiap plugin mengekspor struktur standar:

```javascript
// Contoh format plugin native Niwo Bot
const handler = async (m, { conn, usedPrefix, command, text, args, isOwner }) => {
    // Logika utama
};

handler.command = ['nama_command', 'alias_command'];
handler.tags = ['kategori'];
handler.isOwner = true; // Pembatasan hak akses owner

// Opsional: Event listener sebelum command parser
handler.before = async function (m, { conn, isOwner }) {
    // Intersepsi pesan masuk
    return true; // Return true jika ingin menghentikan pesan agar tidak diproses command lain
};

export default handler;
```

`pluginBridge.js` memuat plugin secara otomatis:
- Pemindaian rekursif seluruh subfolder di `/plugins/`.
- Validasi izin (`isOwner`, `isGroup`, `isPrivate`, `isAdmin`, `isBotAdmin`) dilakukan terpusat sebelum handler dieksekusi.
- Menyediakan hook `runBefore(Hanz, mSer, ctx)` yang dijalankan sebelum command matcher.

---

## 6. Blueprint Integrasi Fitur Baru (Antigravity C2 Assistant)

Untuk memenuhi standar rekayasa perangkat lunak autentik dan profesional (anti-slop, zero mock, isolasi modular, penanganan error tangguh), fitur baru **tidak boleh di-hardcode** ke dalam `messageHandler.js` atau `index.js`. 

Fitur C2 Assistant harus dirancang menjadi dua komponen modular yang terpisah:
1. **Core Bridge Engine**: `src/lib/antigravityBridge.js` (Modul logika IPC, state management, queue file I/O, watcher, fallback timer, dan sticker dispatcher).
2. **Owner Plugin UI**: `plugins/owner/gravity.js` (Plugin antarmuka perintah `.gravity on/off/status/wake` serta event handler `before` untuk intersepsi pesan).

### 6.1 State Management & Konfigurasi Persisten
Data status integrasi disimpan ke dalam `database/settings.json` melalui layer `src/lib/database.js` (`db.setting('gravity_config', ...)`).
Parameter state:
- `enabled`: boolean (`true` / `false`).
- `mode`: string (`'chat'` = private only, `'group'` = group only, `'both'` = chat & group).
- `timeoutMs`: integer (waktu tunggu respon Antigravity sebelum trigger fallback, default: `25000` ms).
- `lastWakeAt`: timestamp eksekusi launcher Antigravity.

### 6.2 Alur Perintah `.gravity` di `plugins/owner/gravity.js`
- **Akses**: Khusus nomor Super Owner (`6285217124804`).
- **Input Perintah**:
  - `.gravity on`: Mengirim pesan interaktif dengan 3 tombol quick reply:
    - Tombol 1: `Chat Only` (ID: `.gravity on chat`)
    - Tombol 2: `Group Only` (ID: `.gravity on group`)
    - Tombol 3: `Both (Chat & Group)` (ID: `.gravity on both`)
  - `.gravity on <chat|group|both>`: Mengaktifkan mode yang dipilih dan menyimpan status ke database.
  - `.gravity off`: Menonaktifkan C2 bridge.
  - `.gravity status`: Menampilkan ringkasan status bridge, mode aktif, dan statistik pesan.
  - `.gravity wake` (atau callback tombol `open_antigravity`): Memanggil `antigravityBridge.openAntigravity()`.

### 6.3 Intersepsi Pesan Masuk (`handler.before`)
Plugin `plugins/owner/gravity.js` mendaftarkan `handler.before`:
1. Validasi awal: Jika bridge nonaktif (`!enabled`), lewati (`return false`).
2. Filter perintah: Jika pesan diawali prefix bot (`^[./#!]`), lewati (`return false`) agar perintah bot lainnya tetap berfungsi normal.
3. Filter pengirim:
   - Jika chat pribadi (DM): Hanya proses jika pengirim adalah Owner. Jika mode aktif adalah `'group'`, abaikan.
   - Jika grup: Hanya proses jika mode aktif adalah `'group'` atau `'both'`. Pesan di grup **hanya diproses jika**:
     a) Pesan me-reply chat bot (`m.quoted?.fromMe === true`), ATAU
     b) Pesan me-mention nomor bot (`m.mentionedJid.includes(botJid)`), ATAU
     c) Pesan memanggil keyword pemicu (`/^sawako\b/i`, `/^gravity\b/i`).
4. Eksekusi pengiriman ke Antigravity:
   - Buat payload pesan terstruktur (ID unik, timestamp, sender, pushName, chatId, isGroup, text).
   - Tulis ke `wa_queue.json` secara atomik (tulis ke file `.tmp` lalu rename untuk mencegah race condition pembacaan).
   - Tampilkan reaksi WhatsApp: `m.react('💭')` atau kirim indikator mengetik.
   - Tunggu respon dari `wa_response.json` hingga batas timeout (`25` detik).
5. Hasil Respon:
   - **Sukses**:
     - Parse teks respon.
     - Cek apakah terdapat tag aksi stiker: `[ACTION: SEND_STICKER_<TYPE>]`.
     - Bersihkan teks dari tag aksi stiker, lalu kirim teks balasan (persona Sawako) ke WhatsApp.
     - Jika terdapat tag stiker, ambil stiker yang sesuai dari bank stiker dan kirim ke WhatsApp via `sock.sendMessage(chat, { sticker: buffer })`.
     - Hapus entri antrean dari `wa_response.json`.
     - Kembalikan `true` (menghentikan pipeline).
   - **Timeout (Antigravity offline/tertutup)**:
     - Kirim pesan penolakan sopan khas Sawako dengan tombol interaktif:
       ```
       (*>﹏<*) Maaf, session Antigravity sedang tidak aktif atau tertutup di laptop kamu...

       Silakan tekan tombol di bawah ini untuk membuka Antigravity secara otomatis:
       ```
     - Tombol: `[Open Antigravity]` dengan ID `.gravity wake`.
     - Kembalikan `true` (menghentikan pipeline).

### 6.4 IPC Bridge File Protocol (`wa_queue.json` & `wa_response.json`)
Kedua file diletakkan di root proyek: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\`.

**Struktur `wa_queue.json`**:
```json
{
  "queue": [
    {
      "id": "wa_msg_1728395000123",
      "timestamp": 1728395000123,
      "chatId": "6285217124804@s.whatsapp.net",
      "sender": "6285217124804",
      "senderName": "ilham",
      "isGroup": false,
      "text": "Sawako, tolong cek apakah build project sudah selesai (*v*)",
      "quotedMessage": null
    }
  ]
}
```

**Struktur `wa_response.json`**:
```json
{
  "responses": [
    {
      "id": "wa_msg_1728395000123",
      "timestamp": 1728395004500,
      "chatId": "6285217124804@s.whatsapp.net",
      "text": "(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) Baik Ilham-kun, aku sudah memeriksa build-nya (*v*). Semua unit test lulus tanpa error! [ACTION: SEND_STICKER_HAPPY]",
      "status": "ready"
    }
  ]
}
```

### 6.5 Mekanisme Auto-Wake Windows
Di dalam `src/lib/antigravityBridge.js`:
```javascript
import { exec } from 'child_process';

export function openAntigravity() {
    return new Promise((resolve, reject) => {
        // Eksekusi Windows start agy
        exec('start agy', { shell: 'cmd.exe' }, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve({ success: true });
        });
    });
}
```
Perintah `start agy` pada Windows akan membuka instance CLI Antigravity baru secara asynchronous di background/jendela terminal terpisah tanpa memblokir event loop bot.

### 6.6 Bank Stiker & Generator Otomatis
Stiker disimpan pada direktori terdedikasi: `assets/stickers/sawako/`.
Kategori emosi:
- `shy.webp` (pemalu/tersipu, misal saat dipuji)
- `happy.webp` (gembira/antusias saat tugas selesai)
- `sad.webp` (sedih/minta maaf saat terjadi kegagalan)
- `surprise.webp` (terkejut/kaget saat menerima perintah penting)
- `thinking.webp` (sedang berpikir/meneliti)

Modul `antigravityBridge.js` akan memeriksa keberadaan file WebP di folder tersebut. Jika belum tersedia, modul secara dinamis dapat mengonversi gambar PNG/JPG anime Sawako menggunakan fungsi `writeExif` dari `esmlib/sticker.js` dengan metadata pack "Sawako Assistant" dan author "Niwo C2".

---

## 7. Rangkuman Poin Verifikasi & Kelayakan Teknis

1. **Kompatibilitas Runtime**: Node.js v24.14.1 sepenuhnya kompatibel dengan struktur ES Modules dan CommonJS shims proyek.
2. **Koneksi WhatsApp**: Sesi WhatsApp bot (`src/database/session/`) dalam keadaan terautentikasi dan siap online tanpa perlu scanning QR atau pairing code baru.
3. **Mekanisme Intersepsi**: Penggunaan `handler.before` pada plugin ESM terbukti aman, tidak merusak pipeline pesan reguler, dan memiliki preseden implementasi nyata pada `plugins/ai/autogpt.js`.
4. **Mekanisme Tombol**: Library Baileys fork `@itsliaaa/baileys` yang dipakai bot terbukti mendukung native flow quick reply buttons dan ekstraksi ID tombol pada `messageHandler.js`.
5. **Ketersediaan Executable Windows**: Biner `agy.exe` telah terverifikasi tersedia di sistem host pada `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe` dan dapat di-spawn melalui `start agy`.

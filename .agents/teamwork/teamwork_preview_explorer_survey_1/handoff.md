# Handoff Report: Codebase & Architecture Explorer (Survey 1)

**Date**: 2026-10-08  
**Agent**: Survey Explorer 1 (Codebase & Architecture Explorer)  
**Working Directory**: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\.agents\teamwork\teamwork_preview_explorer_survey_1`  
**Target Project**: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727`  
**Deliverable Document**: `survey_codebase.md` (dalam direktori yang sama)

---

## 1. Observation

1. **Konfigurasi Paket & Dependensi**:
   - Berkas `package.json` mendefinisikan `"name": "niwo-bot"`, versi `"2.2.0"`, `"main": "index.js"`.
   - Menggunakan fork Baileys `"@itsliaaa/baileys": "latest"`, `"sharp": "^0.33.4"`, `"node-webpmux": "^3.1.9"`, `"chokidar": "^3.6.0"`, `"fluent-ffmpeg": "^2.1.3"`.
   - Runtime Node.js pada sistem host adalah v24.14.1 (hasil `node -v`).

2. **Ketersediaan Executable Antigravity di Windows**:
   - Perintah `where.exe agy` menghasilkan output:
     `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe`.
   - Hal ini mengonfirmasi bahwa perintah `start agy` adalah perintah valid pada host Windows.

3. **Status Sesi & Autentikasi WhatsApp**:
   - Di `src/config.js` (baris 48), `authFolder: './src/database/session'`.
   - File `src/database/session/creds.json` ada dan berisi `"registered": true`, dengan identitas akun:
     `"me": {"id": "6282261921848:4@s.whatsapp.net", "name": "Niwo"}`.
   - Sesi login WhatsApp sudah aktif dan tidak membutuhkan pairing code atau scan QR baru saat dijalankan.

4. **Pipeline Pesan Masuk & Ekstraksi Tombol**:
   - Di `index.js` (baris 170-173), event `messages.upsert` memanggil `messageHandler(Welper, m, isMain)`.
   - Di `src/handlers/messageHandler.js`:
     - Baris 140-162: Fungsi `extractMessageText` mengekstrak teks dari berbagai tipe pesan, termasuk respons tombol: `buttonsResponseMessage.selectedButtonId`, `listResponseMessage.singleSelectReply.selectedRowId`, dan `interactiveResponseMessage.nativeFlowResponseMessage.paramsJson` (mem-parse JSON dan mengambil `parsed.id`).
     - Baris 330-339: Menjalankan `await bridge.runBefore(Hanz, mSer, { isOwner, isSuperOwner })`. Jika handler mengembalikan `true`, alur berhenti (`if (stopped) continue;`).
     - Baris 341-346: Mem-parse perintah melalui `parseCommand(text, isGroup, isInteractive)`.
     - Baris 348-414: Mengeksekusi command CJS (`plugins.get(command.name)`) jika ada.
     - Baris 415-446: Mengeksekusi command ESM (`bridge.has(command.name)` -> `bridge.exec(...)`).
     - Baris 460-466: Jika bukan command dan tidak diawali prefix, mengalir ke `handleAutoAi(Hanz, msg, sender, text)`.

5. **Pembangun Pesan Tombol Interaktif**:
   - Di `src/utils/interactiveHelper.js` (baris 61-94 & 150-171), pesan tombol native flow dibuat menggunakan `proto.Message.InteractiveMessage` di dalam `viewOnceMessage` dengan tombol berformat `quick_reply` (`buttonParamsJson: JSON.stringify({ display_text: btn.text, id: btn.id })`).
   - Di `src/utils/connPatch.js` (baris 93-109), socket Baileys memiliki method `Hanz.sendButton(jid, content, opts)` yang secara otomatis menyematkan header gambar dan merelay pesan interaktif ke penerima.

6. **Arsitektur Plugin & Hak Akses Owner**:
   - Seluruh plugin di folder `plugins/` dimuat secara otomatis oleh `src/utils/pluginBridge.js`.
   - Super Owner didefinisikan di `src/config.js` (baris 33): `superOwner: '6285217124804'`.
   - Pola plugin owner yang sudah ada (misal `plugins/owner/buttonmode.js`) menggunakan metadata `handler.isOwner = true` dan `handler.command = [...]`.
   - Pola event `handler.before` yang sudah ada (misal `plugins/ai/autogpt.js`, baris 181-270) mendemonstrasikan bagaimana pesan diintersepsi secara elegan sebelum masuk ke parser perintah biasa.

---

## 2. Logic Chain

1. **Dari Observasi 1 dan 3**: Bot memiliki dependensi lengkap untuk media dan manipulasi stiker (Sharp, Node-Webpmux), dan sesi WhatsApp sudah terdaftar (`registered: true`). Maka dari itu, bot dapat langsung beroperasi tanpa hambatan koneksi awal atau otentikasi.
2. **Dari Observasi 4 dan 6**: Karena `bridge.runBefore` dijalankan sebelum parser perintah umum dan dapat menghentikan propagasi jika mengembalikan nilai `true`, mekanisme ini adalah titik intersepsi yang ideal untuk menyaring pesan yang ditujukan ke Antigravity. Pesan masuk yang merupakan chat pribadi dari Owner atau mention/reply di grup dapat dialihkan ke bridge tanpa merusak atau mengubah logika inti di `messageHandler.js`.
3. **Dari Observasi 4 dan 5**: ID dari tombol interaktif yang ditekan oleh pengguna akan diekstraksi sebagai teks biasa oleh `extractMessageText`. Jika tombol memiliki ID berupa perintah seperti `.gravity on chat`, `.gravity on group`, `.gravity on both`, atau `.gravity wake`, ID tersebut akan secara otomatis dieksekusi oleh pipeline perintah bot sebagai perintah normal.
4. **Dari Observasi 2**: Karena `where.exe agy` menemukan binary `agy.exe` di direktori aplikasi lokal pengguna, pemanggilan perintah shell `start agy` dari Node.js melalui `child_process.exec` akan sukses meluncurkan CLI Antigravity di jendela Windows baru saat fallback auto-wake dipicu.
5. **Kesimpulan Arsitektur**: Berdasarkan rantai logika ini, integrasi harus dibagi menjadi dua file terisolasi: modul utilitas `src/lib/antigravityBridge.js` (untuk manajemen antrean file `wa_queue.json`/`wa_response.json`, status persisten di `database/settings.json`, dan timeout polling) serta modul plugin `plugins/owner/gravity.js` (untuk interaksi tombol `.gravity`, izin Owner, dan intersepsi `handler.before`). Pendekatan ini memenuhi standar anti-slop karena tidak mengubah file core Baileys maupun merusak `messageHandler.js`.

---

## 3. Caveats

1. **Kondisi Proses Antigravity Aktif**: Investigasi ini fokus pada struktur kode statis dan lingkungan lokal. Daemon watcher latar belakang Antigravity yang memonitor `wa_queue.json` belum diimplementasikan di sisi Antigravity, dan merupakan tanggung jawab Explorer 2 / implementer.
2. **Ketersediaan Stiker Asli**: Folder `assets/stickers/sawako/` belum ada secara fisik di repositori saat ini. Implementasi final perlu memastikan adanya fallback pembuatan stiker atau penyediaan aset awal.
3. **Keterbatasan Format Pesan Interaktif**: Tombol interaktif native flow Baileys bekerja pada aplikasi WhatsApp seluler dan desktop resmi, tetapi beberapa client modifikasi pihak ketiga mungkin hanya melihat teks fallback.

---

## 4. Conclusion

Arsitektur Niwo Bot sangat siap untuk diintegrasikan dengan Antigravity Remote C2 Assistant. 
Desain integrasi yang direkomendasikan adalah:
1. **Modul Bridge**: `src/lib/antigravityBridge.js` mengelola I/O atomik ke `wa_queue.json` dan `wa_response.json`, persistence setting via `src/lib/database.js`, timer fallback 25 detik, dan parser tag stiker `[ACTION: SEND_STICKER_<TYPE>]`.
2. **Plugin Owner**: `plugins/owner/gravity.js` menangani perintah `.gravity on/off/status/wake` lengkap dengan menu tombol quick reply, serta event hook `handler.before` untuk intersepsi pesan masuk sesuai filter (Owner DM, group reply/mention).
3. **Auto-Wake Windows**: Integrasi pemanggilan `start agy` saat tombol fallback ditekan untuk membangunkan sesi Antigravity.
4. **Zero Slop**: Tidak ada pengubahan pada berkas inti `index.js` atau `messageHandler.js`. Semua ekstensi modular dan terisolasi.

Laporan komprehensif telah didokumentasikan secara rinci di file `survey_codebase.md`.

---

## 5. Verification Method

Untuk memverifikasi secara independen temuan-temuan di atas:

1. **Verifikasi Lokasi Executable**:
   Jalankan di PowerShell:
   ```powershell
   where.exe agy
   ```
   Ekspektasi: Muncul path `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe`.

2. **Verifikasi Status Session WhatsApp**:
   Jalankan di PowerShell atau Node inspect:
   ```powershell
   node -e "const creds = require('./src/database/session/creds.json'); console.log('Registered:', creds.registered, 'User:', creds.me.id);"
   ```
   Ekspektasi: `Registered: true User: 6282261921848:4@s.whatsapp.net`.

3. **Verifikasi Muatan Plugin**:
   Jalankan inspeksi loader plugin:
   ```powershell
   node -e "const bridge = require('./src/utils/pluginBridge'); bridge.init({ silent: true }).then(() => console.log('Commands:', bridge.commands.size));"
   ```
   Ekspektasi: Ratusan command plugin berhasil dimuat tanpa error.

4. **Kondisi Invalidasi**:
   - Jika folder `src/database/session/` dihapus atau `creds.json` invalid, bot memerlukan pairing ulang.
   - Jika path `agy.exe` dipindahkan atau dicopot dari Windows PATH, perintah `start agy` akan memerlukan path absolut.

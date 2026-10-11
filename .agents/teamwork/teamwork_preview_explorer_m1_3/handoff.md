# Handoff Report: Agent CLI Reply Tool & Queue State Transition (`bridge/reply.js`)

**Author**: M1 Explorer 3 (Agent CLI Reply Tool & Queue State Specialist)  
**Date**: 2026-10-08  
**Scope**: Milestone 1 (Bridge Core IPC, Storage & Daemon Watcher)  
**Target File**: `bridge/reply.js`  
**Working Directory**: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\.agents\teamwork\teamwork_preview_explorer_m1_3`  
**Detailed Analysis Document**: `analysis_reply.md` (di direktori kerja)

---

## 1. Observation

1. **Runtime Node.js Aktif**:
   - Perintah `node -v` dijalankan di terminal dan menghasilkan output verbatim `v24.14.1`.
   - File `package.json` baris 53-55 mendefinisikan `"engines": { "node": ">=18.0.0" }`.
   - Node.js versi 18.3.0 ke atas menyediakan modul internal bawaan `node:util` dengan fungsi `parseArgs`.

2. **Spesifikasi Dokumen Proyek (`PROJECT.md`)**:
   - Baris 50: `bridge/reply.js: CLI tool for atomic response serialization`.
   - Baris 183-184: `CLI Response Helper (bridge/reply.js): Usage: node bridge/reply.js --id <queueId> --text <text> [--sticker <EMOTION>] [--image <path>]`.
   - Baris 155-157: Mendefinisikan antarmuka `appendResponse(responseObject): Promise<string>` dengan input `{ queueId, targetJid, text, actions, stickerKey, mediaAttachment }`.

3. **Kebutuhan Asli Pengguna (`ORIGINAL_REQUEST.md`)**:
   - Baris 21-23 (R2): Menyatakan pesan WA ditulis ke `wa_queue.json`, daemon memantau file tersebut untuk membangunkan Antigravity, dan balasan agen ditulis ke `wa_response.json`.
   - Baris 27-28 (R4): Menyatakan agen dapat memicu stiker WA di momen tertentu dengan membalas format action tag `[ACTION: SEND_STICKER_<EMOTION>]`.

4. **Struktur Direktori Proyek Saat Ini**:
   - Direktori `bridge/` belum dibuat di root proyek. Direktori ini dijadwalkan untuk dibangun pada Milestone 1 bersama file `ipc.js`, `daemon.js`, `reply.js`, `wa_queue.json`, `wa_response.json`, dan `bridge_heartbeat.json`.

---

## 2. Logic Chain

1. **Pemilihan Parser CLI (Mengacu pada Observasi 1)**:
   - Karena runtime terverifikasi adalah Node.js v24.14.1 dan `package.json` mensyaratkan `>=18.0.0`, modul bawaan `node:util parseArgs` dapat digunakan langsung tanpa perlu menambahkan paket npm pihak ketiga (seperti `yargs` atau `commander`). Ini menjamin efisiensi runtime dan bebas dependensi luar.

2. **Parsing Argumen & Deteksi Action Tag (Mengacu pada Observasi 2 & 3)**:
   - Sesuai spesifikasi CLI, argumen wajib adalah `--id` dan `--text`, sedangkan `--sticker`, `--image`, `--action`, `--force`, dan `--json` adalah opsional.
   - Jika agen Antigravity menyematkan format `[ACTION: SEND_STICKER_<EMOTION>]` di dalam `--text`, `reply.js` mengekstrak token emosi tersebut secara otomatis jika flag `--sticker` tidak diberikan, lalu menormalkannya ke huruf kapital (contoh: `SHY`, `HAPPY`) dan memasukkannya ke array `actions`.

3. **Transisi Status Antrean & Pencegahan Auto-Wake Ganda (Mengacu pada Observasi 2 & 3)**:
   - Saat item antrean masuk diproses, statusnya di `bridge/wa_queue.json` wajib diubah dari `pending` ke `completed`, disertai pencatatan `completedAt` dan `replyId`.
   - Transisi ini menjadi filter krusial bagi `bridge/daemon.js`, karena daemon hanya memicu log stdout `[ANTIGRAVITY_BRIDGE]` untuk pesan yang berstatus `pending`. Tanpa transisi status ini, penulisan balasan akan menyebabkan daemon memicu auto-wake berulang untuk pesan yang sama.

4. **Ketahanan I/O Windows 11 & Sinkronisasi Konkuren (Mengacu pada Observasi 1 & 4)**:
   - Pada Windows 11, pembacaan dan penulisan konkuren dapat memicu error `EBUSY` atau `EPERM`.
   - Oleh karena itu, operasi pembaruan antrean dan penulisan balasan diamankan menggunakan advisory mutex lock `bridge/.queue.lock` dengan `fs.promises.open(..., 'wx')`, dilengkapi deteksi stale lock berbasis TTL (8000 ms).
   - Penulisan file JSON dilakukan secara atomik melalui file temporer dan loop retry untuk `fs.promises.rename` (hingga 10 kali percobaan).

5. **Matriks Kode Keluar Deterministik (Mengacu pada Observasi 2)**:
   - Untuk memfasilitasi penanganan error otomatis oleh tool agen Antigravity, skrip memetakan kegagalan ke kode keluar standar: 0 (Sukses), 1 (Argumen Tidak Valid), 2 (Item Queue Tidak Ditemukan), 3 (Item Queue Sudah Selesai), 4 (File Media Tidak Ditemukan), 5 (Storage Rusak), 6 (Lock Timeout), dan 7 (Error I/O).

---

## 3. Caveats

1. **Escape Karakter pada Shell Windows**:
   - Jika teks balasan memuat tanda kutip ganda internal atau karakter khusus PowerShell, pemanggil di terminal harus membungkus string dengan tanda kutip yang sesuai agar tidak terpotong oleh parser shell sistem operasi.
2. **Ketersediaan Folder Media**:
   - Jika opsi `--image` digunakan, path file harus mengarah ke file nyata yang sudah ada di disk (misalnya file screenshot hasil eksekusi PowerShell di `bridge/media/`).
3. **Ketergantungan Modular pada `bridge/ipc.js`**:
   - Cetak biru implementasi di `analysis_reply.md` dirancang mandiri (self-contained) agar dapat langsung diuji, namun dapat dengan mudah didelegasikan ke `bridge/ipc.js` saat modul IPC bersama selesai dibuat oleh spesialis IPC.

---

## 4. Conclusion

Strategi implementasi untuk responder CLI `bridge/reply.js` telah dirancang secara tuntas, mencakup:
1. Sintaks CLI lengkap dengan pengurai argumen zero-dependency menggunakan `node:util parseArgs`.
2. Sinkronisasi transisi status antrean dari `pending` ke `completed` di `bridge/wa_queue.json`.
3. Penulisan atomik balasan ke `bridge/wa_response.json` di bawah perlindungan advisory lock `bridge/.queue.lock`.
4. Deteksi otomatis tag stiker `[ACTION: SEND_STICKER_<EMOTION>]` dan integrasi emosi stiker.
5. Matriks kode keluar 0 sampai 7 dengan pesan error deskriptif dan opsi output format `--json`.
6. Kode implementasi referensi siap pakai telah didokumentasikan di `analysis_reply.md`.

---

## 5. Verification Method

Cara memverifikasi implementasi `bridge/reply.js` secara independen:

1. **Verifikasi Bantuan CLI**:
   ```bash
   node bridge/reply.js --help
   ```
   *Kondisi lulus*: Menampilkan manual penggunaan dan keluar dengan kode 0.

2. **Verifikasi Validasi Argumen**:
   ```bash
   node bridge/reply.js
   ```
   *Kondisi lulus*: Keluar dengan kode 1 dan mencetak pesan error argumen di stderr.

3. **Verifikasi Transisi Status & Penulisan Balasan**:
   - Siapkan file uji `bridge/wa_queue.json` berisi:
     `[{"id":"wa_msg_test_01","sender":"628123456789@s.whatsapp.net","text":"halo","status":"pending"}]`
   - Jalankan perintah:
     ```bash
     node bridge/reply.js --id wa_msg_test_01 --text "Halo Kak! (*^▽^*) [ACTION: SEND_STICKER_HAPPY]"
     ```
   - *Kondisi lulus*:
     - Keluar dengan kode 0.
     - `bridge/wa_queue.json` menunjukkan `status: "completed"`, memiliki timestamp `completedAt`, dan `replyId`.
     - `bridge/wa_response.json` memiliki entri balasan dengan `stickerKey: "HAPPY"`, `actions: ["SEND_STICKER_HAPPY"]`, dan `status: "pending"`.

4. **Verifikasi Penolakan Balasan Duplikat (Idempotency)**:
   - Jalankan kembali perintah verifikasi nomor 3 tanpa flag `--force`.
   - *Kondisi lulus*: Keluar dengan kode 3 (`EXIT_ALREADY_COMPLETED`).
   - Jalankan dengan menambahkan flag `--force`.
   - *Kondisi lulus*: Keluar dengan kode 0.

5. **Verifikasi Ketahanan Stale Lock**:
   - Buat file `bridge/.queue.lock` secara manual dengan timestamp 10 detik lalu.
   - Jalankan `bridge/reply.js` untuk pesan baru.
   - *Kondisi lulus*: File lock lama terdeteksi kedaluwarsa, dibersihkan, dan operasi berhasil dengan kode keluar 0.

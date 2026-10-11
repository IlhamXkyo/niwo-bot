# Laporan Riset Teknis: Antigravity-Bridge IPC dan Pipeline Eksekusi

## Ringkasan Eksekutif
Riset ini menyusun spesifikasi teknis lengkap untuk subsistem **Antigravity-Bridge**, yaitu jembatan komunikasi jarak jauh (Remote C2 Assistant) yang menghubungkan WhatsApp Bot (Niwo Bot) dengan sesi aktif Antigravity di laptop Windows. Subsistem ini terdiri dari empat pilar utama:
1. **File-based IPC**: Mekanisme antrean berbasis file (`wa_queue.json` dan `wa_response.json`) dengan penanganan konkurensi atomik dan locking aman untuk Windows NTFS.
2. **Daemon Watcher**: Skrip latar belakang yang memantau antrean, mencetak log ke stdout untuk memicu bangun otomatis (auto-wake) agen Antigravity, dan memfasilitasi penulisan balasan.
3. **Fallback dan Launcher Windows**: Deteksi status sesi Antigravity berbasis heartbeat dan timeout, penyediaan tombol interaktif WhatsApp, serta eksekusi `start agy` di Windows.
4. **Pipeline Perintah Sistem**: Eksekusi aman untuk tangkapan layar (screenshot), shutdown berpenjaga (guarded shutdown), dan pemrosesan file lokal.

---

## 1. Mekanisme File-based IPC (Antrean Pesan dan Respons)

### 1.1 Struktur dan Lokasi File
Semua file antrean dan status operasional diletakkan di direktori terisolasi:
`C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727\bridge\`

Daftar file inti:
- `bridge/wa_queue.json`: Antrean pesan masuk dari WhatsApp yang menunggu diproses agen Antigravity.
- `bridge/wa_response.json`: Antrean balasan dan tindakan dari agen yang siap dikirimkan kembali ke WhatsApp oleh Niwo Bot.
- `bridge/bridge_heartbeat.json`: Sinyal detak jantung (liveness heartbeat) dari daemon Antigravity untuk verifikasi sesi aktif.
- `bridge/.queue.lock`: File lock penanganan akses bersama saat read-modify-write.
- `bridge/media/`: Folder penyimpanan artefak media sementara (misalnya hasil tangkapan layar).

### 1.2 Skema Definisi Pesan (`wa_queue.json`)
File `wa_queue.json` menyimpan kumpulan pesan masuk dengan status siklus hidup yang terdefinisi secara ketat:

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-08T13:00:00.000Z",
  "queue": [
    {
      "id": "wa_msg_1728394800000_a1b2",
      "timestamp": 1728394800000,
      "isoTime": "2026-10-08T13:00:00.000Z",
      "sender": "6285217124804@s.whatsapp.net",
      "senderNumber": "6285217124804",
      "pushName": "ilham",
      "chatType": "dm",
      "groupJid": null,
      "groupSubject": null,
      "text": "Halo Sawako, tolong kirimkan screenshot desktop ya",
      "quoted": null,
      "status": "pending",
      "retryCount": 0,
      "meta": {
        "isOwner": true,
        "isSuperOwner": true
      }
    }
  ]
}
```

Rincian status pesan:
- `pending`: Pesan baru masuk dari WhatsApp, siap diambil oleh agen Antigravity.
- `processing`: Agen sedang merumuskan respons atau menjalankan tugas.
- `completed`: Respons telah dihasilkan dan ditransfer ke `wa_response.json`.
- `timed_out`: Batas waktu respons terlampaui (memicu pesan fallback).
- `failed`: Terjadi error internal saat pemrosesan.

### 1.3 Skema Definisi Respons (`wa_response.json`)
File `wa_response.json` menyimpan daftar respons yang dihasilkan agen Antigravity:

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-08T13:00:05.000Z",
  "responses": [
    {
      "id": "resp_1728394805000_c3d4",
      "queueId": "wa_msg_1728394800000_a1b2",
      "timestamp": 1728394805000,
      "targetJid": "6285217124804@s.whatsapp.net",
      "text": "Ini tangkapan layar laptopnya ya, Ilham-kun... (*´▽`*)",
      "delivered": false,
      "action": {
        "type": "SEND_IMAGE",
        "payload": {
          "filePath": "C:\\Users\\ACER NITRO\\Downloads\\Hiyuki-AI-21-09-26-1789982840727\\bridge\\media\\screenshot_1728394805000.png",
          "caption": "Screenshot Desktop Utama (*´▽`*)"
        }
      },
      "sticker": {
        "key": "HAPPY",
        "category": "happy"
      }
    }
  ]
}
```

Tipe aksi (`action.type`) yang didukung:
- `TEXT_ONLY`: Hanya mengirimkan pesan teks persona Sawako.
- `SEND_STICKER`: Mengirimkan stiker ekspresi Sawako (shy, happy, sad, surprised).
- `SEND_IMAGE`: Mengirimkan gambar (misalnya hasil tangkapan layar desktop).
- `EXECUTE_SYSTEM`: Laporan status eksekusi perintah sistem (misalnya status shutdown atau operasi file).

### 1.4 Penanganan Konkurensi dan Operasi Atomik pada Windows NTFS
Pada sistem operasi Windows, operasi pembacaan dan penulisan file rentan mengalami `EBUSY` atau `EPERM` (Sharing Violation) jika dua proses mengakses file yang sama secara bersamaan. Untuk menjamin reliabilitas 100 persen, dirancang protokol berikut:

1. **Strategi Penulisan Atomik (Atomic Write with Rename)**:
   - Data JSON ditulis terlebih dahulu ke file temporer unik pada direktori yang sama:
     `bridge/wa_queue.json.tmp.<pid>.<timestamp>`
   - Panggil `fs.fsyncSync(fd)` untuk memastikan flush tuntas ke media penyimpanan fisik.
   - Lakukan rename menggunakan `fs.renameSync`.
   - Jika terjadi tabrakan sementara (`EPERM` / `EBUSY`), bungkus dalam fungsi retry dengan exponential backoff (maksimal 5 percobaan, jeda 25 sampai 50 ms).

2. **File Lock Advisory (`.queue.lock`)**:
   - Sebelum melakukan mutasi antrean (menambahkan, mengubah status, atau menghapus), proses memperoleh kunci file eksklusif dengan `fs.openSync(lockPath, 'wx')`.
   - **Stale Lock Prevention**: Jika file lock telah berumur lebih dari 5000 ms (akibat proses sebelumnya crash), lock dianggap kedaluwarsa dan dihapus paksa.

3. **Ketahanan Parsing JSON (JSON Read Resilience)**:
   - Pembacaan file JSON tidak boleh langsung melempar unhandled exception jika terbaca saat proses rename berlangsung. Gunakan pembacaan dengan retry loop terproteksi.

### 1.5 Perbandingan: Polling vs File Watcher (Chokidar vs fs.watch)

| Aspek | `fs.watch` Bawaan Node.js | `chokidar` (^3.6.0) | Desain Rekomendasi (Hybrid) |
|---|---|---|---|
| Perilaku Windows | Menggunakan `ReadDirectoryChangesW`. Sering memicu duplikasi event `change` saat file ditulis. | Menstabilkan event lewat debouncing dan deteksi ukuran file. | Event primer dipicu oleh Chokidar dengan proteksi debounce. |
| Stabilitas Tulis | Rentan membaca file setengah jadi (partial content). | Dilengkapi fitur `awaitWriteFinish` bawaan. | Gunakan `awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }`. |
| Kasus Event Missed | Event bisa hilang jika sistem I/O sedang sibuk. | Jauh lebih andal, tetapi tetap bergantung pada OS. | Ditambahkan safety poll setiap 2500 ms untuk menjamin zero-loss. |
| Overhead CPU | Sangat rendah. | Rendah (untuk direktori terisolasi `bridge/`). | Sangat rendah dan responsif (< 100 ms latensi). |

**Keputusan Arsitektur**: Menggunakan **Chokidar** dengan opsi `awaitWriteFinish` di Niwo Bot dan skrip daemon, dikombinasikan dengan fallback interval pemeriksaan ringan setiap 2.5 detik.

---

## 2. Arsitektur Daemon Watcher untuk Sesi Antigravity

### 2.1 Konteks Sesi Antigravity
Sesi Antigravity beroperasi sebagai agen otonom di terminal atau IDE dengan memori proyek aktif. Antigravity memiliki mekanisme bangun reaktif (Reactive Wakeup):
- Ketika sebuah background daemon process dijalankan melalui alat eksekusi perintah (seperti `run_command` dengan status `IsDaemon: true`), sistem Antigravity memantau aliran output (stdout/stderr).
- Setiap kali proses mencetak log signifikan ke stdout, runtime Antigravity menangkap event tersebut dan segera mengaktifkan giliran agen untuk memproses pesan.

### 2.2 Alur Kerja Skrip Daemon (`bridge/daemon.js`)
Skrip daemon berjalan di dalam lingkungan sesi Antigravity:
1. **Inisialisasi**:
   - Memastikan direktori `bridge/` dan file `bridge/wa_queue.json`, `bridge/wa_response.json`, `bridge/bridge_heartbeat.json` tersedia.
   - Mencatat PID proses daemon dan memperbarui detak jantung awal.
2. **Pemantauan Heartbeat**:
   - Mengatur interval periodik setiap 5000 ms untuk menulis timestamp terbaru ke `bridge/bridge_heartbeat.json`:
     `{ "status": "ALIVE", "timestamp": Date.now(), "pid": process.pid }`
3. **Pendeteksian Pesan Baru**:
   - Memantau `bridge/wa_queue.json` menggunakan Chokidar.
   - Saat mendeteksi item dengan `"status": "pending"`:
     - Mengubah status pesan menjadi `"processing"` agar tidak diproses ganda.
     - Mencetak format sinyal log yang jelas dan mudah diparsing ke konsol:
       ```
       ===============================================================
       [ANTIGRAVITY_BRIDGE] INCOMING_WHATSAPP_MESSAGE
       ID: wa_msg_1728394800000_a1b2
       FROM: 6285217124804 (ilham)
       TYPE: dm
       MESSAGE: Halo Sawako, tolong kirimkan screenshot desktop ya
       ACTION_REQUIRED: Formulate Sawako response or execute system tool, then append to wa_response.json
       ===============================================================
       ```
4. **Respon Reaktif Agen**:
   - Agen Antigravity melihat log pemberitahuan tersebut.
   - Agen merumuskan respons Sawako dengan kaomoji (misalnya `(*v*)`, `(UwU)`, `(*´▽`*)`).
   - Jika terdapat instruksi sistem (screenshot/shutdown/file), agen mengeksekusi alat terkait.
   - Agen menuliskan respons ke `wa_response.json` dan memperbarui status antrean menjadi `"completed"`.

### 2.3 CLI Helper Respons Agen (`bridge/reply.js`)
Agar agen Antigravity tidak perlu melakukan manipulasi JSON tingkat rendah secara manual yang rentan salah format, disediakan alat bantu CLI atomik:

```bash
node bridge/reply.js --id wa_msg_1728394800000_a1b2 --text "Ini respons Sawako (*´▽`*)" --sticker HAPPY --image "bridge/media/screenshot.png"
```

Fungsi skrip `reply.js`:
- Membaca dan memvalidasi `queueId`.
- Menambahkan entri baru ke `bridge/wa_response.json` secara atomik.
- Mengubah status pesan di `bridge/wa_queue.json` menjadi `"completed"`.
- Melepaskan lock file dan keluar dengan kode status 0.

---

## 3. Mekanisme Fallback Antigravity Tertutup dan Windows Launcher

### 3.1 Pendeteksian Sesi Mati (Dead Session Detection)
Niwo Bot mendeteksi apakah Antigravity sedang tertutup atau tidak responsif melalui evaluasi bertingkat:

1. **Pengecekan Detak Jantung (Heartbeat Check)**:
   - Niwo Bot memeriksa file `bridge/bridge_heartbeat.json`.
   - Ambang batas kadaluwarsa (`HEARTBEAT_TTL_MS`): **15.000 ms (15 detik)**.
   - Jika timestamp lebih lama dari 15 detik yang lalu, daemon dinyatakan offline.
2. **Pengecekan Proses Windows (`agy.exe`)**:
   - Jalankan query proses ringan:
     `tasklist /FI "IMAGENAME eq agy.exe" /NH`
   - Berdasarkan temuan empiris pada sistem ini, executable `agy.exe` terletak di:
     `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe` (versi 1.1.26).
   - Jika `agy.exe` tidak ditemukan dalam daftar proses aktif, sesi Antigravity dipastikan tertutup.
3. **Batas Waktu Tunggu Respons (Queue Timeout Threshold)**:
   - Ketika pesan masuk dialihkan ke `wa_queue.json`, Niwo Bot memasang timer tunggu dengan batas waktu **20.000 ms (20 detik)**.
   - Jika dalam 20 detik tidak ada respons yang muncul di `wa_response.json`:
     - Tandai status pesan di antrean menjadi `"timed_out"`.
     - Picu pengiriman pesan fallback interaktif ke WhatsApp.

### 3.2 Pembuatan Pesan Fallback dan Tombol Interaktif WhatsApp
Saat fallback terpicu, Niwo Bot memanfaatkan modul interaktif bawaan (`src/utils/interactiveHelper.js` via `sendButtons`) untuk mengirimkan tombol aksi langsung ke pemilik bot (Owner):

```javascript
await sendButtons(Hanz, sender, {
    text: `⚠️ *Antigravity Sedang Tertutup / Tidak Merespons*\n\nSesi Antigravity tidak aktif atau daemon bridge belum berjalan (´;ω;｀)\n\nSilakan tekan tombol di bawah untuk meluncurkan Antigravity di laptop secara otomatis:`,
    footer: `Niwo Bot • Remote C2 Bridge`,
    buttons: [
        { text: '🚀 Open Antigravity', id: '.open_antigravity' },
        { text: '🔄 Cek Status', id: '.gravity status' }
    ],
    quoted: msg
});
```

Jika aplikasi WhatsApp klien pengirim tidak mendukung tombol interaktif native flow, helper secara otomatis menyediakan teks alternatif fallback sehingga pengguna dapat mengetik `.open_antigravity`.

### 3.3 Penanganan Perintah Peluncur (`.open_antigravity`)
Ketika Owner menekan tombol `[ 🚀 Open Antigravity ]` atau mengirimkan perintah `.open_antigravity`:
1. **Verifikasi Otoritas**: Periksa apakah pengirim adalah `superOwner` atau `coOwner` (`isOwner(sender, msg)`). Jika bukan, tolak perintah.
2. **Lokalisasi Executable**:
   - Cari `agy.exe` pada PATH sistem.
   - Jika tidak ditemukan, gunakan path absolut default:
     `C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe`
3. **Eksekusi Peluncuran Terminal Windows**:
   - Jalankan proses di jendela konsol baru yang terlihat:
     `cmd.exe /c start "Antigravity Session" "C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe"`
   - Atau menggunakan PowerShell:
     `Start-Process -FilePath "C:\Users\ACER NITRO\AppData\Local\agy\bin\agy.exe"`
4. **Umpan Balik ke WhatsApp**:
   - Kirimkan balasan konfirmasi:
     `"🚀 Meluncurkan Antigravity di laptop... (*´▽`*)\nJendela sesi Antigravity sedang dibuka. Silakan tunggu sekitar 10-15 detik hingga daemon aktif kembali!"`

---

## 4. Persyaratan Eksekusi Perintah Sistem (Remote C2)

### 4.1 Perintah Tangkapan Layar (Screenshot)
- **Tujuan**: Mengambil tangkapan layar desktop utama dan mengirimkannya sebagai file media gambar ke WhatsApp.
- **Implementasi Teknis di Windows**:
  - Tangkapan layar dieksekusi melalui skrip PowerShell terisolasi (`bridge/tools/screenshot.ps1`) memanfaatkan assembly .NET `System.Windows.Forms` dan `System.Drawing`.
  - Format output: File PNG beresolusi penuh (pada laptop ini terdeteksi 1536x960 piksel) yang disimpan ke `bridge/media/screenshot_<timestamp>.png`.
- **Temuan Diagnostik Kritis (Win32 Error 6: ERROR_INVALID_HANDLE)**:
  - Pada pengujian langsung, pemanggilan `Graphics.CopyFromScreen` atau `BitBlt` saat sesi berada dalam kondisi non-interaktif, terkunci (locked screen), atau sesi terminal terputus (Session ID 23) menghasilkan kode kesalahan `Win32Exception: The handle is invalid`.
  - **Mitigasi Rekayasa**:
    - Skrip pembantu wajib menangkap exception ini secara eksplisit.
    - Jika terjadi kegagalan akibat handle display tidak valid, sistem mengirimkan pesan pemberitahuan yang jelas ke WhatsApp:
      `"Maaf Ilham-kun, layar laptop sedang terkunci atau dalam mode sleep/standby sehingga screenshot tidak dapat diambil saat ini (´;ω;｀)"`
    - Ketika laptop digunakan secara aktif di sesi konsol lokal (Session 1), tangkapan layar berhasil 100 persen dan dikirimkan via Baileys.

### 4.2 Perintah Shutdown dan Restart Berpenjaga (Guarded Shutdown)
- **Tujuan**: Memungkinkan pemilik mematikan atau me-restart laptop dari jarak jauh melalui WhatsApp.
- **Prinsip Keselamatan (Safety First)**:
  - Perintah shutdown seketika (`shutdown /s /t 0`) dilarang keras sebagai default, karena dapat memutus koneksi bot secara mendadak dan menghilangkan pekerjaan yang belum disimpan.
  - **Desain Graceful Shutdown (Jeda 60 Detik)**:
    - Eksekusi default: `shutdown /s /t 60 /c "Remote shutdown diinisiasi via Niwo Bot oleh Owner"`
    - Bot mengirimkan pesan konfirmasi beserta tombol pembatalan interaktif:
      ```
      ⚠️ *Peringatan Shutdown Terjadwal*
      Laptop akan dimatikan dalam waktu 60 detik.
      ```
      Tombol: `[ 🛑 Batalkan Shutdown ]` (ID: `.abort_shutdown`)
  - **Pembatalan Shutdown**:
    - Jika tombol ditekan atau perintah `.abort_shutdown` dikirimkan, bot mengeksekusi `shutdown /a` di Windows dan mengirimkan konfirmasi:
      `"Shutdown berhasil dibatalkan! Laptop tetap menyala aman (*´▽`*)"`

### 4.3 Pemrosesan File Lokal (File Processing)
- **Kemampuan**:
  - Membaca isi file teks, konfigurasi, atau log di direktori proyek.
  - Menampilkan daftar file dalam direktori tertentu.
  - Menjalankan pencarian file atau string spesifik.
- **Batasan Keamanan**:
  - Pembatasan direktori: Hanya direktori kerja yang diizinkan (misalnya direktori proyek dan folder dokumen pengguna).
  - Sanitasi path: Mencegah serangan path traversal (`../`) ke direktori sistem Windows kritis (`C:\Windows\System32`, credential stores).
  - Pemotongan output: Pesan WhatsApp dibatasi maksimal 3500 karakter. Jika output melebihi ambang batas, kirimkan ringkasan teks plus lampiran dokumen file `.txt`.

---

## 5. Ringkasan Arsitektur dan Matriks Integrasi

```
+-----------------------------------------------------------------------------------+
|                                  WHATSAPP (OWNER)                                  |
+-----------------------------------------------------------------------------------+
       |                                                                ^
       | Pesan / Tombol                                                  | Balasan / Media
       v                                                                |
+-----------------------------------------------------------------------------------+
|                       NIWO BOT (index.js / messageHandler.js)                     |
|                                                                                   |
|  [Filter Mode .gravity]  --->  [Heartbeat Check: bridge_heartbeat.json]           |
|                                   | (Jika Offline)                                |
|                                   v                                               |
|                             [Kirim Fallback + Tombol "Open Antigravity"]          |
|                                   | (Jika Online)                                 |
|                                   v                                               |
|                    [Atomic Write: bridge/wa_queue.json]                           |
|                                   ^                                               |
|               (Chokidar Watch)    |                                               |
|                    [Read & Send: bridge/wa_response.json]                         |
+-----------------------------------------------------------------------------------+
       |                                                                ^
       | File I/O IPC                                                   | File I/O IPC
       v                                                                |
+-----------------------------------------------------------------------------------+
|                            ANTIGRAVITY DAEMON WATCHER                             |
|                           (bridge/daemon.js - Background)                         |
|                                                                                   |
|  - Perbarui bridge_heartbeat.json setiap 5 detik                                  |
|  - Pantau bridge/wa_queue.json (Chokidar)                                         |
|  - Cetak log terstruktur ke stdout: [ANTIGRAVITY_BRIDGE] INCOMING_MESSAGE         |
+-----------------------------------------------------------------------------------+
       |
       | Reactive Wakeup via stdout log
       v
+-----------------------------------------------------------------------------------+
|                        ANTIGRAVITY AGENT (Active Session)                         |
|                                                                                   |
|  - Membaca konteks pesan dari log atau wa_queue.json                             |
|  - Menghasilkan respons persona Sawako (Kaomoji + Stiker Tag)                     |
|  - Menjalankan Perintah C2 (Screenshot, Shutdown, File Check) jika diminta        |
|  - Eksekusi: node bridge/reply.js --id <id> --text <text> --sticker <sticker>     |
+-----------------------------------------------------------------------------------+
```

---

## 6. Rencana Verifikasi dan Pengujian Independen

1. **Uji Atomic Write dan Mutex Locking**:
   - Jalankan simulasi stress test: 20 proses Node.js melakukan read-modify-write ke `bridge/wa_queue.json` secara simultan. Verifikasi tidak ada data korup (`SyntaxError`) atau crash `EBUSY`.
2. **Uji Siklus Lengkap Daemon Auto-Wake**:
   - Tulis item pesan dummy ke `bridge/wa_queue.json`.
   - Pastikan daemon mendeteksi perubahan dalam waktu < 200 ms dan mencetak log trigger ke konsol.
3. **Uji Fallback Launcher**:
   - Hentikan proses daemon dan buat file heartbeat kedaluwarsa.
   - Kirim pesan uji coba ke bot.
   - Pastikan bot merespons dengan tombol `[ 🚀 Open Antigravity ]` dalam batas waktu timeout.
   - Eksekusi perintah `.open_antigravity` dan pastikan `agy.exe` berhasil diluncurkan di Windows.
4. **Uji Perintah Sistem**:
   - Tangkapan layar: Uji skrip tangkapan layar, verifikasi file PNG valid terbentuk di `bridge/media/`.
   - Guarded shutdown: Uji pemanggilan `shutdown /s /t 60` dan pembatalan langsung via `shutdown /a`. Pastikan tidak ada kegagalan eksekusi hak akses.

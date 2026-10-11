# Original User Request

## 2026-10-08T12:53:34Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team (Build)

Membangun jembatan komunikasi jarak jauh (Remote C2 Assistant) yang **secara harfiah terhubung ke session Antigravity aktif ini**, sehingga agen memiliki memori tentang proyek-proyek sebelumnya. Bot WhatsApp (Niwo Bot) akan merutekan pesan ke Antigravity menggunakan sistem *file-watcher bridge*. Agen Antigravity akan membalas dengan persona Sawako (Kimi ni Todoke), menggunakan *kaomoji* Jepang seperti (*v*) atau (UwU), dan sesekali mengirimkan stiker WA otomatis di momen emosional tertentu. Agen juga harus mampu mengeksekusi perintah tingkat sistem (screenshot, shutdown, file processing).

Working directory: `C:\Users\ACER NITRO\Downloads\Hiyuki-AI-21-09-26-1789982840727`
Integrity mode: development

## Requirements

### R1. WhatsApp Bot Routing & Mode Toggle
Membangun fitur `.gravity on` di Niwo Bot (dengan *button* opsi: *chat only*, *group only*, atau *both*) dan `.gravity off`. Mode ini eksklusif untuk nomor Owner. Jika di grup, bot hanya membalas jika pesan me-reply chat bot atau memanggil keyword.

### R2. Antigravity-Bridge (File-based IPC) & Auto-Wake
Membangun sistem *bridge*: WA Bot menulis pesan masuk ke `wa_queue.json`. Sebuah *daemon script* berjalan di latar belakang Antigravity untuk memantau *file* tersebut. Saat ada pesan baru, *daemon* mencetak log untuk membangunkan agen Antigravity. Jika Antigravity tertutup, WA Bot mengirim pesan penolakan dan menawarkan tombol "Open Antigravity" yang akan mengeksekusi `start agy` (atau path executable Antigravity) di Windows.

### R3. Persona Sawako & Kaomoji
Prompt sistem khusus untuk menjembatani pesan agar merespons dengan gaya Sawako, menggunakan *kaomoji*, dan bebas dari *emoji* modern standar.

### R4. Automatic Sticker Fetching & Handling
Bot harus bisa bereaksi dengan mengirimkan stiker WA lucu pada momen-momen tertentu (kejutan, senang, sedih). WA Bot harus dilengkapi modul/bank stiker yang bisa di-trigger oleh agen Antigravity dengan membalas format tertentu (misal: `[ACTION: SEND_STICKER_SHY]`).

## Acceptance Criteria

### Sistem Routing & Bridge
- [ ] Mengetik `.gravity on` memunculkan opsi target (Chat/Grup/Keduanya).
- [ ] Pesan WA berhasil ditulis ke `wa_queue.json` dan memicu script daemon untuk membangunkan agen.
- [ ] Balasan dari agen ditulis ke `wa_response.json` dan sukses terkirim ke WA.

### Fallback Antigravity Tertutup
- [ ] Jika daemon bridge tidak merespons dalam X detik, WA Bot mengirim pesan "Antigravity di-close" beserta tombol "Open Antigravity".
- [ ] Menekan tombol tersebut berhasil membuka aplikasi/CLI Antigravity di laptop.

### Persona & Stiker
- [ ] Agen membalas dengan *kaomoji* bergaya Sawako.
- [ ] Agen dapat men-trigger pengiriman stiker ekspresi ke WA dengan format *action* tertentu.

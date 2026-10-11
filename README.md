# NIWO BOT

WhatsApp Bot : **Developer: WELPER ID**

Kontak: `6283838681020` · YouTube: https://youtube.com/@welper-tzyofficial

---

## 1. Menjalankan

```bash
npm install
npm start
```

Masukkan nomor WhatsApp, lalu masukkan pairing code di
`Linked Devices → Link with phone number`.

Node.js minimal versi 18 (disarankan 20 ke atas).

---

## 2. Konfigurasi

Semua setelan ada di **satu file**: `src/config.js`.
File `config.js` dan `appConfig.js` di root hanya meneruskan ke file itu,
jadi plugin yang meng-import `../../config.js` maupun `../../appConfig.js`
membaca setelan yang sama.

Yang perlu diisi:

| Bagian | Isi |
|---|---|
| `botName`, `ownerName` | identitas bot |
| `developer` | nama, nomor, link YouTube developer |
| `superOwner`, `coOwner` | nomor owner bot |
| `apikey`, `apiBaseUrl` | API utama untuk fitur AI/downloader/search |
| `ai` | endpoint + key untuk `.autogpt` |
| `pterodactyl` | domain & API key panel (server1-server5) |

**Jangan pernah menaruh API key langsung di dalam file plugin.**
Semua plugin panel dan AI membaca key dari `src/config.js`.

---

## 3. Menu

Menu dibuat otomatis per kategori dari command registry. Menambah fitur di
`plugins/<kategori>/namafitur.js` langsung menambah isi menu.

```
.menu               menu utama : video GIF + foto + info + kategori + tombol
.menu game          isi satu kategori
.menu 5             isi kategori nomor 5
.menu cek-cekan     nama label juga dikenali
.allmenu            semua fitur, pagination terkontrol
.info               identitas bot
.sc                 identitas source & developer
```

Tampilan `.menu` (tema salju ❄️):

- **Video GIF di atas, foto di bawah.** Video dari `config.menuVideo.url`
  dikirim sebagai GIF (autoplay + loop, tanpa suara), lalu disusul foto +
  info + tombol. Layout diatur `menuLayout` di `src/config.js`:
  `'stack'` (2 pesan, paling stabil) atau `'single'` (1 pesan, video jadi
  header dan foto jadi thumbnail; otomatis turun ke `stack` kalau gagal).
- Video hanya di menu utama. Submenu dan `.allmenu` tetap foto + teks + tombol.
- Kalau video gagal diunduh/dikirim, menu **tetap terkirim** tanpa video.
- Tombol **HUBUNGI DEVELOPER**, **YOUTUBE DEVELOPER**, **ALL MENU**,
  **SCRIPT**, dan **BUKA KATEGORI** ada di `.menu`. Submenu hanya punya
  **PILIH KATEGORI** dan **MENU UTAMA**.
- Jumlah fitur dan kategori dihitung dari registry, tidak di-hardcode.
- Semua game ada di satu kategori **GAME**.

### Video menu

```
src/media/video/menu.mp4     file lokal (diutamakan kalau ada)
config.menuVideo.url         link mp4, diunduh sekali lalu disimpan di src/media/video/
config.menuVideo.enabled     false = matikan video
config.menuVideo.caption     caption video
```

Ganti `url` -> otomatis diunduh ulang. Cek isi folder dengan `.listasset`.

### Tema

Gaya teks (bingkai, bullet, small caps) ada di `src/lib/theme.js`. Icon
kategori dan label tombol ada di `plugins/menu/menu.js`. Foto kartu
kategori: `src/media/menu/<kategori>.png`.

### Sistem Button

Default **AKTIF**.

```
.offbutton      matikan button → menu jadi teks rapi   (owner)
.aktifbutton    aktifkan full button                   (owner)
.statusbutton   lihat status sekarang                  (owner)
```

Status tersimpan permanen di `database/settings.json` : tetap sama setelah
restart. Saat NONAKTIF, tidak ada button yang dikirim sama sekali.
Status selalu tampil di baris `Button :`.

### Foto menu

Foto menu dibaca ulang setiap kali dipakai (divalidasi lewat mtime), jadi
penggantian foto langsung berlaku tanpa restart dan foto lama tidak
nyangkut di cache.

```
.setfotomenu          ganti foto menu utama (kirim/reply foto)   (owner)
.setfotomenu game     ganti foto satu kategori                   (owner)
.resetfotomenu        balik ke foto bawaan                       (owner)
.cekfotomenu          lihat foto yang sedang dipakai             (owner)
```

Foto disimpan ke `src/media/menu/` : folder asset yang sudah dipakai source.

---

## 3b. Welcome grup

```
.setwelcome                    lihat status & cara pakai
.setwelcome on | off
.setwelcome mode text|mention|foto
.setwelcome teks <teks>
.setwelcome foto               kirim/reply foto
.setwelcome resetfoto
.setwelcome reset
.testwelcome                   coba kirim ke diri sendiri
```

Mode:

| Mode | Perilaku |
|---|---|
| `text` | teks biasa, member baru tidak ditag |
| `mention` | member baru benar-benar ditag |
| `foto` | foto + caption |

Placeholder: `@user` `@group` `@desc` `@count`

Konfigurasi disimpan per grup di database NIWO BOT. Kalau owner tidak memasang
foto, dipakai foto bawaan NIWO BOT (`src/media/menu/welcome.png`, lalu `logo`).

### Anti-link

```
.antlink on | off       (alias: .antylink .antilink .antilinkall)
.antilinkgc on | off
```

---

## 4. CPANEL / Pterodactyl

`.cpanel` : menu panel yang bersih, hanya berisi command yang memang ada.

**Pembuatan panel** (owner atau member grup reseller):

```
.1gbv2  .2gbv2  .3gbv2  .4gbv2  .5gbv2  .6gbv2
.7gbv2  .8gbv2  .9gbv2  .10gbv2  .unliv2
```

Format: `.1gbv2 username` atau `.1gbv2 username,628xxxxxxxx`
Ganti akhiran `v1`-`v5` untuk memilih server panel lain.

**Grup reseller** (owner):

```
.addgrupreseller [v1-v5]    daftarkan grup ini
.delgrupreseller            hapus grup ini
.delgrupreseller 2          hapus berdasarkan nomor di daftar
.delgrupreseller all        kosongkan daftar
.listgrupseller [v1-v5]     tampilkan daftar grup
```

Disimpan di `database/cpanel/grupreseller.json`. Bisa lebih dari satu grup
per server, duplicate ditolak otomatis.

**Admin panel** (owner): `.cadminv2` `.deladminv2` `.listadminv2`

**Management** (owner): `.listpanelv2` `.delpanelv2` `.clearpanelv2`

`.clearpanelv2` menghapus seluruh server & user **non-admin**.
User `root_admin` **tidak pernah dihapus**, dan command ini wajib
dikonfirmasi ulang dengan `.clearpanelv2 yes` dalam 60 detik.

Pembacaan data panel memakai pagination penuh (semua halaman), bukan
hanya `page=1`.

---

## 5. Fitur yang diintegrasikan

| Fitur | Command | Kategori |
|---|---|---|
| Tic Tac Toe | `.ttt` `.tictactoe` | GAME |
| Block Blast | `.blockgame` `.blockblast` `.block` | GAME |
| Music player + lirik | `.play2` | DOWNLOAD |
| Chat AI otomatis | `.autogpt on/off` | AI & CHAT |
| Cari jodoh | `.carijodoh` | FUN MENU |

`.autogpt` aktif per grup (admin grup atau owner). Setelah aktif, bot
membalas kalau pesan men-tag bot, me-reply pesan bot, atau diawali
`bot` / `niwo`. Endpoint & key dibaca dari `config.ai`, tidak pernah
ditampilkan ke user, dan error/timeout API ditangani tanpa membuat bot crash.

---

## 6. Voice Note

Fitur VN **tetap ada dan tidak dihapus**. Yang berubah: VN otomatis saat
menu dibuka sekarang **default mati** (`menuVoiceNote: false` di
`src/config.js`), supaya `.menu` tetap bersih (video + foto + tombol).
Ubah ke `true` kalau memang ingin menu mengeluarkan suara.

- Foto menu : `src/media/menu/<kategori>.png`
- Video menu: `src/media/video/menu.mp4` (atau `config.menuVideo.url`)
- Audio VN  : `src/media/audio/<kategori>.mp3` atau `.ogg`

Nama file cukup disamakan dengan nama kategori. Cek dengan `.listasset`.

---

## 7. Struktur

```
index.js                    entry point
src/config.js               SATU-SATUNYA file konfigurasi
src/lib/buttonState.js      status button (persistent)
src/lib/welcomeSystem.js    konfigurasi & pengirim welcome grup
src/lib/resellerStore.js    daftar grup reseller panel
src/lib/panelCompat.js      helper panel (role, jeda, format)
src/utils/pluginBridge.js   loader /plugins
src/utils/interactiveHelper.js  builder tombol/native flow
plugins/<kategori>/*.js     semua fitur
```

Format plugin yang didukung ada dua, keduanya otomatis dikenali:

```js
// format native
const handler = async (m, { conn, args, command }) => { ... }
handler.command = ['contoh']
handler.tags = ['tools']
export default handler
```

```js
// format legacy
const config = { name: 'contoh', category: 'tools', isOwner: false }
async function handler(m, ctx) { ... }
export default { config, handler }
```

---

## 8. Cek kesehatan project

```
.plugininfo     jumlah plugin dimuat, command, kategori, dan yang gagal
.listasset      foto & audio menu yang tersedia
.cpanel         status konfigurasi panel (tanpa menampilkan API key)
```

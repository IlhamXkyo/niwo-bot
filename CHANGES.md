# NIWO BOT : Catatan Perubahan

## Rebrand AUREX MD -> NIWO BOT ❄️

- Nama bot, watermark, stiker, persona AI, trigger `bot / hiyuki`, banner
  console, dan seluruh teks di plugin diganti dari AUREX ke HIYUKI.
- Logo dan 43 kartu kategori (`src/media/menu/*.png`) dibuat ulang bertema
  es/salju dengan tulisan NIWO BOT. Kategori yang dulu jatuh ke gambar
  TOOLS (download, cek, user, store, religi, rpg, vps) kini punya kartu sendiri.
- `.menu`: video GIF autoplay di atas + foto/info/tombol di bawah
  (`config.menuVideo`, `config.menuLayout`). Loader video dengan cache di
  `src/utils/assets.js`, builder pesan `sendInteractiveWithVideo` di
  `src/utils/interactiveHelper.js`.
- Tema teks & tombol baru: `src/lib/theme.js`, `plugins/menu/menu.js`,
  `plugins/main/sc.js`, `plugins/info/info.js`.
- Kredit developer (WELPER ID) tidak diubah.

---

## 2.3.0 : Perbaikan Total Button/Menu, Hapus HIYUKI GAME, NOBAR Baru

### Bug utama: kategori 1-17 muncul dobel saat mode button AKTIF
Akar masalahnya di `plugins/menu/menu.js`: pesan interaktif WhatsApp itu
foto + **teks (caption)** + tombol jadi satu pesan : tapi teksnya masih
selalu menulis daftar kategori bernomor 1..N, PADAHAL tombol/list di
pesan yang sama sudah menyediakan navigasi kategori itu sendiri. Jadi
yang terlihat "menu dobel" bukan dua pesan, tapi satu pesan yang isinya
kepasang dua kali (teks + tombol).

Perbaikan: `mainMenuText()` sekarang menerima status button. Kalau
button AKTIF, daftar kategori bernomor **tidak ditulis lagi** : hanya
header info + cara pakai `.menu <kategori>` + baris `.offbutton` /
`.aktifbutton`. Kalau button NONAKTIF (mode teks), daftar bernomor tetap
ditulis lengkap seperti biasa karena itu satu-satunya navigasi yang ada.
`.allmenu` ikut mengikuti pola yang sama: mode teks tetap dump semua
command per kategori, mode button jadi ringkas + navigasi list kategori
(bukan dump ratusan command jadi caption raksasa).

### `buttonConfig` : kontrol tombol per kategori
`src/config.js` sekarang punya `buttonConfig: { game: true, owner: true,
... }`. Kalau sebuah kategori di-set `false`, kategori itu tidak muncul
sebagai tombol di menu utama / `.allmenu`, tapi TETAP bisa diakses lewat
`.menu <kategori>` : tidak ada fitur yang hilang, cuma navigasi
tombolnya yang dilepas untuk kategori itu. Kategori yang tidak
disebutkan di `buttonConfig` otomatis dianggap `true`, jadi kategori
baru tidak pernah hilang dari tombol tanpa diminta.

### `showDeveloperContact`
Config baru `showDeveloperContact: true/false` di `src/config.js`.
`false` -> info developer (nama/nomor/tombol) tidak ditampilkan sama
sekali di menu, baik mode teks maupun mode button. Kalau `true`: mode
teks menulis nama+nomor developer sebagai teks, mode button hanya
menulis nama (nomor sudah diwakili tombol "HUBUNGI DEVELOPER" : tidak
ditulis dobel sebagai teks panjang yang mengganggu tampilan tombol).

### HIYUKI GAME dihapus
`plugins/game/hiyukigames.js` : hub game (Dino Runner / Tic-Tac-Toe /
Doom lewat WhatsApp rich response) dihapus total dari source, menu, dan
navigasi kategori GAME. Game individual lain di kategori GAME
(`.dino` bukan dari hub ini, `.tictactoe`, `.catur`, `.slot`, `.tetris`,
dst : semuanya file plugin sendiri-sendiri) **tidak disentuh**.

### NOBAR / Watch Party (fitur baru)
Fitur NOBAR yang diminta belum pernah ada di project ini sebelumnya,
jadi dibangun dari nol, terhubung ke sistem menu/kategori yang sudah
ada (bukan sistem terpisah):

- `src/nobar/store.js` : state room (video aktif, status play/pause,
  posisi, queue, chat, viewer) disimpan di RAM per chat. Sengaja bukan
  data permanen : ini sesi live, bukan setelan seperti status button.
- `src/nobar/server.js` : server Express + WebSocket (`/nobar/:roomId`
  + `/nobar-ws`), dinyalakan otomatis (lazy, sekali saja) begitu ada
  yang pakai `.nobar`. Kalau `express`/`ws` gagal dimuat, NOBAR saja
  yang nonaktif : bot & fitur lain tidak ikut terganggu.
- `src/nobar/page.js` : halaman HTML NOBAR: player YouTube (IFrame
  API), status playing/paused, viewer count, live chat, form request
  video, daftar queue, kontrol khusus host (play/pause/next/seek),
  mobile responsive.
- `plugins/nobar/nobar.js` : `.nobar <link>` mulai sesi & kirim dua
  link (link nonton untuk semua, link kontrol khusus host); `.nobar
  play|pause|next|seek <detik>|queue <link>|stop` untuk kontrol lewat
  chat juga (host / owner bot saja untuk play/pause/next/seek/stop).
- Ditambahkan sebagai kategori menu baru `NOBAR`, otomatis ikut
  `buttonConfig`.
- Dependency baru di `package.json`: `express`, `ws`.

### Diperiksa, tidak ada yang perlu diubah
- Sistem foto/asset menu (`src/utils/assets.js`) sudah terpusat per
  kategori dengan fallback logo & cache yang divalidasi mtime : sudah
  memenuhi permintaan "semua asset harus bisa diganti", tidak diubah.
- Status button (`src/lib/buttonState.js`) sudah tersimpan permanen
  lewat `src/lib/database.js` (settings.json), tahan restart : sudah
  benar sebelumnya, tidak diubah.
- Tidak ditemukan menu/fitur bernama PROMO di project ini (hanya fitur
  `promote`/`notifpromote` grup yang tidak berkaitan). Item PROMO di
  brief sifatnya kondisional ("jika ada menu/fitur PROMO") : karena
  memang tidak ada, tidak ada perubahan yang dibuat di bagian ini.

### Diketahui, di luar cakupan perbaikan ini
`bridge.init()` melaporkan 3 file gagal dimuat, semuanya sudah begitu
sebelum perubahan ini dan tidak berkaitan dengan menu/button/NOBAR:
`downloader/loklok.js` (butuh file scraper yang belum ada di
`src/lib/scraper/loklok.js`) dan `owner/swgcv2.js` /
`owner/swgcv2all.js` (import named export dari package `file-type` yang
CommonJS, seharusnya pakai default import). Dibiarkan sesuai instruksi
untuk tidak mengubah fitur lain tanpa alasan yang terkait permintaan ini.

### Hasil test
505+ file lolos syntax check (`node --check`, 0 gagal dari 510 file).
Plugin bridge memuat 423 file / 1421 command / 27 kategori (termasuk
`nobar`, tanpa `hiyukigames`). `.menu` diverifikasi tidak lagi dobel di
mode button ON maupun OFF, `.menu <kategori>` & `.allmenu` diverifikasi
di kedua mode. Server NOBAR diverifikasi start, menyajikan halaman
(200 OK), dan menyiarkan chat + kontrol owner (play/pause) lewat
WebSocket ke lebih dari satu klien.

---

## 2.2.0 : Menu Rebuild, Welcome System, Foto Dinamis

### Sumber "Popioo" ditemukan dan dihapus
Pesan random `> popioo` berasal dari `plugins/game/hiyukigames.js` :
tertanam di dua tempat dalam payload rich message (`messageText` dan
`primitive.text`). Diganti jadi `HIYUKI GAMES`. Sisa project sudah discan:
tidak ada lagi teks debug/testing yang terkirim ke chat.

### Kategori GAME tidak lagi terpecah
Tiga plugin (`bns.js`, `susunkata.js`, `asahotak.js`) mendeklarasikan
`category: 'games'` sementara sisanya `'game'` : itulah sebabnya GAME
muncul dua kali. Sekarang dinormalkan ke `'game'` di source, plus
`CATEGORY_MERGE` di menu sebagai pengaman. `linode` digabung ke `panel`.

### Menu ditulis ulang : satu sistem, satu pesan
- `.menu` mengirim **tepat satu pesan**: foto + info + daftar kategori +
  tombol, semuanya menyatu. Tidak ada pesan susulan, tidak ada tombol
  terpisah, tidak ada audio yang ikut terkirim.
- Tombol `HUBUNGI DEVELOPER` / `YOUTUBE DEVELOPER` / kategori **hanya
  muncul di `.menu`**. Submenu (`.menu ai`, `.menu game`, dst) dikirim
  tanpa tombol sama sekali.
- Daftar kategori memakai urutan tetap: AI & CHAT, DOWNLOAD, GROUP,
  FUN MENU, GAME, TOOLS, CPANEL, OWNER, MAKER, CEK-CEKAN, USER, STORE,
  CANVAS, INFO, PRIMBON, RELIGI, RPG. Kategori lain menyusul otomatis.
- Badge verified `NIWO BOT ✓`.
- `.menu <nomor>` dan `.menu <label>` (`.menu cek-cekan`, `.menu fun menu`)
  ikut dikenali.
- Jumlah fitur & kategori dihitung dari command registry, tidak di-hardcode.
- `.allmenu` memakai pagination terkontrol (`MENU 1/3`), memotong di batas
  baris, bukan di tengah kata.
- VN menu **tidak dihapus** : hanya default mati (`menuVoiceNote: false`)
  supaya `.menu` benar-benar satu pesan. Set `true` kalau tetap mau.
- `.rekomendasi` dihapus karena menjadi jalur menu ketiga yang bertabrakan
  dengan `.menu` dan `.allmenu`.

### Foto menu dinamis
- Cache foto di `src/utils/assets.js` dulunya **permanen** : foto lama
  nyangkut di memori sampai bot direstart. Sekarang divalidasi lewat
  `mtime` + ukuran file, jadi foto baru langsung terpakai.
- `.setfotomenu` (kirim/reply foto) : ganti foto menu utama.
- `.setfotomenu game` : ganti foto satu kategori.
- `.resetfotomenu` / `.cekfotomenu`.
- Disimpan ke `src/media/menu/` : folder asset yang memang sudah dipakai
  source, bukan sistem penyimpanan kedua.

### Welcome system
- `src/lib/welcomeSystem.js` : konfigurasi per grup lewat `db.getGroup` /
  `db.setGroup`. Sebelumnya welcome hanya stub `global.welcomeGroups`
  (Map di memori, hilang setiap restart, tanpa konfigurasi).
- Mode: `text` (tanpa tag), `mention` (member ditag beneran), `foto`.
- Placeholder: `@user` `@group` `@desc` `@count`.
- `.setwelcome on|off|mode|teks|foto|resetfoto|reset`, `.testwelcome`.
- Fallback foto: foto grup -> foto bawaan HIYUKI -> teks saja.
- Event `group-participants.update` di `messageHandler.js` disambungkan ke
  sistem ini, metadata grup diambil sekali untuk semua member baru, dan
  kegagalan welcome tidak menghentikan event lain.

### Lain-lain
- `.info` : identitas bot ringkas.
- `.antlink` / `.antylink` / `.antilink` jadi alias `antilinkall`.
- `.match` jadi alias `carijodoh`.
- Duplicate baru dibereskan: `info` (store/list.js) dan `listproduk`.
- 505 file JS lolos syntax check, 1.179 command, 22 kategori, 0 duplicate.

---

## 2.1.0 : Full Rebuild / Feature Integration

### Perbaikan bug fatal (CPANEL & VPS)
Setiap command panel/VPS sebelumnya **selalu crash** sebelum sempat jalan.
Ini penyebab utama CPANEL terasa berantakan. Dua bug di 19 file:

1. `const command = String(ctx.command || command || "")` : variabel
   merujuk dirinya sendiri sebelum diinisialisasi (ReferenceError).
2. `getText()` dipakai tapi tidak pernah di-import.

Diperbaiki di: `createserver`, `cpanel`, `cadmin`, `deladmin`, `listadmin`,
`listserver`, `listuser`, `delserver`, `delpanel`, `serverinfo`, `cekjeda`,
`jedacreate`, `linode`, dan 6 file VPS.

### Konfigurasi
- `src/config.js` ditulis ulang sebagai satu-satunya sumber konfigurasi.
- Blok `pterodactyl` (server1-server5: domain, apikey, capikey, nestid,
  eggid, loc + `ownerPanels`) ditambahkan : sebelumnya key ini **tidak ada
  sama sekali**, sehingga `appConfig.pterodactyl` selalu `undefined`.
- Blok `ai` untuk `.autogpt` dan blok `developer` ditambahkan.
- Tidak ada API key yang di-hardcode di file plugin mana pun.

### Sistem Button
- `src/lib/buttonState.js` : status button persistent lewat sistem settings
  yang sudah ada, bukan database baru.
- `.offbutton` / `.aktifbutton` / `.statusbutton` (owner only).
- Status bertahan setelah restart, dan selalu tampil di baris `Button :`.

### Menu
- Ditulis ulang total: tanpa box `WELCOME`, tanpa garis ASCII dekoratif,
  tanpa "Selamat datang di WhatsApp Bot".
- Berbasis kategori. `.allmenu` tetap dikelompokkan per kategori.
- Mode button: foto + teks + tombol dalam **satu pesan**.
- Mode teks: daftar kategori bernomor, bisa dibuka via `.menu <nomor>`.
- Tombol `HUBUNGI DEVELOPER` dan `YOUTUBE DEVELOPER`.
- VN menu tetap berjalan di kedua mode.

### Fitur baru
- `.ttt` / `.tictactoe` : versi lengkap (vs AI + vs Player, level, skor).
- `.blockgame` : Block Blast Mini.
- `.play2` : music player + lirik ter-sinkron LRCLIB.
- `.autogpt on/off` : chat AI otomatis per grup.
- `.carijodoh` : fitur fun di grup.
- `.sc` : identitas source & developer.
- `.addgrupreseller` / `.delgrupreseller` / `.listgrupseller` : grup
  reseller multi-grup (sebelumnya hanya bisa satu grup per server).
- `.clearpanelv2` : bersihkan panel, **root admin tidak pernah dihapus**,
  wajib konfirmasi, pagination penuh.
- Alias `listpanelv1-v5`, `listpv1-v5`, `delpanelv1-v5`, `delpv1-v5`.

### Branding
- Seluruh nama script & developer lama dibersihkan dari source, command,
  config, caption, response, button, metadata, dan nama file.
- `plugins/game/mahjong-shinobu.js` → `plugins/game/mahjong.js`
- `plugins/game/nixelgames.js` → `plugins/game/hiyukigames.js`
- Watermark "Fitur By ..." di 290 file diganti `NIWO BOT`.
- Lisensi MIT dan credit pihak ketiga yang diwajibkan tetap dipertahankan.

### Perapian
- 4 duplicate command dihapus: `spotify`, `blockgame`, `savescrape`,
  `speedtest`.
- `play2` diarahkan ke ffmpeg bawaan `@ffmpeg-installer` agar tetap jalan
  di server tanpa ffmpeg global.
- Seluruh 501 file JS lolos pemeriksaan syntax.
- Tidak ada dependency yang kurang di `package.json`.

### Yang sengaja TIDAK diubah
- Seluruh fitur lama HIYUKI tetap ada (1.165 command terdaftar, 24 kategori).
- Fitur VN / Voice Note tidak dihapus.

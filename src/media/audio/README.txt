==================================================
FOLDER AUDIO VN (VOICE NOTE) : NIWO BOT
==================================================

Taruh file audio di folder ini. Nama file HARUS sama dengan
nama menu/kategori. Format yang didukung:
  .ogg  .opus  .mp3  .m4a  .wav

Audio dikirim sebagai VOICE NOTE (ptt: true), jadi tampil
seperti VN beneran, bukan file audio.

--------------------------------------------------
DAFTAR NAMA FILE YANG DIBACA OTOMATIS
--------------------------------------------------
menu.mp3          -> saat .menu dibuka (WAJIB, jadi fallback semua menu)
allmenu.mp3       -> saat .allmenu dibuka

ai.mp3            alkitab.mp3       am.mp3
anime.mp3         canvas.mp3        donghua.mp3
downloader.mp3    extra.mp3         freefire.mp3
fun.mp3           game.mp3          general.mp3
group.mp3         info.mp3          islami.mp3
jadibot.mp3       komik.mp3         maker.mp3
manga.mp3         media.mp3         mlbb.mp3
movie.mp3         news.mp3          owner.mp3
panel.mp3         primbon.mp3       random.mp3
samp.mp3          sample.mp3        search.mp3
stalker.mp3       sticker.mp3       tools.mp3

--------------------------------------------------
CATATAN
--------------------------------------------------
1. Kalau cuma mau 1 audio untuk SEMUA menu:
   cukup taruh "menu.mp3" saja. Menu lain otomatis pakai itu.

2. Kalau file audio tidak ada, menu tetap terkirim normal
   (audio cuma dilewati, tidak bikin error).

3. Untuk hasil paling rapi pakai .ogg opus:
   ffmpeg -i suara.mp3 -c:a libopus -b:a 64k -ar 48000 -ac 1 menu.ogg

4. Durasi disarankan 2-8 detik biar tidak spam.

5. Cek daftar file yang kebaca bot: ketik .listasset

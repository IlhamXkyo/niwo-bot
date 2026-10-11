const config = {
  name: "web2apk",
  alias: ["webtoapk", "webtoapp", "apkmaker", "buatapk"],
  category: "tools",

  description: "Membuat APK dari website",
  usage: ".web2apk <url> [icon] [name] [package]",
  example: ".web2apk https://example.com https://icon.png MyApp com.myapp",

  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,

  cooldown: 60,
  energi: 10,
  isEnabled: true
};

async function handler(m, { sock }) {
  const args = String(m.text || "").trim().split(/\s+/);

  // ── Cek parameter minimal ─────────────────
  if (args.length < 1) {
    return m.reply(
      "〄 *WEB2APK MAKER*\n\n" +
      "┌──────────────\n" +
      "│ 〄 Buat APK dari website\n" +
      "│\n" +
      "│ 〄 *Cara Penggunaan:*\n" +
      `│ ${m.prefix}web2apk <url> [icon] [name] [package]\n` +
      "│\n" +
      "│ 〄 *Contoh:*\n" +
      `│ ${m.prefix}web2apk https://example.com\n` +
      `│ ${m.prefix}web2apk https://example.com https://icon.png MyApp com.myapp\n` +
      "│\n" +
      "│ 〄 *Parameter (Opsional):*\n" +
      "│ • icon : URL icon (PNG)\n" +
      "│ • name : Nama aplikasi\n" +
      "│ • package : Package ID\n" +
      "│\n" +
      "│ ⚠️ *Catatan:*\n" +
      "│ • Proses memakan waktu 2-5 menit\n" +
      "│ • URL harus valid\n" +
      "│ • Hasil berupa file APK\n" +
      "│ • Package ID harus unik\n" +
      "└──────────────"
    );
  }

  const url = args[0];
  const icon = args[1] || "";
  const name = args[2] || "";
  const packageId = args[3] || "";

  // ── Validasi URL ─────────────────────────
  try {
    new URL(url);
  } catch {
    return m.reply(
      "〄 *URL TIDAK VALID*\n\n" +
      "〄 Pastikan URL yang dimasukkan benar\n" +
      "〄 Contoh: https://example.com"
    );
  }

  // ── Validasi icon jika diisi ─────────────
  if (icon) {
    try {
      new URL(icon);
    } catch {
      return m.reply(
        "〄 *ICON URL TIDAK VALID*\n\n" +
        "〄 Pastikan URL icon benar\n" +
        "〄 Contoh: https://example.com/icon.png"
      );
    }
  }

  // ── Validasi package ID ──────────────────
  if (packageId && !/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageId)) {
    return m.reply(
      "〄 *PACKAGE ID TIDAK VALID*\n\n" +
      "〄 Format package ID tidak valid\n" +
      "〄 Contoh: com.example.myapp\n" +
      "〄 • Hanya huruf, angka, underscore\n" +
      "〄 • Minimal 2 segmen (contoh: com.app)"
    );
  }

  try {
    await m.react("🕐");
    
    let statusMsg = await m.reply(
      "〄 *WEB2APK MAKER*\n\n" +
      "〄 🔄 Sedang memproses...\n" +
      "〄 ⏳ Mohon tunggu 2-5 menit\n" +
      "〄 📱 Membuat APK dari website\n\n" +
      `〄 URL : ${url}\n` +
      (name ? `〄 Nama : ${name}\n` : "") +
      (packageId ? `〄 Package : ${packageId}\n` : "") +
      (icon ? `〄 Icon : ${icon.substring(0, 30)}...\n` : "") +
      "\n〄 ⏳ Proses berjalan..."
    );

    // ── Build API URL ──────────────────────
    let apiUrl = `https://api.ikyyxd.my.id/tools/web2apk?url=${encodeURIComponent(url)}`;
    
    if (icon) apiUrl += `&icon=${encodeURIComponent(icon)}`;
    if (name) apiUrl += `&name=${encodeURIComponent(name)}`;
    if (packageId) apiUrl += `&package=${encodeURIComponent(packageId)}`;

    // ── Panggil API ────────────────────────
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API mengembalikan status ${response.status}`);
    }

    const data = await response.json();

    // ── Cek response ───────────────────────
    if (!data || data.status === false) {
      throw new Error(data.message || "Gagal membuat APK");
    }

    // ── Jika API mengembalikan URL download ──
    if (data.download_url || data.apk_url || data.result) {
      const apkUrl = data.download_url || data.apk_url || data.result;
      
      // ── Update status ────────────────────
      await sock.sendMessage(
        m.chat,
        {
          text: 
            "〄 *WEB2APK MAKER*\n\n" +
            "〄 ✅ APK berhasil dibuat!\n" +
            "〄 📥 Sedang mengunduh file...\n\n" +
            `〄 URL : ${url}\n` +
            (name ? `〄 Nama : ${name}\n` : "") +
            (packageId ? `〄 Package : ${packageId}\n` : "")
        },
        {
          quoted: m.verifiedQuoted || m
        }
      );

      // ── Download APK ─────────────────────
      const apkResponse = await fetch(apkUrl);

      if (!apkResponse.ok) {
        throw new Error("Gagal mendownload file APK");
      }

      const arrayBuffer = await apkResponse.arrayBuffer();
      const apkBuffer = Buffer.from(arrayBuffer);

      if (!apkBuffer.length) {
        throw new Error("File APK kosong");
      }

      // ── Kirim file APK ──────────────────
      await sock.sendMessage(
        m.chat,
        {
          document: apkBuffer,
          mimetype: 'application/vnd.android.package-archive',
          fileName: `${name || 'webapp'}_${Date.now()}.apk`,
          caption:
            "〄 *WEB2APK MAKER*\n\n" +
            "┌──────────────\n" +
            "│ ✅ *APK Berhasil Dibuat*\n" +
            `│ 📱 URL : ${url}\n` +
            (name ? `│ 📛 Nama : ${name}\n` : "") +
            (packageId ? `│ 📦 Package : ${packageId}\n` : "") +
            `│ 📊 Ukuran : ${(apkBuffer.length / 1024 / 1024).toFixed(2)} MB\n` +
            `│ ⏱ Waktu : ${new Date().toLocaleString('id-ID')}\n` +
            "└──────────────\n\n" +
            "〄 *Cara Install:*\n" +
            "〄 1. Download file APK\n" +
            "〄 2. Buka file di Android\n" +
            "〄 3. Aktifkan \"Unknown Sources\"\n" +
            "〄 4. Install aplikasi\n\n" +
            "〄 *Info Tambahan:*\n" +
            "〄 • Aplikasi akan membuka website\n" +
            "〄 • Memerlukan koneksi internet\n" +
            "〄 • Support Android 5.0+"
        },
        {
          quoted: m.verifiedQuoted || m
        }
      );

      await m.react("✅");

    } else {
      // ── Jika response berupa data lain ──
      const resultText = JSON.stringify(data, null, 2);
      
      await sock.sendMessage(
        m.chat,
        {
          text:
            "〄 *WEB2APK MAKER*\n\n" +
            "┌──────────────\n" +
            "│ ✅ *Proses Selesai*\n" +
            "│\n" +
            `│ 📋 Result :\n${resultText}\n` +
            "└──────────────"
        },
        {
          quoted: m.verifiedQuoted || m
        }
      );

      await m.react("✅");
    }

  } catch (error) {
    console.error("[WEB2APK ERROR]", error);

    await m.react("❌");

    return m.reply(
      "〄 *GAGAL MEMBUAT APK*\n\n" +
      `〄 Error : ${error.message}\n\n` +
      "〄 *Solusi:*\n" +
      "〄 • Periksa URL website\n" +
      "〄 • Pastikan website dapat diakses\n" +
      "〄 • Coba beberapa saat lagi\n" +
      "〄 • URL harus dengan protokol http/https\n" +
      "〄 • Periksa koneksi internet\n\n" +
      "〄 *Tips:*\n" +
      "〄 • Gunakan package ID yang unik\n" +
      "〄 • Nama aplikasi maksimal 30 karakter\n" +
      "〄 • Icon harus format PNG"
    );
  }
}

export default {
  config,
  handler
};
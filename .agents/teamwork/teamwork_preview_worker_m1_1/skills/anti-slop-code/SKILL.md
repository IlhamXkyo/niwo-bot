---
name: anti-slop-code
description: Terapkan standar rekayasa perangkat lunak autentik dan profesional. Gunakan saat membuat proyek baru, merancang arsitektur, menulis atau merefaktor kode, menyusun API, atau membangun antarmuka aplikasi. Mencegah abstraksi prematur, komentar basi, sindrom mock/placeholder, error handling rapuh, dan template AI generik.
---

# Prinsip Utama Rekayasa Perangkat Lunak (Anti-Slop Code)

Kode yang dihasilkan AI sering kali langsung terbaca tidak profesional karena pola-pola generik: terlalu banyak lapisan abstraksi kosong, komentar yang mendeskripsikan ulang sintaks, penanganan error yang hanya menangkap dan menelan kegagalan, serta kode tiruan (mock/stub) yang tidak pernah bisa dijalankan di dunia nyata.

Skill ini menertibkan seluruh proses rekayasa perangkat lunak agar kode yang dihasilkan memiliki kualitas engineer berpengalaman: pragmatis, tangguh, bersih dari bising, dan siap produksi.

---

## 5 Pilar Kode Profesional

### 1. Pragmatisme di Atas Abstraksi Prematur
- Tulis solusi paling langsung dan kohesif.
- Jangan membuat interface generic, abstract base class, builder, atau factory jika hanya ada satu implementasi nyata.
- Struktur folder harus proporsional dengan ukuran sistem. Hindari membuat puluhan direktori kosong demi meniru template arsitektur tertentu.

### 2. Eliminasi Sindrom Mock & Selesaikan End-to-End
- Jangan pernah meninggalkan placeholder seperti `// TODO: Implement actual logic` atau mengembalikan data dummy di jalur kode produksi.
- Jika membuat database schema, tulis tipe data, constraint, index, dan foreign key yang masuk akal.
- Pastikan logika input mengalir nyata sampai ke database, file, atau response stream.

### 3. Nol Komentar Basi (Zero Comment Slop)
- Hapus komentar yang hanya mengulang fungsi sintaks (contoh: `// instantiate service`, `// return response`).
- Kode harus self-documenting lewat penamaan variabel dan fungsi yang presisi.
- Komentar hanya diizinkan untuk alasan (why), batasan sistem eksternal, atau keputusan arsitektur non-intuitif.

### 4. Ketahanan & Penanganan Error Nyata (Beyond Happy Path)
- Dilarang menelan error (swallow error) tanpa aksi mitigasi.
- Bedakan jenis error: validation failure, network timeout, resource exhaustion, authorization failure.
- Selalu bersihkan resource (connection pool, file handles, event listeners).
- Lakukan validasi data di batas sistem (boundary validation).

### 5. UI/UX Fungsional Tanpa Desain Khas AI
- Hindari palet ungu neon / cyan di latar hitam pekat tanpa dasar identitas brand.
- Hindari border rounded raksasa dan padding boros yang mengurangi efisiensi kerja pengguna.
- Pastikan seluruh state komponen lengkap: idle, loading, empty state, dan error state dengan opsi pemulihan.

---

## Alur Kerja Eksekusi & Verifikasi

Sebelum menyerahkan hasil kerja ke pengguna:
1. **Analisa Konteks Nyata**: Periksa dependensi, versi runtime, dan konvensi penamaan yang sudah ada di repositori sebelum menulis kode.
2. **Uji Mandiri**: Jalankan linter, typecheck, atau tes unit yang tersedia. Jangan pernah menyerahkan kode yang belum diverifikasi eksekusinya.
3. **Penyampaian Lugas**: Sampaikan hasil kerja secara faktual tanpa pembuka atau penutup basa-basi.

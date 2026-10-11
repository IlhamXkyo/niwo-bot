# Anti-Slop Code Standards Local Copy
Source: C:\Users\ACER NITRO\.gemini\config\skills\anti-slop-code\SKILL.md

1. Pragmatisme di atas abstraksi prematur: kode langsung dan kohesif, zero generic interfaces/factories tanpa kebutuhan riil.
2. Eliminasi sindrom mock: implementasi logika utuh, verifikasi riil dalam test assertions, zero mock di jalur produksi.
3. Nol komentar basi: hapus komentar sintaks repetitif, jelaskan 'why' bukan 'what'.
4. Ketahanan dan penanganan error: tangani boundary errors, bersihkan resources, laporkan error spesifik.
5. Verifikasi mandiri: jalankan test runner dan verifikasi exit code 0 sebelum serah terima.

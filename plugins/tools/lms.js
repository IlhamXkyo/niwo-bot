/**
 * plugins/tools/lms.js : NIWO BOT
 * ---------------------------------------------------------------------
 * Integrasi LMS Mahasiswa ITB STIKOM Ambon (Civitas Siakad Tech).
 * ---------------------------------------------------------------------
 */

import lms from '../../src/lib/lmsClient.js';

const config = {
  name: 'lms',
  alias: ['siakad', 'civitas', 'lmslogin', 'lmslogout', 'lmsnotif', 'lmskelas', 'lmsabsen', 'lmsnilai'],
  category: 'tools',
  description: 'Portal LMS Mahasiswa (Profil, Jadwal Kelas, Rekap Absen per Semester, Notifikasi & Nilai)',
  usage: '.lms [opsi] atau .lmslogin <NIM>|<Password>',
  example: '.lms atau .lms absen 1 atau .lms login 240012345|rahasia123',
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 3,
  energi: 0,
  isEnabled: true,
};

async function handler(m, { text: rawText, sock }) {
  const p = m.prefix || '.';
  const senderNumber = String(m.sender || '').replace(/@.+$/, '').replace(/\D/g, '');
  const cmd = String(m.command || 'lms').toLowerCase();
  const fullText = String(rawText || m.text || '').trim();
  const subArgs = fullText.split(/\s+/).filter(Boolean);
  let subCmd = subArgs[0] ? subArgs[0].toLowerCase() : '';
  let paramOption = subArgs[1] ? subArgs[1].trim() : '';

  // Jika dipanggil via alias langsung (mis: .lmsabsen 1, .lmsnilai 1, .lmskelas 1)
  if (cmd !== 'lms' && subArgs[0]) {
    paramOption = subArgs[0].trim();
  }

  // 1. SUBCOMMAND: LOGIN (.lmslogin atau .lms login)
  if (cmd === 'lmslogin' || subCmd === 'login') {
    let cred = fullText;
    if (subCmd === 'login') cred = fullText.replace(/^login\s*/i, '').trim();

    const parts = cred.split('|').map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      return m.reply(
        `🔐 *LOGIN LMS STIKOM AMBON*\n\n` +
          `Masukkan NIM dan Password kamu dengan pemisah tanda garis lurus (*|*).\n\n` +
          `*Format:* \`${p}lmslogin NIM|PASSWORD\`\n` +
          `*Contoh:* \`${p}lmslogin 240012345|rahasia123\`\n\n` +
          `_Kredensial disimpan aman di database bot untuk nomor WA kamu._`
      );
    }

    const [inputNim, inputPass] = parts;
    await m.react('⏳');

    const loginRes = await lms.loginLms(inputNim, inputPass);
    if (!loginRes.ok) {
      await m.react('❌');
      if (loginRes.isDown) {
        return m.reply(
          `🔴 *SERVER LMS SEDANG DOWN / TIMEOUT*\n\n` +
            `> Website LMS kampus (lms.stikomambon.siakad.tech) sedang tidak dapat dihubungi.\n` +
            `> Silakan coba lagi beberapa saat nanti.`
        );
      }
      return m.reply(
        `❌ *LOGIN GAGAL*\n\n` +
          `> NIM atau Password yang kamu masukkan salah, atau akun belum terdaftar.\n` +
          `> *Alasan:* ${loginRes.error}\n\n` +
          `Silakan coba ketik ulang:\n` +
          `\`${p}lmslogin ${inputNim}|<password_benar>\``
      );
    }

    const token = loginRes.data.access_token;
    const now = Date.now();
    const expiresIn = (loginRes.data.expires_in || 64800) * 1000;
    const tokenData = {
      ...loginRes.data,
      expires_at: now + expiresIn,
    };

    // Tarik profil mahasiswa
    let profile = null;
    try {
      profile = await lms.getStudentProfile(inputNim, token);
    } catch {}

    // Simpan ke database
    lms.saveLmsAccount(senderNumber, {
      username: inputNim,
      password: inputPass,
      tokenData,
      profile,
    });

    await m.react('✅');
    return renderDashboard(m, sock, senderNumber, profile, token, p);
  }

  // 2. CEK SESI LOGIN DARI DATABASE
  const account = lms.getLmsAccount(senderNumber);
  if (!account) {
    return m.reply(
      `🎓 *PORTAL LMS MAHASISWA*\n\n` +
        `Nomor WA kamu belum terhubung dengan akun LMS.\n\n` +
        `Silakan login terlebih dahulu:\n` +
        `\`${p}lmslogin NIM|PASSWORD\`\n\n` +
        `*Contoh:* \`${p}lmslogin 240012345|rahasia123\``
    );
  }

  // 3. SUBCOMMAND: LOGOUT (.lmslogout atau .lms logout)
  if (cmd === 'lmslogout' || subCmd === 'logout') {
    lms.deleteLmsAccount(senderNumber);
    await m.react('👋');
    return m.reply(`✅ *BERHASIL KELUAR*\n\nSesi akun LMS untuk nomor kamu telah dihapus dari bot.`);
  }

  await m.react('⏳');

  // Validasi token atau auto re-login jika expired
  const tokenCheck = await lms.getValidToken(account, senderNumber);
  if (!tokenCheck.ok) {
    await m.react('❌');
    if (tokenCheck.isDown) {
      return m.reply(
        `🔴 *SERVER LMS SEDANG DOWN*\n\n` +
          `> Tidak dapat menghubungi server kampus saat ini. Silakan coba lagi nanti.`
      );
    }
    return m.reply(
      `⚠️ *SESI KEDALUWARSA / GAGAL LOGIN ULANG*\n\n` +
        `> Kemungkinan password telah diganti atau terjadi perubahan data di kampus.\n` +
        `> Silakan login kembali menggunakan format:\n` +
        `\`${p}lmslogin ${account.username}|<password_baru>\``
    );
  }

  const token = tokenCheck.token;

  // 4. SUBCOMMAND: NOTIF (.lmsnotif atau .lms notif)
  if (cmd === 'lmsnotif' || subCmd === 'notif') {
    return handleNotif(m, account, token, p);
  }

  // 5. SUBCOMMAND: KELAS (.lmskelas atau .lms kelas)
  if (cmd === 'lmskelas' || subCmd === 'kelas') {
    return handleKelas(m, account, token, paramOption, p);
  }

  // 6. SUBCOMMAND: ABSEN (.lmsabsen atau .lms absen)
  if (cmd === 'lmsabsen' || subCmd === 'absen') {
    return handleAbsen(m, account, token, paramOption, p);
  }

  // 7. SUBCOMMAND: NILAI (.lmsnilai atau .lms nilai)
  if (cmd === 'lmsnilai' || subCmd === 'nilai') {
    return handleNilai(m, account, token, paramOption, p);
  }

  // DEFAULT: TAMPILKAN DASHBOARD UTAMA
  let profile = account.profile;
  if (!profile || !profile.nama || !profile.semesters?.length) {
    try {
      profile = await lms.getStudentProfile(account.username, token);
      lms.saveLmsAccount(senderNumber, { ...account, profile });
    } catch {}
  }

  await m.react('✅');
  return renderDashboard(m, sock, senderNumber, profile, token, p);
}

/** Tampilkan menu dashboard utama */
async function renderDashboard(m, sock, senderNumber, profile, token, p) {
  const nim = profile?.idMahasiswa || '-';
  const nama = profile?.nama || 'Mahasiswa';
  const prodi = profile?.prodi || '-';
  const kelas = profile?.kelas || '-';
  const dosen = profile?.dosen || '-';
  const ipk = profile?.ipk || '-';
  const sks = profile?.sks || 0;

  // Selalu prioritaskan cek periode terbaru yang memiliki data
  const latestInfo = await lms.resolveLatestActivePeriod(profile?.semesters, token);
  let notifCount = 0;
  let notifText = '🟢 0 (Semua beres)';

  try {
    const pending = await lms.getPendingNotifications(latestInfo.classes, token);
    notifCount = pending.length;
    if (notifCount > 0) {
      notifText = `🔴 ${notifCount} hal belum selesai!`;
    }
  } catch {}

  const caption = [
    `╭───「 *PORTAL LMS MAHASISWA* 」`,
    `│ • *Nama*      : ${nama}`,
    `│ • *NIM*       : ${nim}`,
    `│ • *Prodi*     : ${prodi}`,
    `│ • *Kelas*     : ${kelas}`,
    `│ • *Dosen PA*  : ${dosen}`,
    `│ • *IPK / SKS* : ${ipk} (${sks} SKS)`,
    `│ • *Notifikasi*: ${notifText}`,
    `╰────────────────────────`,
    ``,
    `📌 *MENU PERINTAH LMS:*`,
    `• \`${p}lms notif\`         : Hal yang belum dikerjakan / absen kosong`,
    `• \`${p}lms kelas\`         : Jadwal kuliah semester terbaru`,
    `• \`${p}lms absen [no]\`    : Rekap presensi (bisa pilih semester)`,
    `• \`${p}lms nilai [no]\`    : KHS & nilai semester (bisa pilih semester)`,
    `• \`${p}lms logout\`        : Keluar & hapus sesi akun`,
    ``,
    `💡 _Contoh: Ketik \`${p}lms absen\` untuk semester terbaru, atau \`${p}lms absen 2\` untuk semester 2._`,
  ].join('\n');

  if (profile?.fotoUrl) {
    try {
      return await sock.sendMessage(
        m.chat,
        {
          image: { url: profile.fotoUrl },
          caption,
        },
        { quoted: m.raw || m }
      );
    } catch {}
  }

  return m.reply(caption);
}

/** Tampilkan daftar notifikasi & pending tasks */
async function handleNotif(m, account, token, p) {
  try {
    const latestInfo = await lms.resolveLatestActivePeriod(account.profile?.semesters, token);
    let pending = await lms.getPendingNotifications(latestInfo.classes, token);

    // Jika di periode terbaru belum ada sesi, periksa semester aktif sebelumnya
    if (pending.length === 0) {
      const prevClasses = await lms.getEnrolledClasses('20252', token);
      const prevPending = await lms.getPendingNotifications(prevClasses.slice(0, 4), token);
      if (prevPending.length > 0) pending = prevPending;
    }

    if (pending.length === 0) {
      return m.reply(
        `🎉 *SEMUA TUNTAS!*\n\n` +
          `> Tidak ada notifikasi tertunda atau presensi yang kosong saat ini.\n` +
          `> Pertahankan kehadiran dan keaktifan belajarmu!`
      );
    }

    const lines = [
      `🔔 *NOTIFIKASI TUGAS & ABSENSI* (${pending.length})`,
      `Berikut daftar pertemuan atau aktivitas yang belum kamu selesaikan:`,
      ``,
    ];

    pending.slice(0, 10).forEach((item, idx) => {
      lines.push(
        `*${idx + 1}. ${item.matkul}*`,
        `   • Pertemuan : #${item.pertemuanNomor} (${item.pertemuanJudul})`,
        `   • Status    : ❌ ${item.presensi === 'A' ? 'Belum Hadir / Absen' : item.presensi}`,
        `   • Tipe      : ${item.jenis.toUpperCase()}`,
        ``
      );
    });

    if (pending.length > 10) {
      lines.push(`_...dan masih ada ${pending.length - 10} item lainnya._\n`);
    }

    lines.push(`💡 _Buka rekap presensi dengan mengetik \`${p}lms absen\`_`);
    return m.reply(lines.join('\n'));
  } catch (err) {
    return m.reply(`❌ Gagal mengambil notifikasi LMS: ${err?.message || err}`);
  }
}

/** Tampilkan daftar kelas kuliah */
async function handleKelas(m, account, token, paramOption, p) {
  try {
    // Tentukan periode
    let periodeCode = '20261';
    let semesterNama = '2026/2027 Ganjil (Terbaru)';

    if (paramOption === '2' || paramOption === '20252') {
      periodeCode = '20252';
      semesterNama = '2025/2026 Genap';
    } else if (paramOption === '1' || paramOption === '20251') {
      periodeCode = '20251';
      semesterNama = '2025/2026 Ganjil';
    }

    const classes = await lms.getEnrolledClasses(periodeCode, token);
    if (!classes || classes.length === 0) {
      return m.reply(`ℹ️ Tidak ditemukan kelas aktif untuk periode ${semesterNama}.`);
    }

    const lines = [
      `📚 *DAFTAR KELAS KULIAH*`,
      `Semester : *${semesterNama}*`,
      `Total    : *${classes.length} Mata Kuliah*`,
      ``,
    ];

    classes.forEach((k, idx) => {
      const mk = k.mata_kuliah?.nama || 'Mata Kuliah';
      const sks = k.mata_kuliah?.sks || 0;
      const kelasNama = k.kelas?.nama || '-';
      const dosen = k.pengajar?.[0]?.nama_pengajar || 'Dosen Pengampu';
      const jadwal = k.jadwal?.[0]
        ? `Hari ${k.jadwal[0].hari} (${k.jadwal[0].jam_mulai?.slice(0, 5)} - ${k.jadwal[0].jam_selesai?.slice(0, 5)})`
        : 'Jadwal fleksibel';

      lines.push(
        `*${idx + 1}. ${mk}* [${sks} SKS]`,
        `   • Kelas  : ${kelasNama}`,
        `   • Dosen  : ${dosen}`,
        `   • Jadwal : ${jadwal}`,
        ``
      );
    });

    lines.push(
      `────────────────────────`,
      `💡 _Pilih semester lain:_`,
      `• \`${p}lms kelas 1\` (Semester 1 / 20251)`,
      `• \`${p}lms kelas 2\` (Semester 2 / 20252)`,
      `• \`${p}lms kelas 3\` (Semester 3 / 20261 - Terbaru)`
    );

    return m.reply(lines.join('\n'));
  } catch (err) {
    return m.reply(`❌ Gagal memuat daftar kelas: ${err?.message || err}`);
  }
}

/** Tampilkan rekap absen dengan opsi pilih semester */
async function handleAbsen(m, account, token, paramOption, p) {
  try {
    // Pilihan semester
    let targetPeriode = '20261';
    let semesterLabel = '2026/2027 Ganjil (Terbaru)';

    if (paramOption === '1' || paramOption === '20251') {
      targetPeriode = '20251';
      semesterLabel = 'Semester 1 (2025/2026 Ganjil)';
    } else if (paramOption === '2' || paramOption === '20252') {
      targetPeriode = '20252';
      semesterLabel = 'Semester 2 (2025/2026 Genap)';
    } else if (paramOption === '3' || paramOption === '20261') {
      targetPeriode = '20261';
      semesterLabel = 'Semester 3 (2026/2027 Ganjil - Terbaru)';
    } else if (!paramOption) {
      // Default: Cek apakah periode terbaru (20261) sudah punya pertemuan
      const checkClasses = await lms.getEnrolledClasses('20261', token, account);
      let hasMeetings = false;
      if (checkClasses && checkClasses.length > 0) {
        for (const k of checkClasses.slice(0, 2)) {
          const checkRecs = await lms.getStudentAttendance(k.id, token, account);
          if (checkRecs && checkRecs.length > 0) {
            hasMeetings = true;
            break;
          }
        }
      }
      // Jika periode terbaru belum ada sesi kuliah, beri tahu dan fallback ke semester sebelumnya
      if (!hasMeetings) {
        targetPeriode = '20252';
        semesterLabel = 'Semester 2 (2025/2026 Genap)';
      }
    }

    const classes = await lms.getEnrolledClasses(targetPeriode, token, account);
    if (!classes || classes.length === 0) {
      return m.reply(`ℹ️ Tidak ditemukan kelas kuliah untuk semester yang dipilih.`);
    }

    const lines = [
      `╭───「 *REKAP PRESENSI KULIAH* 」`,
      `│ • Mahasiswa : ${account.profile?.nama || account.username}`,
      `│ • Semester  : ${semesterLabel}`,
      `│ • Matkul    : ${classes.length} Kelas`,
      `╰────────────────────────`,
      ``,
      `📊 *RINCIAN KEHADIRAN PER MATKUL:*`,
      ``,
    ];

    let totalSemuaPertemuan = 0;
    let totalSemuaHadir = 0;

    for (const [idx, k] of classes.entries()) {
      const mkNama = k.mata_kuliah?.nama || 'Mata Kuliah';
      const sks = k.mata_kuliah?.sks || 0;
      let hadirCount = 0;
      let totalCount = 0;

      try {
        const records = await lms.getStudentAttendance(k.id, token, account);
        totalCount = records.length;
        hadirCount = records.filter((r) => r.is_hadir || r.presensi === 'H').length;
      } catch {}

      totalSemuaPertemuan += totalCount;
      totalSemuaHadir += hadirCount;

      const persen = totalCount > 0 ? Math.round((hadirCount / totalCount) * 100) : 0;
      const statusIcon = totalCount === 0 ? '⚪' : persen >= 80 ? '🟢' : persen >= 50 ? '🟡' : '🔴';

      lines.push(
        `*${idx + 1}. ${mkNama}* [${sks} SKS]`,
        `   • Status : ${statusIcon} *${totalCount > 0 ? persen + '%' : 'Belum Ada Sesi'}* (${hadirCount}/${totalCount} Pertemuan)`,
        ``
      );
    }

    const persentaseTotal =
      totalSemuaPertemuan > 0
        ? Math.round((totalSemuaHadir / totalSemuaPertemuan) * 100)
        : 100;

    lines.push(
      `────────────────────────`,
      `📈 *Rata-rata Kehadiran:* *${totalSemuaPertemuan > 0 ? persentaseTotal + '%' : '-'}* (${totalSemuaHadir}/${totalSemuaPertemuan} Hadir)`,
      ``,
      `💡 *PILIH SEMESTER LAIN:*`,
      `• \`${p}lms absen 1\` -> Rekap Semester 1 (20251)`,
      `• \`${p}lms absen 2\` -> Rekap Semester 2 (20252)`,
      `• \`${p}lms absen 3\` -> Rekap Semester 3 (20261 - Terbaru)`
    );

    return m.reply(lines.join('\n'));
  } catch (err) {
    return m.reply(`❌ Gagal memuat rekap presensi: ${err?.message || err}`);
  }
}

/** Tampilkan KHS dan nilai mahasiswa per semester */
async function handleNilai(m, account, token, paramOption, p) {
  try {
    let tahun = 2026;
    let semester = 2; // Default semester 2 (terakhir selesai)
    let semLabel = 'Semester 2 (2025/2026 Genap)';

    if (paramOption === '1' || paramOption === '20251') {
      tahun = 2026;
      semester = 1;
      semLabel = 'Semester 1 (2025/2026 Ganjil)';
    } else if (paramOption === '2' || paramOption === '20252') {
      tahun = 2026;
      semester = 2;
      semLabel = 'Semester 2 (2025/2026 Genap)';
    }

    const khs = await lms.getKhsGrades(account.username, tahun, semester, token);
    const ips = khs.ips?.angka || khs.ips?.ip || '-';
    const ipk = khs.ipk?.angka || khs.ipk?.ip || '-';
    const totalSks = khs.totalSks || 0;
    const maxSks = khs.sksMaxBerikutnya || 24;

    const lines = [
      `╭───「 *KARTU HASIL STUDI (KHS)* 」`,
      `│ • Mahasiswa : ${account.profile?.nama || account.username}`,
      `│ • Semester  : ${semLabel}`,
      `│ • IPS / IPK : *${ips}* / *${ipk}*`,
      `│ • SKS Diambil: ${totalSks} SKS`,
      `│ • Max SKS   : ${maxSks} SKS`,
      `╰────────────────────────`,
      ``,
      `📑 *DAFTAR NILAI MATA KULIAH:*`,
      ``,
    ];

    const nilais = khs.nilais?.data || [];
    if (nilais.length > 0) {
      nilais.forEach((n, idx) => {
        lines.push(
          `*${idx + 1}. ${n.namaMakul}* [${n.sks} SKS]`,
          `   • Nilai: *${n.simbol || '-'}* (${n.nilai || '-'}) | Bobot: ${n.bobot || '-'}`,
          ``
        );
      });
    } else {
      lines.push(`_Belum ada nilai yang dipublikasikan untuk semester ini._\n`);
    }

    lines.push(
      `────────────────────────`,
      `💡 *PILIH SEMESTER LAIN:*`,
      `• \`${p}lms nilai 1\` -> KHS Semester 1`,
      `• \`${p}lms nilai 2\` -> KHS Semester 2`
    );

    return m.reply(lines.join('\n'));
  } catch (err) {
    return m.reply(`❌ Gagal memuat nilai KHS: ${err?.message || err}`);
  }
}

export { config, handler };
export default { config, handler };


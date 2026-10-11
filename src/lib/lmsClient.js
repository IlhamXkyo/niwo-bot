/**
 * src/lib/lmsClient.js : STIKOM AMBON LMS CLIENT
 * ---------------------------------------------------------------------
 * Helper untuk integrasi LMS Civitas Siakad ITB STIKOM Ambon.
 * Mengelola autentikasi OAuth2, token session, biodata mahasiswa,
 * pemilihan semester dinamis, jadwal kelas, rekap kehadiran, dan notifikasi.
 * ---------------------------------------------------------------------
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://lms.stikomambon.siakad.tech';
const COLLEGE_ID = '122001';
const DB_PATH = path.join(process.cwd(), 'database', 'lms_users.json');

/** Muat database session pengguna LMS */
function loadLmsDb() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
            return {};
        }
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8') || '{}');
    } catch {
        return {};
    }
}

/** Simpan database session pengguna LMS */
function saveLmsDb(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[LMS DB] Gagal simpan:', e.message);
    }
}

/** Ambil kredensial user berdasarkan nomor WA (jid/phone) */
export function getLmsAccount(userJid) {
    const db = loadLmsDb();
    const cleanId = String(userJid || '').replace(/@.+$/, '').replace(/\D/g, '');
    return db[cleanId] || null;
}

/** Simpan kredensial user */
export function saveLmsAccount(userJid, { username, password, tokenData = null, profile = null }) {
    const db = loadLmsDb();
    const cleanId = String(userJid || '').replace(/@.+$/, '').replace(/\D/g, '');
    db[cleanId] = {
        username: String(username).trim(),
        password: String(password).trim(),
        tokenData: tokenData || db[cleanId]?.tokenData || null,
        profile: profile || db[cleanId]?.profile || null,
        updatedAt: Date.now()
    };
    saveLmsDb(db);
    return db[cleanId];
}

/** Hapus sesi login user */
export function deleteLmsAccount(userJid) {
    const db = loadLmsDb();
    const cleanId = String(userJid || '').replace(/@.+$/, '').replace(/\D/g, '');
    if (db[cleanId]) {
        delete db[cleanId];
        saveLmsDb(db);
        return true;
    }
    return false;
}

/**
 * Login ke LMS menggunakan OAuth2 Password Grant
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, isDown?: boolean }>}
 */
export async function loginLms(username, password) {
    try {
        const payload = {
            grant_type: 'password',
            client_id: 'web',
            username: String(username).trim(),
            password: String(password).trim()
        };

        const res = await fetch(`${BASE_URL}/v2/access_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'college-id': COLLEGE_ID,
                role: 'ROLE_MAHASISWA'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        });

        if (res.status === 200) {
            const data = await res.json();
            return { ok: true, data };
        }

        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.status?.message || errJson.message || errJson.detail || `HTTP ${res.status}`;
        return { ok: false, error: msg, isDown: false };
    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || /timeout|abort/i.test(err.message);
        const isDown = isTimeout || /ENOTFOUND|ECONNREFUSED|UND_ERR_CONNECT_TIMEOUT/i.test(err.message);
        return {
            ok: false,
            error: isDown ? 'Server LMS sedang down atau tidak dapat dihubungi.' : err.message,
            isDown
        };
    }
}

/**
 * Dapatkan token yang valid untuk user. Jika sudah expired atau belum ada, login otomatis.
 */
export async function getValidToken(account, userJid) {
    if (!account || !account.username || !account.password) {
        return { ok: false, error: 'Kredensial belum tersimpan' };
    }

    const tokenData = account.tokenData;
    // Cek apakah token masih berlaku (buffer 5 menit)
    if (tokenData?.access_token && tokenData?.expires_at && Date.now() < tokenData.expires_at - 300000) {
        return { ok: true, token: tokenData.access_token };
    }

    // Refresh dengan login ulang
    const loginResult = await loginLms(account.username, account.password);
    if (!loginResult.ok) {
        return loginResult;
    }

    const now = Date.now();
    const expiresIn = (loginResult.data.expires_in || 64800) * 1000;
    account.tokenData = {
        ...loginResult.data,
        expires_at: now + expiresIn
    };
    if (userJid) {
        saveLmsAccount(userJid, account);
    }

    return { ok: true, token: account.tokenData.access_token };
}

/** Fetch API LMS dengan otentikasi */
async function fetchLms(endpoint, token, account = null) {
    let currentToken = token;
    let res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            Authorization: `Bearer ${currentToken}`,
            'college-id': COLLEGE_ID,
            role: 'ROLE_MAHASISWA',
            Accept: 'application/json'
        },
        signal: AbortSignal.timeout(20000)
    });

    // Jika 401 Unauthorized / session expired dan ada kredensial account, login ulang otomatis
    if (res.status === 401 && account?.username && account?.password) {
        const reLogin = await loginLms(account.username, account.password);
        if (reLogin.ok && reLogin.data?.access_token) {
            currentToken = reLogin.data.access_token;
            account.tokenData = {
                ...reLogin.data,
                expires_at: Date.now() + (reLogin.data.expires_in || 64800) * 1000
            };
            res = await fetch(`${BASE_URL}${endpoint}`, {
                headers: {
                    Authorization: `Bearer ${currentToken}`,
                    'college-id': COLLEGE_ID,
                    role: 'ROLE_MAHASISWA',
                    Accept: 'application/json'
                },
                signal: AbortSignal.timeout(20000)
            });
        }
    }

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.status?.message || errJson.message || `HTTP ${res.status}`);
    }
    return res.json();
}

/** Ambil profil lengkap mahasiswa */
export async function getStudentProfile(username, token, account = null) {
    const [bioRes, mhsRes, smtRes] = await Promise.allSettled([
        fetchLms(`/v1/mahasiswa/${username}/biodata_singkat_web`, token, account),
        fetchLms(`/v1/mahasiswa/${username}`, token, account),
        fetchLms(`/v1/mahasiswa/${username}/tahun_semester`, token, account)
    ]);

    const bio = bioRes.status === 'fulfilled' ? bioRes.value : {};
    const mhs = mhsRes.status === 'fulfilled' ? mhsRes.value : {};
    const rawSemesters = smtRes.status === 'fulfilled' ? smtRes.value?.data || [] : [];

    const semesters = rawSemesters.map((s, idx) => ({
        index: idx + 1,
        tahun: s.tahun,
        semester: s.semester,
        nama: s.nama,
        code: `${s.tahun}${s.semester}`
    }));

    return {
        idMahasiswa: bio.idMahasiswa || username,
        nama: bio.nama || mhs.nama || username,
        prodi: bio.prodi || mhs.prodi?.nama || 'Teknik Informatika',
        kelas: bio.kelas?.nama || mhs.kelas?.nama || '-',
        dosen: bio.dosen?.nama || mhs.dosen?.nama || '-',
        hp: bio.hp || mhs.ponsel || '-',
        ipk: bio.ipk || '-',
        sks: bio.sks || 0,
        status: bio.status || mhs.namaStatus || 'Aktif',
        fotoUrl: bio.fotoContentUrl || mhs.fotoContentUrl || null,
        semesters
    };
}

/** Ambil kelas kuliah berdasarkan periode kode (mis: 20261, 20252, 20251) */
export async function getEnrolledClasses(periodeCode, token, account = null) {
    const res = await fetchLms(`/v2/lms/kelas_kuliah?periode=${encodeURIComponent(periodeCode)}`, token, account);
    return res.data || [];
}

/** Ambil seluruh pertemuan suatu kelas kuliah */
export async function getClassMeetings(kelasId, token, account = null) {
    const res = await fetchLms(`/v2/lms/kelas_kuliah/${encodeURIComponent(kelasId)}/pertemuan`, token, account);
    return res.data || [];
}

/** Ambil rekap kehadiran mahasiswa pada kelas kuliah */
export async function getStudentAttendance(kelasId, token, account = null) {
    const res = await fetchLms(`/v2/lms/kehadiran_mahasiswa/kelas_kuliah/${encodeURIComponent(kelasId)}/me`, token, account);
    return res.data || [];
}

/** Ambil Kartu Hasil Studi (KHS) dan nilai semester */
export async function getKhsGrades(username, tahun, semester, token, account = null) {
    const res = await fetchLms(`/v1/mahasiswa/${username}/khs?tahun=${tahun}&semester=${semester}`, token, account);
    return res;
}

/**
 * Cari periode terbaru yang sudah memiliki data kelas aktif
 */
export async function resolveLatestActivePeriod(semesters, token) {
    // Daftar kode periode yang diketahui memiliki data di sistem LMS:
    // 20261 (Ganjil 2026/2027), 20252 (Genap 2025/2026), 20251 (Ganjil 2025/2026)
    const priorityCodes = [
        { code: '20261', label: '2026/2027 Ganjil' },
        { code: '20252', label: '2025/2026 Genap' },
        { code: '20251', label: '2025/2026 Ganjil' }
    ];

    for (const item of priorityCodes) {
        try {
            const classes = await getEnrolledClasses(item.code, token);
            if (classes && classes.length > 0) {
                return { code: item.code, label: item.label, classes };
            }
        } catch {}
    }

    return { code: '20261', label: '2026/2027 Ganjil', classes: [] };
}

/**
 * Hitung notifikasi / pending tasks:
 * Mendeteksi pertemuan yang status presensinya belum Hadir (A / belum absen),
 * tugas yang belum diselesaikan, atau materi baru.
 */
export async function getPendingNotifications(classes, token) {
    const pendingList = [];

    for (const k of classes) {
        try {
            const records = await getStudentAttendance(k.id, token);
            for (const r of records) {
                if (!r.is_hadir || r.presensi !== 'H') {
                    pendingList.push({
                        type: 'presensi',
                        kelasId: k.id,
                        matkul: k.mata_kuliah?.nama || 'Mata Kuliah',
                        pertemuanNomor: r.pertemuan?.nomor || '?',
                        pertemuanJudul: r.pertemuan?.judul || `Pertemuan ${r.pertemuan?.nomor || ''}`,
                        presensi: r.presensi || 'Belum Absen',
                        jenis: r.pertemuan?.jenis || 'online',
                        detail: r.detail || []
                    });
                }
            }
        } catch {}
    }

    return pendingList;
}

export default {
    getLmsAccount,
    saveLmsAccount,
    deleteLmsAccount,
    loginLms,
    getValidToken,
    getStudentProfile,
    getEnrolledClasses,
    getClassMeetings,
    getStudentAttendance,
    getKhsGrades,
    resolveLatestActivePeriod,
    getPendingNotifications
};

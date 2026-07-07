const pool = require('../config/db');
const { ambilKelas, siswaTerdaftarDiKelas, ambilAktivitasDenganKelas } = require('../utils/ownership');

// Fungsi Membuat Aktivitas Baru (Khusus Guru)
// DIPERBARUI (Bagian 1): jalur eksperimen sekarang bisa membawa
// catatan_guru (panduan khusus guru, hasil AI Teaching Co-Pilot).
// Kolom ini ikut disimpan di jalur_aktivitas, terpisah dari `konten`
// yang dilihat siswa.
exports.buatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;
  const { judul, deskripsi, template_pedagogis, pertanyaan_pemantik, jalur } = req.body;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat membuat aktivitas.' });
  }

  if (!Array.isArray(jalur) || jalur.length < 2) {
    return res.status(400).json({ message: 'Minimal 2 jalur belajar (mis. Teks & Video) wajib diisi agar siswa punya pilihan otonomi.' });
  }

  const client = await pool.connect();
  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) {
      client.release();
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    if (kelas.guru_id !== guru_id) {
      client.release();
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    await client.query('BEGIN');

    const hasilAktivitas = await client.query(
      'INSERT INTO aktivitas (kelas_id, judul, deskripsi, template_pedagogis, pertanyaan_pemantik) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [kelas_id, judul, deskripsi, template_pedagogis, pertanyaan_pemantik]
    );
    const aktivitasBaru = hasilAktivitas.rows[0];

    const jalurTersimpan = [];
    for (let i = 0; i < jalur.length; i++) {
      const j = jalur[i];
      const hasilJalur = await client.query(
        'INSERT INTO jalur_aktivitas (aktivitas_id, tipe_jalur, label, konten, urutan, catatan_guru) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [aktivitasBaru.id, j.tipe_jalur, j.label, j.konten, i, j.catatan_guru || null]
      );
      jalurTersimpan.push(hasilJalur.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Aktivitas bermakna berhasil dirancang!',
      data: { ...aktivitasBaru, jalur: jalurTersimpan }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  } finally {
    client.release();
  }
};

// Fungsi Melihat Daftar Aktivitas (Bisa diakses Guru & Siswa)
// DIPERBARUI (Bagian 1): kalau peran = siswa, kolom catatan_guru
// DIHAPUS dari setiap jalur sebelum dikirim sebagai response. Ini
// bukan cuma "disembunyikan di UI" — datanya benar-benar tidak pernah
// sampai ke browser siswa, jadi tidak bisa dilihat lewat DevTools.
exports.lihatAktivitas = async (req, res) => {
  const { kelas_id } = req.params;
  const peran = req.user.peran;
  const user_id = req.user.id;

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    if (peran === 'guru' && kelas.guru_id !== user_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    if (peran === 'siswa') {
      const terdaftar = await siswaTerdaftarDiKelas(kelas_id, user_id);
      if (!terdaftar) {
        return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini. Gunakan kode kelas dari gurumu terlebih dahulu.' });
      }
    }

    const daftarAktivitas = await pool.query(
      'SELECT * FROM aktivitas WHERE kelas_id = $1 ORDER BY created_at ASC',
      [kelas_id]
    );

    const aktivitasIds = daftarAktivitas.rows.map(a => a.id);
    let jalurRows = [];
    if (aktivitasIds.length > 0) {
      const hasilJalur = await pool.query(
        'SELECT * FROM jalur_aktivitas WHERE aktivitas_id = ANY($1::int[]) ORDER BY urutan ASC',
        [aktivitasIds]
      );
      jalurRows = hasilJalur.rows;
    }

    const hasilAkhir = daftarAktivitas.rows.map(akt => ({
      ...akt,
      jalur: jalurRows
        .filter(j => j.aktivitas_id === akt.id)
        .map(j => {
          if (peran === 'siswa') {
            const { catatan_guru, ...jalurUntukSiswa } = j;
            return jalurUntukSiswa;
          }
          return j;
        })
    }));

    res.status(200).json(hasilAkhir);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// BARU: Siswa memilih salah satu jalur belajar. Ini mencatat log yang
// nanti jadi dasar data Otonomi & Keterlibatan pada MLI (menggantikan
// pendekatan lama yang cuma memakai durasi_belajar).
exports.pilihJalur = async (req, res) => {
  const { aktivitas_id } = req.params;
  const { jalur_id } = req.body;
  const peran = req.user.peran;
  const siswa_id = req.user.id;

  if (peran !== 'siswa') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya siswa yang dapat memilih jalur belajar.' });
  }
  if (!jalur_id) {
    return res.status(400).json({ message: 'jalur_id wajib disertakan.' });
  }

  try {
    const aktivitas = await ambilAktivitasDenganKelas(aktivitas_id);
    if (!aktivitas) {
      return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });
    }

    const terdaftar = await siswaTerdaftarDiKelas(aktivitas.kelas_id, siswa_id);
    if (!terdaftar) {
      return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini.' });
    }

    // Pastikan jalur_id memang milik aktivitas ini (mencegah IDOR silang aktivitas)
    const jalurCek = await pool.query(
      'SELECT * FROM jalur_aktivitas WHERE id = $1 AND aktivitas_id = $2',
      [jalur_id, aktivitas_id]
    );
    if (jalurCek.rows.length === 0) {
      return res.status(404).json({ message: 'Jalur belajar tidak ditemukan pada aktivitas ini.' });
    }

    const logBaru = await pool.query(
      'INSERT INTO log_pilihan_jalur (siswa_id, aktivitas_id, jalur_id) VALUES ($1, $2, $3) RETURNING *',
      [siswa_id, aktivitas_id, jalur_id]
    );

    res.status(201).json({ message: 'Pilihan jalur belajar tercatat.', data: logBaru.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
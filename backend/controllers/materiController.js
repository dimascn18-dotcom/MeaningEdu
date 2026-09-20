const pool = require('../config/db');
const { ambilKelas, siswaTerdaftarDiKelas } = require('../utils/ownership');
const { randomUUID } = require('node:crypto');
const { head, issueSignedToken, presignUrl } = require('@vercel/blob');

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const PDF_CONTENT_TYPE = 'application/pdf';

// Whitelist dimensi MLI — mencegah guru (atau request nakal) mengirim
// label dimensi yang tidak dikenal sistem.
const DIMENSI_VALID = ['relevansi', 'otonomi', 'kompetensi', 'keterlibatan', 'refleksi'];
const TIPE_MATERI_REGULER = ['teks', 'video', 'tautan'];

function validasiDimensi(dimensi) {
  return Array.isArray(dimensi)
    && dimensi.length > 0
    && dimensi.every(item => DIMENSI_VALID.includes(item));
}

function validasiMetadataPdf({ nama_file, mime_type, ukuran_byte }) {
  return typeof nama_file === 'string'
    && nama_file.toLowerCase().endsWith('.pdf')
    && mime_type === PDF_CONTENT_TYPE
    && Number.isInteger(ukuran_byte)
    && ukuran_byte > 0
    && ukuran_byte <= MAX_PDF_SIZE_BYTES;
}

// Guru mengunggah materi baru ke kelasnya, WAJIB dilabeli topik +
// minimal 1 dimensi MLI yang disasar.
exports.buatMateri = async (req, res) => {
  const { kelas_id } = req.params;
  const { judul, topik_fisika, tipe_materi, konten, dimensi_disasar } = req.body;
  const peran = req.user.peran;
  const guru_id = req.user.id;

  if (peran !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak! Hanya guru yang dapat mengunggah materi.' });
  }
  if (!judul || !topik_fisika) {
    return res.status(400).json({ message: 'Judul materi dan topik Fisika wajib diisi.' });
  }
  if (tipe_materi && !TIPE_MATERI_REGULER.includes(tipe_materi)) {
    return res.status(400).json({ message: 'Jenis materi tidak valid untuk endpoint ini.' });
  }
  if (!Array.isArray(dimensi_disasar) || dimensi_disasar.length === 0) {
    return res.status(400).json({ message: 'Pilih minimal 1 dimensi MLI yang disasar materi ini, agar Anda tahu aspek apa yang sedang dilatih.' });
  }
  const dimensiTidakValid = dimensi_disasar.filter(d => !DIMENSI_VALID.includes(d));
  if (dimensiTidakValid.length > 0) {
    return res.status(400).json({ message: `Dimensi tidak dikenali: ${dimensiTidakValid.join(', ')}` });
  }

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (kelas.guru_id !== guru_id) return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });

    const hasil = await pool.query(
      `INSERT INTO materi_kelas (kelas_id, judul, topik_fisika, tipe_materi, konten, dimensi_disasar)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [kelas_id, judul, topik_fisika, tipe_materi || 'teks', konten || '', dimensi_disasar]
    );
    res.status(201).json({ message: 'Materi berhasil diunggah dan dilabeli dimensi MLI!', data: hasil.rows[0] });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// Tahap 1 upload PDF: setelah ownership kelas terverifikasi, backend membuat
// pathname dan URL PUT berumur pendek. Binary tidak pernah melewati Express.
exports.buatUrlUploadPdf = async (req, res) => {
  const { kelas_id } = req.params;
  const { nama_file, mime_type, ukuran_byte } = req.body;

  if (!validasiMetadataPdf({ nama_file, mime_type, ukuran_byte })) {
    return res.status(400).json({
      message: `File harus PDF valid dengan ukuran maksimal ${Math.floor(MAX_PDF_SIZE_BYTES / 1024 / 1024)} MB.`
    });
  }

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (kelas.guru_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    const pathname = `materi/${kelas.id}/${randomUUID()}.pdf`;
    const validUntil = Date.now() + 10 * 60 * 1000;
    const signedToken = await issueSignedToken({
      pathname,
      operations: ['put'],
      validUntil,
      allowedContentTypes: [PDF_CONTENT_TYPE],
      maximumSizeInBytes: MAX_PDF_SIZE_BYTES
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      access: 'private',
      operation: 'put',
      pathname,
      validUntil,
      allowedContentTypes: [PDF_CONTENT_TYPE],
      maximumSizeInBytes: MAX_PDF_SIZE_BYTES,
      // Pathname sudah unik karena memakai UUID. Tanpa opsi ini Blob dapat
      // menambahkan suffix lagi sehingga pathname hasil upload tidak sama.
      addRandomSuffix: false,
      allowOverwrite: false
    });

    return res.status(200).json({
      upload_url: presignedUrl,
      blob_pathname: pathname,
      expires_at: new Date(validUntil).toISOString(),
      max_size_bytes: MAX_PDF_SIZE_BYTES
    });
  } catch (error) {
    console.error('Gagal membuat URL upload PDF:', error.message);
    return res.status(500).json({ message: 'Penyimpanan PDF belum tersedia. Coba lagi nanti.' });
  }
};

// Tahap 2: server memeriksa objek yang benar-benar tersimpan sebelum metadata
// dimasukkan ke Neon. URL privat atau token tidak pernah disimpan di database.
exports.selesaikanUploadPdf = async (req, res) => {
  const { kelas_id } = req.params;
const {
  judul,
  topik_fisika,
  dimensi_disasar,
  blob_pathname,
  blob_url,
  nama_file,
  mime_type,
  ukuran_byte
} = req.body;

  if (!judul || !topik_fisika || !validasiDimensi(dimensi_disasar)) {
    return res.status(400).json({ message: 'Judul, topik Fisika, dan minimal satu dimensi MLI wajib diisi.' });
  }
  if (!validasiMetadataPdf({ nama_file, mime_type, ukuran_byte })) {
    return res.status(400).json({ message: 'Metadata PDF tidak valid.' });
  }

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    if (kelas.guru_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }

    const prefix = `materi/${kelas.id}/`;
    if (typeof blob_pathname !== 'string' || !blob_pathname.startsWith(prefix) || !blob_pathname.endsWith('.pdf')) {
      return res.status(400).json({ message: 'Path PDF tidak valid untuk kelas ini.' });
    }

    if (typeof blob_url !== 'string') {
  return res.status(400).json({
    message: 'URL PDF dari penyimpanan tidak valid.'
  });
}

let parsedBlobUrl;

try {
  parsedBlobUrl = new URL(blob_url);
} catch (_) {
  return res.status(400).json({
    message: 'URL PDF dari penyimpanan tidak valid.'
  });
}

if (
  parsedBlobUrl.protocol !== 'https:' ||
  !parsedBlobUrl.hostname.endsWith('.private.blob.vercel-storage.com')
) {
  return res.status(400).json({
    message: 'URL PDF bukan berasal dari Private Blob MeaningEdu.'
  });
}

const metadata = await head(blob_url);

const storedPathname = String(metadata.pathname || '');
const storedContentType = String(metadata.contentType || '')
  .split(';')[0]
  .trim()
  .toLowerCase();

const storedSize = Number(metadata.size);
const expectedSize = Number(ukuran_byte);

console.log('Verifikasi PDF:', {
  path_cocok: storedPathname === blob_pathname,
  content_type_blob: storedContentType,
  content_type_diharapkan: PDF_CONTENT_TYPE,
  ukuran_blob: storedSize,
  ukuran_diharapkan: expectedSize
});

if (storedPathname !== blob_pathname) {
  return res.status(400).json({
    message: 'Path PDF di penyimpanan tidak cocok.'
  });
}

if (storedContentType !== PDF_CONTENT_TYPE) {
  return res.status(400).json({
    message: `Tipe file di penyimpanan tidak cocok (${storedContentType || 'tidak diketahui'}).`
  });
}

if (
  !Number.isFinite(storedSize) ||
  storedSize !== expectedSize
) {
  return res.status(400).json({
    message: `Ukuran PDF tidak cocok. Penyimpanan: ${storedSize} byte, file: ${expectedSize} byte.`
  });
}

if (storedSize > MAX_PDF_SIZE_BYTES) {
  return res.status(400).json({
    message: 'Ukuran PDF melebihi batas 10 MB.'
  });
};


    const hasil = await pool.query(
      `INSERT INTO materi_kelas
       (kelas_id, judul, topik_fisika, tipe_materi, konten, dimensi_disasar,
        blob_pathname, nama_file_asli, mime_type, ukuran_byte)
       VALUES ($1, $2, $3, 'pdf', '', $4, $5, $6, $7, $8)
       ON CONFLICT (blob_pathname) WHERE blob_pathname IS NOT NULL DO NOTHING
       RETURNING *`,
      [kelas.id, judul.trim(), topik_fisika.trim(), dimensi_disasar,
        blob_pathname, nama_file, mime_type, ukuran_byte]
    );

    if (hasil.rows.length === 0) {
      const existing = await pool.query(
        'SELECT * FROM materi_kelas WHERE blob_pathname = $1 AND kelas_id = $2',
        [blob_pathname, kelas.id]
      );
      return res.status(200).json({ message: 'PDF sebelumnya sudah tercatat.', data: existing.rows[0] });
    }
    return res.status(201).json({ message: 'Materi PDF berhasil disimpan.', data: hasil.rows[0] });
  } catch (error) {
    console.error('Gagal menyelesaikan upload PDF:', error.message);
    return res.status(500).json({ message: 'Gagal memverifikasi atau menyimpan PDF.' });
  }
};

exports.bukaPdf = async (req, res) => {
  const materiId = Number.parseInt(req.params.materi_id, 10);
  if (!Number.isInteger(materiId)) {
    return res.status(400).json({ message: 'ID materi tidak valid.' });
  }

  try {
    const hasil = await pool.query(
      `SELECT m.*, k.guru_id
       FROM materi_kelas m JOIN kelas k ON k.id = m.kelas_id
       WHERE m.id = $1 AND m.tipe_materi = 'pdf'`,
      [materiId]
    );
    const materi = hasil.rows[0];
    if (!materi) return res.status(404).json({ message: 'Materi PDF tidak ditemukan.' });

    if (req.user.peran === 'guru' && materi.guru_id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak! Materi ini bukan milik kelas Anda.' });
    }
    if (req.user.peran === 'siswa') {
      const terdaftar = await siswaTerdaftarDiKelas(materi.kelas_id, req.user.id);
      if (!terdaftar) return res.status(403).json({ message: 'Akses ditolak! Anda tidak terdaftar di kelas ini.' });
    }

    const validUntil = Date.now() + 5 * 60 * 1000;
    const signedToken = await issueSignedToken({
      pathname: materi.blob_pathname,
      operations: ['get'],
      validUntil
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      access: 'private', operation: 'get', pathname: materi.blob_pathname, validUntil, useCache: true
    });
    return res.status(200).json({
      url: presignedUrl,
      expires_at: new Date(validUntil).toISOString(),
      nama_file: materi.nama_file_asli
    });
  } catch (error) {
    console.error('Gagal membuka PDF:', error.message);
    return res.status(500).json({ message: 'PDF belum dapat dibuka. Coba lagi nanti.' });
  }
};

// Guru (kelasnya sendiri) & Siswa (yang sudah enroll) bisa melihat
// daftar materi kelas beserta label dimensinya.
exports.lihatMateriKelas = async (req, res) => {
  const { kelas_id } = req.params;
  const peran = req.user.peran;
  const user_id = req.user.id;

  try {
    const kelas = await ambilKelas(kelas_id);
    if (!kelas) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    if (peran === 'guru' && kelas.guru_id !== user_id) {
      return res.status(403).json({ message: 'Akses ditolak! Kelas ini bukan milik Anda.' });
    }
    if (peran === 'siswa') {
      const terdaftar = await siswaTerdaftarDiKelas(kelas_id, user_id);
      if (!terdaftar) return res.status(403).json({ message: 'Akses ditolak! Anda belum bergabung ke kelas ini.' });
    }

    const daftarMateri = await pool.query(
      `SELECT id, kelas_id, judul, topik_fisika, tipe_materi, konten,
              dimensi_disasar, nama_file_asli, mime_type, ukuran_byte, created_at
       FROM materi_kelas WHERE kelas_id = $1 ORDER BY created_at DESC`,
      [kelas_id]
    );
    res.status(200).json(daftarMateri.rows);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

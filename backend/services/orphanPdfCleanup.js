const { list, del } = require('@vercel/blob');

const GRACE_MS = 48 * 60 * 60 * 1000;
const MAX_PAGES = 10;
const PDF_PATH = /^materi\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

// Hanya hapus objek PDF lama yang tidak tercatat; kegagalan DB/Blob menghentikan
// proses tanpa menghapus objek berikutnya. ETag melindungi objek yang berubah.
async function cleanupOrphanPdfs({ pool, blob = { list, del }, now = Date.now() }) {
  let cursor;
  let scanned = 0;
  let deleted = 0;
  let hasMore = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await blob.list({ prefix: 'materi/', limit: 100, ...(cursor ? { cursor } : {}) });
    for (const item of result.blobs) {
      scanned++;
      if (!PDF_PATH.test(item.pathname) || !item.etag) continue;
      const age = now - new Date(item.uploadedAt).getTime();
      if (!Number.isFinite(age) || age < GRACE_MS) continue;

      const reference = await pool.query('SELECT 1 FROM materi_kelas WHERE blob_pathname = $1 LIMIT 1', [item.pathname]);
      if (reference.rows.length) continue;
      await blob.del(item.url, { ifMatch: item.etag });
      deleted++;
    }
    hasMore = Boolean(result.hasMore);
    if (!hasMore) break;
    if (!result.cursor || result.cursor === cursor) throw new Error('Cursor Blob tidak maju.');
    cursor = result.cursor;
  }
  return { scanned, deleted, has_more: hasMore };
}

module.exports = { cleanupOrphanPdfs };

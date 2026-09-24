const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupOrphanPdfs } = require('../services/orphanPdfCleanup');

const now = Date.parse('2026-09-24T00:00:00Z');
const old = new Date(now - 49 * 60 * 60 * 1000);
const recent = new Date(now - 47 * 60 * 60 * 1000);
const path = id => `materi/7/${id}.pdf`;
const entry = (pathname, uploadedAt) => ({ pathname, uploadedAt, etag: 'etag', url: `https://blob.test/${pathname}` });
const idA = '12345678-1234-1234-1234-123456789abc';
const idB = '12345678-1234-1234-1234-123456789abd';
const idC = '12345678-1234-1234-1234-123456789abe';

test('cleanup hanya menghapus PDF lama tanpa referensi dan dengan etag', async () => {
  const removed = [];
  const queried = [];
  const result = await cleanupOrphanPdfs({
    now,
    pool: { async query(_sql, params) { queried.push(params[0]); return { rows: params[0] === path(idB) ? [{ '?column?': 1 }] : [] }; } },
    blob: {
      async list() { return { blobs: [entry(path(idA), recent), entry(path(idB), old), entry(path(idC), old), entry('materi/7/unexpected.pdf', old)], hasMore: false }; },
      async del(url, options) { removed.push([url, options]); }
    }
  });
  assert.deepEqual(queried, [path(idB), path(idC)]);
  assert.deepEqual(removed, [[`https://blob.test/${path(idC)}`, { ifMatch: 'etag' }]]);
  assert.deepEqual(result, { scanned: 4, deleted: 1, has_more: false });
});

test('cleanup berhenti tanpa menghapus bila pemeriksaan database gagal', async () => {
  let deleted = false;
  await assert.rejects(cleanupOrphanPdfs({
    now,
    pool: { async query() { throw new Error('database offline'); } },
    blob: {
      async list() { return { blobs: [entry(path(idA), old)], hasMore: false }; },
      async del() { deleted = true; }
    }
  }), /database offline/);
  assert.equal(deleted, false);
});

test('cleanup meneruskan pagination dan menolak cursor yang tidak maju', async () => {
  const cursors = [];
  await assert.rejects(cleanupOrphanPdfs({
    now,
    pool: { async query() { throw new Error('Tidak boleh ada query untuk daftar kosong'); } },
    blob: {
      async list(options) { cursors.push(options.cursor); return { blobs: [], hasMore: true, cursor: 'stuck' }; },
      async del() { throw new Error('Tidak boleh menghapus'); }
    }
  }), /Cursor Blob tidak maju/);
  assert.deepEqual(cursors, [undefined, 'stuck']);
});

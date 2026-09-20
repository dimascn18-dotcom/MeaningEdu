const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/db');

async function runMigrations(db = pool, options = {}) {
  const migrationsDir = options.migrationsDir || path.join(__dirname, '..', 'migrations');
  const logger = options.logger || console;
  const files = fs.readdirSync(migrationsDir)
    .filter(file => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await db.query('SELECT filename FROM schema_migrations');
  const appliedFiles = new Set(applied.rows.map(row => row.filename));

  for (const file of files) {
    if (appliedFiles.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    logger.log(`Menjalankan ${file}...`);
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
  }

  logger.log('Semua migrasi database selesai.');
}

if (require.main === module) {
  runMigrations()
    .catch(error => {
      console.error('Migrasi gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { runMigrations };

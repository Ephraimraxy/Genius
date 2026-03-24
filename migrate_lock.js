import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_g0sYnURP6mHe@ep-small-night-a2z5zsqs-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
});

async function migrate() {
  try {
    await pool.query('ALTER TABLE papers ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;');
    console.log('Migration successful: is_locked column added.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();

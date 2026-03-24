import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_g0sYnURP6mHe@ep-small-night-a2z5zsqs-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
});

async function migrate() {
  try {
    console.log('Checking paper_references table...');
    
    // Add missing columns to paper_references
    await pool.query(`
      ALTER TABLE paper_references 
      ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS journal TEXT,
      ADD COLUMN IF NOT EXISTS year TEXT,
      ADD COLUMN IF NOT EXISTS authors TEXT,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS doi TEXT;
    `);
    
    console.log('Migration successful: paper_references table updated.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  // Check if FK constraint exists
  const fks = await client.query(`
    SELECT conname, conrelid::regclass AS table, confrelid::regclass AS foreign_table
    FROM pg_constraint
    WHERE contype = 'f' AND conrelid = 'action_template'::regclass
    ORDER BY conname
  `);
  console.log('Existing FKs on action_template:');
  fks.rows.forEach(r => console.log('  ', r.conname, '->', r.foreign_table));

  // Check if country_id FK exists
  const hasCountryFk = fks.rows.some(r => r.foreign_table === 'countries');
  console.log('\nHas country FK:', hasCountryFk);

  if (!hasCountryFk) {
    console.log('Adding FK constraint...');
    try {
      await client.query(`
        ALTER TABLE action_template
        ADD CONSTRAINT action_template_country_id_fkey
        FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL
      `);
      console.log('  ✓ FK constraint added');
    } catch (e) {
      console.error('  ✗ Error:', e.message);
    }
  }

  // Also check document_templates FKs
  console.log('\nFKs on document_templates:');
  const dtFks = await client.query(`
    SELECT conname, confrelid::regclass AS foreign_table
    FROM pg_constraint
    WHERE contype = 'f' AND conrelid = 'document_templates'::regclass
    ORDER BY conname
  `);
  dtFks.rows.forEach(r => console.log('  ', r.conname, '->', r.foreign_table));

  await client.end();
})();

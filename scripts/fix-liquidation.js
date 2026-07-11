require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await c.connect();

  // Get current sequence value
  const seq = await c.query("SELECT last_value FROM claims_liquidation_seq");
  console.log('Current sequence value:', seq.rows[0].last_value);

  // Rebuild liquidation_number from created_at order using row_number
  const r = await c.query(`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
      FROM claims
    )
    UPDATE claims c
    SET liquidation_number = 'L-' || LPAD(n.rn::TEXT, 9, '0')
    FROM numbered n
    WHERE c.id = n.id
    RETURNING c.liquidation_number
  `);
  console.log(`Updated ${r.rowCount} claims`);

  // Show results
  const r2 = await c.query('SELECT liquidation_number FROM claims ORDER BY liquidation_number LIMIT 5');
  console.log('Fixed values:');
  r2.rows.forEach((x) => console.log(' ', x.liquidation_number));

  // Align sequence with max
  await c.query(`
    SELECT setval('claims_liquidation_seq',
      COALESCE((SELECT COUNT(*) FROM claims), 1))
  `);
  console.log('Sequence aligned to claim count');

  await c.end();
})();

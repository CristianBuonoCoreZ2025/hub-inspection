require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const claimRes = await client.query(
      'SELECT id FROM claims WHERE liquidation_number = $1',
      ['L-000000141']
    );
    const claimId = claimRes.rows[0]?.id;
    if (!claimId) {
      console.log('Siniestro no encontrado');
      return;
    }

    await client.query('BEGIN');

    // Borrar la gestión INS y su sesión de inspección en cascada
    const delRes = await client.query(
      `DELETE FROM claim_actions
       WHERE claim_id = $1
         AND action_template_id IN (
           SELECT id FROM action_template WHERE code = 'INS'
         )
       RETURNING id`,
      [claimId]
    );

    await client.query('COMMIT');
    console.log(`Gestiones INS eliminadas: ${delRes.rowCount}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

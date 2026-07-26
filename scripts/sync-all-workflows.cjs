require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL no configurada en .env.local');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();

    if (dryRun) {
      await client.query('BEGIN');
    }

    const claimsRes = await client.query(
      'SELECT id, liquidation_number FROM claims ORDER BY liquidation_number'
    );

    console.log(`Siniestros encontrados: ${claimsRes.rowCount}`);

    let totalCreated = 0;

    for (const claim of claimsRes.rows) {
      const res = await client.query(
        'SELECT action_template_id, name, created FROM sync_workflow_for_claim($1)',
        [claim.id]
      );

      const createdActions = res.rows.filter((r) => r.created);
      if (createdActions.length > 0) {
        totalCreated += createdActions.length;
        const names = createdActions.map((r) => r.name).join(', ');
        console.log(`${claim.liquidation_number}: +${createdActions.length} (${names})`);
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n[DRY-RUN] No se persistieron cambios.');
    }

    console.log(`\nTotal gestiones creadas: ${totalCreated}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

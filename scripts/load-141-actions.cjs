require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurada en .env.local');
  process.exit(1);
}

const LIQUIDATION = 'L-000000141';
const CODES = ['COB', 'AVI', 'CIN', 'SOL', 'INS'];

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    const claimRes = await client.query(
      'SELECT id, company_id, country_id, business_line_id, event_id, adjuster_id, assigned_adjuster_id, assistant_id, inspector_id, auditor_id, dispatcher_id FROM claims WHERE liquidation_number = $1',
      [LIQUIDATION]
    );
    if (claimRes.rows.length === 0) {
      console.log('No se encontró siniestro', LIQUIDATION);
      return;
    }
    const claim = claimRes.rows[0];
    console.log('Siniestro:', claim.id);

    const statusRes = await client.query(
      "SELECT id FROM lookup_catalog WHERE category = 'action_status' AND code = 'todo' LIMIT 1"
    );
    if (statusRes.rows.length === 0) throw new Error('No se encontró estado todo');
    const todoStatusId = statusRes.rows[0].id;

    const templateRes = await client.query(
      `SELECT id, code, name, description, action_type_id, action_features_id, line_business_id, default_issuer_role, is_blocker
       FROM action_template
       WHERE code = ANY($1::text[])
         AND (company_id = $2 OR company_id IS NULL)
         AND (country_id = $3 OR country_id IS NULL)
         AND (line_business_id = $4 OR line_business_id IS NULL)
         AND (event_id = $5 OR event_id IS NULL)`,
      [CODES, claim.company_id, claim.country_id, claim.business_line_id, claim.event_id]
    );

    const roleMap = {
      adjuster: claim.adjuster_id,
      assigned_adjuster: claim.assigned_adjuster_id,
      assistant: claim.assistant_id,
      inspector: claim.inspector_id,
      auditor: claim.auditor_id,
      dispatcher: claim.dispatcher_id,
    };

    const createdBy = claim.adjuster_id || claim.assigned_adjuster_id || null;
    const inserted = [];
    for (const code of CODES) {
      const tpl = templateRes.rows.find((t) => t.code === code);
      if (!tpl) {
        console.log(`⚠️ No se encontró plantilla para ${code}`);
        continue;
      }
      const issuerId = roleMap[tpl.default_issuer_role] || null;
      const actionData = code === 'INS'
        ? JSON.stringify({ coord_type: 'remote', coord_fecha: new Date().toISOString() })
        : JSON.stringify({});

      const ins = await client.query(
        `INSERT INTO claim_actions (
          claim_id, action_template_id, action_type_id, action_features_id, line_business_id,
          name, description, code, action_data, action_status_id, origin, is_automatic,
          is_active, is_blocker, issuer_id, created_on, created_by, updated_on, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'W', true, true, $11, $12, now(), $13, now(), $13)
        RETURNING id`,
        [
          claim.id, tpl.id, tpl.action_type_id, tpl.action_features_id, tpl.line_business_id,
          tpl.name, tpl.description, tpl.code, actionData, todoStatusId, tpl.is_blocker, issuerId, createdBy,
        ]
      );
      inserted.push({ code, id: ins.rows[0].id, name: tpl.name });
      console.log(`✅ Insertada gestión ${code}: ${tpl.name} (${ins.rows[0].id})`);
    }

    await client.query('COMMIT');
    console.log(`\nTotal gestiones cargadas: ${inserted.length}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

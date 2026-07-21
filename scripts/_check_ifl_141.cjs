require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING });

(async () => {
  await c.connect();

  // 1. Buscar el claim por liquidation_number
  const { rows: claims } = await c.query(
    `SELECT id, claim_number, liquidation_number
     FROM claims
     WHERE liquidation_number = 'L-000000141'
     LIMIT 1`
  );

  if (claims.length === 0) {
    console.log('❌ No se encontró el claim L-000000141');
    await c.end();
    return;
  }

  const claim = claims[0];
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Claim encontrado:`);
  console.log(`  ID: ${claim.id}`);
  console.log(`  Claim number: ${claim.claim_number}`);
  console.log(`  Liquidation number: ${claim.liquidation_number}`);
  console.log(`  Status: (n/a)`);
  console.log('═══════════════════════════════════════════════════════════');

  // 2. Buscar todas las gestiones del claim, especialmente IFL
  const { rows: actions } = await c.query(
    `SELECT ca.id, ca.name, ca.code, ca.action_status_id, ca.issued_on, ca.issued_by,
            ca.action_data,
            at.code AS template_code,
            ls.code AS status_code, ls.name AS status_name
     FROM claim_actions ca
     LEFT JOIN action_template at ON ca.action_template_id = at.id
     LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
     WHERE ca.claim_id = $1
     ORDER BY ca.created_on ASC`,
    [claim.id]
  );

  console.log(`\nGestiones del claim (${actions.length} total):`);
  console.log('───────────────────────────────────────────────────────────');
  for (const a of actions) {
    const flag = a.template_code === 'IFL' || a.code === 'IFL' ? ' ⚠️ IFL' : '';
    console.log(`  [${a.status_code || '???'}] ${a.template_code || a.code || '???'} — ${a.name}${flag}`);
    console.log(`      id: ${a.id}`);
    console.log(`      issued_on: ${a.issued_on || '(no emitida)'}`);
    if (a.action_data) {
      const keys = Object.keys(a.action_data || {});
      if (keys.length > 0) {
        console.log(`      action_data keys: ${keys.join(', ')}`);
      }
    }
  }

  // 3. Buscar específicamente la IFL
  const iflActions = actions.filter(a => a.template_code === 'IFL' || a.code === 'IFL');
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`IFL encontradas: ${iflActions.length}`);
  iflActions.forEach((ifl, i) => {
    console.log(`  IFL #${i + 1}:`);
    console.log(`    id: ${ifl.id}`);
    console.log(`    status: ${ifl.status_code} (${ifl.status_name})`);
    console.log(`    issued_on: ${ifl.issued_on || '(no emitida)'}`);
    console.log(`    action_data: ${JSON.stringify(ifl.action_data, null, 2)}`);
  });

  // 4. Verificar si hay gestiones dependientes de la IFL
  // (gestiones cuyo action_template depende de IFL en el workflow)
  if (iflActions.length > 0) {
    const iflIds = iflActions.map(a => a.id);
    const { rows: dependents } = await c.query(
      `SELECT ca.id, ca.name, ca.code, at.code AS template_code, ls.code AS status_code
       FROM claim_actions ca
       LEFT JOIN action_template at ON ca.action_template_id = at.id
       LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
       WHERE ca.claim_id = $1
         AND ca.id != ALL($2::uuid[])
         AND ca.created_on > (SELECT MIN(created_on) FROM claim_actions WHERE id = ANY($2::uuid[]))
       ORDER BY ca.created_on ASC`,
      [claim.id, iflIds]
    );

    console.log(`\nGestiones creadas DESPUÉS de la IFL (posibles dependientes): ${dependents.length}`);
    dependents.forEach(d => {
      console.log(`  [${d.status_code}] ${d.template_code || d.code} — ${d.name} (id: ${d.id})`);
    });
  }

  // 5. Verificar si hay documentos asociados a la IFL
  if (iflActions.length > 0) {
    const iflIds = iflActions.map(a => a.id);
    const { rows: docs } = await c.query(
      `SELECT id, version, file_type, file_name, source, is_current, created_at
       FROM claim_action_documents
       WHERE claim_action_id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [iflIds]
    );
    console.log(`\nDocumentos asociados a la IFL: ${docs.length}`);
    docs.forEach(d => {
      console.log(`  v${d.version} [${d.file_type}] ${d.file_name} (source: ${d.source}, current: ${d.is_current})`);
    });
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log('Resumen para decidir:');
  console.log(`  - IFL a eliminar: ${iflActions.length}`);
  iflActions.forEach(ifl => {
    console.log(`    • ${ifl.id} (status: ${ifl.status_code})`);
  });

  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });

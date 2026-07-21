require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING });

(async () => {
  await c.connect();

  const iflId = '0f66493e-42cb-4615-95af-d0345d84c5ef';
  const claimId = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';

  // Verificar que la IFL sigue existiendo y está en todo
  const { rows: check } = await c.query(
    `SELECT id, code, action_status_id, action_data
     FROM claim_actions
     WHERE id = $1 AND claim_id = $2`,
    [iflId, claimId]
  );

  if (check.length === 0) {
    console.log('⚠️ La IFL ya no existe (fue eliminada antes?)');
    await c.end();
    return;
  }

  console.log('IFL a eliminar:');
  console.log(`  id: ${check[0].id}`);
  console.log(`  code: ${check[0].code}`);
  console.log(`  action_data: ${JSON.stringify(check[0].action_data)}`);

  // Eliminar la IFL
  await c.query('DELETE FROM claim_actions WHERE id = $1 AND claim_id = $2', [iflId, claimId]);

  // Verificar eliminación
  const { rows: verify } = await c.query(
    'SELECT id FROM claim_actions WHERE id = $1',
    [iflId]
  );

  if (verify.length === 0) {
    console.log('\n✓ IFL eliminada correctamente');
    console.log('  El claim L-000000141 ya no tiene gestión IFL');
    console.log('  Para recrearla: abrí el claim → botón "Nueva Gestión" → elegí "Informe de Liquidación"');
  } else {
    console.log('\n❌ Error: la IFL sigue existiendo');
  }

  // Mostrar gestiones restantes del claim
  const { rows: remaining } = await c.query(
    `SELECT ca.code, ca.name, ls.code AS status_code
     FROM claim_actions ca
     LEFT JOIN lookup_catalog ls ON ca.action_status_id = ls.id
     WHERE ca.claim_id = $1
     ORDER BY ca.created_on ASC`,
    [claimId]
  );

  console.log(`\nGestiones restantes del claim (${remaining.length}):`);
  remaining.forEach(r => {
    console.log(`  [${r.status_code}] ${r.code} — ${r.name}`);
  });

  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });

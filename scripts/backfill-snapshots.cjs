require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // 1. Backfill: para cada RES sin parent_snapshot, buscar el COB padre más reciente emitido
  // y copiar el snapshot
  const resActions = await c.query(`
    SELECT ca.id, ca.claim_id, ca.action_data
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE at.code = 'RES' AND ca.is_active = true AND lc.code != 'rejected'
  `);
  console.log(`RES sin snapshot: ${resActions.rows.length}`);

  for (const res of resActions.rows) {
    // Buscar el COB más reciente emitido para este claim
    const cob = await c.query(`
      SELECT ca.id
      FROM claim_actions ca
      JOIN action_template at ON at.id = ca.action_template_id
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = $1 AND at.code = 'COB' AND ca.is_active = true AND lc.code = 'issued'
      ORDER BY ca.issued_on DESC LIMIT 1
    `, [res.claim_id]);

    if (cob.rows.length === 0) {
      console.log(`  RES ${res.id}: no se encontró COB padre`);
      continue;
    }

    const cobId = cob.rows[0].id;
    // Obtener el snapshot de coberturas del COB
    const snapshotResult = await c.query(`SELECT get_coverages_snapshot($1) as snapshot`, [cobId]);
    const snapshot = snapshotResult.rows[0].snapshot;

    // Obtener action_data del COB padre
    const cobData = await c.query(`SELECT action_data FROM claim_actions WHERE id = $1`, [cobId]);
    const parentActionData = cobData.rows[0].action_data || {};

    // Actualizar el RES con el snapshot
    const newData = {
      ...(res.action_data || {}),
      parent_snapshot: snapshot,
      parent_action_data: parentActionData,
      parent_action_id: cobId,
      parent_code: 'COB',
    };

    await c.query(`UPDATE claim_actions SET action_data = $1 WHERE id = $2`, [JSON.stringify(newData), res.id]);
    console.log(`  RES ${res.id}: snapshot actualizado desde COB ${cobId} (${snapshot.length} coberturas)`);
  }

  // 2. Backfill para PCA sin snapshot
  const pcaActions = await c.query(`
    SELECT ca.id, ca.claim_id, ca.action_data
    FROM claim_actions ca
    JOIN action_template at ON at.id = ca.action_template_id
    JOIN lookup_catalog lc ON lc.id = ca.action_status_id
    WHERE at.code = 'PCA' AND ca.is_active = true AND lc.code != 'rejected'
  `);
  console.log(`\nPCA sin snapshot: ${pcaActions.rows.length}`);

  for (const pca of pcaActions.rows) {
    const res = await c.query(`
      SELECT ca.id
      FROM claim_actions ca
      JOIN action_template at ON at.id = ca.action_template_id
      JOIN lookup_catalog lc ON lc.id = ca.action_status_id
      WHERE ca.claim_id = $1 AND at.code = 'RES' AND ca.is_active = true AND lc.code = 'issued'
      ORDER BY ca.issued_on DESC LIMIT 1
    `, [pca.claim_id]);

    if (res.rows.length === 0) {
      console.log(`  PCA ${pca.id}: no se encontró RES padre`);
      continue;
    }

    const resId = res.rows[0].id;
    const snapshotResult = await c.query(`SELECT get_reserves_snapshot($1) as snapshot`, [resId]);
    const snapshot = snapshotResult.rows[0].snapshot;

    const resData = await c.query(`SELECT action_data FROM claim_actions WHERE id = $1`, [resId]);
    const parentActionData = resData.rows[0].action_data || {};

    const newData = {
      ...(pca.action_data || {}),
      parent_snapshot: snapshot,
      parent_action_data: parentActionData,
      parent_action_id: resId,
      parent_code: 'RES',
    };

    await c.query(`UPDATE claim_actions SET action_data = $1 WHERE id = $2`, [JSON.stringify(newData), pca.id]);
    console.log(`  PCA ${pca.id}: snapshot actualizado desde RES ${resId} (${snapshot.length} reservas)`);
  }

  await c.end();
  console.log('\n✅ Backfill completado');
}
main().catch(e => { console.error(e.message); process.exit(1); });

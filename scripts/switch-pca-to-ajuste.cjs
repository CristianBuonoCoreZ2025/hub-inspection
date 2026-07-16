require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const ajusteFeatureId = 'c708929f-e2f5-4a93-a42e-8e8abda49084';
  const ajusteScreenId = 'a7cdbf73-0aff-4748-84c7-9e8e42c1fa2b';
  const ajuFeatureId = 'a1000001-0000-0000-0000-000000000004';

  // 1. Asignar screen "ajuste" a AJUSTE
  await c.query(`
    UPDATE action_features SET screen_id = $1 WHERE id = $2
  `, [ajusteScreenId, ajusteFeatureId]);
  console.log(`✅ ActionFeature AJUSTE apunta a screen ajuste`);

  // 2. Cambiar el template PCA para que use AJUSTE en vez de AJU
  const updated = await c.query(`
    UPDATE action_template SET action_features_id = $1 WHERE action_features_id = $2 RETURNING id, code, name
  `, [ajusteFeatureId, ajuFeatureId]);
  console.log(`✅ Templates PCA actualizados: ${updated.rows.length}`);
  for (const r of updated.rows) console.log(`  ${r.code} | ${r.name}`);

  // 3. Verificar si no hay más templates usando AJU
  const remaining = await c.query(`
    SELECT at.id, at.code, at.name FROM action_template at WHERE at.action_features_id = $1
  `, [ajuFeatureId]);
  console.log(`\nTemplates restantes con AJU: ${remaining.rows.length}`);
  for (const r of remaining.rows) console.log(`  ${r.code} | ${r.name}`);

  // 4. Actualizar claim_actions que usan AJU para que usen AJUSTE
  const claimActions = await c.query(`
    UPDATE claim_actions SET action_features_id = $1 WHERE action_features_id = $2 RETURNING id, code
  `, [ajusteFeatureId, ajuFeatureId]);
  console.log(`✅ ClaimActions actualizadas: ${claimActions.rows.length}`);
  for (const r of claimActions.rows) console.log(`  ${r.code} (${r.id})`);

  // 5. Desactivar o borrar AJU
  if (remaining.rows.length === 0) {
    await c.query(`DELETE FROM action_features WHERE id = $1`, [ajuFeatureId]);
    console.log(`✅ ActionFeature AJU eliminada`);
  } else {
    await c.query(`UPDATE action_features SET is_active = false WHERE id = $1`, [ajuFeatureId]);
    console.log(`⚠️ ActionFeature AJU desactivada (aún tiene templates asociados)`);
  }

  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

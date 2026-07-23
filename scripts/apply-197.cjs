require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const sql = fs.readFileSync('migrations/197_auto_session_find_by_prefix.sql', 'utf8');
  await c.query(sql);
  console.log("✓ Migración 197 aplicada");

  // Probar la función find_coord_field con datos reales
  const test = await c.query(`
    SELECT find_coord_field('{"coord_type_1": "remote", "coord_fecha_1": "2026-07-23T15:00", "coord_inspector_1": "abc-123"}'::jsonb, 'coord_type', 'coord_inspection_type') as type,
           find_coord_field('{"coord_type_1": "remote", "coord_fecha_1": "2026-07-23T15:00", "coord_inspector_1": "abc-123"}'::jsonb, 'coord_fecha') as fecha,
           find_coord_field('{"coord_type_1": "remote", "coord_fecha_1": "2026-07-23T15:00", "coord_inspector_1": "abc-123"}'::jsonb, 'coord_inspector') as inspector,
           find_coord_field('{"coord_fecha_recoord": "2026-08-01", "coord_fecha_1": "2026-07-23T15:00"}'::jsonb, 'coord_fecha') as fecha_no_recoord
  `);
  console.log("\nTest find_coord_field:");
  console.log("  type:", test.rows[0].type);
  console.log("  fecha:", test.rows[0].fecha);
  console.log("  inspector:", test.rows[0].inspector);
  console.log("  fecha (excluye recoord):", test.rows[0].fecha_no_recoord);

  await c.end();
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });

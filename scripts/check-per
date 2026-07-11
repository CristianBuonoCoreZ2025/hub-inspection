const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  const r1 = await client.query(
    "SELECT user_type, section, can_view, can_edit, can_create, can_delete FROM user_type_permissions WHERE section = 'catalogos_gestiones' ORDER BY user_type"
  );
  console.log('=== user_type_permissions (catalogos_gestiones) ===');
  if (r1.rows.length === 0) console.log('  (sin filas — hereda de catalogos)');
  r1.rows.forEach(r => console.log('  ' + r.user_type + ': view=' + r.can_view + ' edit=' + r.can_edit + ' create=' + r.can_create + ' delete=' + r.can_delete));

  const r2 = await client.query(
    "SELECT user_type, section, field_name, can_edit FROM field_permissions WHERE section = 'catalogos_gestiones' ORDER BY user_type, field_name"
  );
  console.log('\n=== field_permissions (catalogos_gestiones) ===');
  if (r2.rows.length === 0) console.log('  (sin filas — todo editable por default)');
  let lastType = '';
  r2.rows.forEach(r => {
    if (r.user_type !== lastType) {
      console.log('  [' + r.user_type + ']');
      lastType = r.user_type;
    }
    console.log('    ' + r.field_name + ' → ' + (r.can_edit ? 'editable' : 'RESTRINGIDO'));
  });

  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });

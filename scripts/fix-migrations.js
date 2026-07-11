require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();

  // 1. Marcar migraciones 66-77 como ejecutadas (ya están en la BD)
  const alreadyApplied = [
    '66_create_claim_actions_system.sql',
    '67_create_user_types_system.sql',
    '68_password_reset_codes.sql',
    '69_user_type_permissions.sql',
    '70_add_action_fk_constraints.sql',
    '71_subsection_permissions.sql',
    '72_claims_inspecciones_subsections.sql',
    '73_create_persons_master.sql',
    '74_backfill_persons_from_participants.sql',
    '75_add_person_type.sql',
    '76_gestiones_permissions.sql',
    '77_add_country_to_action_template.sql',
  ];

  for (const f of alreadyApplied) {
    await client.query(
      'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [f]
    );
    console.log('  Marked as executed:', f);
  }

  // 2. Aplicar migración 78 (document_templates)
  const sql78 = fs.readFileSync('migrations/78_create_document_templates.sql', 'utf-8');
  console.log('\nApplying migration 78...');
  await client.query(sql78);
  await client.query(
    'INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    ['78_create_document_templates.sql']
  );
  console.log('  ✓ 78_create_document_templates.sql applied');

  console.log('\nDone!');
  await client.end();
})();

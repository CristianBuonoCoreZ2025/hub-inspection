require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NHOST_DATABASE_URL;

let warnings = 0;
let errors = 0;
let info = [];

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function critical(msg) { errors++; console.log('❌ CRÍTICO: ' + msg); }
function warn(msg) { warnings++; console.log('⚠️  ADVERTENCIA: ' + msg); }
function ok(msg) { console.log('✅ ' + msg); }

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    const { rows: dbName } = await client.query('SELECT current_database() AS db');
    console.log(`Auditoría completa del sistema — DB: ${dbName[0].db}`);

    // 1. Migraciones pendientes
    logSection('1. Migraciones');
    const files = fs.readdirSync(path.join(process.cwd(), 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const appliedCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='_migrations'"
    );
    const nameCol = appliedCols.rows.find((r) => ['name','filename','migration_name','id'].includes(r.column_name))?.column_name || appliedCols.rows[0]?.column_name;
    if (!nameCol) throw new Error('No se pudo determinar la columna de _migrations');
    const appliedRes = await client.query(`SELECT ${nameCol} AS name FROM _migrations`);
    const applied = new Set(appliedRes.rows.map((r) => r.name));
    const pending = files.filter((f) => !applied.has(f));
    const extra = [...applied].filter((n) => !files.includes(n));
    if (pending.length === 0 && extra.length === 0) ok('Todas las migraciones del disco están aplicadas y sin extras.');
    if (pending.length > 0) {
      critical(`${pending.length} migración(es) en disco no aplicadas:`);
      pending.forEach((m) => console.log(`   - ${m}`));
    }
    if (extra.length > 0) {
      warn(`${extra.length} migración(es) aplicadas en DB que no están en disco:`);
      extra.forEach((m) => console.log(`   - ${m}`));
    }

    // 2. Workflows
    logSection('2. Workflows');
    const onlineNoSteps = await client.query(
      `SELECT wc.id, wc.country_id, wc.business_line_id, wc.event_id, wc.claim_status_id
       FROM workflow_configs wc
       LEFT JOIN workflow_steps ws ON ws.workflow_config_id = wc.id
       WHERE wc.status = 'online' AND ws.id IS NULL`
    );
    if (onlineNoSteps.rows.length > 0) {
      critical(`${onlineNoSteps.rows.length} workflow(s) online sin pasos:`);
      onlineNoSteps.rows.forEach((r) => console.log(`   - ${r.id}`));
    }

    const multiOnline = await client.query(
      `SELECT country_id, business_line_id, event_id, claim_status_id, COUNT(*) AS cnt
       FROM workflow_configs
       WHERE status = 'online'
       GROUP BY country_id, business_line_id, event_id, claim_status_id
       HAVING COUNT(*) > 1`
    );
    if (multiOnline.rows.length > 0) {
      critical(`${multiOnline.rows.length} combinación(es) con más de un workflow online:`);
      multiOnline.rows.forEach((r) => console.log(`   - ${r.country_id}/${r.business_line_id}/${r.event_id}/${r.claim_status_id} = ${r.cnt}`));
    }

    const stepsNoTemplate = await client.query(
      `SELECT ws.id, ws.workflow_config_id, ws.action_template_id
       FROM workflow_steps ws
       LEFT JOIN action_template at ON at.id = ws.action_template_id
       WHERE at.id IS NULL OR at.is_active = false`
    );
    if (stepsNoTemplate.rows.length > 0) {
      critical(`${stepsNoTemplate.rows.length} workflow_steps apuntan a plantillas inexistentes/inactivas.`);
    }

    const stepsBadDepends = await client.query(
      `SELECT ws.id, ws.workflow_config_id, ws.depends_on_template_id
       FROM workflow_steps ws
       WHERE ws.depends_on_template_id IS NOT NULL
         AND ws.depends_on_template_id NOT IN (
           SELECT action_template_id FROM workflow_steps ws2 WHERE ws2.workflow_config_id = ws.workflow_config_id
         )`
    );
    if (stepsBadDepends.rows.length > 0) {
      warn(`${stepsBadDepends.rows.length} workflow_steps dependen de un template que no está en el mismo workflow.`);
    }

    const orphanDeps = await client.query(
      `SELECT d.parent_code, d.child_code
       FROM action_template_dependencies d
       LEFT JOIN action_template pt ON pt.code = d.parent_code
       LEFT JOIN action_template ct ON ct.code = d.child_code
       WHERE pt.id IS NULL OR ct.id IS NULL`
    );
    if (orphanDeps.rows.length > 0) {
      critical(`${orphanDeps.rows.length} dependencias con códigos de template inexistentes:`);
      orphanDeps.rows.forEach((r) => console.log(`   - ${r.parent_code} -> ${r.child_code}`));
    }

    if (
      onlineNoSteps.rows.length === 0 &&
      multiOnline.rows.length === 0 &&
      stepsNoTemplate.rows.length === 0 &&
      stepsBadDepends.rows.length === 0 &&
      orphanDeps.rows.length === 0
    ) ok('Workflows sin problemas estructurales.');

    // 3. Gestiones (claim_actions)
    logSection('3. Gestiones (claim_actions)');
    const dupActions = await client.query(
      `SELECT claim_id, action_template_id, COUNT(*) AS cnt
       FROM claim_actions
       WHERE is_active = true
       GROUP BY claim_id, action_template_id
       HAVING COUNT(*) > 1`
    );
    if (dupActions.rows.length > 0) {
      critical(`${dupActions.rows.length} combinaciones claim+template con gestiones activas duplicadas:`);
      dupActions.rows.slice(0, 10).forEach((r) => console.log(`   - claim=${r.claim_id} template=${r.action_template_id} cnt=${r.cnt}`));
    }

    const inconsistentIssue = await client.query(
      `SELECT ca.id, at.code, lc.code AS status_code, ca.issued_on
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       JOIN lookup_catalog lc ON lc.id = ca.action_status_id
       WHERE (lc.code IN ('issued','reviewed','approved','dispatched') AND ca.issued_on IS NULL)
          OR (lc.code = 'todo' AND ca.issued_on IS NOT NULL)`
    );
    if (inconsistentIssue.rows.length > 0) {
      critical(`${inconsistentIssue.rows.length} gestiones con inconsistencia entre estado y issued_on.`);
    }

    const badStatus = await client.query(
      `SELECT ca.id FROM claim_actions ca
       LEFT JOIN lookup_catalog lc ON lc.id = ca.action_status_id
       WHERE ca.action_status_id IS NULL OR lc.id IS NULL OR lc.category <> 'action_status'`
    );
    if (badStatus.rows.length > 0) {
      critical(`${badStatus.rows.length} gestiones con action_status_id inválido.`);
    }

    const orphanActions = await client.query(
      `SELECT ca.id FROM claim_actions ca
       LEFT JOIN claims c ON c.id = ca.claim_id
       WHERE c.id IS NULL`
    );
    if (orphanActions.rows.length > 0) {
      critical(`${orphanActions.rows.length} gestiones huérfanas (sin claim).`);
    }

    const inactiveTemplateActions = await client.query(
      `SELECT ca.id, ca.claim_id, at.code
       FROM claim_actions ca
       JOIN action_template at ON at.id = ca.action_template_id
       WHERE at.is_active = false`
    );
    if (inactiveTemplateActions.rows.length > 0) {
      warn(`${inactiveTemplateActions.rows.length} gestiones creadas a partir de plantillas inactivas.`);
    }

    if (
      dupActions.rows.length === 0 &&
      inconsistentIssue.rows.length === 0 &&
      badStatus.rows.length === 0 &&
      orphanActions.rows.length === 0 &&
      inactiveTemplateActions.rows.length === 0
    ) ok('Gestiones sin problemas estructurales.');

    // 4. Inspecciones
    logSection('4. Inspecciones');
    const orphanSessions = await client.query(
      `SELECT s.id, s.claim_id, s.claim_action_id
       FROM inspection_sessions s
       LEFT JOIN claims c ON c.id = s.claim_id
       LEFT JOIN claim_actions ca ON ca.id = s.claim_action_id
       WHERE c.id IS NULL OR ca.id IS NULL`
    );
    if (orphanSessions.rows.length > 0) {
      critical(`${orphanSessions.rows.length} sesiones huérfanas.`);
    }

    const badSessionStatus = await client.query(
      `SELECT id, status, inspection_type FROM inspection_sessions
       WHERE status NOT IN ('scheduled','active','completed','cancelled')
          OR inspection_type NOT IN ('onsite','remote')`
    );
    if (badSessionStatus.rows.length > 0) {
      critical(`${badSessionStatus.rows.length} sesiones con estado/tipo inválido.`);
    }

    const remoteNoSchedule = await client.query(
      `SELECT id, scheduled_at, magic_link_expires_at, magic_link_token
       FROM inspection_sessions
       WHERE inspection_type = 'remote'
         AND (scheduled_at IS NULL OR magic_link_token IS NULL OR magic_link_expires_at IS NULL)`
    );
    if (remoteNoSchedule.rows.length > 0) {
      critical(`${remoteNoSchedule.rows.length} sesiones remote sin scheduled_at/token/expiración.`);
    }

    const sessionsMismatched = await client.query(
      `SELECT s.id, s.claim_id AS session_claim, ca.claim_id AS action_claim
       FROM inspection_sessions s
       JOIN claim_actions ca ON ca.id = s.claim_action_id
       WHERE s.claim_id <> ca.claim_id`
    );
    if (sessionsMismatched.rows.length > 0) {
      critical(`${sessionsMismatched.rows.length} sesiones con claim_id distinto al de su claim_action.`);
    }

    if (
      orphanSessions.rows.length === 0 &&
      badSessionStatus.rows.length === 0 &&
      remoteNoSchedule.rows.length === 0 &&
      sessionsMismatched.rows.length === 0
    ) ok('Inspecciones sin problemas estructurales.');

    // 5. Claims
    logSection('5. Siniestros (claims)');
    const badClaims = await client.query(
      `SELECT c.id, c.liquidation_number
       FROM claims c
       LEFT JOIN lookup_catalog lc ON lc.id = c.status_id
       WHERE c.status_id IS NULL
          OR c.company_id IS NULL
          OR c.business_line_id IS NULL
          OR c.event_id IS NULL
          OR c.country_id IS NULL
          OR lc.id IS NULL
          OR lc.category <> 'claim_status'`
    );
    if (badClaims.rows.length > 0) {
      critical(`${badClaims.rows.length} siniestros con campos obligatorios inválidos:`);
      badClaims.rows.slice(0, 10).forEach((r) => console.log(`   - ${r.id} (${r.liquidation_number})`));
    } else ok('Siniestros sin problemas estructurales.');

    // 6. Funciones críticas
    logSection('6. Funciones y triggers críticos');
    const requiredFns = [
      'auto_create_inspection_session',
      'cascade_workflow_on_issue',
      'execute_workflow_on_status_change',
      'sync_workflow_for_claim',
      'renew_inspection_magic_link',
      'is_tenant_allowed',
    ];
    const fnRes = await client.query(
      `SELECT routine_name
       FROM information_schema.routines
       WHERE routine_schema = 'public' AND routine_name = ANY($1::text[])`
      , [requiredFns]
    );
    const foundFns = new Set(fnRes.rows.map((r) => r.routine_name));
    const missingFns = requiredFns.filter((f) => !foundFns.has(f));
    if (missingFns.length > 0) {
      critical(`Funciones críticas faltantes: ${missingFns.join(', ')}`);
    } else ok('Funciones críticas presentes.');

    const requiredTriggers = [
      'trg_cascade_workflow',
      'trg_auto_create_inspection_session',
      'trg_execute_workflow',
    ];
    const trigRes = await client.query(
      `SELECT trigger_name
       FROM information_schema.triggers
       WHERE trigger_name = ANY($1::text[])`
      , [requiredTriggers]
    );
    const foundTriggers = new Set(trigRes.rows.map((r) => r.trigger_name));
    const missingTriggers = requiredTriggers.filter((t) => !foundTriggers.has(t));
    if (missingTriggers.length > 0) {
      critical(`Triggers críticos faltantes en claim_actions: ${missingTriggers.join(', ')}`);
    } else ok('Triggers críticos presentes.');

    // 7. Resumen
    logSection('Resumen');
    console.log(`Errores críticos: ${errors}`);
    console.log(`Advertencias: ${warnings}`);
    if (errors === 0 && warnings === 0) {
      console.log('✅ Auditoría finalizada sin hallazgos.');
    } else if (errors === 0) {
      console.log('⚠️  Auditoría finalizada con advertencias menores.');
    } else {
      console.log('❌ Auditoría finalizada con errores que requieren atención.');
    }
  } catch (err) {
    console.error('\n❌ Error en auditoría:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

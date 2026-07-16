const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres.uoqubwwimudywcpxyxdk:Paoloxvito099!@aws-1-us-west-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const claimId = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';

  // 1. Buscar las claim_actions
  const actions = await client.query('SELECT id FROM claim_actions WHERE claim_id = $1', [claimId]);
  console.log(`Gestiones: ${actions.rows.length}`);
  const actionIds = actions.rows.map(r => r.id);
  if (actionIds.length === 0) { console.log('Nada que borrar'); await client.end(); return; }

  // 2. Dropear triggers problemáticos temporalmente
  console.log('Dropping triggers temporalmente...');
  // audit trigger de inspection_sessions (referencia OLD.updated_by)
  await client.query('DROP TRIGGER IF EXISTS inspection_sessions_audit_trigger ON inspection_sessions');
  // triggers custom de claim_actions
  await client.query('DROP TRIGGER IF EXISTS trg_auto_recreate_rejected ON claim_actions');
  await client.query('DROP TRIGGER IF EXISTS trg_cascade_workflow ON claim_actions');
  await client.query('DROP TRIGGER IF EXISTS trg_set_claim_action_code ON claim_actions');

  // 3. Borrar tablas hijas
  await client.query('DELETE FROM claim_action_history WHERE claim_action_id = ANY($1::uuid[])', [actionIds]);
  await client.query('DELETE FROM claim_coverages WHERE claim_action_id = ANY($1::uuid[])', [actionIds]);
  await client.query('DELETE FROM claim_reserves WHERE claim_action_id = ANY($1::uuid[])', [actionIds]);

  // inspection_sessions y sus hijas
  await client.query('DELETE FROM inspection_chat_messages WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_evidences WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_checklists WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_damages WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_notes WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_signatures WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_reports WHERE session_id IN (SELECT id FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[]))', [actionIds]);
  await client.query('DELETE FROM inspection_sessions WHERE claim_action_id = ANY($1::uuid[])', [actionIds]);

  console.log('Tablas hijas borradas');

  // 4. Borrar claim_actions
  const deleted = await client.query('DELETE FROM claim_actions WHERE claim_id = $1', [claimId]);
  console.log(`claim_actions borradas: ${deleted.rowCount}`);

  // 5. Recrear triggers
  console.log('Recreating triggers...');
  await client.query('CREATE TRIGGER trg_auto_recreate_rejected AFTER UPDATE OF action_status_id ON claim_actions FOR EACH ROW EXECUTE FUNCTION auto_recreate_rejected_workflow_action()');
  await client.query('CREATE TRIGGER trg_cascade_workflow AFTER UPDATE OF issued_on ON claim_actions FOR EACH ROW EXECUTE FUNCTION cascade_workflow_on_issue()');
  await client.query('CREATE TRIGGER trg_set_claim_action_code BEFORE INSERT ON claim_actions FOR EACH ROW EXECUTE FUNCTION set_claim_action_code()');
  await client.query('CREATE TRIGGER inspection_sessions_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON inspection_sessions FOR EACH ROW EXECUTE FUNCTION audit_trigger_func()');

  // 6. Verificar
  const after = await client.query('SELECT count(*) FROM claim_actions WHERE claim_id = $1', [claimId]);
  console.log(`Gestiones restantes: ${after.rows[0].count}`);

  await client.end();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

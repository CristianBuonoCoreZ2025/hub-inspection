require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const claimId = '69ac9d90-9b49-4fd2-962c-4f9fa6f501ff';
  const actionId = '1deac6c6-2f69-4d01-a1ac-6702a06c185e'; // NSA
  const businessLineId = '582c29fe-dc89-b815-97b2-0de7f0ee544c'; // Hogar

  // 1. Obtener todos los document_requirements activos de la línea Hogar
  const reqRes = await c.query(
    `SELECT document_type_code, document_name, sort_order
     FROM document_requirements
     WHERE business_line_id = $1 AND is_active = true
     ORDER BY sort_order`,
    [businessLineId]
  );
  console.log(`Documentos a solicitar (${reqRes.rows.length}):`);
  for (const r of reqRes.rows) {
    console.log(`  - ${r.document_type_code}: ${r.document_name}`);
  }

  if (reqRes.rows.length === 0) {
    console.log('No hay documentos configurados para esta línea. Abortando.');
    await c.end();
    return;
  }

  // 2. Crear la nueva claim_document_request
  const requestNumber = `SD-${Date.now().toString(36).toUpperCase()}`;
  const insertReq = await c.query(
    `INSERT INTO claim_document_requests
       (claim_id, claim_action_id, request_number, status, notes, created_at, updated_at)
     VALUES ($1, $2, $3, 'requested', 'Solicitud regenerada con documentos de la línea Hogar', NOW(), NOW())
     RETURNING id, request_number`,
    [claimId, actionId, requestNumber]
  );
  const newReq = insertReq.rows[0];
  console.log(`\nNueva solicitud creada: id=${newReq.id} | num=${newReq.request_number}`);

  // 3. Insertar los items (uno por documento de la línea)
  let idx = 0;
  for (const r of reqRes.rows) {
    idx++;
    await c.query(
      `INSERT INTO claim_document_request_items
         (request_id, document_type_code, document_name, status, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, 'requested', $4, NOW(), NOW())`,
      [newReq.id, r.document_type_code, r.document_name, idx]
    );
  }
  console.log(`Insertados ${idx} ítems en la solicitud.`);

  // 4. Verificación
  const verify = await c.query(
    `SELECT document_type_code, document_name, status, sort_order
     FROM claim_document_request_items
     WHERE request_id = $1
     ORDER BY sort_order`,
    [newReq.id]
  );
  console.log('\nVerificación — ítems en la nueva solicitud:');
  for (const v of verify.rows) {
    console.log(`  ${v.sort_order}. [${v.status}] ${v.document_type_code} — ${v.document_name}`);
  }

  await c.end();
  console.log('\nOK');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL no configurada');
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    const defRes = await client.query(
      "SELECT pg_get_functiondef(oid) AS src FROM pg_proc WHERE proname = 'execute_workflow_on_status_change'"
    );
    if (defRes.rows.length === 0) {
      console.log('Funcion no encontrada');
      return;
    }
    let src = defRes.rows[0].src;
    const buggy = 'COALESCE(NEW.updated_by, NEW.issued_by, NEW.created_by)';
    const fixed = 'NEW.updated_by';
    if (!src.includes(buggy)) {
      console.log('No se encontro la expresion a corregir');
      return;
    }
    src = src.replace(buggy, fixed);
    await client.query(src);
    console.log('Funcion execute_workflow_on_status_change corregida');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

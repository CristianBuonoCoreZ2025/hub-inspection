require('dotenv').config({ path: '.env.local' });
const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;
const metadataUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendMetadata(payload) {
  const res = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': adminSecret,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 100)}`);
  }
}

async function dropPermission(table, type) {
  try {
    await sendMetadata({
      type: `pg_drop_${type}_permission`,
      args: { table: { name: table, schema: 'public' }, role: 'user', source: 'default' },
    });
  } catch {
    // may not exist
  }
}

async function createPermission(table, type) {
  const baseArgs = { table: { name: table, schema: 'public' }, role: 'user', source: 'default' };
  let permission;
  switch (type) {
    case 'select': permission = { columns: '*', filter: {} }; break;
    case 'insert': permission = { columns: '*', check: {} }; break;
    case 'update': permission = { columns: '*', filter: {}, check: {} }; break;
    case 'delete': permission = { filter: {} }; break;
  }
  await dropPermission(table, type);
  await sleep(300);
  await sendMetadata({
    type: `pg_create_${type}_permission`,
    args: { ...baseArgs, permission },
  });
  console.log(`  ✓ ${type} on ${table}`);
}

// Only the tables that need permissions
const TABLES = [
  'action_features',
  'action_template',
  'action_template_claim_status',
  'document_templates',
];

async function main() {
  console.log('Setting permissions for new tables only...\n');
  for (const table of TABLES) {
    console.log(`Table: ${table}`);
    for (const type of ['select', 'insert', 'update', 'delete']) {
      try {
        await createPermission(table, type);
      } catch (e) {
        console.error(`  ✗ ${type} on ${table}: ${e.message.slice(0, 80)}`);
      }
      await sleep(500);
    }
    console.log('');
  }
  console.log('Done!');
}

main().catch(console.error);

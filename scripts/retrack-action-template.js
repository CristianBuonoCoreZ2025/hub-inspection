require('dotenv').config({ path: '.env.local' });
const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;
const metadataUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`;

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
    const data = JSON.parse(text);
    if (data.error) throw new Error(JSON.stringify(data.error));
    return data;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Non-JSON: ${text.slice(0, 100)}`);
    }
    throw e;
  }
}

async function main() {
  // Untrack action_template
  console.log('Untracking action_template...');
  try {
    await sendMetadata({
      type: 'pg_untrack_table',
      args: { source: 'default', table: { schema: 'public', name: 'action_template' } },
    });
    console.log('  ✓ Untracked');
  } catch (e) {
    console.log('  ℹ', e.message.slice(0, 100));
  }

  await new Promise((r) => setTimeout(r, 2000));

  // Re-track action_template (should pick up all FKs including country)
  console.log('\nRe-tracking action_template...');
  try {
    await sendMetadata({
      type: 'pg_track_table',
      args: { source: 'default', table: { schema: 'public', name: 'action_template' } },
    });
    console.log('  ✓ Tracked');
  } catch (e) {
    console.log('  ℹ', e.message.slice(0, 100));
  }

  // Re-add permissions (untracking removes them)
  console.log('\nRe-adding permissions...');
  for (const type of ['select', 'insert', 'update', 'delete']) {
    try {
      const perm = type === 'select' ? { columns: '*', filter: {} }
        : type === 'insert' ? { columns: '*', check: {} }
        : type === 'update' ? { columns: '*', filter: {}, check: {} }
        : { filter: {} };
      await sendMetadata({
        type: `pg_create_${type}_permission`,
        args: { table: { name: 'action_template', schema: 'public' }, role: 'user', source: 'default', permission: perm },
      });
      console.log(`  ✓ ${type}`);
    } catch (e) {
      if (e.message.includes('already')) {
        console.log(`  ℹ ${type} (already exists)`);
      } else {
        console.log(`  ✗ ${type}: ${e.message.slice(0, 80)}`);
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\nDone!');
}

main().catch(console.error);

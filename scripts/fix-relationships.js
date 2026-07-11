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
  // Add country relationship to action_template
  console.log('Adding country relationship to action_template...');
  try {
    await sendMetadata({
      type: 'pg_track_relationship',
      args: {
        source: 'default',
        table: { schema: 'public', name: 'action_template' },
        name: 'country',
        definition: {
          manual_configuration: {
            column_mapping: { country_id: 'id' },
            remote_table: { schema: 'public', name: 'countries' },
          },
        },
      },
    });
    console.log('  ✓ country relationship added');
  } catch (e) {
    if (e.message.includes('already')) {
      console.log('  ℹ country relationship already exists');
    } else {
      console.error('  ✗ Error:', e.message.slice(0, 200));
    }
  }

  // Also add document_templates relationships
  console.log('\nAdding document_templates relationships...');
  const relationships = [
    { name: 'company', col: 'company_id', remote: 'companies' },
    { name: 'action_template', col: 'action_template_id', remote: 'action_template' },
    { name: 'event', col: 'event_id', remote: 'events' },
  ];

  for (const rel of relationships) {
    try {
      await sendMetadata({
        type: 'pg_track_relationship',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'document_templates' },
          name: rel.name,
          definition: {
            manual_configuration: {
              column_mapping: { [rel.col]: 'id' },
              remote_table: { schema: 'public', name: rel.remote },
            },
          },
        },
      });
      console.log(`  ✓ ${rel.name} relationship added`);
    } catch (e) {
      if (e.message.includes('already')) {
        console.log(`  ℹ ${rel.name} relationship already exists`);
      } else {
        console.error(`  ✗ ${rel.name}:`, e.message.slice(0, 200));
      }
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);

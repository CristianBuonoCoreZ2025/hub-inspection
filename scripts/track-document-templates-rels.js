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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Relationships to track on document_templates
const relationships = [
  { name: 'company', col: 'company_id', remote: 'companies' },
  { name: 'insurance_company', col: 'insurance_company_id', remote: 'insurance_companies' },
  { name: 'action_template', col: 'action_template_id', remote: 'action_template' },
  { name: 'event', col: 'event_id', remote: 'events' },
  { name: 'country', col: 'country_id', remote: 'countries' },
];

async function main() {
  console.log('Tracking relationships on document_templates...\n');

  // First try pg_track_relationships (bulk)
  try {
    await sendMetadata({
      type: 'pg_track_relationships',
      args: {
        source: 'default',
        table: { schema: 'public', name: 'document_templates' },
      },
    });
    console.log('✓ Bulk track relationships succeeded');
  } catch (e) {
    console.log(`ℹ Bulk track failed: ${e.message.slice(0, 100)}`);
    console.log('Trying individual relationships...\n');

    // Try individual manual relationships
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
        console.log(`  ✓ ${rel.name} -> ${rel.remote}`);
      } catch (e) {
        if (e.message.includes('already') || e.message.includes('exists')) {
          console.log(`  ℹ ${rel.name} already tracked`);
        } else {
          console.log(`  ✗ ${rel.name}: ${e.message.slice(0, 120)}`);
        }
      }
      await sleep(500);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);

require('dotenv').config({ path: '.env.local' });
const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;
const metadataUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/metadata`;

// Reload metadata to pick up schema changes (new columns, new tables)
async function reloadMetadata() {
  console.log('Reloading Hasura metadata...');
  const res = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': adminSecret,
    },
    body: JSON.stringify({
      type: 'reload_metadata',
      args: {},
    }),
  });
  const data = await res.json();
  if (!res.ok || data?.error) {
    console.error('Error reloading metadata:', JSON.stringify(data, null, 2));
  } else {
    console.log('✓ Metadata reloaded successfully');
  }
}

reloadMetadata().catch(console.error);

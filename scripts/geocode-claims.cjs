/**
 * Script batch para geocodificar las direcciones de todos los claims
 * que tienen claim_address pero no tienen claim_latitude/claim_longitude.
 *
 * Uso: node scripts/geocode-claims.cjs
 *
 * Usa Nominatim (OpenStreetMap) — rate limit de 1 request/segundo.
 */
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function geocodeAddress(address) {
  if (!address || !address.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'hub-inspection/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (e) {
    console.warn('  geocode error:', e.message);
    return null;
  }
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Buscar claims sin coordenadas pero con dirección
  const { rows } = await c.query(`
    SELECT c.id, c.liquidation_number, c.claim_address,
      ci.name as city_name, co.name as commune_name, r.name as region_name, cnt.name as country_name
    FROM claims c
    LEFT JOIN cities ci ON c.city_id = ci.id
    LEFT JOIN communes co ON c.commune_id = co.id
    LEFT JOIN regions r ON c.region_id = r.id
    LEFT JOIN countries cnt ON c.country_id = cnt.id
    WHERE c.claim_address IS NOT NULL AND c.claim_address <> ''
      AND (c.claim_latitude IS NULL OR c.claim_longitude IS NULL)
      AND c.disabled = false
    ORDER BY c.created_at DESC
  `);

  console.log(`Claims sin geocodificar: ${rows.length}`);

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    // Construir dirección completa para mejorar precisión
    const parts = [row.claim_address];
    if (row.commune_name) parts.push(row.commune_name);
    if (row.city_name) parts.push(row.city_name);
    if (row.region_name) parts.push(row.region_name);
    if (row.country_name) parts.push(row.country_name);
    const fullAddress = parts.join(', ');

    process.stdout.write(`  ${row.liquidation_number || row.id}: ${fullAddress} → `);
    const coords = await geocodeAddress(fullAddress);
    if (coords) {
      await c.query(
        'UPDATE claims SET claim_latitude = $1, claim_longitude = $2 WHERE id = $3',
        [coords.lat, coords.lng, row.id]
      );
      console.log(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} ✓`);
      updated++;
    } else {
      console.log('no encontrado ✗');
      failed++;
    }
    // Rate limit: 1 request/segundo
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\nResumen: ${updated} geocodificados, ${failed} no encontrados`);
  await c.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

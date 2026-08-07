// Verifica que los productos estén alocados correctamente:
// 1. Conteo de tipos, productos, marcas, relaciones
// 2. Productos sin tipo asignado (huérfanos)
// 3. Productos duplicados por (tipo + nombre)
// 4. Tipos sin productos
// 5. Marcas duplicadas (no debería haber después de migración 240)
// 6. Relaciones pivote que apuntan a productos/marcas inexistentes
// 7. Muestra distribución de productos por tipo
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync } from "fs";

const envPath = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envPath });

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  VERIFICACIÓN DE ALOCACIÓN DE PRODUCTOS Y MARCAS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Conteos totales
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM content_good_types WHERE is_active = true) AS tipos,
      (SELECT COUNT(*) FROM content_good_products WHERE is_active = true) AS productos,
      (SELECT COUNT(*) FROM content_good_brands WHERE is_active = true) AS marcas,
      (SELECT COUNT(*) FROM content_good_product_brands) AS relaciones
  `);
  const c = counts.rows[0];
  console.log(`📊 Conteos totales:`);
  console.log(`   Tipos activos:     ${c.tipos}`);
  console.log(`   Productos activos: ${c.productos}`);
  console.log(`   Marcas activas:    ${c.marcas}`);
  console.log(`   Relaciones N:M:    ${c.relaciones}`);
  console.log();

  // 2. Productos huérfanos (sin tipo asignado o tipo inactivo)
  const orphans = await client.query(`
    SELECT p.id, p.name
    FROM content_good_products p
    LEFT JOIN content_good_types t ON p.content_good_type_id = t.id
    WHERE t.id IS NULL OR t.is_active = false
  `);
  console.log(`🔍 Productos huérfanos (sin tipo o tipo inactivo): ${orphans.rows.length}`);
  if (orphans.rows.length > 0) {
    orphans.rows.forEach((r) => console.log(`   ❌ ${r.name}`));
  } else {
    console.log(`   ✅ Ninguno`);
  }
  console.log();

  // 3. Productos duplicados (mismo tipo + mismo nombre)
  const dups = await client.query(`
    SELECT t.name AS tipo, p.name AS producto, COUNT(*) AS cant
    FROM content_good_products p
    JOIN content_good_types t ON p.content_good_type_id = t.id
    WHERE p.is_active = true
    GROUP BY t.name, p.name
    HAVING COUNT(*) > 1
    ORDER BY cant DESC
  `);
  console.log(`🔍 Productos duplicados (mismo tipo + nombre): ${dups.rows.length}`);
  if (dups.rows.length > 0) {
    dups.rows.forEach((r) => console.log(`   ❌ ${r.cant}x  [${r.tipo}] ${r.producto}`));
  } else {
    console.log(`   ✅ Ninguno`);
  }
  console.log();

  // 4. Tipos sin productos
  const emptyTypes = await client.query(`
    SELECT t.name, COUNT(p.id) AS productos
    FROM content_good_types t
    LEFT JOIN content_good_products p ON p.content_good_type_id = t.id AND p.is_active = true
    WHERE t.is_active = true
    GROUP BY t.name
    HAVING COUNT(p.id) = 0
    ORDER BY t.name
  `);
  console.log(`🔍 Tipos sin productos: ${emptyTypes.rows.length}`);
  if (emptyTypes.rows.length > 0) {
    emptyTypes.rows.forEach((r) => console.log(`   ⚠️  ${r.name}`));
  } else {
    console.log(`   ✅ Todos los tipos tienen productos`);
  }
  console.log();

  // 5. Marcas duplicadas (no debería haber después de migración 240)
  const dupBrands = await client.query(`
    SELECT name, COUNT(*) AS cant
    FROM content_good_brands
    GROUP BY name
    HAVING COUNT(*) > 1
  `);
  console.log(`🔍 Marcas duplicadas (mismo nombre): ${dupBrands.rows.length}`);
  if (dupBrands.rows.length > 0) {
    dupBrands.rows.forEach((r) => console.log(`   ❌ ${r.cant}x  ${r.name}`));
  } else {
    console.log(`   ✅ Ninguna (unique constraint funciona)`);
  }
  console.log();

  // 6. Relaciones pivote huérfanas
  const orphanRels = await client.query(`
    SELECT COUNT(*) AS cant
    FROM content_good_product_brands pb
    LEFT JOIN content_good_products p ON pb.product_id = p.id
    LEFT JOIN content_good_brands b ON pb.brand_id = b.id
    WHERE p.id IS NULL OR b.id IS NULL
  `);
  console.log(`🔍 Relaciones pivote huérfanas: ${orphanRels.rows[0].cant}`);
  console.log();

  // 7. Distribución de productos por tipo
  const dist = await client.query(`
    SELECT t.name AS tipo, COUNT(p.id) AS productos
    FROM content_good_types t
    LEFT JOIN content_good_products p ON p.content_good_type_id = t.id AND p.is_active = true
    WHERE t.is_active = true
    GROUP BY t.name
    ORDER BY productos DESC, t.name
  `);
  console.log(`📋 Distribución de productos por tipo:`);
  dist.rows.forEach((r) => {
    const bar = "█".repeat(Math.min(40, Number(r.productos)));
    console.log(`   ${String(r.productos).padStart(3)}  ${bar}  ${r.tipo}`);
  });
  console.log();

  // 8. Productos sin marcas asignadas
  const noBrands = await client.query(`
    SELECT t.name AS tipo, p.name AS producto
    FROM content_good_products p
    JOIN content_good_types t ON p.content_good_type_id = t.id
    LEFT JOIN content_good_product_brands pb ON pb.product_id = p.id
    WHERE p.is_active = true AND pb.id IS NULL
    ORDER BY t.name, p.name
  `);
  console.log(`🔍 Productos sin marcas asignadas (en pivote): ${noBrands.rows.length}`);
  if (noBrands.rows.length > 0 && noBrands.rows.length <= 30) {
    noBrands.rows.forEach((r) => console.log(`   ⚠️  [${r.tipo}] ${r.producto}`));
  } else if (noBrands.rows.length > 30) {
    noBrands.rows.slice(0, 15).forEach((r) => console.log(`   ⚠️  [${r.tipo}] ${r.producto}`));
    console.log(`   ... y ${noBrands.rows.length - 15} más`);
  } else {
    console.log(`   ✅ Todos los productos tienen al menos una marca`);
  }
  console.log();

  // 9. Marcas no usadas en ninguna relación
  const unusedBrands = await client.query(`
    SELECT b.name
    FROM content_good_brands b
    LEFT JOIN content_good_product_brands pb ON pb.brand_id = b.id
    WHERE b.is_active = true AND pb.id IS NULL
    ORDER BY b.name
  `);
  console.log(`🔍 Marcas activas no usadas en ninguna relación: ${unusedBrands.rows.length}`);
  if (unusedBrands.rows.length > 0 && unusedBrands.rows.length <= 30) {
    unusedBrands.rows.forEach((r) => console.log(`   ⚠️  ${r.name}`));
  } else if (unusedBrands.rows.length > 30) {
    unusedBrands.rows.slice(0, 15).forEach((r) => console.log(`   ⚠️  ${r.name}`));
    console.log(`   ... y ${unusedBrands.rows.length - 15} más`);
  } else {
    console.log(`   ✅ Todas las marcas están en uso`);
  }
  console.log();

  // 10. Muestra algunos productos de muestra con sus marcas
  const sample = await client.query(`
    SELECT t.name AS tipo, p.name AS producto,
           COUNT(pb.id) AS marcas_count,
           STRING_AGG(b.name, ', ' ORDER BY b.name) AS marcas
    FROM content_good_products p
    JOIN content_good_types t ON p.content_good_type_id = t.id
    LEFT JOIN content_good_product_brands pb ON pb.product_id = p.id
    LEFT JOIN content_good_brands b ON pb.brand_id = b.id
    WHERE p.is_active = true
    GROUP BY t.name, p.name
    ORDER BY t.name, p.name
    LIMIT 10
  `);
  console.log(`📋 Muestra (primeros 10 productos con sus marcas):`);
  sample.rows.forEach((r) => {
    console.log(`   [${r.tipo}] ${r.producto}  (${r.marcas_count} marcas)`);
    if (r.marcas) {
      const list = r.marcas.length > 80 ? r.marcas.slice(0, 80) + "..." : r.marcas;
      console.log(`      → ${list}`);
    }
  });

  await client.end();
  console.log("\n✅ Verificación completa\n");
}

main().catch((e) => { console.error("❌ Error:", e.message); process.exit(1); });

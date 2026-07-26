#!/usr/bin/env node
/**
 * Genera SQL de seed para content_good_product_brands (pivote N:M)
 * a partir de product-brands.json + products.json + brands.json + types.json.
 *
 * Resuelve los IDs por nombre (producto + tipo, marca) porque los IDs
 * temporales (P0101, B0001) no coinciden con los UUIDs de la base.
 *
 * Uso: node scripts/seed-content-goods/generate-pivote-seed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));

const types = read("types.json");
const products = read("products.json");
const brands = read("brands.json");
const productBrands = read("product-brands.json");

const esc = (s) => (s || "").replace(/'/g, "''");

// Índices por ID temporal
const productsById = new Map(products.map((p) => [p.id, p]));
const brandsById = new Map(brands.map((b) => [b.id, b]));
const typesByCode = new Map(types.map((t) => [t.code, t]));

const lines = [];

lines.push("-- Pivote N:M producto ↔ marca");
lines.push("-- Resuelve IDs por nombre (producto+tipo, marca)");
lines.push(`INSERT INTO content_good_product_brands (product_id, brand_id)`);

const rows = [];
let skipped = 0;
for (const rel of productBrands) {
  const product = productsById.get(rel.product_id);
  const brand = brandsById.get(rel.brand_id);
  if (!product || !brand) {
    skipped++;
    continue;
  }
  const type = typesByCode.get(product.type_code);
  if (!type) {
    skipped++;
    continue;
  }
  // Resuelve product_id por nombre + tipo, brand_id por nombre
  // LIMIT 1 por seguridad (puede haber marcas duplicadas que se deduplican en migración 240)
  rows.push(
    `  ((SELECT p.id FROM content_good_products p JOIN content_good_types t ON p.content_good_type_id = t.id WHERE p.name = '${esc(product.name)}' AND t.name = '${esc(type.name)}' LIMIT 1), (SELECT id FROM content_good_brands WHERE name = '${esc(brand.name)}' LIMIT 1))`
  );
}

lines.push(`VALUES`);
lines.push(rows.join(",\n"));
lines.push(`ON CONFLICT DO NOTHING;`);

if (skipped > 0) {
  process.stderr.write(`Saltaron ${skipped} relaciones (IDs no encontrados)\n`);
}
process.stderr.write(`OK: ${rows.length} relaciones generadas\n`);

const sql = lines.join("\n") + "\n";
writeFileSync(join(here, "pivote-seed-generated.sql"), sql, "utf-8");
process.stdout.write(sql);

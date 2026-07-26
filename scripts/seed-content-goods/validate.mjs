#!/usr/bin/env node
/**
 * Valida la consistencia de la base temporal de tipos de bien / productos / marcas.
 *
 * Chequea:
 *  - IDs únicos en cada archivo
 *  - Todo product_id de product-brands existe en products
 *  - Todo brand_id de product-brands existe en brands
 *  - Todo type_code de products existe en types
 *  - Sin duplicados (product_id, brand_id) en product-brands
 *  - Estadísticas: total por tipo, productos sin marcas, marcas no usadas
 *
 * Uso:  node scripts/seed-content-goods/validate.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const read = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));

const types = read("types.json");
const products = read("products.json");
const brands = read("brands.json");
const productBrands = read("product-brands.json");

let errors = 0;
const fail = (msg) => { console.error("✗ " + msg); errors++; };
const ok = (msg) => console.log("✓ " + msg);

// 1. IDs únicos
const checkUnique = (rows, idKey, label) => {
  const seen = new Set();
  let dups = 0;
  for (const r of rows) {
    if (seen.has(r[idKey])) { fail(`ID duplicado en ${label}: ${r[idKey]}`); dups++; }
    seen.add(r[idKey]);
  }
  if (dups === 0) ok(`${rows.length} ${label} con IDs únicos`);
};
checkUnique(types, "id", "types");
checkUnique(products, "id", "products");
checkUnique(brands, "id", "brands");

// 2. type_code de products existe en types
const typeCodes = new Set(types.map((t) => t.code));
let badType = 0;
for (const p of products) {
  if (!typeCodes.has(p.type_code)) { fail(`Producto ${p.id} tiene type_code inválido: ${p.type_code}`); badType++; }
}
if (badType === 0) ok("Todos los productos apuntan a un type_code válido");

// 3. product_id y brand_id de product-brands existen
const productIds = new Set(products.map((p) => p.id));
const brandIds = new Set(brands.map((b) => b.id));
let badProduct = 0, badBrand = 0;
for (const rel of productBrands) {
  if (!productIds.has(rel.product_id)) { fail(`product-brands con product_id inexistente: ${rel.product_id}`); badProduct++; }
  if (!brandIds.has(rel.brand_id)) { fail(`product-brands con brand_id inexistente: ${rel.brand_id}`); badBrand++; }
}
if (badProduct === 0 && badBrand === 0) ok(`Todas las ${productBrands.length} relaciones apuntan a IDs existentes`);

// 4. Sin duplicados (product_id, brand_id)
const seenPairs = new Set();
let dupPairs = 0;
for (const rel of productBrands) {
  const k = `${rel.product_id}|${rel.brand_id}`;
  if (seenPairs.has(k)) { fail(`Relación duplicada: ${rel.product_id} ↔ ${rel.brand_id}`); dupPairs++; }
  seenPairs.add(k);
}
if (dupPairs === 0) ok("Sin relaciones duplicadas");

// 5. Estadísticas
console.log("\n— Estadísticas —");
const byType = new Map();
for (const p of products) byType.set(p.type_code, (byType.get(p.type_code) || 0) + 1);
for (const t of types) {
  console.log(`  ${t.code.padEnd(28)} ${String(byType.get(t.code) || 0).padStart(3)} productos`);
}

const productsWithBrands = new Set(productBrands.map((r) => r.product_id));
const orphanProducts = products.filter((p) => !productsWithBrands.has(p.id));
console.log(`\nProductos sin marcas asignadas: ${orphanProducts.length}`);
for (const p of orphanProducts) console.log(`  - ${p.id} ${p.name} (${p.type_code})`);

const usedBrands = new Set(productBrands.map((r) => r.brand_id));
const unusedBrands = brands.filter((b) => !usedBrands.has(b.id));
console.log(`\nMarcas no usadas en ninguna relación: ${unusedBrands.length}`);
for (const b of unusedBrands) console.log(`  - ${b.id} ${b.name}`);

console.log(`\nResumen: ${types.length} tipos, ${products.length} productos, ${brands.length} marcas, ${productBrands.length} relaciones`);
console.log(errors === 0 ? "\n✔ Todo OK" : `\n✗ ${errors} error(es)`);
process.exit(errors === 0 ? 0 : 1);

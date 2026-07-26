#!/usr/bin/env node
/**
 * Genera SQL de seed para content_good_brands y content_good_products
 * a partir de los JSON temporales en scripts/seed-content-goods/.
 *
 * Maneja:
 *  - Renombramientos de tipos existentes (UPDATE, no INSERT)
 *  - Tipos nuevos (INSERT, solo los que no existen)
 *  - Brands (INSERT global)
 *  - Products (INSERT con FK resuelta por nombre de tipo)
 *
 * Uso: node scripts/seed-content-goods/generate-seed-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));

const types = read("types.json");
const products = read("products.json");
const brands = read("brands.json");

const esc = (s) => (s || "").replace(/'/g, "''");

// Mapeo de nombres originales (en la base) -> nombres nuevos (en types.json)
const renames = [
  { old: "Maquinaria", new: "Maquinaria y Herramientas", desc: "Maquinaria industrial, herramientas eléctricas y manuales, equipos de trabajo." },
  { old: "Enseres Generales", new: "Enseres de Cocina", desc: "Vajilla, cubiertos, ollas, sartenes, vasos, copas, termos, coolers. Bienes de uso durable de cocina (no consumibles)." },
  { old: "Móviles", new: "Computación y Móviles", desc: "Informática y móviles: notebooks, PC desktop, all-in-one, tablets, smartphones, smartwatches, monitores, routers, discos externos, auriculares, power banks, accesorios móvil." },
  { old: "Electrónica", new: "Electrónica", desc: "Entretenimiento y audio/video: TV, consolas, equipos de sonido, parlantes, soundbars, proyectores, cámaras, drones. NO incluye computación ni móviles (ver Computación y Móviles)." },
  { old: "Joyas / Bisutería", new: "Joyas / Bisutería", desc: "Joyas, relojes tradicionales y bisutería de valor. NO incluye smartwatches (ver Computación y Móviles)." },
];

// Nombres que ya existen en la base (después del renombramiento)
const existingAfterRename = new Set([
  "Electrodomésticos", "Electrónica", "Computación y Móviles", "Muebles",
  "Ropa / Vestuario", "Joyas / Bisutería", "Maquinaria y Herramientas", "Vehículos",
  "Equipamiento Oficina", "Equipamiento Deportivo", "Instrumentos Musicales",
  "Arte / Colecciones", "Libros / Documentos", "Equipamiento Médico",
  "Enseres de Cocina", "Otros"
]);

const newTypes = types.filter((t) => !existingAfterRename.has(t.name));

const lines = [];

// 1. Renombramientos
lines.push("-- Renombramientos de tipos existentes (UPDATE, no toca datos)");
for (const r of renames) {
  lines.push(`UPDATE content_good_types SET name = '${esc(r.new)}', description = '${esc(r.desc)}' WHERE name = '${esc(r.old)}';`);
}
lines.push("");

// 2. Tipos nuevos
lines.push("-- Tipos nuevos (INSERT, solo los que no existen)");
if (newTypes.length > 0) {
  lines.push(`INSERT INTO content_good_types (name, description) VALUES`);
  lines.push(newTypes.map((t) => `  ('${esc(t.name)}', '${esc(t.description)}')`).join(",\n"));
  lines.push(`ON CONFLICT DO NOTHING;`);
}
lines.push("");

// 3. Brands
lines.push("-- Brands (catálogo global)");
lines.push(`INSERT INTO content_good_brands (name, country, is_active) VALUES`);
lines.push(brands.map((b) => `  ('${esc(b.name)}', ${b.country ? `'${esc(b.country)}'` : "NULL"}, ${b.is_active ? "true" : "false"})`).join(",\n"));
lines.push(`ON CONFLICT DO NOTHING;`);
lines.push("");

// 4. Products
lines.push("-- Products (con FK a content_good_types por nombre)");
lines.push(`INSERT INTO content_good_products (content_good_type_id, name, description, sort_order, is_active)`);

const byType = new Map();
for (const p of products) {
  if (!byType.has(p.type_code)) byType.set(p.type_code, []);
  byType.get(p.type_code).push(p);
}

const productRows = [];
for (const [typeCode, prods] of byType) {
  const type = types.find((t) => t.code === typeCode);
  if (!type) continue;
  for (const p of prods) {
    productRows.push(
      `  ((SELECT id FROM content_good_types WHERE name = '${esc(type.name)}'), '${esc(p.name)}', ${p.description ? `'${esc(p.description)}'` : "NULL"}, ${p.sort_order || 0}, true)`
    );
  }
}
lines.push(`VALUES`);
lines.push(productRows.join(",\n"));
lines.push(`ON CONFLICT DO NOTHING;`);

process.stdout.write(lines.join("\n") + "\n");
writeFileSync(join(here, "seed-generated.sql"), lines.join("\n") + "\n", "utf-8");
console.error("OK: seed-generated.sql escrito con " + lines.length + " lineas");

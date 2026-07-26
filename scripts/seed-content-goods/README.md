# Base temporal — Tipos de Bien / Productos / Marcas

> **NO es estructura definitiva.** Es una carga inicial curada para poblar el
> sistema cuando el plan de tablas definitivas (`content_good_products`,
> `content_good_brands`, pivote) esté listo. Estos JSON son la **fuente de
> datos** para esa migración, no el destino.

## Por qué existe esto

En `inspection_damages` los campos `product` y `brand_model` son texto libre
(migración 09). No hay catálogo. El inspector escribe "Lavadora" y "Samsung"
a mano. Esto impide reportes, autocompletado y validación.

El plan definitivo (en curso) creará las tablas normalizadas. Mientras tanto,
esta base temporal entrega datos **reales del mercado chileno** listos para
insertar cuando las tablas existan, sin tener que investigar todo de cero.

## Fuentes de los datos

Curaduría manual basada en:
- **MercadoLibre Chile (MLC)** — categorías jerárquicas oficiales + atributo
  `BRAND` con lista cerrada de marcas válidas por categoría.
- Sitios oficiales de marcas locales: tiendafensa.cl, tiendamademsa.cl,
  whirlpool.cl, samsung.com/cl, motorola.cl, mi.com/cl.
- Reportes de Aduanas Chile (smartphones 2023) para ordenar marcas por
  market share real del país.
- Conocimiento del mercado chileno de muebles (Dico, René Müller, Mixo,
  Dasec, Rosen) y bicicletas (Oxford, Mercurio + internacionales).

No es un tempario automotriz (no existe equivalente público para bienes de
contenido). Es una curaduría enfocada en lo que efectivamente se asegura y
se daña en siniestros de contenido en Chile.

## Estructura (4 archivos JSON)

```
scripts/seed-content-goods/
├── types.json              — 16 tipos de bien (categorías raíz)
├── products.json           — 157 productos (subcategorías)
├── brands.json             — 259 marcas (catálogo global normalizado)
├── product-brands.json     — 817 relaciones N:M producto ↔ marca
├── validate.mjs            — script de validación de integridad
└── README.md               — este archivo
```

### Esquema de cada archivo

**types.json** — 1 fila por tipo de bien
```json
{ "id": "T01", "code": "ELECTRODOMESTICOS", "name": "Electrodomésticos",
  "description": "...", "sort_order": 1 }
```

**products.json** — 1 fila por producto, colgando de un tipo
```json
{ "id": "P0001", "type_code": "ELECTRODOMESTICOS", "name": "Refrigerador",
  "description": "...", "sort_order": 1 }
```

**brands.json** — catálogo global de marcas (sin duplicar)
```json
{ "id": "B0001", "name": "Samsung", "country": "KR", "is_active": true }
```

**product-brands.json** — relación N:M (qué marcas aplican a qué productos)
```json
{ "product_id": "P0001", "brand_id": "B0001" }
```

### Convención de IDs

- `T01`..`T16` — tipos (estables, no cambiar)
- `P0001`..`P9999` — productos (rango por tipo: P00xx electrodomésticos,
  P01xx electrónica, P02xx móviles, P03xx muebles, etc.)
- `B0001`..`B9999` — marcas (B00xx globales electrodomésticos/electrónica,
  B01xx IT/audio, B02xx relojes/joyas, B03xx herramientas, B04xx vehículos,
  B05xx muebles, B06xx deportivo, B07xx instrumentos, B08xx médico,
  B09xx ropa, B10xx enseres cocina, B11xx misc)

Los IDs son strings estables. Cuando se migre a las tablas definitivas
(UUIDs), se conserva el `code`/`id` temporal como columna `legacy_code`
para trazabilidad.

## Mapeo a las tablas definitivas (cuando existan)

| JSON temporal           | Tabla definitiva (propuesta)        |
|-------------------------|-------------------------------------|
| `types.json`            | `content_good_types` (ya existe, migración 159) |
| `products.json`         | `content_good_products`             |
| `brands.json`           | `content_good_brands`               |
| `product-brands.json`   | `content_good_product_brands` (pivote N:M) |

Mapeo de columnas sugerido:

```sql
-- content_good_products
INSERT INTO content_good_products (id, content_good_type_id, name, description, sort_order, is_active, legacy_code)
SELECT gen_random_uuid(), cgt.id, p.name, p.description, p.sort_order, true, p.id
FROM json_populate_recordset(null::json_products, '...') p
JOIN content_good_types cgt ON cgt.code = p.type_code;

-- content_good_brands
INSERT INTO content_good_brands (id, name, country, is_active, legacy_code)
SELECT gen_random_uuid(), name, country, is_active, id
FROM json_populate_recordset(null::json_brands, '...');

-- content_good_product_brands (pivote)
INSERT INTO content_good_product_brands (product_id, brand_id)
SELECT p.id, b.id
FROM json_populate_recordset(null::json_rels, '...') r
JOIN content_good_products p ON p.legacy_code = r.product_id
JOIN content_good_brands b ON b.legacy_code = r.brand_id;
```

## Cómo validar

```bash
node scripts/seed-content-goods/validate.mjs
```

Verifica: IDs únicos, integridad referencial, sin duplicados, y muestra
estadísticas (productos por tipo, productos sin marcas, marcas no usadas).

## Cómo extender (crecimiento on-demand)

1. **Agregar un producto nuevo**: añadir fila a `products.json` con un ID
   libre del rango del tipo correspondiente, luego relaciones a `product-brands.json`.
2. **Agregar una marca nueva**: añadir fila a `brands.json` con un ID libre,
   luego relaciones a `product-brands.json`.
3. **Marcar marca inactiva**: set `is_active: false` en `brands.json` (no borrar).
4. Correr `validate.mjs` antes de commitear.

## Notas

- `B0041 Generic` es la marca comodín para productos sin marca conocida.
  Siempre está disponible para cualquier producto.
- Las categorías ARTE_COLECCIONES, LIBROS_DOCUMENTOS y OTROS tienen solo
  `Generic` porque sus marcas son altamente específicas (casa de subastas,
  editorial, etc.) y se cargan on-demand caso a caso.
- `B0010 POCO` y `B0011 Redmi` son sub-marcas de Xiaomi, válidas para
  smartphones. Quedan en el catálogo aunque no tengan relaciones aún.
- `B1107 Valve` cubre Steam Deck; `B0114 Steam` quedó sin uso (mismo
  fabricante, se unificó bajo Valve).

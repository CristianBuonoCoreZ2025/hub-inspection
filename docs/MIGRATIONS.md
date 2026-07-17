# Migraciones de Base de Datos — Claims Hub Platform

> 159 migraciones SQL versionadas en `migrations/`.
> Ejecutar con scripts de apply o `pnpm db:push`.

## Migraciones por Rango

### 000-019 — Schema Inicial
| # | Descripción |
|---|-------------|
| 000 | Schema inicial |
| 01 | Tablas principales |
| 02 | Triggers de auditoría |
| 03 | Company fields + policies |
| 04 | Países |
| 05 | Grant permissions |
| 06 | Extend claims |
| 07 | Extend sessions y claims |
| 08 | Inspection forms |
| 09 | Extend damages |
| 10 | Remove legacy fields |
| 11 | Acta fields |
| 12 | Catálogos base |
| 13 | Advisors |
| 14 | Audit triggers |
| 15-16 | Regiones, ciudades, comunas |
| 17 | Client catalogs |
| 18 | Import claims |
| 19 | Claim FKs y catálogos |

### 090-099 — Gestión Screens
| # | Descripción |
|---|-------------|
| 90 | Inspection action template |
| 91 | Gestión screen types |
| 92 | Gestión screens relation |
| 93 | Characteristic screen id |
| 94 | Action feature screen id |
| 95 | Remove screen type |
| 96 | Gestión screens fields |
| 97 | Form builder |
| 98 | Simple system fields |
| 99 | New schema |

### 100-120 — Coberturas, Reservas, Pólizas
| # | Descripción |
|---|-------------|
| 100 | Informe liquidación screen |
| 101 | Coverages and reserves |
| 102 | Fix reserva screen |
| 103 | Policy coverages |
| 104 | Reserva ajuste |
| 105 | Policies |
| 106 | Adjustment fields |
| 107 | Backfill policies |
| 108 | Review levels entity |
| 109 | General fields toplevel |
| 110 | Screen layouts |
| 111 | Document requests |
| 112 | Policy multiple business lines |
| 113 | Coverage catalog + gestión línea negocio |
| 114 | Coverage catalog country |
| 115 | Coverage document url |
| 116 | Claim actions is_automatic |
| 117 | Assistant role + claim documents |
| 121 | Rejection fields |
| 122 | Claim action history |
| 123 | Profile extra fields |
| 124 | Default roles |

### 125-140 — Fixes y Workflow
| # | Descripción |
|---|-------------|
| 125 | Fix claim action code format |
| 126 | ATCS claim status FK |
| 127 | Missing FKs |
| 128 | Action template line business FK |
| 129 | Inspection claim action link |
| 130 | Inspection legacy claim actions |
| 131 | Correlativo por template |
| 132 | Reactivate soft deleted |
| 133 | Inspection fixed screen |
| 134 | Fix sync inspection active |
| 135 | Workflow configs |
| 136 | Workflow final |
| 137 | Workflow unique |
| 138 | Workflow RLS |
| 139 | Template dependencies |
| 140 | Cascade trigger |

### 141-150 — Cascade y Auto-asignación
| # | Descripción |
|---|-------------|
| 141 | Add is_active |
| 142 | Dependencies by code |
| 143 | Cascade trigger v2 |
| 144 | Sync workflow |
| 145 | Workflow status |
| 146 | Triggers online |
| 147 | Fix audit trigger + fix workflow triggers |
| 148 | Sync no parent if child exists |
| 149 | Auto assign responsibles |
| 150 | Snapshot parent data |

### 151-160 — Roles, Inspecciones, Field Config, Daños
| # | Descripción |
|---|-------------|
| 151 | User secondary roles |
| 152 | Remove client operator |
| 153 | Clean roles and triggers |
| 154 | Auto inspection session |
| 155 | Inspector id + magic link |
| 156 | Fix inspector fallback |
| 157 | Third parties relacional |
| 158 | Field config catalogs |
| 159 | Damage catalogs (spaces, good types, building categories) |
| 160 | Third parties extend (insurance, claim_number, company_name) |
| 161 | Damage spaces × classifications (applicable_classifications) |

## Migraciones Clave (Detalle)

### 158 — field_config_catalogs.sql
Agrega columna `field_config` (JSONB) a `property_classifications` y
`housing_destinations`. Permite configurar qué campos del acta mostrar
y qué labels usar, según la clasificación y destino del bien.

```json
{
  "show": ["floor_count", "built_surface", ...],
  "hide": ["apartment_number", ...],
  "labels": { "age_years": "Antigüedad del Producto" }
}
```

### 154 — auto_inspection_session.sql
Cuando se emite una gestión COI, el trigger cascade crea automáticamente
la gestión INS y la `inspection_session` correspondiente.

### 149 — auto_assign_responsibles.sql
Al crear una gestión via workflow, asigna automáticamente `issuer_id`,
`reviewer_id`, `approver_id` según los `default_*_role` del template.

### 135-148 — Sistema de Workflows
Workflow automático que crea gestiones según país + línea + evento + estado.
- `workflow_configs` — configuración por combinación
- `workflow_steps` — pasos del workflow (level 1 = raíz, 2+ = dependiente)
- Triggers: status change, cascade on issue, recreate on reject

### 151 — user_secondary_roles.sql
Perfiles secundarios de usuarios para aparecer en combos de asignación.
Funciones: `get_users_by_role_for_company`, `get_users_by_roles_for_company`.

### 159 — damage_catalogs.sql
Crea 3 catálogos para el registro estructurado de daños:
- `damage_spaces` (22 espacios): Cocina, Baño, Dormitorio, Living, Garage, Oficina, Bodega Industrial, etc.
- `content_good_types` (16 tipos): Electrodomésticos, Electrónica, Móviles, Muebles, Ropa, Joyas, Maquinaria, Vehículos, etc.
- `building_damage_categories` (13 categorías): Muros, Pisos, Cielos, Cubierta, Estructura, Eléctricas, Sanitarias, Aberturas, etc.
- Agrega 3 FK a `inspection_damages`: `space_id`, `content_good_type_id`, `building_damage_category_id`

### 160 — third_parties_extend.sql
Extiende `third_parties` con 5 columnas para soportar culpables y afectados:
- `company_name` — empresa del tercero (si aplica)
- `has_insurance` — ¿el culpable tiene seguro?
- `insurance_company` — compañía del tercero
- `claim_number` — n° siniestro en su compañía
- `notes` — notas adicionales
- Normaliza `party_type` a "afectado"/"responsable" + RLS

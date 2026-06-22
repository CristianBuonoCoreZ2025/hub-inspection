# DATABASE REBRANDING RECOMMENDATIONS

## Hub Inspections → Claims Hub Platform

---

## Análisis de Impacto

### Tablas Principales

La base de datos está diseñada con nomenclatura genérica en inglés y plural:

- `claims` — siniestros
- `claims_participants` — participantes del siniestro
- `inspection_sessions` — sesiones de inspección
- `companies` — empresas/tenants
- `profiles` — perfiles de usuario
- `audit_logs` — auditoría
- `insurance_companies` — compañías aseguradoras
- `claim_causes`, `claim_types`, `business_lines` — catálogos

### Evaluación de Cambios

| Componente | Recomendación | Riesgo | Prioridad |
|-----------|----------------|--------|-----------|
| Nombre de tablas | NO cambiar — ya son genéricas y semánticas | Ninguno | — |
| Comentarios SQL en migraciones | Mantener histórico — son referencia de auditoría | Ninguno | Baja |
| Columnas `created_by`, `updated_by` | NO cambiar — usan user_id genérico | Ninguno | — |
| Tabla `inspection_sessions` | Mantener nombre — describe función correctamente | Medio | Baja |
| Esquema de PostgreSQL | NO cambiar — `public` es estándar | Alto | — |
| Nombre de la DB en Nhost | NO cambiar — implica recreación | Alto | — |

### Recomendación General

> **NO realizar cambios destructivos en la base de datos.**
>
> El esquema actual ya está diseñado con terminología genérica y profesional (inglés, plural, estándar de la industria). El rebranding es de marca comercial, no de modelo de datos.

---

## Cambios Sugeridos (No Destructivos)

### 1. Comments en tablas (opcional)

Actualizar los `COMMENT ON TABLE` de tablas principales para reflejar la nueva marca:

```sql
COMMENT ON TABLE claims IS 'Siniestros gestionados en Claims Hub Platform';
COMMENT ON TABLE inspection_sessions IS 'Sesiones de inspección remotas y presenciales en Claims Hub';
```

**Impacto**: Nulo. Solo metadatos de documentación.

### 2. Seed data (catálogos)

Ningún cambio requerido. Los catálogos (`claim_causes`, `claim_types`, etc.) usan terminología estándar del sector asegurador.

### 3. Columnas de branding

Si en el futuro se desea agregar un campo `platform_name` o similar a nivel de `companies`, se recomienda:

```sql
ALTER TABLE companies ADD COLUMN display_name TEXT;
```

Para permitir white-label por empresa.

---

## Migraciones Futuras (Plan)

| # | Migración | Justificación | Timing |
|---|-----------|-------------|--------|
| — | Agregar `display_name` a `companies` | White-label por empresa | Fase 2 |
| — | Agregar `claim_portal_url` a `companies` | URL del portal del cliente | Fase 3 |
| — | Crear tabla `vendor_network` | Red de proveedores | Fase 2 |
| — | Crear tabla `liquidation_items` | Detalle de liquidación | Fase 2 |
| — | Crear tabla `sla_rules` | Reglas de SLA por tipo de siniestro | Fase 3 |

---

## Riesgos Identificados

1. **Renombrar tablas existentes** — Alto riesgo. Rompería queries GraphQL, triggers, RLS, y foreign keys.
2. **Renombrar columnas** — Alto riesgo. Requiere actualización completa del frontend y backend.
3. **Cambiar esquema PostgreSQL** — Alto riesgo. Nhost espera `public`.

## Conclusión

El rebranding de marca **no requiere cambios en la base de datos**. El modelo de datos actual es robusto, genérico y preparado para crecer hacia la visión de Claims Hub Platform sin modificaciones estructurales.

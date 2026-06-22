# Claims Hub Platform — Visión del Producto

## Nombre Comercial

**Claims Hub** — Claims Lifecycle Management Platform

## Visión

Claims Hub Platform es la plataforma digital empresarial para la gestión integral del ciclo de vida de un siniestro. Unifica apertura de casos, asignaciones, inspecciones presenciales y remotas, videoinspecciones, gestión documental, evidencias, liquidación y analítica avanzada en una sola solución SaaS multi-tenant.

## Propuesta de Valor

> "La plataforma digital para la gestión integral de siniestros."

- **Reducción de tiempos de resolución** — desde la apertura del caso hasta la liquidación
- **Automatización operacional** — workflows inteligentes, asignaciones automáticas, SLAs
- **Trazabilidad completa** — auditoría inmutable de cada acción sobre cada caso
- **Gestión centralizada** — un único hub para aseguradoras, liquidadores, ajustadores y clientes
- **Experiencia del cliente** — portales dedicados, comunicaciones integradas, seguimiento en tiempo real
- **Inteligencia artificial** — detección de fraudes, estimación de daños, OCR, analítica predictiva
- **Seguridad empresarial** — multi-tenant, RLS, compliance, cifrado end-to-end

## Público Objetivo

### Primario
- **Aseguradoras** — departamentos de siniestros, operaciones y compliance
- **Empresas de liquidación** — liquidadores, supervisores, ajustadores
- **Corredores de seguros** — gestión de cartera y seguimiento de casos

### Secundario
- **Inspectores de campo** — mobile app para inspecciones presenciales
- **Clientes finales** — portal para seguimiento de su caso y carga de documentos
- **Auditores internos** — reportería, trazabilidad y control de calidad

## Objetivos Estratégicos

### Corto plazo (0-6 meses)
1. Consolidar módulo Core Claims (apertura, seguimiento, estados, asignaciones)
2. Estabilizar inspecciones remotas con LiveKit (videollamada, evidencia, firma)
3. Lanzar gestión documental básica (upload, clasificación, búsqueda)
4. Implementar agenda integrada con calendario de inspecciones

### Mediano plazo (6-18 meses)
1. Módulo de Liquidación Center (cálculos, reservas, pagos, integración contable)
2. Vendor Network (red de proveedores: constructoras, tasadores, peritos)
3. Customer Portal (cliente final puede seguir su caso y cargar documentos)
4. Mobile Field App (inspecciones presenciales offline-first)
5. AI Services v1 — OCR de documentos, clasificación automática de daños

### Largo plazo (18-36 meses)
1. Detección de fraude con ML
2. Analítica avanzada y BI integrado
3. Gestión de SLA con alertas predictivas
4. Marketplace de servicios (integración con terceros)
5. Expansión multi-país con localización completa

## Arquitectura Funcional

```
┌─────────────────────────────────────────────────────────────┐
│                    Claims Hub Platform                        │
├─────────────────────────────────────────────────────────────┤
│  Core Claims    │  Assessments  │  Evidence Center           │
│  ├─ Apertura    │  ├─ Remotas   │  ├─ Documentos            │
│  ├─ Workflow    │  ├─ Presencial│  ├─ Fotos/Videos            │
│  ├─ Asignaciones│  ├─ Videoinsp.│  ├─ Firmas                  │
│  ├─ Estados     │  ├─ Checklist │  └─ Croquis                 │
│  └─ Audit Log   │  └─ Informes  │                             │
├─────────────────────────────────────────────────────────────┤
│  Document Center│  Liquidation Center │  Vendor Network        │
│  ├─ Upload      │  ├─ Cálculos        │  ├─ Proveedores       │
│  ├─ Clasificación│ ├─ Reservas         │  ├─ Órdenes           │
│  ├─ Búsqueda    │  ├─ Pagos           │  └─ Facturación       │
│  └─ Templates   │  └─ Integración     │                         │
├─────────────────────────────────────────────────────────────┤
│  Customer Portal│  Mobile Field App  │  AI Services           │
│  ├─ Seguimiento │  ├─ Offline sync   │  ├─ OCR                │
│  ├─ Documentos  │  ├─ GPS capture    │  ├─ Clasif. daños      │
│  └─ Comunicación│  └─ Firma digital  │  └─ Fraude detection   │
├─────────────────────────────────────────────────────────────┤
│  Auth · Multi-tenant · RLS · Audit · Notifications · Reports │
└─────────────────────────────────────────────────────────────┘
```

## Posicionamiento Comercial

Claims Hub Platform se posiciona como la alternativa moderna a los sistemas legacy de gestión de siniestros. No es solo una herramienta de inspección — es el sistema operativo del departamento de siniestros.

**Diferenciadores clave:**
- Workflow end-to-end (no solo inspección)
- Inspecciones remotas integradas nativamente
- Arquitectura multi-tenant SaaS moderna
- API-first para integraciones
- AI-ready desde el diseño

## Estrategia de Crecimiento

1. **Land & Expand** — entrar con inspecciones remotas, expandir a gestión completa de casos
2. **Vertical** — dominar seguros de hogar/incendio, expandir a autos, salud, agro
3. **Geográfico** — Chile → LATAM → Global
4. **Partner** — integraciones con core systems de aseguradoras (guidewire, duck creek)
5. **White-label** — capacidad de rebrand por empresa/aseguradora

## Métricas de Éxito

- **Time to resolution** — reducción del 40% en tiempo de liquidación
- **First contact resolution** — 80% de casos resueltos en primer contacto
- **Customer satisfaction** — NPS > 50
- **Inspector utilization** — +30% en capacidad de inspección por inspector
- **Fraud detection** — detección del 15% de casos con indicios de fraude

---

Documento vivo. Última actualización: Junio 2026.

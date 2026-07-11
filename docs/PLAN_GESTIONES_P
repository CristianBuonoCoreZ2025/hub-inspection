# Plan: Sistema de Gestiones del Siniestro

## 1. Principio fundamental

**Todo funciona por el constructor.** No hay pantallas específicas programadas para "Reserva", "Coberturas", "Ajuste" o cualquier otra. Todas las pantallas se construyen con el constructor visual, usando los mismos campos y la misma lógica. Esto da dinamismo: cualquier pantalla puede modificarse sin programar.

---

## 2. Los 4 tipos de característica

El tipo lo define la **característica**, no la pantalla. Y puede cambiar dinámicamente.

### Tipo 1: Solo Template

**Qué significa:** La gestión solo tiene documentos (templates) relacionados. No tiene pantalla con campos.

**Ejemplo:** Prórroga del siniestro.

**Cómo funciona:**
1. En el catálogo, la característica "Prórroga" tiene templates relacionados
2. Se le configuran niveles de revisión (ej: solo emisión, emisor puede ser liquidador o inspector)
3. Al cargar la gestión al siniestro, se cargan los templates y los niveles
4. El sistema busca personas con esos roles en el siniestro
5. Cualquiera con acceso puede elegir a quién asignar desde un combo

**Puede cambiar a:** Pantalla + Template (si le agregas una pantalla con campos)

---

### Tipo 2: Solo Pantalla

**Qué significa:** Tiene una pantalla construida con el constructor. No tiene templates.

**Ejemplo:** Reserva.

**Cómo funciona:**
1. La característica tiene una pantalla diseñada con el constructor
2. La pantalla tiene campos propios + entidades simples + entidades complejas
3. No tiene templates relacionados
4. Se le configuran niveles de revisión

**Puede cambiar a:** Pantalla + Template (si le agregas templates)

---

### Tipo 3: Pantalla + Template

**Qué significa:** Tiene una pantalla construida Y templates relacionados.

**Ejemplo:** Ajuste.

**Por qué tiene ambos:** El ajuste tiene una pantalla con datos (grilla) y un formato que se envía a la compañía (template). Los datos de la pantalla se cargan en el template.

**Puede cambiar a:** Solo Pantalla (si le quitas los templates) o Solo Template (si le quitas la pantalla)

---

### Tipo 4: Genérica

**Qué significa:** Solo nombre y descripción. No tiene pantalla ni templates.

**Puede cambiar a:** Cualquier otro tipo (si le agregas pantalla y/o templates)

---

## 3. Cambio dinámico de tipo

El tipo no es fijo. Se define por qué tiene la característica:

| Tiene pantalla | Tiene templates | Tipo resultante |
|---|---|---|
| No | No | Genérica |
| No | Sí | Solo Template |
| Sí | No | Solo Pantalla |
| Sí | Sí | Pantalla + Template |

**Ejemplo de cambio dinámico:**
- Creas "Reserva" como Solo Pantalla
- Después decides que necesita un formato para la compañía
- Le agregas templates → automáticamente pasa a Pantalla + Template
- No hay que reprogramar nada

---

## 4. Niveles de revisión

Los niveles de revisión se configuran **en la característica** y se aplican **en la gestión**.

**Qué se configura en la característica:**
- Cuántos niveles tiene (1, 2, 3...)
- Qué nivel hace qué (emisión, revisión, aprobación)
- Qué roles puede tener cada nivel

**Ejemplo:**
- Nivel 1: Emisión → roles: liquidador, inspector
- Nivel 2: Revisión → roles: aprobador
- Nivel 3: Aprobación → roles: supervisor

**Qué pasa al cargar la gestión al siniestro:**
1. El sistema busca personas con esos roles en el siniestro
2. Si el emisor puede ser liquidador o inspector, muestra a todas las personas con esos roles
3. Cualquiera con acceso puede tomar el combo y elegir a quién asignar
4. La persona asignada queda con el caso a su cargo

---

## 5. El constructor de pantallas

**Para qué sirve:** Para construir cualquier pantalla sin programar. Todas las pantallas usan la misma lógica.

**Dónde está:** Catálogo → Configuración de Gestiones → Pantallas → Diseñar

**Cómo funciona:**
- Paleta de campos a la izquierda (click para agregar)
- Vista previa del formulario al centro (click en un campo para seleccionarlo)
- Propiedades del campo a la derecha (editar etiqueta, validaciones, etc.)

### Los 3 tipos de campos

**Campos propios** (el usuario los completa):
- Texto corto (alfanumérico o numérico, largo máximo)
- Descripción (texto largo)
- Número
- Fecha (con validaciones: mayor/menor/igual que otro campo o fecha actual)
- Selección (lista desplegable)
- Checkbox
- Tabla (con columnas configurables)
- Sección (separador visual)

**Entidades simples** (solo vista, datos que se muestran solos):

*Del siniestro:*
- N° Siniestro, N° Liquidación, Estado, Fecha Siniestro
- N° Póliza, Asegurado, Reclamante, Corredor, Liquidador, Dirección

*De la gestión:*
- Nombre de la acción
- Emisor, Revisor, Aprobador
- Fecha de creación, actualización, fecha esperada

**Entidades complejas** (solo vista, datos reales de la base de datos):
- Coberturas del siniestro (tabla real)
- Reservas creadas (con sus coberturas)
- Documentos del siniestro
- Participantes
- Historial de gestiones

---

## 6. Modelo de coberturas, reservas y ajustes

### Flujo (acumulativo)

```
Paso 1: Cargar coberturas del siniestro
        (acumulativas: todas las coberturas quedan disponibles)

Paso 2: Crear reserva
        (seleccionas cuáles coberturas entran y con qué montos)
        (tienes disponibles TODAS las coberturas del siniestro)

Paso 3: Crear ajuste
        (se desprenden de las reservas ya creadas)
        (tienes disponibles TODAS las reservas acumuladas)
```

### Tablas en la base de datos

**`claim_coverages`** — coberturas del siniestro
- Nombre, subcobertura, monto asegurado, reclamado, reservado, recuperado, deducible, reserva neta, moneda

**`claim_reserves`** — reservas del siniestro
- Moneda, capital, reclamado, deducible, reserva total, monto final, estado

**`reserve_coverages`** — qué coberturas tiene cada reserva
- Relación reserva ↔ cobertura con los montos específicos

> Estas tablas son el modelo de datos. Las pantallas para verlas se construyen con el constructor agregando la entidad compleja correspondiente.

---

## 7. Modelo de documentos

### Flujo

```
Paso 1: Solicitud de documentos
        (marcas qué documentos necesitas)

Paso 2: Relación con catálogos
        (los documentos se relacionan con póliza, línea de negocio o tipo de siniestro)

Paso 3: Recepción total de documentos
        (controlas: de los que pedí, ¿cuáles ya los tengo?)
```

---

## 8. Bosquejo: qué ve el usuario al hacer una gestión

### Caso 1: Solo Template (ej: Prórroga)

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver al siniestro                                   │
│                                                          │
│  ⚡ Prórroga del Siniestro          Estado: Borrador     │
│  Siniestro CL-2024-001                                  │
│                                                          │
│  ┌── NIVELES DE REVISIÓN ─────────────────────────────┐ │
│  │  Emisor (roles: liquidador, inspector)             │ │
│  │  [Juan Pérez (Liquidador)        ▼]                │ │
│  │  (combo con personas que tienen esos roles)        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── TEMPLATES RELACIONADOS ───────────────────────────┐│
│  │  📄 Solicitud de Prórroga        [Vincular] [Ver]  ││
│  │  📄 Carta a Compañía             [Vincular] [Ver]  ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│              [Cancelar]           [Guardar]              │
└─────────────────────────────────────────────────────────┘
```

### Caso 2: Solo Pantalla (ej: Reserva)

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver al siniestro                                   │
│                                                          │
│  ⚡ Reserva                         Estado: Borrador     │
│  Siniestro CL-2024-001                                  │
│                                                          │
│  ┌── NIVELES DE REVISIÓN ─────────────────────────────┐ │
│  │  Emisor: [Juan Pérez (Liquidador) ▼]               │ │
│  │  Revisor: [María López (Aprobador) ▼]              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── DATOS DEL SINIESTRO ──────────────────────────────┐│
│  │  N° Siniestro: CL-2024-001                          ││
│  │  N° Liquidación: LIQ-001                            ││
│  │  (solo vista, entidad simple del constructor)       ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── FORMULARIO (construido con el constructor) ───────┐│
│  │  Moneda *                Tipo de Cambio             ││
│  │  [USD           ▼]       [950.00       ]            ││
│  │                                                     ││
│  │  Capital Siniestro *     Reclamado *                ││
│  │  [50.000.000   ]        [45.000.000   ]             ││
│  │                                                     ││
│  │  Deducible               Reserva *                  ││
│  │  [500.000      ]        [44.500.000   ]             ││
│  │                                                     ││
│  │  Previsión Final *                                  ││
│  │  [44.000.000   ]                                   ││
│  │                                                     ││
│  │  Fecha de Pago *                                    ││
│  │  [📅 20/01/2024]                                    ││
│  │  ⚠ Debe ser mayor a la fecha actual                ││
│  │                                                     ││
│  │  Instrucción de Pago                                ││
│  │  [Transferencia bancaria...]                        ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── COBERTURAS DEL SINIESTRO ─────────────────────────┐│
│  │  ┌────────────┬──────────┬──────────┬──────────┐   ││
│  │  │ Cobertura  │ Asegurado│ Reclamad.│ Reserva  │   ││
│  │  ├────────────┼──────────┼──────────┼──────────┤   ││
│  │  │ Incendio   │ 50M      │ 45M      │ 44.5M    │   ││
│  │  │ Robo       │ 10M      │ 5M       │ 4.5M     │   ││
│  │  └────────────┴──────────┴──────────┴──────────┘   ││
│  │  (entidad compleja del constructor, datos reales)   ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│              [Cancelar]           [Guardar]              │
└─────────────────────────────────────────────────────────┘
```

### Caso 3: Pantalla + Template (ej: Ajuste)

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver al siniestro                                   │
│                                                          │
│  ⚡ Ajuste                          Estado: Borrador     │
│  Siniestro CL-2024-001                                  │
│                                                          │
│  ┌── NIVELES DE REVISIÓN ─────────────────────────────┐ │
│  │  Emisor: [Juan Pérez (Liquidador) ▼]               │ │
│  │  Revisor: [María López (Aprobador) ▼]              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── DATOS DEL SINIESTRO ──────────────────────────────┐│
│  │  N° Siniestro: CL-2024-001                          ││
│  │  (entidad simple del constructor)                   ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── PANTALLA (construida con el constructor) ─────────┐│
│  │  Provisión de Origen *                              ││
│  │  [44.500.000   ]                                   ││
│  │                                                     ││
│  │  Tipo Moneda *           Valor Moneda *             ││
│  │  [USD           ▼]       [950.00       ]            ││
│  │                                                     ││
│  │  Fecha Siniestro         Fecha Presupuesto          ││
│  │  [📅 10/01/2024]         [📅 18/01/2024]            ││
│  │                                                     ││
│  │  ┌── TABLA (campo tabla del constructor) ────────┐  ││
│  │  │ Cobertura  │ Reserva │ Ajuste  │ Diferencia │  ││
│  │  │ Incendio   │ 44.5M   │ 42M     │ -2.5M      │  ││
│  │  │ Robo       │ 4.5M    │ 4M      │ -0.5M      │  ││
│  │  │ Total      │ 49M     │ 46M     │ -3M        │  ││
│  │  └──────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── TEMPLATES RELACIONADOS ───────────────────────────┐│
│  │  📄 Formato de Ajuste (para compañía)              ││
│  │     [Vincular] [Ver]                                ││
│  │  (los datos de la pantalla se cargan en este doc)   ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│              [Cancelar]           [Guardar]              │
└─────────────────────────────────────────────────────────┘
```

### Caso 4: Genérica

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver al siniestro                                   │
│                                                          │
│  ⚡ Gestión Genérica                Estado: Borrador     │
│  Siniestro CL-2024-001                                  │
│                                                          │
│  ┌── NIVELES DE REVISIÓN ─────────────────────────────┐ │
│  │  Emisor: [Juan Pérez ▼]                             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── FORMULARIO (mínimo del constructor) ──────────────┐│
│  │  Nombre *                                           ││
│  │  [Llamada telefónica con asegurado]                 ││
│  │                                                     ││
│  │  Descripción                                        ││
│  │  [Se contactó al asegurado para...]                 ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│              [Cancelar]           [Guardar]              │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Qué ya está hecho

| Tarea | Estado |
|---|---|
| Constructor visual de pantallas (ScreenBuilder) | Listo |
| 3 tipos de campos (propios, entidades simples, complejas) | Listo |
| Validaciones de fecha | Listo |
| Propiedades de texto (alfanumérico/numérico, largo) | Listo |
| Tablas de coberturas y reservas | Listo |
| Servicios de coberturas y reservas | Listo |
| Entidades complejas muestran datos reales | Listo |
| Modal de características ampliado | Listo |

---

## 10. Qué falta hacer

| # | Tarea | Descripción |
|---|---|---|
| 1 | Quitar pantallas específicas | Eliminar las pantallas hardcoded (reserva, coberturas, etc.) y dejar todo vía constructor |
| 2 | Tipo dinámico en característica | El tipo (Solo Template, Solo Pantalla, etc.) se calcula automáticamente según tenga pantalla y/o templates |
| 3 | Niveles de revisión funcionales | Configurar niveles en la característica, asignar personas por rol al cargar la gestión |
| 4 | Templates relacionados en la gestión | Mostrar y vincular templates según el tipo de característica |
| 5 | Formulario de Reserva funcional | Seleccionar coberturas, guardar montos, cálculos (todo vía constructor) |
| 6 | Formulario de Ajuste | Se desprenden de las reservas (todo vía constructor) |
| 7 | Solicitud de documentos | Marcar qué documentos necesito |
| 8 | Recepción total de documentos | Controlar que los solicitados fueron recibidos |
| 9 | Bitácora de gestiones | Listado de gestiones del siniestro con estados y días |
| 10 | Workflow de siniestros | Por país, línea de negocio, evento (define qué gestiones aplican) |
| 11 | Datos del template cargados desde la pantalla | En Pantalla + Template, los datos del formulario se cargan en el documento |

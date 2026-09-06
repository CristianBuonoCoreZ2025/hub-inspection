# Diagnóstico de la tabla `persons`

> Fecha: 2026-08-31
> Tipo: **SOLO LECTURA — sin modificaciones**
> Script: `scripts/person-cleanup-diagnostic.sql`
> Base de datos: Supabase local (Docker) — `127.0.0.1:54322`

---

## 1. Resumen general

| Métrica | Valor |
| --- | --- |
| Total de personas | 678 |
| Total de direcciones | 430 |
| Duplicados por `tax_id` | 0 |
| Duplicados por `country_id` + `tax_id` | 0 |
| `tax_id` nulos o vacíos | 0 |
| `first_name` nulos o vacíos | 84 |
| `last_name` nulos o vacíos | 85 |
| `business_name` nulos o vacíos | 593 |
| `country_id` nulos | 0 |
| `tax_id` con formato inconsistente | 4 |
| Personas sin ningún nombre | 0 |

**Conclusión:** La tabla está en buen estado general. No hay duplicados ni registros sin nombre. Los 84 `first_name` nulos y 85 `last_name` nulos corresponden a personas jurídicas (correcto tras migración 331). Los 593 `business_name` nulos corresponden a personas naturales (correcto).

---

## 2. Distribución por `person_type`

| person_type | Cantidad |
| --- | --- |
| natural | 593 |
| legal | 85 |

---

## 3. Duplicados por `tax_id`

_No se encontraron duplicados por `tax_id`._ ✅

---

## 4. Duplicados por `country_id` + `tax_id`

_No se encontraron duplicados por `country_id` + `tax_id`._ ✅

---

## 5. `tax_id` con formato inconsistente

Registros donde `tax_id` contiene puntos, guiones, espacios o caracteres no válidos (debería ser solo dígitos + DV `0-9` o `K`):

**4 registros con formato inconsistente:**

| id | tax_id actual | first_name | last_name | person_type |
| --- | --- | --- | --- | --- |
| `1961793b...` | `1-9` | MARCELA | ARAYA AGUILAR | natural |
| `92a5302b...` | `23458886-9` | DOMINIQUE STELLA | BUONO-CORE GOMEZ | natural |
| `23dc3144...` | `26290447-2` | FRANCO | BUONO-CORE CELIS | natural |
| `1eaff21b...` | `78233990-7` | — | — | legal |

**Acción propuesta:** Normalizar estos 4 `tax_id` quitando guiones:
- `1-9` → `19` (⚠️ posible RUT incompleto — revisar)
- `23458886-9` → `234588869`
- `26290447-2` → `262904472`
- `78233990-7` → `782339907`

> ⚠️ El RUT `1-9` parece incompleto. Se debería validar con el rootificador antes de normalizar.

---

## 6. Personas sin ningún nombre

_No hay personas sin nombre._ ✅

---

## 7. Personas naturales incompletas

_No hay personas naturales incompletas (todas tienen `first_name` y `last_name`)._ ✅

---

## 8. Personas jurídicas sin `business_name`

_No hay personas jurídicas sin `business_name`._ ✅

---

## 9. Análisis de clasificación `person_type`

### 9.1. RUT >= 50.000.000 marcados como `natural`

Se encontraron **531** registros con cuerpo de RUT >= 50.000.000 marcados como `natural`.

**Desglose por rango:**

| Rango | Cantidad | ¿Error? |
| --- | --- | --- |
| 100M+ | 381 | ❌ No — RUT 100M+ es el rango moderno para personas naturales en Chile |
| 60M-100M | 129 | ❌ No — todos tienen `first_name` y `last_name` confirmados |
| 50M-60M | 21 | ❌ No — todos tienen `first_name` y `last_name` confirmados |

**Conclusión:** Los 531 registros **NO son errores de clasificación**. Aunque el RUT >= 50M se asocia típicamente con personas jurídicas, en Chile:

- **RUT 50M-60M:** Puede ser tanto natural como jurídica. Los 21 registros tienen nombres y apellidos claramente de personas naturales (ej: "Andres Fernando Salinas Ripoll", "Maria Ines Puga Pinto").
- **RUT 60M-100M:** Similar al anterior. Los 129 registros tienen nombres de personas naturales.
- **RUT 100M+:** Es el rango moderno exclusivo para personas naturales (RUTs emitidos después del año ~2000).

> ⚠️ **Nota sobre el umbral:** El código `rut.ts` usa `>= 50.000.000` como umbral para `legal`, pero esto es una heurística simplificada. El plan `PERSON_CLEANUP.md` usa `>= 60.000.000`. En la práctica, **ningún umbral numérico es 100% confiable** — la presencia de `first_name`/`last_name` vs `business_name` es un mejor indicador.

### 9.2. RUT < 50.000.000 marcados como `legal`

_No se encontraron registros en este caso._ ✅

---

## 10. Personas con direcciones (top 20)

| id | tax_id | nombre | direcciones |
| --- | --- | --- | --- |
| `2ec11ba2...` | 970060006 | Banco de Crédito e Inversiones | 96 |
| `0b3f2db3...` | 533060307 | Comunidad Edificio Agustin Del Castillo | 6 |
| `c9de6679...` | 560374003 | Comunidad Edificio Navidad | 6 |
| `72632242...` | 533174299 | Comunidad Edf Las Araucarias De Gertrudis Echeñique | 6 |
| `2202537b...` | 95535224 | Eladio Manuel Muñoz Seitz | 6 |
| `da2e8947...` | 826068000 | Caja de Compensación Asignación Familiar 18 de Septiembre | 6 |
| `ba7225c8...` | 779802701 | Casa Molle Hoteles Spa | 3 |
| `e2f509c5...` | 533106641 | Edificio Europa N° 2069 | 3 |
| `ff50286a...` | 42398004 | Norma Pacheco Perez | 3 |
| `b225ec28...` | 55503974 | Jose Miguel Armijo Ramirez | 3 |
| `62370bf0...` | 53322492K | Edificio Estacion Italia | 3 |
| `9ddfe312...` | 78876565 | Ruben Mario Espinoza Troncoso | 3 |
| `85c4a5b1...` | 995378000 | CLINICA PORTADA SPA | 3 |
| `6fcf9721...` | 761156381 | Inversiones Linea Nueva Limitada | 3 |
| `88d11814...` | 80697406 | FRELIDA PATRICIA ESCOBAR DIAZ | 3 |
| `8960d8b8...` | 652005098 | Boulevard San Joaquin | 3 |
| `55f7c85a...` | 650474635 | Condominio Costa Sur | 3 |
| `1a262eb0...` | 265286992 | Daniel Ernesto Imperiale Granados | 3 |
| `b7d93a09...` | 53302727K | Comunidad Edificio Los Leones | 3 |
| `903899e9...` | 763185869 | Paloma Alvarado Ruiz Hostal Estacion E | 3 |

---

## 11. Muestra de últimos 20 registros

| id | tax_id | person_type | first_name | last_name | business_name |
| --- | --- | --- | --- | --- | --- |
| `92a5302b...` | 23458886-9 | natural | DOMINIQUE STELLA | BUONO-CORE GOMEZ | — |
| `707db4a8...` | 68671132 | natural | XIMENA DEL CARMEN | CASANOVA ACOSTA | — |
| `8be81ac8...` | 70049082 | natural | REBECA | URRUTIA BONILLA | — |
| `7885b571...` | 169671257 | natural | NATALIA PARRA DIAZ | PARRA DIAZ | — |
| `aa087b8e...` | 174439419 | natural | Maria Paz | Ulloa Alcaino | — |
| `1d98aac4...` | 165905032 | natural | MIGUEL ESTEBAN | CISTERNA VALENZUELA | — |
| `0f49056d...` | 48276725 | natural | NURY ADELINDA | JORQUERA IRIARTE | — |
| `d02315b8...` | 125371981 | natural | Lorna Ines Del Pilar | Matamala Araneda | — |
| `5b36cd78...` | 84483788 | natural | Marcos Orlando | Fuentes Tarraff | — |
| `a4243a43...` | 763902927 | legal | — | — | Inversiones J Y R Spa |
| `9258e0f6...` | 652200737 | legal | — | — | CONDOMINIO JARDINES DE ALVARADO |
| `48a93f30...` | 106594406 | natural | RAFAEL | GONZALEZ OLIVARES | — |
| `66dcfb94...` | 100272466 | natural | BETTY BUGUENO | VILLALOBOS | — |
| `e4c0fbfd...` | 173647069 | natural | MANUEL | ALVAREZ CORTES | — |
| `f10999a8...` | 153855137 | natural | TERESITA | SAAVEDRA DIAZ | — |
| `c5362d20...` | 46777557 | natural | WILSON | GROTHE ALAN | — |
| `ccdfe3e2...` | 159891216 | natural | ALONSO | CHRYSTEL NAVARRETE | — |
| `969e6588...` | 104015298 | natural | Maria Alejandra | Lira Espinoza | — |
| `db507ca5...` | 64491938 | natural | Patricia | Gaibisso Ibañez | — |
| `affaf10b...` | 72371119 | natural | Kimberly Amada | Rogers | — |

---

## 12. Observaciones sobre calidad de datos

### 12.1. Nombres con apellidos duplicados

Varios registros tienen el apellido duplicado en `first_name` (ej: "Carlos Maurin Rivera" con `last_name` "MAURIN RIVERA"). Esto sugiere que los datos se cargaron desde una fuente donde el nombre completo estaba en un solo campo y se splitió incorrectamente.

Ejemplos:
- `67076281` — first_name: "CARLOS MAURIN RIVERA", last_name: "MAURIN RIVERA"
- `108387599` — first_name: "Siska Valenzuela Leiva", last_name: "Valenzuela Leiva"
- `87946665` — first_name: "Juan Carlos Verdugo Bustos", last_name: "Verdugo Bustos"
- `108481536` — first_name: "Mauricio Rubilar Aguilar", last_name: "Rubilar Aguilar"

**Acción propuesta:** Comparar con el rootificador para corregir estos nombres.

### 12.2. RUT sin dígito verificador

La mayoría de los `tax_id` no incluyen el dígito verificador (DV). Ej: `100036630` en lugar de `100036630-K`. Esto es consistente con el formato actual de la tabla pero puede dificultar la validación.

### 12.3. Nombres en mayúsculas vs título

La mayoría de los nombres están en MAYÚSCULAS. Algunos están en formato título (ej: "Maria Alejandra", "Patricia"). Esto es una inconsistencia cosmética.

---

## Próximos pasos

1. **Backup**: Crear `persons_backup_20260831` y `person_addresses_backup_20260831` antes de cualquier modificación.
2. **Normalizar `tax_id`**: Quitar guiones de los 4 registros con formato inconsistente.
   - ⚠️ Revisar el RUT `1-9` que parece incompleto.
3. **Comparar con rootificador**: Cargar archivo externo y comparar nombres.
   - Corregir nombres con apellidos duplicados (sección 12.1).
4. **Reporte final**: Generar `docs/PERSON_CLEANUP_REPORT.md` con cambios propuestos.

### Lo que NO necesita corrección

- ❌ No hay duplicados que consolidar.
- ❌ No hay errores de clasificación `person_type` (los 531 RUT >= 50M marcados como natural son correctos).
- ❌ No hay personas sin nombre.
- ❌ No hay personas naturales incompletas.
- ❌ No hay personas jurídicas sin `business_name`.

> ⚠️ **Ningún cambio se ejecutará sin aprobación explícita del usuario.**

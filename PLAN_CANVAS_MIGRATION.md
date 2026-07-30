# Arquitectura Definitiva del Editor de Croquis

> **Estado:** FASE 1 — Arquitectura y diseño funcional (pendiente de aprobación)
> **Fecha:** 2026-07-30
> **Filosofía:** Construir una sola vez. Evolucionar durante 10 años sin rediseñar el núcleo.

---

## 1. Visión general

El Editor de Croquis es el motor gráfico oficial de la plataforma Claims Hub
para representar visualmente un siniestro. No es un software CAD. No busca
precisión arquitectónica. Busca que un inspector o un asegurado explique
visualmente qué pasó, en menos de 2 minutos, con claridad suficiente para que
cualquier persona que vea el resultado entienda la situación sin haber estado
presente.

El editor tiene dos usuarios:

- **Liquidador / inspector** — desde el dashboard.
- **Asegurado** — desde el Magic Link (inspección remota).

Ambos usan exactamente la misma herramienta con las mismas funcionalidades.

---

## 2. Filosofía del producto

- Priorizar velocidad sobre precisión.
- Priorizar claridad sobre detalle.
- Priorizar comunicación visual sobre exactitud arquitectónica.
- Reducir clics. Reducir escritura. Reducir formularios.
- No interrumpir el flujo.
- Toda información adicional debe ser opcional.
- Toda funcionalidad nueva debe responder una sola pregunta:
  **¿Ayuda al inspector a terminar el croquis más rápido?**
  Si la respuesta es no, no se implementa.

---

## 3. Principios de UX

- El croquis completo debe poder realizarse en menos de 2 minutos.
- El usuario nunca debe estar obligado a escribir un nombre (la numeración
  es automática).
- El usuario nunca debe estar obligado a ingresar medidas (son opcionales).
- El usuario nunca debe conectar elementos manualmente (las relaciones son
  automáticas por proximidad).
- La interfaz no debe mostrar información vacía ("___ x ___").
- El color se usa para comunicar, no para decorar.

---

## 4. Modelo de entidades

El editor deja de trabajar con dibujos. Trabaja con **entidades**.

Cada entidad tiene:

- **Identidad** — qué es (dormitorio, muro, puerta, etiqueta, comentario).
- **Representación gráfica** — cómo se ve en el lienzo.
- **Propiedades** — nombre, medidas, tipo, destino, etc. (según el tipo).
- **Eventos** — cómo responde a interacciones (clic, doble clic, arrastre).
- **Serialización** — cómo se guarda y reconstruye.
- **Exportación** — cómo aparece en el PNG y en la estructura de datos.

El dibujo es solamente la representación visual de la entidad. Nunca se crea
un objeto que sea únicamente un rectángulo de color sin identidad.

---

## 5. Categorías de entidades

El catálogo se organiza en **5 categorías**:

### 5.1 Espacios

Representan áreas o recintos del inmueble.

Ejemplos: Dormitorio, Living, Comedor, Cocina, Baño, Oficina, Sala, Hall,
Pasillo, Patio, Jardín, Bodega, Galpón, Área común, Estacionamiento, Local
comercial, Otros.

Características:

- Se representan mediante bloques redimensionables.
- Cada bloque lleva su nombre escrito dentro (numeración automática).
- Admiten texturas configurables (ver § 12).
- Admiten medidas opcionales (largo y ancho). Si existen, se muestran
  automáticamente sobre el bloque. Si no existen, no se muestra nada.
- Doble clic abre el panel de propiedades.

### 5.2 Estructura

Representan elementos constructivos del inmueble.

Ejemplos: Muro, Puerta, Ventana, Escalera, Portón, Reja, Pilar, Ascensor.

Características:

- Cada elemento tiene representación gráfica propia. Una puerta parece una
  puerta. Una ventana parece una ventana. Una escalera parece una escalera.
  Un muro parece un muro. Nunca se utilizan bloques de color genéricos.
- Las puertas y ventanas se asocian a muros por proximidad (snap). Si el muro
  se mueve, la puerta o ventana acompaña. No quedan flotando.

Propiedades mínimas por tipo:

| Tipo | Propiedades |
|---|---|
| Muro | Nombre, Longitud, Tipo (Interior / Exterior / Medianero) |
| Puerta | Nombre, Ancho |
| Ventana | Nombre, Ancho, Alto |
| Escalera | Nombre, Destino |

Toda propiedad adicional debe justificarse cuidadosamente.

### 5.3 Objetos

Representan mobiliario, vehículos, electrodomésticos y elementos que no son
espacios ni estructura.

Ejemplos: Vehículo, Bicicleta, Caja, Escritorio, Silla, Mesa, Árbol,
Lavadora, Refrigerador, WC, Tina, Ducha.

Características:

- Todos utilizan representación gráfica propia (SVG). Nunca rectángulos ni
  cuadrados de color.
- Solo permiten escalamiento proporcional. Una silla nunca puede terminar
  del tamaño de una habitación. Una bicicleta nunca puede ocupar media casa.
- Siempre conservan la proporción original.

### 5.4 Equipamiento

Representa equipos industriales, eléctricos y mecánicos propios de oficinas,
galpones e instalaciones.

Ejemplos: Maquinaria, Rack, Tablero eléctrico, Motor, Transformador, Caldera,
Compresor, Grupo electrógeno.

Características:

- Representación gráfica propia (SVG).
- Escalamiento proporcional (como Objetos).
- Es una categoría separada de Objetos porque conceptualmente son equipos
  fijos de instalación, no mobiliario móvil. Esto permite crecer sin mezclar
  conceptos.

### 5.5 Anotaciones

Representan información textual sobre el plano. Reemplazan al texto libre.

Dos tipos:

- **Etiqueta** — identifica un sector. Ejemplos: "Zona inundada", "Zona
  vecino", "Acceso", "Segundo piso". Se representa con formato de etiqueta
  (fondo y borde propios). Al soltarla, solicita el texto al usuario.
- **Comentario** — explica una situación. Se representa con formato de
  comentario (marca visual distinta a la etiqueta). Al soltarlo, solicita el
  texto al usuario.

Las etiquetas y comentarios admiten color de la paleta reducida (ver § 9)
para comunicar significado:

| Color | Uso sugerido |
|---|---|
| Rojo | Zona dañada |
| Azul | Ingreso de agua |
| Verde | Área inspeccionada |
| Amarillo | Observación |
| Gris | Referencia |

El color es del usuario: puede asignarlo libremente dentro de la paleta
reducida. La tabla anterior es una convención sugerida, no obligatoria.

---

## 6. Biblioteca basada en configuración (catalog.json)

**Esta es la decisión arquitectónica más importante del documento.**

El catálogo de entidades NO se codifica directamente en los componentes. Se
define mediante un archivo de configuración declarativa.

Formato de cada definición de entidad:

```json
{
  "id": "bathroom",
  "category": "spaces",
  "defaultLabel": "B",
  "icon": "bath",
  "texture": "tiles",
  "defaultProperties": {},
  "renderer": "block",
  "scaleMode": "free"
}
```

Campos:

| Campo | Descripción |
|---|---|
| `id` | Identificador único de la entidad. |
| `category` | Categoría: `spaces`, `structure`, `objects`, `equipment`, `annotations`. |
| `defaultLabel` | Etiqueta por defecto para la numeración automática (ver § 11). |
| `icon` | Icono de la biblioteca (lucide o SVG propio). |
| `texture` | Textura sugerida (puede cambiarse, ver § 12). |
| `defaultProperties` | Propiedades iniciales (medidas, tipo, etc.). |
| `renderer` | Cómo se dibuja: `block` (espacio), `svg` (objeto/equipamiento), `line` (muro), `group` (puerta/ventana). |
| `scaleMode` | `free` (redimensionar libre) o `proportional` (mantener proporción). |

**Agregar una nueva entidad no requiere modificar el editor.** Solo se agrega
una nueva definición al archivo de configuración. El editor lee el catálogo,
renderiza la biblioteca, instancia la entidad y aplica su comportamiento
según el `renderer` y `scaleMode` declarados.

Esto permite que mañana se agregue "Sala de bombas" o "Batería de
condensadores" sin tocar el núcleo del editor.

---

## 7. Favoritos

La biblioteca incluye una sección **Favoritos** en la parte superior.

Contiene automáticamente los elementos más utilizados por el inspector. En
la primera versión, con un conjunto inicial razonable:

- Muro
- Puerta
- Ventana
- Dormitorio
- Baño
- Comentario

El sistema registra qué entidades usa cada inspector con más frecuencia y
reordena los favoritos automáticamente. El objetivo es reducir aún más la
búsqueda dentro de la biblioteca.

---

## 8. Buscador

La biblioteca incluye un campo de búsqueda en la parte superior.

Ejemplo de uso:

```
Buscar...    [ba]
```

Resultados:

- Baño
- Bodega
- Balcón

El buscador filtra todas las entidades del catálogo por nombre, sin importar
en qué categoría estén. Es más rápido que abrir acordeones cuando el
inspector sabe qué busca.

---

## 9. Barra superior

Simplificada. Contiene únicamente:

| Herramienta | Función |
|---|---|
| Seleccionar | Mover, redimensionar, rotar entidades. |
| Dibujar | Lápiz a mano alzada. |
| Etiqueta | Soltar una etiqueta (pide texto). |
| Comentario | Soltar un comentario (pide texto). |
| Deshacer | Revertir última acción. |
| Rehacer | Reaplicar acción deshecha. |
| Guardar | Exportar PNG y enviar al backend. |

**Paleta de colores reducida:** 5 colores fijos (rojo, azul, verde, amarillo,
gris). No hay selector de color libre ni personalización completa. Los
colores se utilizan principalmente para anotaciones, comentarios y resaltado
de zonas. No hay control de grosor del lápiz visible en la barra (el grosor
es fijo y propio del croquis).

**Más herramientas:** Las figuras geométricas básicas (línea, rectángulo,
círculo, polígono) existen pero se agrupan en una sección secundaria
desplegable "Más herramientas". No forman parte del flujo principal porque la
mayoría de los croquis utilizarán entidades inteligentes. Existen para casos
excepcionales donde el inspector necesita representar una forma no contemplada
en la biblioteca (muro provisorio, cierre, piscina irregular, zona cercada,
canil, ampliación, galpón con forma extraña).

---

## 10. Propiedades

Al hacer doble clic sobre una entidad, se abre un panel pequeño.

- Nunca formularios largos.
- Nunca ventanas complejas.
- Solo las propiedades mínimas del tipo de entidad (ver § 5.2 para estructura;
  espacios tienen nombre, largo y ancho).
- Las medidas son opcionales. Si no se llenan, no se muestran sobre el plano.
- Nunca se muestra información vacía.

---

## 11. Numeración automática

Eliminar escritura innecesaria.

| Entidad | Numeración |
|---|---|
| Dormitorio | D1, D2, D3... |
| Baño | B1, B2... |
| Living comedor | L-C |
| Cocina | C |
| Muro | M1, M2... |
| Puerta | P1, P2... |
| Ventana | V1, V2... |

El `defaultLabel` del catálogo (ver § 6) define el prefijo. El editor cuenta
cuántas entidades del mismo tipo existen y asigna el número automáticamente.

El usuario puede modificar el nombre después con doble clic. Nunca está
obligado a escribirlo.

---

## 12. Texturas configurables

Las texturas NO representan materiales. Sirven únicamente para distinguir
visualmente sectores y mejorar la lectura del croquis.

Cada espacio tiene una textura sugerida (definida en el catálogo), pero el
usuario puede cambiarla:

- Sin textura
- Textura A
- Textura B
- Textura C

Esto permite que dos oficinas se vean iguales si el inspector lo prefiere, o
distintas si necesita diferenciarlas.

---

## 13. Snap (motor de吸附)

El snap es un comportamiento del **motor**, no una funcionalidad específica de
cada entidad.

El motor debe soportar snap entre:

- Muros y muros (conexión de extremos).
- Puertas y muros (asociación por proximidad).
- Ventanas y muros (asociación por proximidad).
- Espacios y espacios (alineación de bordes).
- Objetos y guías de alineación (líneas guía visuales al arrastrar).

Si un muro se mueve, las puertas y ventanas asociadas se mueven con él. No
quedan flotando.

---

## 14. Relaciones

Las puertas se asocian a muros. Las ventanas se asocian a muros.

La asociación es automática por proximidad (snap). El usuario no conecta nada
manualmente.

Si un muro cambia de posición, longitud o ángulo, las puertas y ventanas
asociadas se reubican para mantener la relación.

---

## 15. Tipo de bien

La inspección ya conoce el tipo de bien (casa, departamento, edificio, galpón,
maquinaria, oficina, otros).

El editor utiliza automáticamente esa información para **reordenar** la
biblioteca:

- Si es una casa → "Espacios" aparece abierto primero.
- Si es un galpón → "Estructura" y "Equipamiento" aparecen primero.
- Si es una oficina → "Espacios" y "Objetos" aparecen primero.

Nunca se ocultan elementos. Solo se reordenan. No se le vuelve a preguntar el
tipo de bien al usuario. No se agrega otro selector.

---

## 16. API interna de entidades

Cada entidad debe implementar el mismo contrato interno. Como mínimo:

| Método | Descripción |
|---|---|
| Identidad | `id`, `type`, `category`, `label` |
| Representación gráfica | Cómo se dibuja en el lienzo (SVG, bloque, línea, grupo). |
| Propiedades | Lista de propiedades editables (para el panel de doble clic). |
| Eventos | Cómo responde a clic, doble clic, arrastre, resize, rotación. |
| Serialización | Cómo se guarda a JSON y se reconstruye desde JSON. |
| Exportación | Cómo aparece en el PNG final. |

Todas las entidades se comportan de forma consistente. Agregar un nuevo tipo
es trivial: se agrega la definición al catálogo y se implementa el contrato.

---

## 17. Compatibilidad (sin cambios)

Se mantiene sin modificaciones:

- Fabric.js como motor del lienzo.
- Exportación PNG base64.
- Cloudflare R2 (almacenamiento).
- Magic Link (asegurado).
- Dashboard (inspector).
- Responsive (5 breakpoints).
- Undo / Redo.
- API existente (`/api/inspection/sketch`).
- Payload existente (`{ sessionId, sketchDataUrl, label, sketchId? }`).
- Carga de croquis anteriores como fondo bloqueado.

El backend no se modifica. El PNG sigue siendo lo que se envía al endpoint.

---

## 18. Estructura de datos (preparada, no enviada aún)

Cada entidad del plano guarda su identidad completa: tipo, nombre, medidas,
posición, relaciones y color. Esta estructura se puede serializar a JSON
organizado para que una IA la lea sin interpretar la imagen.

**Hoy el backend sigue recibiendo solo el PNG.** La estructura JSON queda
disponible en el editor. Cuando se decida integrar análisis con IA, se añade
el envío del JSON al endpoint sin rediseñar el editor.

---

## 19. Herramientas futuras (arquitectura preparada)

Aunque no se implementen ahora, la arquitectura debe quedar preparada para
incorporar en el futuro sin rediseñar el núcleo:

- **Flechas** — para indicar direcciones, flujos o accesos.
- **Polígonos** — para zonas con formas irregulares.
- **Zonas de daño** — áreas marcadas que se asocian a un tipo de daño.
- **Capas** — para separar estructura, mobiliario, daños y anotaciones.
- **IA** — análisis automático del plano a partir de la estructura de datos.
- **Exportación estructurada** — JSON/XML para integraciones externas.

El motor de entidades y la API interna (§ 16) están diseñados para que estas
funcionalidades se agreguen como extensiones, no como rediseños.

---

## 20. Visión de largo plazo

Este editor será el **motor gráfico oficial de toda la plataforma**.

Cualquier módulo futuro que necesite representar visualmente un inmueble, una
oficina, un galpón, una maquinaria o un siniestro deberá reutilizar este mismo
motor.

La arquitectura debe permitir agregar nuevas entidades, herramientas y
comportamientos sin modificar el núcleo del editor.

---

## 21. Cierre

No quiero que el resultado sea un editor de dibujo mejorado. Quiero una
**plataforma gráfica extensible, orientada a inspecciones de siniestros, cuya
arquitectura pueda evolucionar durante los próximos 10 años sin requerir un
nuevo rediseño del núcleo.**

---

> **🛑 PUNTO DE DETENCIÓN.**
> Este documento queda en revisión. No se iniciará la implementación ni se
> modificará ningún archivo de código fuente hasta la aprobación explícita del
> usuario.

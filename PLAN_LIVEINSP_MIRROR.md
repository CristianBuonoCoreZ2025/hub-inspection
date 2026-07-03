# Plan: LiveInsp = espejo de AppInsp (sin Informe)

## Objetivo
El magic link (`/inspection/[token]`) debe mostrar las mismas pestañas que el inspector (`/dashboard/inspecciones/[id]`), excepto "Informe". El cliente ve en tiempo real todo lo que el inspector hace, y puede firmar.

## Pestañas a mostrar en LiveInsp
1. **Resumen** — datos del siniestro, asegurado, contacto, estado (read-only)
2. **Acta** — formulario del acta (read-only para el cliente, ve lo que el inspector llena)
3. **Checklist** — items agrupados por área (read-only)
4. **Daños** — lista de daños (read-only)
5. **Evidencias** — grilla de fotos/videos/docs (read-only, con presigned URLs)
6. **Croquis** — imágenes de croquis (read-only, con presigned URLs)
7. **Firmas** — canvas de firma para el asegurado + ver firma del ajustador (INTERACTIVO: el cliente firma)
8. **Chat** — chat con inspector (INTERACTIVO: el cliente puede escribir)

## Pestaña que NO se muestra
- **Informe** — solo el inspector lo ve/genera

## Arquitectura

### Problema clave
Los tabs del inspector (appins) usan servicios que llaman a GraphQL directamente desde el cliente con el token del usuario autenticado. El magic link (liveinsp) NO tiene usuario autenticado → no puede usar esos servicios directamente.

### Solución
1. **API route unificada** `/api/inspection/live/[token]` ya devuelve la sesión con todos los datos relacionados (evidencias, notas, checklist, daños, chat, claim). Para acta, croquis y firmas necesito ampliar la query.

2. **API routes adicionales** para operaciones que el cliente necesita hacer:
   - `POST /api/inspection/chat` — enviar mensaje del cliente
   - `POST /api/inspection/sign` — guardar firma del asegurado (subir imagen + crear registro)

3. **Componentes read-only** para liveinsp: reutilizar los componentes existentes pero en modo `readOnly={true}` cuando sea posible, o crear versiones simplificadas.

### Estructura de archivos
```
src/app/inspection/[token]/
  page.tsx              — layout con tabs (dark theme, sin sidebar)
  tabs/
    resumen-tab.tsx     — read-only, datos del siniestro
    acta-tab.tsx        — read-only, muestra el acta con los datos actuales
    checklist-tab.tsx   — read-only, agrupado por área
    damages-tab.tsx     — read-only, lista de daños
    evidences-tab.tsx   — read-only, grilla con presigned URLs
    sketches-tab.tsx    — read-only, croquis con presigned URLs
    signatures-tab.tsx  — interactivo: canvas para firma del asegurado
    chat-tab.tsx        — interactivo: input + lista de mensajes
```

### Cambios en la API route live
Ampliar `INSPECTION_LIVE_QUERY` para incluir:
- `inspection_signatures` (para tab de firmas)
- `inspection_damage_sketches` (para tab de croquis)
- Campos del acta ya están en la query (property_risk, property_materiality, etc.)

### API routes nuevas
- `POST /api/inspection/chat` — { sessionId, message, senderName } → inserta mensaje con sender_role="client"
- `POST /api/inspection/sign` — { sessionId, role: "insured", signatureDataUrl } → sube imagen + crea registro

## Pasos

- [ ] Paso 1: Ampliar `INSPECTION_LIVE_QUERY` con signatures y sketches
- [ ] Paso 2: Presigned URLs para signatures y sketches en la API route live
- [ ] Paso 3: Crear API route `POST /api/inspection/chat` (mensaje del cliente)
- [ ] Paso 4: Crear API route `POST /api/inspection/sign` (firma del asegurado)
- [ ] Paso 5: Reescribir `page.tsx` del magic link con tabs (dark theme)
- [ ] Paso 6: Crear componentes de tabs read-only + interactivos
- [ ] Paso 7: Verificar lint/typecheck

## Notas
- El tema visual del liveinsp se mantiene dark (slate-950) como está ahora
- El polling cada 3s se mantiene para tiempo real
- Las presigned URLs se regeneran en cada poll (expiran en 30s)
- El cliente solo puede: firmar (asegurado) y chatear. Todo lo demás es read-only.

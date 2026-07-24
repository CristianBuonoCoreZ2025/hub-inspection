# Inspecciones — Reglas de negocio

## Magic Link de inspección remota

### Ventana de vigencia

Para inspecciones del tipo `remote`, el magic link tiene una ventana de
vigencia basada en la fecha/hora programada (`scheduled_at`):

```
Inicio de ventana = scheduled_at - 1 hora
Fin de ventana    = scheduled_at + 1 hora
```

Ejemplo: si la inspección está programada para el **25/07/2026 14:30**:

- El link funciona entre **13:00 y 15:30**.
- Antes de las 13:00 la app muestra **"Link aún no activo"**.
- Después de las 15:30 el link está **expirado**.

### Extensión única dentro de la ventana

Si el asegurado o el liquidador solicita renovar el link **dentro de la
ventana** (por ejemplo a las 14:00 o 14:45), el sistema lo extiende **una
sola vez** hasta:

```
scheduled_at + 2 horas
```

En el ejemplo anterior, el link quedaría vigente hasta las **16:30**.

- Solo se permite **una** extensión por sesión (`magic_link_extended = true`).
- Una vez usada la extensión, el link no se puede volver a ampliar.
- Cuando expira, la app muestra **"Link expirado"** y no se puede reactivar.

### Renovación fuera de la ventana

Si se solicita renovar **antes del inicio de la ventana**, el sistema
entrega un **nuevo token** pero **sin modificar el rango** de vigencia. La
ventana sigue siendo `[scheduled_at - 1h, scheduled_at + 1h]`.

Esto permite reenviar el link al asegurado con anterioridad sin alterar la
hora de inicio.

### Regeneración / re-coordinación

- Al coordinar/re-coordinar una inspección remota, el trigger
  `auto_create_inspection_session` calcula el nuevo `magic_link_expires_at`
  como `scheduled_at + 1h` y resetea `magic_link_extended = false`.
- Si cambia `scheduled_at`, el rango se recalcula con la nueva hora.
- La extensión se reinicia, permitiendo una nueva extensión única.

### Relación con la gestión INS

Una sesión de inspección **siempre** debe estar vinculada a:

- Un siniestro (`claim_id`).
- Una gestión del tipo `INS` (`claim_action_id`).

Si se borra la gestión `INS`, la sesión y todo su contenido se borran en
cascada. No pueden existir inspecciones huérfanas.

### Funciones de base de datos

- `auto_create_inspection_session()` — crea/actualiza la sesión y calcula la
  ventana del magic link al crear/coordinar una gestión `INS`.
- `renew_inspection_magic_link(p_session_id uuid)` — regenera o extiende el
  link según la regla descrita arriba.

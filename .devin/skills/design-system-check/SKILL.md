# Design System Check

## Cuándo activar
Esta skill se activa SIEMPRE antes de modificar cualquier archivo `.tsx` o `.css` en el proyecto.

## Reglas Obligatorias (resumen)

Antes de hacer cualquier cambio en la UI, verificar:

1. **LEER `docs/DESIGN_SYSTEM.md`** completo
2. **Botones**: `pg-btn-platinum`, texto de 1 palabra
3. **Inputs**: `app-input`, labels `app-field-label`
4. **Selects**: Portal + positionMethod="fixed" + z-9999, siempre abajo, sideOffset=0
5. **NO checkboxes**: usar Eye/EyeOff o ToggleChip
6. **NO isolate** en overlays/positioners
7. **Iconos**: lucide-react únicamente
8. **field_config**: todo dinámico desde BD, nada hardcoded
9. **Permisos**: canCreate/canEdit/canDelete en todas las acciones
10. **Idioma**: español (Chile)
11. **tsc + eslint**: 0 errores, 0 warnings, SIEMPRE

## Archivos de referencia
- `docs/DESIGN_SYSTEM.md` — Reglas completas de diseño
- `docs/ARCHITECTURE.md` — Arquitectura del proyecto
- `docs/README.md` — Índice de documentación
- `AGENTS.md` — Reglas del proyecto y decisiones técnicas

## Prohibido
- NO usar checkboxes
- NO usar btn-danger, btn-neutral, btn-cancel, btn-close, btn-skip, btn-save, btn-create
- NO usar liquid-button, liquid-button-outline
- NO usar liquid-search (usar app-input)
- NO usar isolate en overlays/positioners
- NO usar texto de 2+ palabras en botones
- NO usar emojis en la UI
- NO hardcodear field_config (siempre desde BD)
- NO crear inspecciones directamente (solo via workflow COI → INS)
- NO usar mass replace scripts (causan duplicados de className)

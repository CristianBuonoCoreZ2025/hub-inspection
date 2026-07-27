# Dropdown Emerge — Efecto visual de origen

> Indicador visual de que un dropdown emerge del botón que lo disparó.
> Aplica a todos los `DropdownMenu` que usen `btn-icon-sm` como trigger.

## Marcadores

| Versión | Descripción |
|---------|-------------|
| **A0** | Estado base — sin efectos visuales de origen |
| **A1** | Combinación de los 3 efectos: flecha + botón activo + animación |

## A1 — Efectos combinados

Al abrir un dropdown desde un `btn-icon-sm`, se aplican 3 efectos simultáneos:

### 1. Flecha (Arrow)
- Triángulo SVG (14×8px) arriba del menú que apunta al botón trigger
- Posicionado según `align`: `end` → derecha, `start` → izquierda, `center` → centro
- Renderizado **fuera** del `Popup` (que tiene `overflow`) pero **dentro** del `Positioner`
- Mismo fill que el popover (`fill-popover/85`)

**Implementación:** `src/components/ui/dropdown-menu.tsx`
- Prop `arrow?: boolean` en `DropdownMenuContent`
- Cuando `arrow={true}`, renderiza el SVG como hermano del `MenuPrimitive.Popup`

### 2. Botón activo
- Mientras el menú está abierto, el botón trigger se "enciende"
- Base UI setea `data-popup-open` en el trigger automáticamente
- Estilos aplicados:
  - `color: var(--primary)`
  - `border-color: color-mix(var(--primary) 35%, transparent)`
  - `background: linear-gradient(var(--primary) 18% → 8%)`
  - `box-shadow: glow con var(--primary) 15%`
  - `transform: none` (no se levanta como en hover)

**Implementación:** `src/app/styles/buttons.css`
- Selector: `.btn-icon-sm[data-popup-open]`
- Aplica a **todos** los `btn-icon-sm` que abran un dropdown

### 3. Animación de emergencia
- El menú parte pequeño (60%) y desplazado 12px arriba
- Crece con suavidad hasta su posición final (220ms)
- Al cerrar, se contrae rápido (140ms)
- `transform-origin: top right` (esquina superior derecha, donde está el botón)
- Curva `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out suave tipo iOS)

**Implementación:** `src/app/styles/buttons.css`
- Clase: `.dropdown-emerge`
- Keyframes: `dropdown-emerge-open` (220ms) + `dropdown-emerge-close` (140ms)
- Anula las animaciones nativas de Tailwind (`--tw-enter-*`, `--tw-exit-*`)

## Uso

```tsx
<DropdownMenu>
  <DropdownMenuTrigger render={
    <button className="btn-icon-sm relative">
      <MailIcon />
    </button>
  } />
  <DropdownMenuContent align="end" arrow className="dropdown-emerge" sideOffset={4}>
    {/* items */}
  </DropdownMenuContent>
</DropdownMenu>
```

### Props necesarias
- `arrow` en `DropdownMenuContent` → activa la flecha
- `dropdown-emerge` en `className` → activa la animación
- `btn-icon-sm` en el trigger → activa el botón activo automáticamente

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/ui/dropdown-menu.tsx` | Prop `arrow` en `DropdownMenuContent` |
| `src/app/styles/buttons.css` | `.btn-icon-sm[data-popup-open]` + `.dropdown-emerge` + keyframes |
| `src/app/dashboard/claims/[id]/page.tsx` | `arrow` + `dropdown-emerge` en el dropdown del botón de mail |

## Volver a A0

Para desactivar todos los efectos y volver al estado base:
1. Quitar `arrow` y `dropdown-emerge` del `DropdownMenuContent` en `page.tsx`
2. Comentar o eliminar `.btn-icon-sm[data-popup-open]` y `.dropdown-emerge` en `buttons.css`
3. No es necesario tocar `dropdown-menu.tsx` (el prop `arrow` queda como opt-in)

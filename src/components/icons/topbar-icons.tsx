/*
 * Iconos SVG multicolor custom para el topbar — estilo Windows 11 / Fluent Color
 * Cada icono tiene gradientes, múltiples capas y sombras reales.
 * Paleta coherente: azul (liquidación), cyan (inspección), violeta (despacho),
 * esmeralda (auditoría), ámbar (recientes), fucsia (skin), azul (help), rojo (logout).
 *
 * Props compatibles con lucide-react: size, className, etc.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

/* ─────────────────────────────────────────────────────────
 * Liquidación — documento con check verde
 * Papel blanco con borde azul, esquina doblada, check esmeralda grueso
 * ───────────────────────────────────────────────────────── */
export function LiquidacionIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="liq-paper" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef2f7" />
        </linearGradient>
        <linearGradient id="liq-fold" x1="14" y1="2" x2="18" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="liq-check" x1="8" y1="12" x2="16" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <filter id="liq-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.6" floodColor="#1e3a8a" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Sombra azul detrás del papel */}
      <path d="M5 2.5h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 3.5 20.5V4A1.5 1.5 0 0 1 5 2.5z" fill="#3b82f6" opacity="0.2" transform="translate(0.5 0.8)" />
      {/* Papel */}
      <path d="M5 2.5h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 3.5 20.5V4A1.5 1.5 0 0 1 5 2.5z" fill="url(#liq-paper)" filter="url(#liq-shadow)" />
      {/* Borde azul del papel */}
      <path d="M5 2.5h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 3.5 20.5V4A1.5 1.5 0 0 1 5 2.5z" stroke="#2563eb" strokeWidth="0.6" fill="none" opacity="0.5" />
      {/* Esquina doblada azul */}
      <path d="M13 2.5l5 5h-4a1 1 0 0 1-1-1v-4z" fill="url(#liq-fold)" />
      <path d="M13 2.5l5 5h-4a1 1 0 0 1-1-1v-4z" stroke="#2563eb" strokeWidth="0.5" fill="none" opacity="0.5" />
      {/* Círculo verde de fondo del check */}
      <circle cx="12" cy="15.5" r="4.5" fill="#10b981" opacity="0.15" />
      {/* Check esmeralda grueso */}
      <path d="M9 15.5l2.2 2.2 4.3-4.6" stroke="url(#liq-check)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 15.5l2.2 2.2 4.3-4.6" stroke="#065f46" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Inspección — lupa con lente cyan/azul
 * Marco fino azul, lente con degradado cyan, brillo superior
 * ───────────────────────────────────────────────────────── */
export function InspeccionIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="ins-lens" x1="6" y1="4" x2="14" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5f3fc" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="ins-frame" x1="3" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="ins-handle" x1="14" y1="14" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <radialGradient id="ins-shine" cx="0.3" cy="0.3" r="0.6">
          <stop stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="ins-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor="#0c4a6e" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Lente */}
      <circle cx="10" cy="10" r="6.5" fill="url(#ins-lens)" filter="url(#ins-shadow)" />
      {/* Brillo del lente */}
      <circle cx="10" cy="10" r="6.5" fill="url(#ins-shine)" />
      {/* Marco fino azul */}
      <circle cx="10" cy="10" r="6.5" stroke="url(#ins-frame)" strokeWidth="1.1" fill="none" />
      {/* Mango fino azul */}
      <path d="M14.8 14.8l5.2 5.2" stroke="url(#ins-handle)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Despacho — avión de papel (NO camión)
 * Avión blanco con borde violeta marcado, sombra y línea de trayectoria
 * ───────────────────────────────────────────────────────── */
export function DespachoIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="desp-plane" x1="3" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#ede9fe" />
        </linearGradient>
        <linearGradient id="desp-trail" x1="3" y1="20" x2="18" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
        <filter id="desp-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#4c1d95" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Línea de trayectoria */}
      <path d="M4 19c4 0 8-3 11-7" stroke="url(#desp-trail)" strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="2 2.5" />
      {/* Sombra del avión (violeta) */}
      <path d="M3 4l17 6.5-7 2-2 7L3 4z" fill="#4c1d95" opacity="0.3" transform="translate(0.8 1)" />
      {/* Avión blanco */}
      <path d="M3 4l17 6.5-7 2-2 7L3 4z" fill="url(#desp-plane)" filter="url(#desp-shadow)" />
      {/* Borde violeta marcado */}
      <path d="M3 4l17 6.5-7 2-2 7L3 4z" stroke="#7c3aed" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
      {/* Línea central del pliegue (violeta oscuro) */}
      <path d="M3 4l10 8.5" stroke="#6d28d9" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
      {/* Pliegue inferior (violeta oscuro) */}
      <path d="M13 12.5l-2 7" stroke="#6d28d9" strokeWidth="0.9" opacity="0.85" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Auditoría — escudo con check
 * Escudo esmeralda con degradado, check blanco con sombra
 * ───────────────────────────────────────────────────────── */
export function AuditoriaIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="aud-shield" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7b7" />
          <stop offset="0.5" stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="aud-shield-light" x1="6" y1="3" x2="12" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="aud-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#064e3b" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Escudo */}
      <path d="M12 2.5l7.5 2.5v6c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V5L12 2.5z" fill="url(#aud-shield)" filter="url(#aud-shadow)" />
      {/* Brillo superior del escudo */}
      <path d="M12 2.5l7.5 2.5v6c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V5L12 2.5z" fill="url(#aud-shield-light)" />
      {/* Check blanco */}
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Sombra suave del check */}
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#064e3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.2" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Recientes — reloj con flecha circular
 * Esfera blanca, manecillas azul, flecha circular ámbar
 * ───────────────────────────────────────────────────────── */
export function RecientesIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="rec-face" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f5f9" />
        </linearGradient>
        <linearGradient id="rec-arrow" x1="3" y1="12" x2="21" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="rec-hands" x1="12" y1="7" x2="12" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id="rec-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor="#0f172a" floodOpacity="0.18" />
        </filter>
      </defs>
      {/* Flecha circular ámbar (fondo) */}
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" stroke="url(#rec-arrow)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Punta de flecha */}
      <path d="M17.3 4.2l2.5 2.5-2.5 2.5" stroke="url(#rec-arrow)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Esfera blanca */}
      <circle cx="12" cy="12" r="5.5" fill="url(#rec-face)" filter="url(#rec-shadow)" />
      {/* Manecillas */}
      <path d="M12 9v3.2l2 1.3" stroke="url(#rec-hands)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Punto central */}
      <circle cx="12" cy="12" r="1" fill="#1d4ed8" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Skin / Color — paleta de pintor con puntos de color
 * Paleta crema con borde, 4 puntos de color vivos y agujero
 * ───────────────────────────────────────────────────────── */
export function SkinIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="skin-palette" x1="3" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fffbeb" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
        <radialGradient id="skin-red" cx="0.35" cy="0.35" r="0.7">
          <stop stopColor="#fca5a5" />
          <stop offset="1" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="skin-yellow" cx="0.35" cy="0.35" r="0.7">
          <stop stopColor="#fde047" />
          <stop offset="1" stopColor="#ca8a04" />
        </radialGradient>
        <radialGradient id="skin-blue" cx="0.35" cy="0.35" r="0.7">
          <stop stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </radialGradient>
        <radialGradient id="skin-green" cx="0.35" cy="0.35" r="0.7">
          <stop stopColor="#86efac" />
          <stop offset="1" stopColor="#16a34a" />
        </radialGradient>
        <filter id="skin-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#78350f" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Sombra de la paleta */}
      <path d="M12 3c-5 0-9 3.5-9 8 0 4 3 6.5 6.5 6.5 1.2 0 1.8-0.8 1.8-1.8 0-0.5-0.2-0.9-0.5-1.3-0.3-0.4-0.5-0.8-0.5-1.3 0-1 0.8-1.8 1.8-1.8H14c3.5 0 6-2.5 6-5.5C20 5.5 16.5 3 12 3z" fill="#92400e" opacity="0.25" transform="translate(0.6 0.9)" />
      {/* Paleta crema */}
      <path d="M12 3c-5 0-9 3.5-9 8 0 4 3 6.5 6.5 6.5 1.2 0 1.8-0.8 1.8-1.8 0-0.5-0.2-0.9-0.5-1.3-0.3-0.4-0.5-0.8-0.5-1.3 0-1 0.8-1.8 1.8-1.8H14c3.5 0 6-2.5 6-5.5C20 5.5 16.5 3 12 3z" fill="url(#skin-palette)" filter="url(#skin-shadow)" />
      {/* Borde marrón de la paleta */}
      <path d="M12 3c-5 0-9 3.5-9 8 0 4 3 6.5 6.5 6.5 1.2 0 1.8-0.8 1.8-1.8 0-0.5-0.2-0.9-0.5-1.3-0.3-0.4-0.5-0.8-0.5-1.3 0-1 0.8-1.8 1.8-1.8H14c3.5 0 6-2.5 6-5.5C20 5.5 16.5 3 12 3z" stroke="#92400e" strokeWidth="0.7" fill="none" opacity="0.6" />
      {/* Puntos de color vivos */}
      <circle cx="7" cy="8" r="2" fill="url(#skin-red)" />
      <circle cx="11.5" cy="6.3" r="2" fill="url(#skin-yellow)" />
      <circle cx="15.8" cy="8" r="2" fill="url(#skin-blue)" />
      <circle cx="17" cy="12.2" r="2" fill="url(#skin-green)" />
      {/* Agujero de la paleta */}
      <circle cx="9" cy="13" r="1.1" fill="#92400e" opacity="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Help — signo de pregunta en círculo azul
 * Círculo azul con degradado, ? blanco con sombra
 * ───────────────────────────────────────────────────────── */
export function HelpIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="help-circle" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="help-circle-light" x1="6" y1="4" x2="12" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="help-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#1e3a8a" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Círculo */}
      <circle cx="12" cy="12" r="9" fill="url(#help-circle)" filter="url(#help-shadow)" />
      <circle cx="12" cy="12" r="9" fill="url(#help-circle-light)" />
      {/* Signo ? blanco */}
      <path d="M9.2 9.5c0-1.6 1.3-2.8 2.8-2.8s2.8 1.2 2.8 2.8c0 1-0.5 1.6-1.4 2.2-0.8 0.5-1 0.9-1 1.6v0.4" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="12.4" cy="16.2" r="1.1" fill="#ffffff" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Logout — botón de power rojo
 * Círculo rojo con gap arriba (vía máscara), línea vertical blanca
 * ───────────────────────────────────────────────────────── */
export function LogoutIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="logout-circle" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f87171" />
          <stop offset="0.5" stopColor="#ef4444" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="logout-circle-light" x1="6" y1="4" x2="12" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="logout-mask">
          {/* Todo blanco = visible */}
          <rect x="0" y="0" width="24" height="24" fill="white" />
          {/* Arco negro = recortado (gap superior del power) */}
          <path d="M8.5 5.8a7.5 7.5 0 1 0 7 0" stroke="black" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </mask>
        <filter id="logout-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#7f1d1d" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Sombra del círculo */}
      <circle cx="12" cy="12" r="9" fill="#7f1d1d" opacity="0.25" transform="translate(0.6 0.9)" />
      {/* Círculo rojo relleno con gap recortado por máscara */}
      <g mask="url(#logout-mask)">
        <circle cx="12" cy="12" r="9" fill="url(#logout-circle)" filter="url(#logout-shadow)" />
        <circle cx="12" cy="12" r="9" fill="url(#logout-circle-light)" />
      </g>
      {/* Línea vertical blanca gruesa (el "palo" del power) */}
      <path d="M12 3.5v8" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
      {/* Sombra suave de la línea para profundidad */}
      <path d="M12 3.5v8" stroke="#7f1d1d" strokeWidth="2.8" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Theme Sun — sol amarillo con rayos
 * Círculo amarillo con degradado, 8 rayos naranjas
 * ───────────────────────────────────────────────────────── */
export function ThemeSunIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <radialGradient id="sun-core" cx="0.4" cy="0.4" r="0.7">
          <stop stopColor="#fef08a" />
          <stop offset="0.6" stopColor="#facc15" />
          <stop offset="1" stopColor="#eab308" />
        </radialGradient>
        <linearGradient id="sun-ray" x1="12" y1="2" x2="12" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="sun-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#92400e" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Rayos (8) */}
      <g stroke="url(#sun-ray)" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
        <line x1="18.8" y1="5.2" x2="17.1" y2="6.9" />
        <line x1="6.9" y1="17.1" x2="5.2" y2="18.8" />
      </g>
      {/* Sol */}
      <circle cx="12" cy="12" r="4.5" fill="url(#sun-core)" filter="url(#sun-shadow)" />
      {/* Brillo superior */}
      <circle cx="10.5" cy="10.5" r="1.8" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────
 * Theme Moon — luna azul con estrella
 * Luna creciente azul con degradado, estrella blanca pequeña
 * ───────────────────────────────────────────────────────── */
export function ThemeMoonIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <radialGradient id="moon-core" cx="0.35" cy="0.35" r="0.8">
          <stop stopColor="#93c5fd" />
          <stop offset="0.6" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e40af" />
        </radialGradient>
        <filter id="moon-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#1e3a8a" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Luna creciente */}
      <path d="M21 13.5A8.5 8.5 0 1 1 10.5 3a6.5 6.5 0 1 0 10.5 10.5z" fill="url(#moon-core)" filter="url(#moon-shadow)" />
      {/* Brillo superior izquierdo */}
      <path d="M11 5.5c-1.5 0.5-2.8 1.5-3.5 3 0.3-1.8 1.3-3.3 2.8-4.3 0.4 0.4 0.6 0.8 0.7 1.3z" fill="#ffffff" opacity="0.4" />
      {/* Estrella blanca pequeña */}
      <path d="M17.5 7l0.6 1.4 1.4 0.6-1.4 0.6-0.6 1.4-0.6-1.4-1.4-0.6 1.4-0.6 0.6-1.4z" fill="#fef3c7" />
    </svg>
  );
}

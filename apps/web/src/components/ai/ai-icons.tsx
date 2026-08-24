"use client";

/**
 * Iconos compuestos de IA dibujados como SVG propio.
 *
 * - BotIcon: robot solo (sin análisis / analizar)
 * - BotRefreshIcon: robot con flecha de actualizar (re-analizar)
 * - BotDocIcon: robot con papel (ver resultado)
 *
 * El SVG se dibuja a 24x24 (viewBox) y se renderiza al tamaño
 * que se necesite (h-3.5 w-3.5 = 14px). Los detalles están
 * dimensionados para verse claros a 14-16px.
 */

interface IconProps {
  className?: string;
}

/** Robot solo — sin análisis / analizar */
export function BotIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
      <path d="M2 13v2" />
      <path d="M22 13v2" />
    </svg>
  );
}

/** Robot + flecha de actualizar — re-analizar */
export function BotRefreshIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Robot */}
      <rect x="3" y="7" width="13" height="11" rx="2" />
      <path d="M9.5 3.5v3.5" />
      <circle cx="9.5" cy="2.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M7 15h5" />
      {/* Flecha de actualizar (esquina inferior derecha) */}
      <path
        d="M17.5 14a4 4 0 1 1 1.5 4.5"
        stroke="#a855f7"
        strokeWidth="2.2"
        fill="none"
      />
      <path
        d="M19 13l-1.5 1.5 2 1"
        stroke="#a855f7"
        strokeWidth="2.2"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Robot + papel — ver resultado */
export function BotDocIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Robot */}
      <rect x="3" y="7" width="13" height="11" rx="2" />
      <path d="M9.5 3.5v3.5" />
      <circle cx="9.5" cy="2.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M7 15h5" />
      {/* Papel (esquina inferior derecha) */}
      <path
        d="M16 13.5h4.5L22 15v5.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"
        fill="#6366f1"
        stroke="#6366f1"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 13.5V15h1.5"
        stroke="#fff"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M17.5 17h3" stroke="#fff" strokeWidth="1.2" />
      <path d="M17.5 19h3" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}

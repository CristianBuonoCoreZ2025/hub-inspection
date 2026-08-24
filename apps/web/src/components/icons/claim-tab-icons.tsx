import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
}

/*
 * Iconos custom para las tabs internas de un siniestro.
 * Estilo Apple: simples, expresivos, sin genéricos de documento.
 */

/** Siniestro — documento con escudo y datos esenciales */
export function SiniestroTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 12h.01" />
      <path d="M9 16h.01" />
      <path d="M13 12h4" />
      <path d="M13 16h4" />
      <path d="M12 22s-4-2-4-6V5l4-2 4 2v11c0 4-4 6-4 6z" />
    </svg>
  );
}

/** Participantes — personas con roles */
export function ParticipantesTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3 3-5 7-5s7 2 7 5" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M19 20c0-2.5-2.5-4-5-4" />
    </svg>
  );
}

/** Incidente — ubicación con marca de impacto */
export function IncidenteTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <path d="M12 22s-7-5.5-7-12a7 7 0 0 1 14 0c0 6.5-7 12-7 12z" />
      <circle cx="12" cy="10" r="3" />
      <path d="M12 7V4" />
      <path d="M9 5l3-2 3 2" />
    </svg>
  );
}

/** Gestiones — lista de tareas/checklist con estados */
export function GestionesTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

/** Documentos — carpeta con hojas */
export function DocumentosTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.586a2 2 0 0 1-1.414-.586l-2.828-2.828A2 2 0 0 0 5.586 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
      <path d="M14 8V4a2 2 0 0 0-2-2H5" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  );
}

/** Log — reloj de arena/historia con flechas */
export function LogTabIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
      <path d="M17 8l2-2" />
      <path d="M7 16l2-2" />
      <path d="M17 16l2 2" />
      <path d="M7 8l2 2" />
    </svg>
  );
}

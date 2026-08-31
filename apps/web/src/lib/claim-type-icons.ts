import {
  FileWarning,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  Flame,
  Droplets,
  Zap,
  Wind,
  Wrench,
  Home,
  Building,
  Warehouse,
  Store,
  Hotel,
  Factory,
  Car,
  Truck,
  Ship,
  Plane,
  Package2,
  Heart,
  Hospital,
  HeartPulse,
  Scale,
  Gavel,
  FileText,
  Badge,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa de nombres de iconos (guardados en claim_types.icon) a componentes
 * de lucide-react. Compartido entre el catalogo de tipos de siniestro y
 * el dropdown de recientes del top-bar.
 */
export const CLAIM_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  FileWarning,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  Flame,
  Droplets,
  Zap,
  Wind,
  Wrench,
  Home,
  Building,
  Warehouse,
  Store,
  Hotel,
  Factory,
  Car,
  Truck,
  Ship,
  Plane,
  Package: Package2,
  Heart,
  Hospital,
  HeartPulse,
  Scale,
  Gavel,
  FileText,
  Badge,
};

export const CLAIM_TYPE_ICON_OPTIONS = Object.keys(CLAIM_TYPE_ICON_MAP);

/** Alias para compatibilidad con el nombre usado en el catalogo. */
export const ICON_MAP = CLAIM_TYPE_ICON_MAP;
export const ICON_OPTIONS = CLAIM_TYPE_ICON_OPTIONS;

/**
 * Resuelve un nombre de icono (string guardado en BD) a un componente
 * lucide. Si no existe, retorna FileWarning como fallback.
 */
export function getClaimTypeIcon(iconName: string | null): LucideIcon {
  if (!iconName) return FileWarning;
  return CLAIM_TYPE_ICON_MAP[iconName] ?? FileWarning;
}

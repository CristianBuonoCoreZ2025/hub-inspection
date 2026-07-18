import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Calendar,
  Users,
  Building2,
  Settings,
  Shield,
  AlertTriangle,
  Landmark,
  Briefcase,
  Tag,
  Box,
  Upload,
  Ban,
  LockOpen,
  MapPin,
  FileWarning,
  Home,
  Warehouse,
  CalendarDays,
  Heart,
  Zap,
  Hammer,
  Layers,
  Square,
  Paintbrush,
  Fence,
  Camera,
  Monitor,
  ListChecks,
  Boxes,
  FileSpreadsheet,
  Code2,
  FileCheck,
  ShieldCheck,
  Workflow,
  Link2,
  Grid3x3,
  Coins,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

export interface NavGroup {
  title: string;
  section: string;
  icon: LucideIcon;
  links: NavLink[];
}

// ── Links principales ──
export const mainLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { href: "/dashboard/catalogos/polizas", label: "Pólizas", icon: FileCheck, section: "claims" },
  { href: "/dashboard/claims", label: "Siniestros", icon: FileText, section: "claims" },
  { href: "/dashboard/gestiones", label: "Gestiones", icon: ListChecks, section: "claims" },
  { href: "/dashboard/inspecciones", label: "Inspecciones", icon: ClipboardCheck, section: "inspecciones" },
  { href: "/dashboard/agenda", label: "Agenda", icon: Calendar, section: "agenda" },
];

// ── Catálogos ──
export const catalogLinks: NavLink[] = [
  { href: "/dashboard/catalogos/ubicaciones", label: "Ubicaciones", icon: MapPin },
  { href: "/dashboard/catalogos/causas", label: "Causas Siniestro", icon: AlertTriangle },
  { href: "/dashboard/catalogos/tipos-siniestros", label: "Tipos Siniestro", icon: FileWarning },
  { href: "/dashboard/catalogos/eventos", label: "Eventos", icon: Zap },
  { href: "/dashboard/catalogos/companias", label: "Compañías Seguros", icon: Landmark },
  { href: "/dashboard/catalogos/corredores", label: "Corredores", icon: Briefcase },
  { href: "/dashboard/catalogos/asesores", label: "Asesores", icon: Users },
  { href: "/dashboard/catalogos/lineas-negocio", label: "Líneas de Negocio", icon: Tag },
  { href: "/dashboard/catalogos/productos", label: "Ramos/Productos", icon: Box },
  { href: "/dashboard/catalogos/tipos-polizas", label: "Tipos Pólizas", icon: Shield },
  { href: "/dashboard/catalogos/coberturas", label: "Coberturas", icon: ShieldCheck },
  { href: "/dashboard/catalogos/parentescos", label: "Parentescos", icon: Heart },
  { href: "/dashboard/catalogos/tipos-documentos", label: "Tipos Documentos", icon: FileText },
  { href: "/dashboard/catalogos/monedas", label: "Monedas y Cambios", icon: Coins },
];

// ── Catálogos de Inspección ──
export const inspectionCatalogLinks: NavLink[] = [
  { href: "/dashboard/catalogos/clasificacion-bien", label: "Clasificación del Bien", icon: Home },
  { href: "/dashboard/catalogos/destinos-vivienda", label: "Destinos del Bien", icon: Warehouse },
  { href: "/dashboard/catalogos/antiguedades", label: "Antigüedad Inmueble", icon: CalendarDays },
  { href: "/dashboard/catalogos/clasificacion-danos", label: "Clasificación Daños", icon: FileWarning },
  { href: "/dashboard/catalogos/inspeccion/relacion-asegurado", label: "Relación Asegurado", icon: Heart },
  { href: "/dashboard/catalogos/inspeccion/muros", label: "Muros", icon: Hammer },
  { href: "/dashboard/catalogos/inspeccion/cubierta", label: "Cubierta / Techumbre", icon: Home },
  { href: "/dashboard/catalogos/inspeccion/pavimentos", label: "Pavimentos Interiores", icon: Layers },
  { href: "/dashboard/catalogos/inspeccion/cielos", label: "Cielos Interiores", icon: Square },
  { href: "/dashboard/catalogos/inspeccion/terminaciones-interiores", label: "Terminaciones Interiores", icon: Paintbrush },
  { href: "/dashboard/catalogos/inspeccion/terminaciones-exteriores", label: "Terminaciones Exteriores", icon: Paintbrush },
  { href: "/dashboard/catalogos/inspeccion/cierre-perimetral", label: "Cierre Perimetral", icon: Fence },
  { href: "/dashboard/catalogos/inspeccion/espacios-dano", label: "Espacios de Daño", icon: Grid3x3 },
  { href: "/dashboard/catalogos/inspeccion/categorias-evidencia", label: "Categorías Evidencia", icon: Camera },
];

// ── Configuración de Gestiones ──
export const gestionCatalogLinks: NavLink[] = [
  { href: "/dashboard/catalogos/gestiones/tipos", label: "Tipos de Gestión", icon: ListChecks },
  { href: "/dashboard/catalogos/gestiones/caracteristicas", label: "Características", icon: Boxes },
  { href: "/dashboard/catalogos/pantallas", label: "Pantallas", icon: Monitor },
  { href: "/dashboard/catalogos/gestiones/gestiones", label: "Gestiones", icon: FileSpreadsheet },
  { href: "/dashboard/catalogos/gestiones/dependencias", label: "Dependencias", icon: Link2 },
  { href: "/dashboard/catalogos/gestiones/campos", label: "Campos Plantillas", icon: Code2 },
  { href: "/dashboard/catalogos/workflows", label: "Workflows", icon: Workflow },
];

// ── Operaciones ──
export const operationLinks: NavLink[] = [
  { href: "/dashboard/operaciones/carga-siniestros", label: "Carga Siniestros", icon: Upload },
  { href: "/dashboard/operaciones/carga-catalogos", label: "Carga Catálogos", icon: Upload },
  { href: "/dashboard/operaciones/inhabilitar", label: "Inhabilitar", icon: Ban },
  { href: "/dashboard/operaciones/reabrir", label: "Reabrir", icon: LockOpen },
];

// ── Administración ──
export const adminLinks: NavLink[] = [
  { href: "/dashboard/users", label: "Usuarios", icon: Users, section: "users" },
  { href: "/dashboard/companies", label: "Empresas", icon: Building2, section: "companies" },
  { href: "/dashboard/permisos", label: "Permisos", icon: Shield, section: "configuracion" },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings, section: "configuracion" },
];

// ── Grupos para navegación agrupada ──
export const navGroups: NavGroup[] = [
  {
    title: "Catálogos",
    section: "catalogos",
    icon: Tag,
    links: catalogLinks,
  },
  {
    title: "Catálogos Inspección",
    section: "catalogos_inspeccion",
    icon: ClipboardCheck,
    links: inspectionCatalogLinks,
  },
  {
    title: "Configuración de Gestiones",
    section: "gestiones",
    icon: ListChecks,
    links: gestionCatalogLinks,
  },
  {
    title: "Operaciones",
    section: "operaciones",
    icon: Upload,
    links: operationLinks,
  },
  {
    title: "Administración",
    section: "administracion",
    icon: Settings,
    links: adminLinks,
  },
];

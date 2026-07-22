"use client";

import { useState, useMemo } from "react";
import {
  HelpCircle,
  Search,
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  Calendar,
  BarChart3,
  Tag,
  Settings,
  Users,
  Building2,
  Shield,
  Upload,
  Workflow,
  ChevronRight,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { HelpIcon } from "@/components/icons/topbar-icons";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface HelpSection {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  category: string;
  content: HelpTopic[];
}

interface HelpTopic {
  question: string;
  answer: string;
  steps?: string[];
  tips?: string[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    category: "Principal",
    content: [
      {
        question: "¿Qué muestra el Dashboard?",
        answer:
          "El Dashboard es la pantalla principal al iniciar sesión. Muestra KPIs clave del sistema: total de siniestros, liquidaciones en proceso, inspecciones pendientes, despachos y auditorías. También incluye gráficos de distribución por estado y un feed de actividad reciente.",
        tips: [
          "Los KPIs del topbar se actualizan cada 60 segundos automáticamente.",
          "Haz clic en cualquier chip del topbar para ir a la lista filtrada por tu rol.",
        ],
      },
      {
        question: "¿Cómo funcionan los chips del topbar?",
        answer:
          "Los chips del topbar muestran conteos en tiempo real de liquidaciones, inspecciones, despachos y auditorías asignadas a tu usuario. Al hacer clic en un chip, navegas a la lista de casos filtrada por tu rol.",
      },
      {
        question: "¿Qué son los siniestros recientes?",
        answer:
          "El botón de historial (icono de reloj) en el topbar muestra los últimos siniestros que visitaste. Te permite volver rápidamente a un siniestro en el que estabas trabajando sin tener que buscarlo.",
      },
    ],
  },
  {
    id: "siniestros",
    title: "Siniestros",
    icon: FileText,
    category: "Core",
    content: [
      {
        question: "¿Cómo crear un siniestro?",
        answer:
          "Desde la lista de siniestros, haz clic en el botón 'Crear Siniestro'. Se abre un asistente de 2 pasos: primero ingresas los datos básicos (número de siniestro, compañía, póliza, asegurado) y luego los participantes (contratista, beneficiario, contactos).",
        steps: [
          "Ve a Siniestros en el menú principal",
          "Haz clic en 'Crear Siniestro'",
          "Completa los datos básicos del siniestro",
          "Agrega los participantes (asegurado, contratista, etc.)",
          "Confirma la creación",
        ],
      },
      {
        question: "¿Qué son las pestañas del siniestro?",
        answer:
          "Cada siniestro tiene 6 pestañas: Siniestro (datos generales), Participantes (personas involucradas), Incidente (detalles del evento), Gestiones (acciones del workflow), Documentos (archivos adjuntos) y Log (auditoría de cambios).",
      },
      {
        question: "¿Qué es el número de liquidación?",
        answer:
          "El número de liquidación (formato L-000000141) es el identificador único del siniestro dentro del sistema. Se asigna automáticamente al crear el siniestro. Cuando buscas un siniestro por número, siempre te refieres al número de liquidación, no al número de siniestro de la compañía.",
      },
      {
        question: "¿Cómo se asignan responsables?",
        answer:
          "Al crear un siniestro, se asignan los responsables según el rol: liquidador asignado, liquidador, inspector, asistente, auditor y despachador. Estos campos determinan quién puede ver y editar el siniestro, y quién recibe las gestiones del workflow automáticamente.",
      },
      {
        question: "¿Qué son los estados del siniestro?",
        answer:
          "Los siniestros pasan por estados: Creado → Liquidación → Despacho → Cerrado. También pueden ser Reabiertos o Inhabilitados. Cada estado tiene un workflow asociado que define qué gestiones se deben realizar.",
      },
    ],
  },
  {
    id: "gestiones",
    title: "Gestiones",
    icon: Workflow,
    category: "Core",
    content: [
      {
        question: "¿Qué es una gestión?",
        answer:
          "Una gestión es una acción que se realiza dentro de un siniestro como parte del flujo de trabajo. Ejemplos: Ingreso de Coberturas (COB), Reserva (RES), Planilla de Cuadro de Ajuste (PCA), Notificación (NSA), Coordinación de Inspección (COI), etc.",
      },
      {
        question: "¿Cómo funciona la cadena de gestiones?",
        answer:
          "Las gestiones siguen una cadena de dependencias. Cada gestión requiere que la gestión anterior esté cerrada (emitida, revisada, aprobada o despachada) antes de poder crearse. Por ejemplo: COB debe estar cerrada antes de crear RES, y RES debe estar cerrada antes de crear PCA.",
        steps: [
          "COB (Ingreso de Coberturas) — primera gestión",
          "RES (Reserva) — requiere COB cerrada",
          "PCA (Planilla Cuadro de Ajuste) — requiere RES cerrada",
          "NSA (Notificación) — puede ir en paralelo",
          "RTA (Recepción de Antecedentes) — requiere NSA cerrada",
        ],
      },
      {
        question: "¿Qué significa emitir, revisar, aprobar una gestión?",
        answer:
          "Cada gestión tiene un flujo de estados: Pendiente (todo) → Emitida (issued) → Revisada (reviewed) → Aprobada (approved) → Despachada (dispatched). También puede ser Rechazada (rejected). El responsable de cada etapa está asignado automáticamente según el rol definido en el template.",
      },
      {
        question: "¿Cómo funciona el autoguardado?",
        answer:
          "Todas las pantallas de gestión guardan automáticamente los cambios 500ms después de la última edición (tipo Excel). No hay botones 'Guardar'. El indicador en el footer del modal muestra 'Guardando...' (ámbar) o 'Guardado' (verde) según el estado.",
        tips: [
          "No necesitas guardar manualmente — todo se autoguarda.",
          "El indicador verde 'Guardado' confirma que los cambios persistieron.",
        ],
      },
      {
        question: "¿Qué pasa cuando se rechaza una gestión?",
        answer:
          "Si una gestión es rechazada y es obligatoria (is_required) en el workflow, se recrea automáticamente en estado pendiente. Las gestiones rechazadas no bloquean la creación de nuevas del mismo tipo.",
      },
    ],
  },
  {
    id: "workflows",
    title: "Workflows",
    icon: Workflow,
    category: "Configuración",
    content: [
      {
        question: "¿Qué es un workflow?",
        answer:
          "Un workflow define qué gestiones se crean automáticamente y en qué orden, según la combinación de país + línea de negocio + evento + estado del siniestro. El workflow tiene 3 estados: draft (editable, no crea gestiones), online (crea gestiones automáticamente) y suspended (no crea gestiones).",
      },
      {
        question: "¿Cuándo actúa el workflow?",
        answer:
          "El workflow actúa en 3 instantes: (1) Cuando el siniestro cambia de estado — crea todas las gestiones de nivel 1. (2) Cuando una gestión se emite — crea las gestiones dependientes. (3) Cuando una gestión se rechaza — recrea la gestión si es obligatoria.",
      },
      {
        question: "¿Cómo configuro un workflow?",
        answer:
          "Ve a Catálogos → Configuración de Gestiones → Workflows. Allí puedes crear workflows arrastrando gestiones (dnd-kit), definir dependencias entre pasos, y marcar qué gestiones son automáticas y obligatorias. Solo los workflows en estado 'online' crean gestiones automáticamente.",
        steps: [
          "Ve a Catálogos → Workflows",
          "Crea un workflow para país + línea + evento + estado",
          "Arrastra las gestiones en orden",
          "Define dependencias entre pasos",
          "Cambia el estado a 'online' para activarlo",
        ],
      },
    ],
  },
  {
    id: "inspecciones",
    title: "Inspecciones",
    icon: ClipboardCheck,
    category: "Core",
    content: [
      {
        question: "¿Cómo se crea una inspección?",
        answer:
          "Las inspecciones NO se crean manualmente. Se crean automáticamente cuando se emite la gestión COI (Coordinación de Inspección) en el siniestro. El workflow crea la gestión INS, que a su vez genera la sesión de inspección. El módulo de Inspecciones solo muestra y gestiona inspecciones ya existentes.",
        tips: [
          "Nunca crees inspecciones desde el módulo de Inspecciones.",
          "Para crear una inspección: emite la gestión COI en el siniestro.",
        ],
      },
      {
        question: "¿Qué tabs tiene una inspección?",
        answer:
          "Cada inspección tiene 8 tabs: Resumen (info de la sesión), Acta (formulario de inspección), Checklist (lista de verificación), Daños (registro de daños con croquis), Evidencias (fotos con geolocalización), Firmas (firmas digitales), Croquis (dibujos) y Reporte (PDF).",
      },
      {
        question: "¿Cómo funciona el magic link?",
        answer:
          "Cada inspección tiene un magic link (token único) que permite acceso público sin login. Ideal para que el inspector o el asegurado accedan desde móvil en campo. El link se puede compartir y muestra todos los datos en tiempo real (refresh cada 2s).",
      },
      {
        question: "¿Cómo funciona la videollamada?",
        answer:
          "Las inspecciones remotas usan Jitsi Meet integrado. Desde la sesión de inspección, puedes iniciar una videollamada que se abre en una ventana. El inspector y el asegurado pueden ver y hablar en tiempo real mientras se completa el acta.",
      },
      {
        question: "¿Cómo se genera el PDF de inspección?",
        answer:
          "Desde el tab Reporte de la inspección, haz clic en 'Generar PDF'. El sistema usa html2canvas + jsPDF para crear el documento con todos los datos del acta, daños, evidencias y firmas. El PDF se sube a Cloudflare R2 y queda disponible para descarga.",
      },
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    category: "Principal",
    content: [
      {
        question: "¿Qué muestra la Agenda?",
        answer:
          "La Agenda muestra una vista semanal de las inspecciones programadas. Puedes filtrar por inspector, ver inspecciones onsite vs remotas, navegar entre semanas, y ver el estado de cada inspección con badges de color.",
      },
      {
        question: "¿Cómo se agenda una inspección?",
        answer:
          "Las inspecciones se agendan desde la gestión COI (Coordinación de Inspección) en el siniestro. Al emitir COI, se crea la sesión de inspección con fecha y hora programada. La agenda muestra automáticamente todas las inspecciones programadas.",
      },
    ],
  },
  {
    id: "polizas",
    title: "Pólizas",
    icon: Shield,
    category: "Catálogos",
    content: [
      {
        question: "¿Qué son las pólizas especiales?",
        answer:
          "El combo de pólizas del siniestro muestra 2 opciones especiales además de las pólizas reales: 'Sin Póliza' (no permite cargar coberturas) y 'En Emisión de Número' (permite cargar cualquier cobertura del catálogo, sin filtrar por póliza).",
      },
      {
        question: "¿Cómo funciona la cadena COB → RES → PCA?",
        answer:
          "COB selecciona coberturas (de la póliza o del catálogo si es emisión) y crea claim_coverages. RES carga esas coberturas y edita montos reservados/deducibles. PCA carga las coberturas del RES y ajusta los montos finales.",
        steps: [
          "COB: selecciona coberturas de la póliza",
          "RES: edita montos reservados por cobertura",
          "PCA: ajusta montos finales del ajuste",
        ],
      },
    ],
  },
  {
    id: "catalogos",
    title: "Catálogos",
    icon: Tag,
    category: "Configuración",
    content: [
      {
        question: "¿Qué catálogos existen?",
        answer:
          "Hay más de 40 catálogos: Ubicaciones (países, regiones, ciudades, comunas), Causas de Siniestro, Tipos de Siniestro, Eventos, Compañías, Corredores, Asesores, Líneas de Negocio, Productos, Tipos de Póliza, Coberturas, Parentescos, Tipos de Documento, Monedas, Tipos de Cambio, y catálogos de inspección (muros, cubiertas, pavimentos, etc.).",
      },
      {
        question: "¿Cómo se gestionan los catálogos?",
        answer:
          "Todos los catálogos tienen CRUD completo (crear, editar, eliminar). Usan soft-delete (flag is_active). Puedes buscar, ordenar y paginar. Algunos catálogos avanzados (Gestiones, Pantallas, Workflows) tienen editores visuales con drag-and-drop.",
      },
      {
        question: "¿Qué es el Screen Builder?",
        answer:
          "El Screen Builder (Catálogos → Pantallas) permite crear pantallas dinámicas para gestiones arrastrando campos. Define qué campos aparecen, su tipo (texto, número, fecha, select, textarea), validaciones y permisos por rol.",
      },
    ],
  },
  {
    id: "permisos",
    title: "Permisos",
    icon: Shield,
    category: "Administración",
    content: [
      {
        question: "¿Cómo funcionan los permisos?",
        answer:
          "Los permisos funcionan en 2 niveles: (1) Nivel sección — define qué módulos puede ver/editar/crear/eliminar cada tipo de usuario. (2) Nivel campo — define qué campos específicos puede editar cada tipo de usuario dentro de un siniestro.",
      },
      {
        question: "¿Qué roles existen?",
        answer:
          "6 roles: Interno (admin total), Liquidador (gestiona siniestros asignados), Inspector (completa inspecciones asignadas), Asistente (asiste al liquidador), Auditor (revisa gestiones), Despachador (despacha siniestros). Cada rol ve diferentes datos y tiene diferentes permisos.",
      },
      {
        question: "¿Cómo configuro permisos?",
        answer:
          "Ve a Administración → Permisos. Selecciona el tipo de usuario y expande cada sección para ver y togglear los permisos (ver, editar, crear, eliminar). Para permisos de campo, expande el siniestro y marca qué campos puede editar cada rol.",
      },
    ],
  },
  {
    id: "usuarios",
    title: "Usuarios",
    icon: Users,
    category: "Administración",
    content: [
      {
        question: "¿Cómo invito un usuario?",
        answer:
          "Ve a Administración → Usuarios y haz clic en 'Invitar'. Ingresa el email, nombre, rol y empresa. El usuario recibe un email con un link para configurar su contraseña. No se envían contraseñas temporales.",
        steps: [
          "Ve a Administración → Usuarios",
          "Haz clic en 'Invitar'",
          "Ingresa email, nombre, rol y empresa",
          "El usuario recibe un email con link de configuración",
        ],
      },
      {
        question: "¿Qué son los roles secundarios?",
        answer:
          "Un usuario puede tener un rol principal (ej: Liquidador) y roles secundarios (ej: Inspector). Esto le permite actuar en ambos roles sin necesidad de tener dos cuentas.",
      },
    ],
  },
  {
    id: "operaciones",
    title: "Operaciones",
    icon: Upload,
    category: "Operaciones",
    content: [
      {
        question: "¿Qué es la carga masiva de siniestros?",
        answer:
          "Desde Operaciones → Carga Siniestros puedes subir un archivo Excel (.xlsx) con múltiples siniestros. El sistema mapea las columnas automáticamente, valida los datos y crea los siniestros en lote.",
      },
      {
        question: "¿Cómo inhabilito un siniestro?",
        answer:
          "Desde Operaciones → Inhabilitar, busca el siniestro e ingresa el motivo de inhabilitación. El siniestro queda fuera de las listas normales pero se puede reactivar. Útil para siniestros duplicados o creados por error.",
      },
      {
        question: "¿Cómo reabro un siniestro cerrado?",
        answer:
          "Desde Operaciones → Reabrir, busca el siniestro cerrado e ingresa el motivo de reapertura. El siniestro vuelve al estado anterior al cierre y se reanuda el workflow.",
      },
    ],
  },
  {
    id: "informes",
    title: "Informes",
    icon: BarChart3,
    category: "Principal",
    content: [
      {
        question: "¿Qué reportes puedo generar?",
        answer:
          "El módulo de Informes tiene 5 tabs: Resumen (KPIs + distribución por estado), Por Liquidador (productividad: total, abiertos, cerrados, % cierre), Por Compañía (siniestros por aseguradora), Inspecciones (métricas de inspecciones) y Detalle Siniestros (tabla con todos los siniestros).",
      },
      {
        question: "¿Puedo exportar los datos?",
        answer:
          "Sí. Haz clic en 'Exportar CSV' para descargar todos los siniestros filtrados en un archivo CSV compatible con Excel. El archivo incluye número de liquidación, número de siniestro, compañía, liquidador, estado y fechas.",
      },
      {
        question: "¿Cómo filtro los reportes?",
        answer:
          "Usa los filtros superiores: búsqueda por texto, filtro por estado, y rango de fechas (desde/hasta). Los filtros se aplican a todas las tabs y al export CSV.",
      },
    ],
  },
  {
    id: "configuracion",
    title: "Configuración",
    icon: Settings,
    category: "Administración",
    content: [
      {
        question: "¿Qué puedo configurar?",
        answer:
          "La Configuración tiene 5 tabs: General (log de diagnóstico + info de cuenta), Marca (branding por empresa: logo, color, contacto), Notificaciones (preferencias por tipo de evento), Integraciones (servicios conectados) y Perfiles (documentación de roles).",
      },
      {
        question: "¿Cómo cambio el logo de la empresa?",
        answer:
          "Ve a Configuración → Marca, selecciona la empresa, ingresa la URL del logo y guarda. El logo se muestra en la vista de la empresa. Solo los usuarios Interno pueden acceder a esta sección.",
      },
    ],
  },
  {
    id: "empresas",
    title: "Empresas",
    icon: Building2,
    category: "Administración",
    content: [
      {
        question: "¿Qué son las empresas?",
        answer:
          "Las empresas representan a los clientes de la plataforma (compañías de seguros, corredoras, etc.). Cada empresa tiene su propio branding (logo, color), usuarios asignados y siniestros asociados. El sistema es multi-tenant con RLS.",
      },
      {
        question: "¿Cómo creo una empresa?",
        answer:
          "Ve a Administración → Empresas y haz clic en 'Crear'. Ingresa nombre, RUT (si es Chile), dirección, teléfono, email, país y URL del logo. Guarda y la empresa queda disponible para asignar usuarios y siniestros.",
      },
    ],
  },
  {
    id: "atajos",
    title: "Atajos y Tips",
    icon: Lightbulb,
    category: "General",
    content: [
      {
        question: "Navegación rápida",
        answer:
          "Usa el menú principal (izquierda en desktop, hamburger en móvil) para navegar entre módulos. Los chips del topbar te llevan directamente a tus casos filtrados por rol.",
        tips: [
          "Dashboard → Inicio general",
          "Siniestros → Lista de todos los siniestros",
          "Inspecciones → Lista de inspecciones",
          "Agenda → Calendario semanal",
          "Informes → Reportes y métricas",
        ],
      },
      {
        question: "Búsqueda de siniestros",
        answer:
          "En la lista de siniestros, usa la barra de búsqueda para encontrar por número de liquidación, número de siniestro, nombre del asegurado o referencia del cliente. Los filtros adicionales permiten acotar por estado y fecha.",
      },
      {
        question: "Siniestros recientes",
        answer:
          "El botón de historial en el topbar guarda los últimos siniestros que visitaste. Úsalo para volver rápidamente a un siniestro sin tener que buscarlo.",
      },
      {
        question: "Tema y apariencia",
        answer:
          "Usa los botones del topbar para cambiar el tema (claro/oscuro/sistema) y el color de acento de la interfaz. Tus preferencias se guardan automáticamente.",
      },
      {
        question: "Real-time",
        answer:
          "El sistema actualiza automáticamente los datos cuando hay cambios en la base de datos. Si otro usuario crea un siniestro o emite una gestión, lo verás reflejado en tu pantalla sin necesidad de recargar.",
      },
    ],
  },
];

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string>("dashboard");

  // Flatten all topics for search
  const allTopics = useMemo(() => {
    return HELP_SECTIONS.flatMap((section) =>
      section.content.map((topic) => ({
        ...topic,
        sectionId: section.id,
        sectionTitle: section.title,
      }))
    );
  }, []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return allTopics.filter(
      (t) =>
        t.question.toLowerCase().includes(q) ||
        t.answer.toLowerCase().includes(q) ||
        t.sectionTitle.toLowerCase().includes(q)
    );
  }, [search, allTopics]);

  const currentSection = HELP_SECTIONS.find((s) => s.id === activeSection);

  // Group sections by category
  const categories = useMemo(() => {
    const cats: Record<string, HelpSection[]> = {};
    HELP_SECTIONS.forEach((s) => {
      if (!cats[s.category]) cats[s.category] = [];
      cats[s.category].push(s);
    });
    return cats;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BookOpen className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Centro de Ayuda
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Manual interactivo del sistema
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
        </div>

        {/* Search bar */}
        <div className="border-b border-border px-4 py-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar en el manual..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="app-input h-8 pl-8"
            />
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — secciones */}
          {!searchResults && (
            <div className="w-52 shrink-0 border-r border-border overflow-y-auto p-2 hidden sm:block">
              {Object.entries(categories).map(([catName, sections]) => (
                <div key={catName} className="mb-3">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {catName}
                  </div>
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors ${
                          activeSection === section.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{section.title}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {searchResults ? (
              /* Search results */
              <div className="space-y-3">
                <div className="text-[12px] text-muted-foreground mb-2">
                  {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""} para &quot;{search}&quot;
                </div>
                {searchResults.map((topic, i) => (
                  <HelpTopicCard key={i} topic={topic} sectionTitle={topic.sectionTitle} />
                ))}
                {searchResults.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-[13px] text-muted-foreground">
                      No se encontraron resultados para &quot;{search}&quot;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Section content */
              currentSection && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const Icon = currentSection.icon;
                      return <Icon className="size-5 text-primary" />;
                    })()}
                    <h2 className="text-base font-semibold">{currentSection.title}</h2>
                  </div>
                  {currentSection.content.map((topic, i) => (
                    <HelpTopicCard key={i} topic={topic} />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HelpTopicCard({
  topic,
  sectionTitle,
}: {
  topic: HelpTopic;
  sectionTitle?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {sectionTitle && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary shrink-0">
              {sectionTitle}
            </span>
          )}
          <span className="text-[13px] font-medium truncate">{topic.question}</span>
        </div>
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {topic.answer}
          </p>
          {topic.steps && (
            <div className="mt-2">
              <div className="text-[11px] font-semibold text-foreground mb-1">Pasos:</div>
              <ol className="space-y-1">
                {topic.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {topic.tips && (
            <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="size-3 text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-500">Tips</span>
              </div>
              <ul className="space-y-0.5">
                {topic.tips.map((tip, i) => (
                  <li key={i} className="text-[11px] text-amber-700 dark:text-amber-500/90">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Botón compacto para el topbar */
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="topbar-action dock-item"
        title="Ayuda"
      >
        <HelpIcon size={18} />
      </button>
      <HelpPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

import DiagnosticLogToggle from "./DiagnosticLogToggle";

const profiles = [
  {
    role: "Interno",
    badge: "Administrador",
    description:
      "Usuarios internos del sistema. Pueden crear siniestros, gestionar empresas, invitar usuarios y ver toda la información de la plataforma.",
    permissions: [
      "Ver todos los siniestros",
      "Crear y editar empresas",
      "Invitar y gestionar usuarios",
      "Generar informes",
      "Configurar la plataforma",
    ],
  },
  {
    role: "Liquidador",
    badge: "Asociado a clientes",
    description:
      "Liquidadores asociados a uno o más clientes. Ven todos los siniestros de sus clientes. Pueden intervenir solo en las gestiones de los siniestros donde son el liquidador asignado.",
    permissions: [
      "Ver siniestros de sus clientes",
      "Ver inspecciones de sus clientes",
      "Intervenir en gestiones donde es liquidador",
      "Solo vista en inspecciones (no modificar)",
    ],
  },
  {
    role: "Inspector",
    badge: "Asociado a clientes",
    description:
      "Inspectores asociados a uno o más clientes. Solo pueden ver los casos de sus clientes donde son el inspector asignado. Solo pueden completar la inspección donde están a cargo.",
    permissions: [
      "Ver siniestros donde es inspector",
      "Completar inspección donde está a cargo",
      "Subir evidencias y fotos",
      "No puede modificar otros datos del siniestro",
    ],
  },
  {
    role: "Operativo (Cliente)",
    badge: "Un solo cliente",
    description:
      "Usuarios operativos del cliente. Ven todos los casos de su empresa. Solo lectura, no pueden crear ni editar.",
    permissions: [
      "Ver siniestros de su empresa",
      "Ver agenda de inspecciones",
      "Descargar informes",
      "No pueden crear ni editar",
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Configuración</h1>
        <p className="app-page-lead">
          Configuración de la plataforma, perfiles de usuario y herramientas de diagnóstico.
        </p>
      </header>

      <DiagnosticLogToggle />

      <section className="app-panel">
        <h2 className="text-sm font-semibold">Perfiles de usuario</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Cuatro tipos de usuario definen el acceso y las capacidades dentro de Claims Hub.
        </p>
        <div className="mt-4 space-y-2">
          {profiles.map((p) => (
            <div
              key={p.role}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-foreground">{p.role}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {p.badge}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <ul className="mt-2 space-y-1">
                {p.permissions.map((perm) => (
                  <li
                    key={perm}
                    className="flex items-center gap-2 text-[12px] text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel">
        <h2 className="text-sm font-semibold">Marca</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Personalización de logo, colores y nombre de la plataforma. Próximamente.
        </p>
      </section>

      <section className="app-panel">
        <h2 className="text-sm font-semibold">Notificaciones</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Configuración de alertas por email y push. Próximamente.
        </p>
      </section>
    </div>
  );
}

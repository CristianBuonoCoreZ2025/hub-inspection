import DiagnosticLogToggle from "./DiagnosticLogToggle";

const profiles = [
  {
    role: "Interno",
    badge: "Administrador / Supervisor / Liquidador",
    description:
      "Usuarios internos del sistema. Pueden crear siniestros, gestionar empresas, invitar usuarios y ver toda la información de la plataforma. Son el personal operativo de la aseguradora.",
    permissions: [
      "Ver todos los siniestros",
      "Crear y editar empresas",
      "Invitar y gestionar usuarios",
      "Generar informes",
      "Configurar la plataforma",
    ],
  },
  {
    role: "Inspector",
    badge: "Inspector de campo",
    description:
      "Profesionales externos asignados para realizar inspecciones presenciales o remotas. Solo ven los siniestros que se les asignan específicamente.",
    permissions: [
      "Ver solo siniestros asignados",
      "Subir evidencias y fotos",
      "Completar checklist de inspección",
      "Registrar daños y observaciones",
    ],
  },
  {
    role: "Empresa (Cliente)",
    badge: "Cliente / Aseguradora",
    description:
      "Usuarios de la empresa aseguradora que solo pueden ver los siniestros y el agendamiento de su propia compañía. No pueden modificar datos ni acceder a otras empresas.",
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
          Tres tipos de usuario definen el acceso y las capacidades dentro de Claims Hub.
        </p>
        <div className="mt-4 space-y-4">
          {profiles.map((p) => (
            <div
              key={p.role}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-foreground">{p.role}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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

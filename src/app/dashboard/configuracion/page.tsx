import DiagnosticLogToggle from "./DiagnosticLogToggle";

export default function SettingsPage() {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Configuración</h1>
        <p className="app-page-lead">
          Configuración de la plataforma y personalización de marca.
        </p>
      </header>

      <DiagnosticLogToggle />

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

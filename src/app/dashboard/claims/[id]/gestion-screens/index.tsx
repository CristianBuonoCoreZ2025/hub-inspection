"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { GestionScreen as GestionScreenType, ClaimAction } from "@/types";
import DynamicScreen from "./DynamicScreen";
import type { ScreenField } from "./DynamicScreen";
import { getInspectionSessions } from "@/services/inspections";

interface GestionScreenSwitcherProps {
  screens: GestionScreenType[];
  action: ClaimAction;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
}

export default function GestionScreenSwitcher({ screens, action, onChange, readOnly, onAdvance, onReject }: GestionScreenSwitcherProps) {
  // Cargar sesiones de inspección del claim
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["inspection-sessions", action.claim_id],
    queryFn: () => getInspectionSessions(action.claim_id),
    enabled: screens?.some((s) => s.code === "inspeccion") ?? false,
  });

  // Buscar sesión vinculada a esta acción
  const linkedSession = sessions?.find((s) => s.claim_action_id === action.id);

  if (!screens || screens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay pantalla configurada para esta característica.
      </p>
    );
  }

  const screen = screens[0];

  // DEBUG: ver qué llega
  console.log("[GestionScreenSwitcher] screens:", screens?.length, "screen:", screen?.code, "is_dynamic:", screen?.is_dynamic, "action.action_data:", action.action_data);

  // Datos heredados de la coordinación (parent_action_data)
  const coordData = (action.action_data || {}) as Record<string, unknown>;
  const parentData = (coordData.parent_action_data || {}) as Record<string, unknown>;
  const inherited = {
    inspectionType: (coordData.coord_inspection_type as string) || (parentData.coord_inspection_type as string),
    inspector: (coordData.coord_inspector as string) || (parentData.coord_inspector as string),
    fecha: (coordData.coord_fecha as string) || (parentData.coord_fecha as string),
    contacto: (coordData.coord_contacto as string) || (parentData.coord_contacto as string),
    ubicacion: (coordData.coord_ubicacion as string) || (parentData.coord_ubicacion as string),
    comentarios: (coordData.coord_comentarios as string) || (parentData.coord_comentarios as string),
  };

  // Pantalla fija de inspección — mostrar datos y link directo
  if (!screen.is_dynamic && screen.code === "inspeccion") {
    if (sessionsLoading) {
      return <p className="text-sm text-muted-foreground text-center py-8">Cargando inspección...</p>;
    }

    // Resumen de datos heredados de la coordinación
    const coordSummary = (
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-[12px] mb-4">
        <p className="font-medium text-foreground text-[13px] mb-1">Datos de la Coordinación</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div><span className="text-muted-foreground">Tipo:</span> {inherited.inspectionType === "remote" ? "Remota" : inherited.inspectionType === "onsite" ? "Presencial" : "—"}</div>
          <div><span className="text-muted-foreground">Fecha:</span> {inherited.fecha ? new Date(inherited.fecha).toLocaleString("es-CL") : "—"}</div>
          <div><span className="text-muted-foreground">Contacto:</span> {inherited.contacto || "—"}</div>
          <div><span className="text-muted-foreground">Ubicación:</span> {inherited.ubicacion || "—"}</div>
          {inherited.comentarios && (
            <div className="col-span-2"><span className="text-muted-foreground">Comentarios:</span> {inherited.comentarios}</div>
          )}
        </div>
      </div>
    );

    if (linkedSession) {
      return (
        <div className="py-4 space-y-3">
          {coordSummary}
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Inspección <strong>{linkedSession.inspection_number || linkedSession.id.slice(0, 8)}</strong>
              {" — "}
              {linkedSession.inspection_type === "onsite" ? "Presencial" : "Remota"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              Estado: {linkedSession.status}
              {linkedSession.scheduled_at && ` · Programada: ${new Date(linkedSession.scheduled_at).toLocaleString("es-CL")}`}
            </p>
            <Button
              className="pg-btn-platinum"
              onClick={() => {
                window.location.href = `/dashboard/inspecciones/${linkedSession.id}`;
              }}
            >
              Ir a Inspección
            </Button>
          </div>
        </div>
      );
    }

    // No hay sesión vinculada (no debería pasar con el trigger, pero por seguridad)
    return (
      <div className="py-4 space-y-3">
        {coordSummary}
        <p className="text-sm text-amber-600 text-center">
          La sesión de inspección no se creó automáticamente. Recargue la página o contacte al administrador.
        </p>
      </div>
    );
  }

  if (!screen.is_dynamic) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        La pantalla <strong>{screen.name}</strong> es un componente fijo no configurable.
      </p>
    );
  }

  // Renderizado dinámico desde form_schema.fields
  const fields = Array.isArray(screen.form_schema?.fields)
    ? (screen.form_schema.fields as ScreenField[])
    : null;

  if (fields && fields.length > 0) {
    return (
      <DynamicScreen
        action={action}
        fields={fields}
        onChange={onChange}
        readOnly={readOnly}
        onAdvance={onAdvance}
        onReject={onReject}
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground text-center py-8">
      La pantalla <strong>{screen.name}</strong> no tiene campos configurados. Usa el constructor para diseñarla.
    </p>
  );
}

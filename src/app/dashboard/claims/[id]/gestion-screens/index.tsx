"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { GestionScreen as GestionScreenType, ClaimAction } from "@/types";
import DynamicScreen from "./DynamicScreen";
import type { ScreenField } from "./DynamicScreen";
import { getInspectionSessions, createInspectionSession } from "@/services/inspections";

interface GestionScreenSwitcherProps {
  screens: GestionScreenType[];
  action: ClaimAction;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
}

export default function GestionScreenSwitcher({ screens, action, onChange, readOnly, onAdvance, onReject }: GestionScreenSwitcherProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  // Cargar sesiones de inspección del claim
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["inspection-sessions", action.claim_id],
    queryFn: () => getInspectionSessions(action.claim_id),
    enabled: screens?.some((s) => s.code === "inspeccion") ?? false,
  });

  // Buscar sesión vinculada a esta acción
  const linkedSession = sessions?.find((s) => s.claim_action_id === action.id);

  // Crear sesión de inspección
  const createSessionMut = useMutation({
    mutationFn: async () => {
      const coordData = (action.action_data || {}) as Record<string, unknown>;
      const parentData = (coordData.parent_action_data || {}) as Record<string, unknown>;
      const inspectionType = ((coordData.coord_inspection_type as string) || (parentData.coord_inspection_type as string) || "onsite") as "onsite" | "remote";
      const scheduledAt = (coordData.coord_fecha as string) || (parentData.coord_fecha as string) || new Date().toISOString();
      const contactName = (coordData.coord_contacto as string) || (parentData.coord_contacto as string) || undefined;
      const inspectionLocation = (coordData.coord_ubicacion as string) || (parentData.coord_ubicacion as string) || undefined;
      const inspectorId = (coordData.coord_inspector as string) || (parentData.coord_inspector as string) || action.issuer_id || undefined;
      return createInspectionSession(action.claim_id, {
        inspectionType,
        scheduledAt,
        contactName,
        inspectionLocation,
        inspectorId,
        actionTemplateId: action.action_template_id || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Inspección creada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", action.claim_id] });
      setCreating(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setCreating(false);
    },
  });

  if (!screens || screens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay pantalla configurada para esta característica.
      </p>
    );
  }

  const screen = screens[0];

  // Pantalla fija de inspección — crear sesión o ir a ella
  if (!screen.is_dynamic && screen.code === "inspeccion") {
    if (sessionsLoading) {
      return <p className="text-sm text-muted-foreground text-center py-8">Cargando inspección...</p>;
    }

    if (linkedSession) {
      return (
        <div className="text-center py-8 space-y-3">
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
              window.location.href = `/dashboard/claims/${action.claim_id}/inspeccion/${linkedSession.id}`;
            }}
          >
            Ir a Inspección
          </Button>
        </div>
      );
    }

    // No hay sesión vinculada — ofrecer crearla
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          No hay inspección creada para esta gestión.
        </p>
        <p className="text-[12px] text-muted-foreground">
          Al crear la inspección se generará una sesión con los datos de la coordinación.
        </p>
        <Button
          className="pg-btn-platinum"
          onClick={() => {
            setCreating(true);
            createSessionMut.mutate();
          }}
          disabled={creating || createSessionMut.isPending}
        >
          {creating || createSessionMut.isPending ? "Creando..." : "Crear Inspección"}
        </Button>
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

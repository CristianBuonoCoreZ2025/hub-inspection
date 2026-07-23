"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { GestionScreen as GestionScreenType, ClaimAction, Claim } from "@/types";
import DynamicScreen from "./DynamicScreen";
import type { ScreenField } from "./DynamicScreen";
import { getInspectionSessions } from "@/services/inspections";

interface GestionScreenSwitcherProps {
  screens: GestionScreenType[];
  action: ClaimAction;
  claim?: Claim;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
}

export default function GestionScreenSwitcher({ screens, action, claim, onChange, readOnly, onAdvance, onReject }: GestionScreenSwitcherProps) {
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
  // Los campos del CIN pueden tener IDs con sufijos (coord_type_1, coord_fecha_1, etc.)
  // porque el editor de pantallas genera IDs únicos. Buscamos por tipo usando
  // prefijos canónicos, no por ID exacto.
  const coordData = (action.action_data || {}) as Record<string, unknown>;
  const parentData = (coordData.parent_action_data || {}) as Record<string, unknown>;

  // Helper: busca un valor por ID canónico o por prefijo de tipo de campo.
  // Ej: findCoord("coord_inspection_type", ["coord_type"]) encuentra coord_type_1
  const findCoord = (canonicalId: string, prefixes: string[]): unknown => {
    const sources = [coordData, parentData];
    for (const src of sources) {
      // 1. ID canónico exacto
      if (src[canonicalId] !== undefined && src[canonicalId] !== null && src[canonicalId] !== "") {
        return src[canonicalId];
      }
      // 2. Cualquier key que empiece con alguno de los prefijos
      //    (excluyendo coord_fecha_recoord que es otro campo)
      for (const key of Object.keys(src)) {
        for (const prefix of prefixes) {
          if (key.startsWith(prefix) && !key.includes("recoord")) {
            const v = src[key];
            if (v !== undefined && v !== null && v !== "") return v;
          }
        }
      }
    }
    return undefined;
  };

  const inherited = {
    inspectionType: findCoord("coord_inspection_type", ["coord_type", "coord_inspection_type"]) as string | undefined,
    inspector: findCoord("coord_inspector", ["coord_inspector"]) as string | undefined,
    fecha: findCoord("coord_fecha", ["coord_fecha"]) as string | undefined,
    otrosContactos: findCoord("coord_contacto", ["coord_cont", "coord_contacto"]) as string | undefined,
    aclaracionDireccion: findCoord("coord_ubicacion", ["coord_ubic", "coord_ubicacion"]) as string | undefined,
    comentarios: findCoord("coord_comentarios", ["coord_com"]) as string | undefined,
  };

  // Dirección y contacto principal del siniestro (no vienen en action_data,
  // se obtienen del claim directamente)
  const claimAddress = claim ? [
    claim.claim_address,
    claim.commune?.name,
    claim.city?.name,
  ].filter(Boolean).join(", ") : "";

  // Contacto: buscar participante de tipo "contact" o "insured"
  const contactParticipant = claim?.claims_participants?.find(
    (p) => p.type === "contact" && p.is_active
  ) || claim?.claims_participants?.find(
    (p) => p.type === "insured" && p.is_active
  );
  const claimContact = contactParticipant ? [
    contactParticipant.full_name,
    contactParticipant.phone,
    contactParticipant.cell_phone,
    contactParticipant.email,
  ].filter(Boolean).join(" · ") : "";

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
          <div className="col-span-2"><span className="text-muted-foreground">Dirección del Siniestro:</span> {claimAddress || "—"}</div>
          {inherited.aclaracionDireccion && (
            <div className="col-span-2"><span className="text-muted-foreground">Aclaración Dirección:</span> {inherited.aclaracionDireccion}</div>
          )}
          <div className="col-span-2"><span className="text-muted-foreground">Contacto del Siniestro:</span> {claimContact || "—"}</div>
          {inherited.otrosContactos && (
            <div className="col-span-2"><span className="text-muted-foreground">Otros Contactos:</span> {inherited.otrosContactos}</div>
          )}
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
    // Pantallas FIJAS (ej: "Inspección") no son configurables — no tienen
    // form_schema ni snapshot. Se renderizan con su propio componente fijo
    // (el flujo de inspección está manejado más arriba, líneas 56-113).
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        La pantalla <strong>{screen.name}</strong> es un componente fijo no configurable.
      </p>
    );
  }

  // ── Snapshot de la pantalla (SOLO pantallas dinámicas) ──
  // Si la acción tiene screen_snapshot, usarlo. Esto "congela" la estructura
  // con la que nació la gestión, de modo que si alguien después edita la
  // pantalla (agrega, quita o reordena campos), las gestiones ya creadas
  // siguen funcionando con la estructura original.
  // Si no hay snapshot (acciones creadas antes de la migración 190), se hace
  // fallback al form_schema actual del screen (mismo comportamiento de antes).
  const effectiveFormSchema = action.screen_snapshot || screen.form_schema;

  // Renderizado dinámico desde form_schema.fields (snapshot o actual)
  const fields = Array.isArray(effectiveFormSchema?.fields)
    ? (effectiveFormSchema.fields as ScreenField[])
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
        screenCode={screen.code}
      />
    );
  }

  return (
    <p className="text-sm text-muted-foreground text-center py-8">
      La pantalla <strong>{screen.name}</strong> no tiene campos configurados. Usa el constructor para diseñarla.
    </p>
  );
}

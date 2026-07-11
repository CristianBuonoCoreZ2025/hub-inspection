"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { GestionScreen as GestionScreenType, ClaimAction } from "@/types";
import type { GestionScreenProps } from "./types";
import DynamicScreen from "./DynamicScreen";
import type { ScreenField } from "./DynamicScreen";

interface GestionScreenSwitcherProps {
  screens: GestionScreenType[];
  action: ClaimAction;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
}

export default function GestionScreenSwitcher({ screens, action, onChange, readOnly, onAdvance, onReject }: GestionScreenSwitcherProps) {
  const router = useRouter();

  if (!screens || screens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay pantalla configurada para esta característica.
      </p>
    );
  }

  const screen = screens[0];

  // Pantallas fijas (no dinamicas) — mostrar link al componente especializado
  if (!screen.is_dynamic) {
    if (screen.code === "inspeccion") {
      // Buscar la inspection_session vinculada a este claim_action
      return (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta gestión usa la pantalla fija de <strong>Inspección</strong>.
          </p>
          <p className="text-[12px] text-muted-foreground">
            La inspección se gestiona desde su propia sección con tabs, wizard de acta, evidencias, daños, croquis, firmas e informe.
          </p>
          <Button
            className="btn-save btn-sm"
            onClick={() => {
              // El claim_action_id está en action.id, buscar la sesión vinculada
              // Por ahora usamos el query de React Query para obtener el href
              const event = new CustomEvent("navigate-to-inspection", { detail: action.id });
              window.dispatchEvent(event);
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ir a Inspección
          </Button>
        </div>
      );
    }
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

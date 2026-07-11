"use client";

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
  if (!screens || screens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay pantalla configurada para esta característica.
      </p>
    );
  }

  const screen = screens[0];

  // Renderizado dinámico desde form_schema.fields (único camino)
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

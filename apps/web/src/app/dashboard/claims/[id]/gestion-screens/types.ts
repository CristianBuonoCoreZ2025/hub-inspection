import type { ClaimAction } from "@/types";

export interface GestionScreenProps {
  action: ClaimAction;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
  screenCode?: string;
}

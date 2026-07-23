"use client";

import { Ban } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function MotivosCancelacionPage() {
  return <LookupCatalogManager category="cancellation_reason" title="Motivos de Cancelación / Reagendamiento" icon={Ban} />;
}

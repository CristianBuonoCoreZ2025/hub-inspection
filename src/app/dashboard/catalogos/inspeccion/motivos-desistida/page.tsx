"use client";

import { Ban } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function MotivosDesistidaPage() {
  return <LookupCatalogManager category="cancellation_reason_desistida" title="Motivos de Cancelación (Desistida)" icon={Ban} />;
}

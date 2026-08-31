"use client";

import { RotateCcw } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function MotivosFallidaPage() {
  return <LookupCatalogManager category="cancellation_reason_fallida" title="Motivos de Reagendamiento (Fallida)" icon={RotateCcw} />;
}

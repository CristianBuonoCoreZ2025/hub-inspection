"use client";

import { Paintbrush } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function TerminacionesExterioresPage() {
  return <LookupCatalogManager category="materiality_exterior_finish" title="Terminaciones Exteriores" icon={Paintbrush} />;
}

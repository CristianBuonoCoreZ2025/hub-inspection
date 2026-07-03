"use client";

import { Paintbrush } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function TerminacionesInterioresPage() {
  return <LookupCatalogManager category="materiality_interior_finish" title="Terminaciones Interiores" icon={Paintbrush} />;
}

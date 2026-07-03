"use client";

import { Home } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function CubiertaPage() {
  return <LookupCatalogManager category="materiality_roof" title="Cubierta / Techumbre" icon={Home} />;
}

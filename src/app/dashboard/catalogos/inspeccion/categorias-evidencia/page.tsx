"use client";

import { Camera } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function CategoriasEvidenciaPage() {
  return <LookupCatalogManager category="evidence_category" title="Categorias de Evidencia" icon={Camera} />;
}

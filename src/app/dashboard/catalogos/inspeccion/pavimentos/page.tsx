"use client";

import { Layers } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function PavimentosPage() {
  return <LookupCatalogManager category="materiality_flooring" title="Pavimentos Interiores" icon={Layers} />;
}

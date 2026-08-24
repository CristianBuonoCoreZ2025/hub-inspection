"use client";

import { Fence } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function CierrePerimetralPage() {
  return <LookupCatalogManager category="materiality_closure" title="Cierre Perimetral" icon={Fence} />;
}

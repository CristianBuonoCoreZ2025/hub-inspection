"use client";

import { Hammer } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function MurosPage() {
  return <LookupCatalogManager category="materiality_walls" title="Muros" icon={Hammer} />;
}

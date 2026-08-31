"use client";

import { Heart } from "lucide-react";
import { LookupCatalogManager } from "@/components/catalogos/lookup-catalog-manager";

export default function RelacionAseguradoPage() {
  return <LookupCatalogManager category="interviewed_relationship" title="Relacion con Asegurado" icon={Heart} />;
}

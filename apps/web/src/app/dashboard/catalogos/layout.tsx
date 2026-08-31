"use client";

import { usePathname } from "next/navigation";
import { SectionGuard } from "@/components/auth/section-guard";

export default function CatalogosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Los catálogos de inspección están bajo /dashboard/catalogos/inspeccion/
  // y tienen su propio permiso "catalogos_inspeccion"
  const section = pathname.includes("/catalogos/inspeccion")
    ? "catalogos_inspeccion"
    : "catalogos";

  return <SectionGuard section={section}>{children}</SectionGuard>;
}

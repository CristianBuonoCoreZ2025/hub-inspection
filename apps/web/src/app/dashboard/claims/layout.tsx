"use client";

import { SectionGuard } from "@/components/auth/section-guard";
import { usePathname } from "next/navigation";

export default function ClaimsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Si estamos en /dashboard/claims/[id], usar sub-sección claims_detalle
  // Si estamos en /dashboard/claims, usar claims_listado
  // El SectionGuard hace fallback al padre "claims" si no existe la sub-sección
  const section = pathname.match(/^\/dashboard\/claims\/[^\/]+/) ? "claims_detalle" : "claims_listado";
  return <SectionGuard section={section}>{children}</SectionGuard>;
}

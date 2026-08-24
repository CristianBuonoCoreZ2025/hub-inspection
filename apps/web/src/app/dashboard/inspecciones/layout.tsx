"use client";

import { SectionGuard } from "@/components/auth/section-guard";
import { usePathname } from "next/navigation";

export default function InspeccionesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Si estamos en /dashboard/inspecciones/[id], usar sub-sección inspecciones_detalle
  // Si estamos en /dashboard/inspecciones, usar inspecciones_listado
  // El SectionGuard hace fallback al padre "inspecciones" si no existe la sub-sección
  const section = pathname.match(/^\/dashboard\/inspecciones\/[^\/]+/) ? "inspecciones_detalle" : "inspecciones_listado";
  return <SectionGuard section={section}>{children}</SectionGuard>;
}

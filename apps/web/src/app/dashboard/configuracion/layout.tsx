"use client";

import { SectionGuard } from "@/components/auth/section-guard";

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  return <SectionGuard section="configuracion">{children}</SectionGuard>;
}

"use client";

import { SectionGuard } from "@/components/auth/section-guard";

export default function OperacionesLayout({ children }: { children: React.ReactNode }) {
  return <SectionGuard section="operaciones">{children}</SectionGuard>;
}

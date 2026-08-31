"use client";

import { SectionGuard } from "@/components/auth/section-guard";

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <SectionGuard section="agenda">{children}</SectionGuard>;
}

"use client";

import { SectionGuard } from "@/components/auth/section-guard";

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return <SectionGuard section="companies">{children}</SectionGuard>;
}

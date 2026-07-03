"use client";

import { SectionGuard } from "@/components/auth/section-guard";

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return <SectionGuard section="users">{children}</SectionGuard>;
}

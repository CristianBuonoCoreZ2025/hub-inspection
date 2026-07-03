"use client";

import { HybridNav } from "@/components/layout/nav-hybrid";

/**
 * Wrapper principal — navegación híbrida (icon rail + flyout).
 */
export function NavWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <HybridNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-3 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay";
import { PerfPanel } from "@/components/perf-panel";
import { GlassCursorLight } from "@/components/glass-cursor-light";
import { DialogProvider } from "@/components/ui/alert-context";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        {children}
        <GlobalLoadingOverlay />
        <GlassCursorLight />
        <Toaster position="top-right" richColors />
        {process.env.NODE_ENV !== "production" && <PerfPanel />}
      </DialogProvider>
    </QueryClientProvider>
  );
}

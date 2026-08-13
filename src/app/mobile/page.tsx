"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardCheck } from "lucide-react";

/**
 * /mobile raíz: redirige directo a la lista de inspecciones mobile.
 * La elección de sistema tradicional se hace desde el header del módulo mobile.
 */
export default function MobileRootPage() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    router.replace("/mobile/inspecciones");
  }, [isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ClipboardCheck className="h-8 w-8 animate-pulse text-primary" />
    </div>
  );
}

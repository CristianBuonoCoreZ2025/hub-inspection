"use client";

import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionById } from "@/services/inspections";
import ActaForm from "@/app/dashboard/inspecciones/[id]/acta-form";
import { Loader2, AlertCircle } from "lucide-react";

export default function MobileActaTab({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="mobile-empty">
        <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
        <p className="mobile-empty-text">Cargando acta...</p>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="mobile-empty">
        <AlertCircle className="h-6 w-6 mobile-empty-icon" />
        <p className="mobile-empty-text">No se pudo cargar el acta</p>
      </div>
    );
  }

  return <ActaForm session={session} />;
}

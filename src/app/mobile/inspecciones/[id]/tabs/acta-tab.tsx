"use client";

import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionById, type SessionDetail } from "@/services/inspections";
import ActaForm from "@/app/dashboard/inspecciones/[id]/acta-form";
import { Loader2, AlertCircle } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { getDownloadedSession } from "@/lib/offline/download-session";
import { useState, useEffect } from "react";
import type { OfflineSession } from "@/db/offline-db";

interface MobileActaTabProps {
  sessionId: string;
  onComplete?: () => void;
  /** Si está en modo offline, usar datos de IndexedDB */
  offlineMode?: boolean;
  /** Callback al guardar offline */
  onOfflineSaved?: () => void;
}

export default function MobileActaTab({ sessionId, onComplete, offlineMode = false, onOfflineSaved }: MobileActaTabProps) {
  const online = useOnline();
  const [offlineSession, setOfflineSession] = useState<OfflineSession | null>(null);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    enabled: !!sessionId && !offlineMode,
  });

  // Cargar sesión offline de IndexedDB
  useEffect(() => {
    if (!offlineMode) return;
    getDownloadedSession(sessionId).then(setOfflineSession);
  }, [sessionId, offlineMode]);

  if (offlineMode) {
    if (!offlineSession) {
      return (
        <div className="mobile-empty">
          <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
          <p className="mobile-empty-text">Cargando acta offline...</p>
        </div>
      );
    }
    return (
      <ActaForm
        session={offlineSession.session}
        offlineMode
        onOfflineSaved={onOfflineSaved}
      />
    );
  }

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

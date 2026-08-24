"use client";

import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionById } from "@/services/inspections";
import ActaForm from "@/app/dashboard/inspecciones/[id]/acta-form";
import { Loader2, AlertCircle } from "lucide-react";
import { getDownloadedSession } from "@/lib/offline/download-session";
import { getGlobalCatalogs, type OfflineSession, type OfflineCatalogs } from "@/db/offline-db";
import { useState, useEffect } from "react";

interface MobileActaTabProps {
  sessionId: string;
  /** Si está en modo offline, usar datos de IndexedDB */
  offlineMode?: boolean;
  /** Callback al guardar offline */
  onOfflineSaved?: () => void;
}

export default function MobileActaTab({ sessionId, offlineMode = false, onOfflineSaved }: MobileActaTabProps) {
  const [offlineSession, setOfflineSession] = useState<OfflineSession | null>(null);
  const [catalogs, setCatalogs] = useState<OfflineCatalogs | null>(null);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    enabled: !!sessionId && !offlineMode,
  });

  // Cargar sesión offline + catálogos globales de IndexedDB
  useEffect(() => {
    if (!offlineMode) return;
    getDownloadedSession(sessionId).then(setOfflineSession);
    getGlobalCatalogs().then(setCatalogs);
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
        offlineCatalogs={catalogs ?? undefined}
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

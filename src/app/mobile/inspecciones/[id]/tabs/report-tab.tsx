"use client";

import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionById, type SessionDetail } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import ReportTab from "@/app/dashboard/inspecciones/[id]/report-tab";
import { Loader2, AlertCircle, CloudOff } from "lucide-react";
import type { OfflineSession } from "@/db/offline-db";

interface MobileReportTabProps {
  sessionId: string;
  offlineMode?: boolean;
  offlineSession?: OfflineSession | null;
}

export default function MobileReportTab({ sessionId, offlineMode = false, offlineSession }: MobileReportTabProps) {
  const { profile } = useAuth();

  const { data: onlineSession, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    enabled: !!sessionId && !offlineMode,
  });

  // En modo offline, usar el snapshot de IndexedDB
  const session = offlineMode ? (offlineSession?.session as SessionDetail | undefined) : onlineSession;

  if (process.env.NODE_ENV === "development") {
    console.log("[MobileReportTab]", { offlineMode, hasOfflineSession: !!offlineSession, hasSession: !!session, sessionId });
  }

  if (isLoading && !offlineMode) {
    return (
      <div className="mobile-empty">
        <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
        <p className="mobile-empty-text">Cargando informe...</p>
      </div>
    );
  }

  if (offlineMode && !offlineSession) {
    return (
      <div className="mobile-empty">
        <CloudOff className="h-6 w-6 mobile-empty-icon" />
        <p className="mobile-empty-text">No hay inspección descargada para mostrar el informe offline</p>
      </div>
    );
  }

  if (!offlineMode && (isError || !session)) {
    return (
      <div className="mobile-empty">
        <AlertCircle className="h-6 w-6 mobile-empty-icon" />
        <p className="mobile-empty-text">No se pudo cargar el informe</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mobile-empty">
        <AlertCircle className="h-6 w-6 mobile-empty-icon" />
        <p className="mobile-empty-text">No hay datos del informe</p>
      </div>
    );
  }

  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");

  return (
    <ReportTab
      session={session}
      profile={profile ? {
        id: profile.id,
        company: profile.company ? {
          name: profile.company.name,
          logo_url: profile.company.logo_url,
          phone: profile.company.phone,
          email: profile.company.email,
          address: profile.company.address,
        } : null,
      } : null}
      claimNumber={claim?.claim_number}
      claimLiquidationNumber={claim?.liquidation_number}
      claimAddress={claim?.claim_address}
      insuredName={insured?.full_name}
      insuredRut={insured?.rut}
      insuredPhone={insured?.phone}
      insuredEmail={insured?.email}
      claimCause={claim?.claim_cause?.name}
      claimDate={claim?.claim_date}
      commune={claim?.commune?.name}
      hideZip
      offlineMode={offlineMode}
    />
  );
}

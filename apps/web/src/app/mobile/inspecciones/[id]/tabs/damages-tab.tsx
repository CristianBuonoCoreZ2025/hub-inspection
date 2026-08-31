"use client";

import DamagesTab from "@/app/dashboard/inspecciones/[id]/damages-tab";
import type { OfflineCatalogs, OfflineSession } from "@/db/offline-db";
import type { SessionDetail } from "@/services/inspections";

interface MobileDamagesTabProps {
  sessionId: string;
  propertyClassification?: string | null;
  countryId?: string | null;
  sessionStatus?: string;
  offlineMode?: boolean;
  onOfflineSaved?: (updated?: OfflineSession) => void | Promise<void>;
  offlineCatalogs?: OfflineCatalogs | null;
  session?: SessionDetail | null;
  offlineSession?: OfflineSession | null;
}

export default function MobileDamagesTab({
  sessionId,
  propertyClassification,
  countryId,
  sessionStatus,
  offlineMode = false,
  onOfflineSaved,
  offlineCatalogs,
  session,
  offlineSession,
}: MobileDamagesTabProps) {
  return (
    <div className="mobile-damage-form">
      <DamagesTab
        sessionId={sessionId}
        propertyClassification={propertyClassification}
        countryId={countryId}
        sessionStatus={sessionStatus}
        offlineMode={offlineMode}
        onOfflineSaved={onOfflineSaved}
        offlineCatalogs={offlineCatalogs}
        session={session}
        offlineSession={offlineSession}
        isMobile
      />
    </div>
  );
}

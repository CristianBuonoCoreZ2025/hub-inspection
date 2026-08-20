"use client";

import DamagesTab from "@/app/dashboard/inspecciones/[id]/damages-tab";

interface MobileDamagesTabProps {
  sessionId: string;
  propertyClassification?: string | null;
  countryId?: string | null;
  sessionStatus?: string;
  offlineMode?: boolean;
  onOfflineSaved?: () => void;
}

export default function MobileDamagesTab({
  sessionId,
  propertyClassification,
  countryId,
  sessionStatus,
  offlineMode = false,
  onOfflineSaved,
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
      />
    </div>
  );
}

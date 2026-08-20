"use client";

import DamagesTab from "@/app/dashboard/inspecciones/[id]/damages-tab";

interface MobileDamagesTabProps {
  sessionId: string;
  propertyClassification?: string | null;
  countryId?: string | null;
  sessionStatus?: string;
}

export default function MobileDamagesTab({
  sessionId,
  propertyClassification,
  countryId,
  sessionStatus,
}: MobileDamagesTabProps) {
  return (
    <div className="mobile-damage-form">
      <DamagesTab
        sessionId={sessionId}
        propertyClassification={propertyClassification}
        countryId={countryId}
        sessionStatus={sessionStatus}
      />
    </div>
  );
}

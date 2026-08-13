"use client";

import SketchesTab from "@/app/dashboard/inspecciones/[id]/sketches-tab";

interface MobileSketchesTabProps {
  sessionId: string;
  sessionStatus?: string;
  magicLinkToken?: string;
}

export default function MobileSketchesTab({
  sessionId,
  sessionStatus,
  magicLinkToken,
}: MobileSketchesTabProps) {
  return (
    <SketchesTab
      sessionId={sessionId}
      sessionStatus={sessionStatus}
      magicLinkToken={magicLinkToken}
    />
  );
}

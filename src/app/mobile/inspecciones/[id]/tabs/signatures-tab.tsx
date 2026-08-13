"use client";

import SignaturesTab from "@/app/dashboard/inspecciones/[id]/signatures-tab";

interface MobileSignaturesTabProps {
  sessionId: string;
  sessionStatus?: string;
  magicLinkToken?: string;
  inspectionType?: "onsite" | "remote";
  signatureWaiverReason?: string | null;
}

export default function MobileSignaturesTab({
  sessionId,
  sessionStatus,
  magicLinkToken,
  inspectionType,
  signatureWaiverReason,
}: MobileSignaturesTabProps) {
  return (
    <SignaturesTab
      sessionId={sessionId}
      sessionStatus={sessionStatus}
      magicLinkToken={magicLinkToken}
      inspectionType={inspectionType}
      signatureWaiverReason={signatureWaiverReason}
    />
  );
}

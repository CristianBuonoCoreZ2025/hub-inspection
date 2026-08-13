"use client";

import ChecklistTab from "@/app/dashboard/inspecciones/[id]/checklist-tab";

export default function MobileChecklistTab({ sessionId }: { sessionId: string }) {
  return <ChecklistTab sessionId={sessionId} />;
}

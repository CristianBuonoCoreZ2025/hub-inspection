"use client";

import ConnectionLogsTab from "@/app/dashboard/inspecciones/[id]/connection-logs-tab";

export default function MobileConnectionsTab({ sessionId }: { sessionId: string }) {
  return <ConnectionLogsTab sessionId={sessionId} />;
}

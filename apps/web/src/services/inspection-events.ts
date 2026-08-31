"use client";

export type InspectionEventType =
  | "photo_taken"
  | "video_recorded"
  | "upload_started"
  | "upload_completed"
  | "upload_failed"
  | "evidence_deleted"
  | "geo_captured"
  | "geo_recapture_enabled"
  | "video_call_started"
  | "video_call_ended"
  | "screenshot_taken"
  | "recording_saved";

export type InspectionEventRole = "adjuster" | "insured" | "system";

export interface InspectionEventEntry {
  sessionId: string;
  role: InspectionEventRole;
  eventType: InspectionEventType;
  eventDetail?: string;
  evidenceId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  magicLinkToken?: string; // para validar desde el magic link anónimo
}

export interface InspectionEventLog {
  id: string;
  session_id: string;
  claim_id: string | null;
  role: string;
  actor_name: string | null;
  event_type: string;
  event_detail: string | null;
  evidence_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Registra un evento de inspección (fire-and-forget).
 * No lanza errores — si falla, solo loggea en consola.
 */
export async function logInspectionEvent(entry: InspectionEventEntry): Promise<void> {
  try {
    await fetch("/api/inspection/event-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    // Fire-and-forget — no bloquear la UI si el log falla
  }
}

/**
 * Obtiene los logs de eventos de una sesión.
 */
export async function getInspectionEventLogs(sessionId: string): Promise<InspectionEventLog[]> {
  try {
    const res = await fetch(`/api/inspection/event-log?sessionId=${sessionId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  } catch {
    return [];
  }
}

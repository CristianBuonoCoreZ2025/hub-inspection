"use client";

export interface WebrtcEventEntry {
  sessionId: string;
  role: "insured" | "adjuster" | "supervisor";
  eventType: string;
  details?: Record<string, unknown>;
  magicLinkToken?: string;
}

/**
 * Registra un evento de WebRTC (peer_join, peer_leave, ice_restart, kick, etc.)
 * Fire-and-forget: no bloquea la UI si falla.
 */
export async function logWebrtcEvent(entry: WebrtcEventEntry): Promise<void> {
  try {
    await fetch("/api/inspection/webrtc-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    });
  } catch {
    // Silencioso: no afecta la llamada
  }
}

export interface WebrtcEvent {
  id: string;
  session_id: string;
  claim_id: string | null;
  user_id: string | null;
  role: string;
  event_type: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * Obtiene los eventos WebRTC de una sesión.
 */
export async function getWebrtcEvents(sessionId: string): Promise<WebrtcEvent[]> {
  try {
    const res = await fetch(`/api/inspection/webrtc-event?sessionId=${sessionId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

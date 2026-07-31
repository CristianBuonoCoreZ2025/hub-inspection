"use client";

export interface ConnectionLogEntry {
  sessionId: string;
  role: "insured" | "adjuster" | "supervisor";
  status: "connecting" | "success" | "failed" | "retry" | "disconnected" | "kicked";
  cameraPermission?: "granted" | "denied" | "error" | "not_requested";
  microphonePermission?: "granted" | "denied" | "error" | "not_requested";
  retryCount?: number;
  failureReason?: string;
  disconnectReason?: string;
  logId?: string; // si viene, actualiza el log existente
  magicLinkToken?: string; // usado por el magic link anónimo para validar POST
}

/**
 * Registra o actualiza un log de conexión del magic link.
 * Retorna el ID del log creado o actualizado.
 */
export async function logConnectionEvent(entry: ConnectionLogEntry): Promise<string | null> {
  try {
    const res = await fetch("/api/inspection/connection-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}

export interface ConnectionLog {
  id: string;
  session_id: string;
  claim_id: string | null;
  role: string;
  status: string;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  camera_permission: string | null;
  microphone_permission: string | null;
  retry_count: number;
  failure_reason: string | null;
  disconnect_reason: string | null;
  connected_at: string;
  disconnected_at: string | null;
  created_at: string;
}

/**
 * Obtiene los logs de conexión de una sesión.
 */
export async function getConnectionLogs(sessionId: string): Promise<ConnectionLog[]> {
  try {
    const res = await fetch(`/api/inspection/connection-log?sessionId=${sessionId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.logs || [];
  } catch {
    return [];
  }
}

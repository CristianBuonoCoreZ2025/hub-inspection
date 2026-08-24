"use client";

import bcrypt from "bcryptjs";
import { getOfflineDB, type OfflineProfile, getExpirationDate, isExpired } from "@/db/offline-db";

// ─────────────────────────────────────────────────────────────────────
// Guardar profile offline (con PIN hash traído de Supabase)
// ─────────────────────────────────────────────────────────────────────

/**
 * Guarda el profile en IndexedDB para login offline.
 * El pin_hash viene de Supabase (profiles.offline_pin_hash).
 * Se llama cuando el inspector descarga inspecciones.
 */
export async function saveOfflineProfile(
  profile: {
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    company_id: string | null;
    company?: { name: string | null; logo_url: string | null } | null;
    mobile_enabled?: boolean;
  },
  pin_hash: string,
): Promise<void> {
  const db = getOfflineDB();

  const offlineProfile: OfflineProfile = {
    id: profile.id,
    user_id: profile.user_id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role as OfflineProfile["role"],
    company_id: profile.company_id,
    company_name: profile.company?.name ?? null,
    company_logo_url: profile.company?.logo_url ?? null,
    mobile_enabled: profile.mobile_enabled ?? false,
    pin_hash,
    expires_at: getExpirationDate(10),
    downloaded_at: new Date().toISOString(),
  };

  await db.profiles.put(offlineProfile);
}

// ─────────────────────────────────────────────────────────────────────
// Login offline
// ─────────────────────────────────────────────────────────────────────

export interface OfflineAuthResult {
  success: boolean;
  error?: string;
  profile?: OfflineProfile;
}

/**
 * Valida email + PIN contra las credenciales guardadas en IndexedDB.
 * No requiere conexión a internet.
 */
export async function loginOffline(email: string, pin: string): Promise<OfflineAuthResult> {
  const db = getOfflineDB();

  const profile = await db.profiles
    .where("email")
    .equals(email.toLowerCase().trim())
    .first();

  if (!profile) {
    return { success: false, error: "No hay credenciales offline para este email" };
  }

  if (isExpired(profile.expires_at)) {
    return {
      success: false,
      error: "Las credenciales offline han expirado (más de 10 días). Conéctate a internet y vuelve a descargar.",
    };
  }

  const valid = await bcrypt.compare(pin, profile.pin_hash);
  if (!valid) {
    return { success: false, error: "PIN incorrecto" };
  }

  return { success: true, profile };
}

// ─────────────────────────────────────────────────────────────────────
// Obtener profile offline
// ─────────────────────────────────────────────────────────────────────

export async function getOfflineProfile(email: string): Promise<OfflineProfile | null> {
  const db = getOfflineDB();
  const profile = await db.profiles
    .where("email")
    .equals(email.toLowerCase().trim())
    .first();
  return profile ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Verificar si tiene PIN (consulta Supabase, requiere conexión)
// ─────────────────────────────────────────────────────────────────────

/**
 * Verifica si el usuario ya tiene un PIN configurado en Supabase.
 * Requiere conexión a internet.
 */
export async function hasOfflinePinInSupabase(profileId: string): Promise<boolean> {
  const { getSupabaseClient } = await import("@/lib/supabase/client");
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("offline_pin_hash")
    .eq("id", profileId)
    .maybeSingle();
  return !!data?.offline_pin_hash;
}

/**
 * Obtiene el PIN hash de Supabase para sincronizar a IndexedDB.
 * Requiere conexión a internet.
 */
export async function getOfflinePinHashFromSupabase(profileId: string): Promise<string | null> {
  const { getSupabaseClient } = await import("@/lib/supabase/client");
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("offline_pin_hash")
    .eq("id", profileId)
    .maybeSingle();
  return data?.offline_pin_hash ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Limpiar credenciales
// ─────────────────────────────────────────────────────────────────────

export async function clearOfflineCredentials(email?: string): Promise<void> {
  const db = getOfflineDB();
  if (email) {
    const profile = await db.profiles
      .where("email")
      .equals(email.toLowerCase().trim())
      .first();
    if (profile) {
      await db.profiles.delete(profile.id);
    }
  } else {
    await db.profiles.clear();
  }
}

export async function hasOfflineCredentials(): Promise<boolean> {
  const db = getOfflineDB();
  const count = await db.profiles.count();
  return count > 0;
}

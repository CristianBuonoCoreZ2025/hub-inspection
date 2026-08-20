"use client";

import bcrypt from "bcryptjs";
import { getOfflineDB, type OfflineProfile, getExpirationDate, isExpired } from "@/db/offline-db";

// ─────────────────────────────────────────────────────────────────────
// Guardar credenciales offline
// ─────────────────────────────────────────────────────────────────────

/**
 * Guarda el profile + password hash en IndexedDB para login offline.
 * Se llama cuando el inspector descarga inspecciones.
 *
 * @param profile  Profile del usuario logueado
 * @param password Password en texto plano (se hashea antes de guardar)
 */
export async function saveOfflineCredentials(
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
  password: string,
): Promise<void> {
  const db = getOfflineDB();
  const saltRounds = 10;
  const password_hash = await bcrypt.hash(password, saltRounds);

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
    password_hash,
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
 * Valida email + password contra las credenciales guardadas en IndexedDB.
 * No requiere conexión a internet.
 */
export async function loginOffline(email: string, password: string): Promise<OfflineAuthResult> {
  const db = getOfflineDB();

  // Buscar profile por email
  const profile = await db.profiles
    .where("email")
    .equals(email.toLowerCase().trim())
    .first();

  if (!profile) {
    return { success: false, error: "No hay credenciales offline para este email" };
  }

  // Verificar expiración
  if (isExpired(profile.expires_at)) {
    return {
      success: false,
      error: "Las credenciales offline han expirado (más de 10 días). Conéctate a internet y vuelve a descargar.",
    };
  }

  // Validar password
  const valid = await bcrypt.compare(password, profile.password_hash);
  if (!valid) {
    return { success: false, error: "Contraseña incorrecta" };
  }

  return { success: true, profile };
}

// ─────────────────────────────────────────────────────────────────────
// Obtener profile offline
// ─────────────────────────────────────────────────────────────────────

/** Obtiene el profile offline guardado (sin validar password) */
export async function getOfflineProfile(email: string): Promise<OfflineProfile | null> {
  const db = getOfflineDB();
  const profile = await db.profiles
    .where("email")
    .equals(email.toLowerCase().trim())
    .first();
  return profile ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Limpiar credenciales
// ─────────────────────────────────────────────────────────────────────

/** Elimina las credenciales offline de un usuario */
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

/** Verifica si hay credenciales offline guardadas */
export async function hasOfflineCredentials(): Promise<boolean> {
  const db = getOfflineDB();
  const count = await db.profiles.count();
  return count > 0;
}

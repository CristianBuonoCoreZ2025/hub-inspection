"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, WifiOff, Lock } from "lucide-react";
import { loginOffline } from "@/lib/auth/offline-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface OfflineLoginProps {
  /** Si se pasa, se llama después del login exitoso en vez de navegar */
  onSuccess?: () => void;
}

/**
 * Página de login offline.
 * Se muestra cuando no hay conexión y el usuario intenta acceder al mobile.
 * Valida email + PIN contra credenciales guardadas en IndexedDB.
 *
 * Si se pasa `onSuccess`, se usa en modo inline (sin navegación).
 * Si no, navega a /mobile/inspecciones después del login.
 */
export function OfflineLogin({ onSuccess }: OfflineLoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || pin.length < 4) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await loginOffline(email, pin);
      if (!result.success) {
        setError(result.error || "Error de autenticación offline");
        return;
      }
      // Guardar profile offline en sessionStorage
      if (result.profile) {
        sessionStorage.setItem("offline-profile", JSON.stringify({
          id: result.profile.id,
          user_id: result.profile.user_id,
          email: result.profile.email,
          full_name: result.profile.full_name,
          role: result.profile.role,
          company_id: result.profile.company_id,
          company: result.profile.company_name
            ? { name: result.profile.company_name, logo_url: result.profile.company_logo_url }
            : null,
          mobile_enabled: result.profile.mobile_enabled,
        }));
        sessionStorage.setItem("offline-mode", "true");
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/mobile/inspecciones");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="auth-title">Claims Hub</h1>
        <p className="auth-subtitle">Modo offline</p>

        <div className="offline-login-banner">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Sin conexión — Ingresa con tu email y PIN</span>
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          <div className="auth-field">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="auth-field">
            <Label htmlFor="pin">PIN offline</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="off"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                className="pl-9 text-center text-lg tracking-widest"
              />
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading || !email.trim() || pin.length < 4}
            className="auth-submit"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

        <p className="auth-footer">
          El PIN es válido por 10 días desde la descarga.
          Conéctate a internet para descargar nuevas inspecciones.
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>
        <p className="auth-brand">Hub Inspections</p>
        <h1 className="auth-title">Registro deshabilitado</h1>
        <p className="auth-subtitle">
          El acceso a la plataforma es solo por invitación.
          Un administrador debe crear tu cuenta desde el sistema.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

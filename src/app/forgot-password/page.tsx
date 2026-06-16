"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/validations";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const nhost = getNhostClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      await nhost.auth.sendPasswordResetEmail({
        email: data.email,
        options: {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });

      setIsSent(true);
      toast.success("Revisa tu correo electrónico");
    } catch (err) {
      toast.error((err as Error).message || "Ocurrió un error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card">
        <div className="text-center">
          <p className="auth-brand">Hub Inspections</p>
          <h1 className="auth-title">Recuperar Contraseña</h1>
          <p className="auth-subtitle">
            Te enviaremos un enlace para restablecer tu acceso
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              {...register("email")}
              aria-invalid={errors.email ? "true" : "false"}
              disabled={isSent}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          {isSent && (
            <p className="text-sm text-emerald-600">
              Si el correo existe, recibirás instrucciones para restablecer tu contraseña.
            </p>
          )}
          <div className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full btn-run btn-lg-block" disabled={isLoading || isSent}>
              {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

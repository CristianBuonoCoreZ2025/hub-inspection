"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loginSchema, LoginInput } from "@/lib/validations";
import { logger } from "@/lib/logger";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Supabase Auth errors sometimes have empty .message — extract from the object
        const errMsg =
          error.message ||
          (error as { msg?: string })?.msg ||
          (error as { error_code?: string })?.error_code ||
          "Credenciales inválidas";
        throw new Error(errMsg);
      }

      if (authData.session) {
        toast.success("Sesión iniciada correctamente");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error("Error al iniciar sesión");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      const displayMsg =
        error.message && error.message !== "{}"
          ? error.message
          : "Credenciales inválidas. Verifica tu email y contraseña.";
      logger.error("Login failed", err instanceof Error ? err : new Error(String(err)), {
        component: "LoginPage",
        action: "signInWithPassword",
        metadata: {
          email: data.email,
          errorMessage: error.message,
        },
      });
      toast.error(displayMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card">
        <div className="text-center">
          <p className="auth-brand">Claims Hub</p>
          <h1 className="auth-title">Iniciar Sesión</h1>
          <p className="auth-subtitle">
            Ingresa tus credenciales para acceder a tu cuenta
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
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
              aria-invalid={errors.password ? "true" : "false"}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center">
            <ToggleChip
              active={
                // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form watch() is incompatible with React Compiler memoization
                Boolean(watch("remember"))
              }
              onClick={(v) => setValue("remember", v)}
            >
              Recordar sesión
            </ToggleChip>
          </div>
          <div className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full pg-btn-platinum" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <span className="text-muted-foreground">
                Acceso solo por invitación. Contacta a tu administrador.
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

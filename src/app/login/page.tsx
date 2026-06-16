"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { loginSchema, LoginInput } from "@/lib/validations";
import { logger } from "@/lib/logger";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const nhost = getNhostClient();

  const {
    register,
    handleSubmit,
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
      const response = await nhost.auth.signInEmailPassword({
        email: data.email,
        password: data.password,
      });

      if (response.body.session) {
        toast.success("Sesión iniciada correctamente");
        router.push("/dashboard");
        router.refresh();
      } else if (response.body.mfa) {
        toast.info("Se requiere verificación MFA");
      } else {
        toast.error("Error al iniciar sesión");
      }
    } catch (err: unknown) {
      const error = err as { body?: { message?: string }; status?: number; message?: string };
      logger.error("Login failed", err instanceof Error ? err : new Error(String(err)), {
        component: "LoginPage",
        action: "signInEmailPassword",
        metadata: {
          email: data.email,
          errorBody: error.body,
          errorStatus: error.status,
        },
      });
      toast.error(error.message || "Ocurrió un error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card">
        <div className="text-center">
          <p className="auth-brand">Hub Inspections</p>
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
          <div className="flex items-center space-x-2">
            <Checkbox id="remember" {...register("remember")} />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
              Recordar sesión
            </Label>
          </div>
          <div className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full btn-save btn-lg-block" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <Link
                href="/register"
                className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                ¿No tienes cuenta? Regístrate
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

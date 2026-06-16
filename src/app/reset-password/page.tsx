"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { resetPasswordSchema, ResetPasswordInput } from "@/lib/validations";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const nhost = getNhostClient();
  const [isReady] = useState(() => {
    const session = nhost.getUserSession();
    if (!session) {
      toast.error("El enlace es inválido o ha expirado");
    }
    return !!session;
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    try {
      await nhost.auth.changeUserPassword({
        newPassword: data.password,
      });

      toast.success("Contraseña actualizada correctamente");
      router.push("/login");
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
          <h1 className="auth-title">Nueva Contraseña</h1>
          <p className="auth-subtitle">
            Ingresa tu nueva contraseña para restablecer el acceso
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
              aria-invalid={errors.password ? "true" : "false"}
              disabled={!isReady}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              disabled={!isReady}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 pt-2">
            <Button
              type="submit"
              className="w-full btn-save btn-lg-block"
              disabled={isLoading || !isReady}
            >
              {isLoading ? "Restableciendo..." : "Restablecer Contraseña"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

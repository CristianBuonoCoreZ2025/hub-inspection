"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { z } from "zod";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const onboardingSchema = z.object({
  companyName: z.string().min(2, "Nombre de empresa requerido"),
});

type OnboardingInput = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: standardSchemaResolver(onboardingSchema),
    defaultValues: { companyName: "" },
  });

  const onSubmit = async (data: OnboardingInput) => {
    setIsLoading(true);
    let userId: string | null = null;
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error("Sesión no válida. Por favor inicia sesión.");
        router.push("/login");
        return;
      }
      userId = authUser.id;

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          userId: authUser.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear empresa");
      }

      toast.success("Empresa creada correctamente");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const error = err as { message?: string };
      logger.error("Onboarding failed", err instanceof Error ? err : new Error(String(err)), {
        component: "OnboardingPage",
        action: "createCompany",
        metadata: {
          companyName: data.companyName,
          userId,
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
          <p className="auth-brand">Claims Hub</p>
          <h1 className="auth-title">Configura tu empresa</h1>
          <p className="auth-subtitle">
            Completa los datos para comenzar a usar Claims Hub
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Nombre de empresa</Label>
            <Input
              id="companyName"
              placeholder="Aseguradora ABC"
              {...register("companyName")}
              aria-invalid={errors.companyName ? "true" : "false"}
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">
                {errors.companyName.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 pt-2">
            <Button type="submit" className="w-full btn-create btn-lg-block" disabled={isLoading}>
              {isLoading ? "Creando..." : "Continuar al Dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

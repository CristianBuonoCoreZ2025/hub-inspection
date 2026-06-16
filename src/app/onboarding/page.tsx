"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { z } from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  const nhost = getNhostClient();

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
    try {
      const session = nhost.getUserSession();
      if (!session?.user) {
        toast.error("Sesión no válida. Por favor inicia sesión.");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          userId: session.user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear empresa");
      }

      toast.success("Empresa creada correctamente");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted/50 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-heading">
            Configura tu empresa
          </CardTitle>
          <CardDescription>
            Completa los datos para comenzar a usar Hub Inspections
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creando..." : "Continuar al Dashboard"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

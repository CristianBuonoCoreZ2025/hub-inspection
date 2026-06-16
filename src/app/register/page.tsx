"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { registerSchema, RegisterInput } from "@/lib/validations";
import { logger } from "@/lib/logger";
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

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const router = useRouter();
  const nhost = getNhostClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: standardSchemaResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      companyName: "",
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      const response = await nhost.auth.signUpEmailPassword({
        email: data.email,
        password: data.password,
      });

      if (response.body.session) {
        toast.success("Cuenta creada correctamente");
        router.push("/dashboard");
        router.refresh();
      } else {
        setNeedsVerification(true);
        toast.info("Revisa tu correo para confirmar la cuenta");
      }
    } catch (err: any) {
      // Log completo para debug
      logger.error("Signup failed", err, {
        component: "RegisterPage",
        action: "signUpEmailPassword",
        metadata: {
          email: data.email,
          errorBody: err.body,
          errorStatus: err.status,
          errorCode: err.code,
        },
      });

      let message = "Ocurrió un error inesperado";

      if (err.body?.message) {
        message = err.body.message;
      } else if (err.body?.error) {
        message = err.body.error;
      } else if (err.message) {
        message = err.message;
      }

      // Mapear errores comunes de Nhost Auth
      if (message.includes("already exists") || message.includes("already registered")) {
        message = "Este correo ya está registrado. Intenta iniciar sesión.";
      } else if (message.includes("password") && message.includes("too short")) {
        message = "La contraseña es muy corta. Usa al menos 6 caracteres.";
      } else if (message.includes("invalid")) {
        message = "Datos inválidos. Verifica el correo y la contraseña.";
      }

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (needsVerification) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted/50 to-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-heading">Verifica tu correo</CardTitle>
            <CardDescription>
              Te enviamos un enlace de confirmación. Revisa tu bandeja de entrada (y spam).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Una vez confirmes, podrás iniciar sesión.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ir al login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted/50 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-heading">Crear Cuenta</CardTitle>
          <CardDescription>
            Completa los datos para comenzar a usar Hub Inspections
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                placeholder="Juan Pérez"
                {...register("fullName")}
                aria-invalid={errors.fullName ? "true" : "false"}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                aria-invalid={errors.confirmPassword ? "true" : "false"}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de empresa</Label>
              <Input
                id="companyName"
                placeholder="Aseguradora ABC"
                {...register("companyName")}
                aria-invalid={errors.companyName ? "true" : "false"}
              />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

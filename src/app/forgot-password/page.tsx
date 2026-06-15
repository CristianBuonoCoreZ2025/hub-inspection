"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { getNhostClient } from "@/lib/nhost/client";
import { forgotPasswordSchema, ForgotPasswordInput } from "@/lib/validations";
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-muted/50 to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-heading">Recuperar Contraseña</CardTitle>
          <CardDescription>
            Te enviaremos un enlace para restablecer tu acceso
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading || isSent}>
              {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              Volver al login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

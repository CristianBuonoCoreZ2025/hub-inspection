"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { forgotPasswordSchema, resetPasswordSchema, ForgotPasswordInput, ResetPasswordInput } from "@/lib/validations";
import { logger } from "@/lib/logger";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Step = "email" | "code" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const router = useRouter();

  const emailForm = useForm<ForgotPasswordInput>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<ResetPasswordInput>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Paso 1: Enviar código al email
  const onSendCode = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const result = await res.json();

      if (!result.ok) {
        toast.error(result.error || "Error al enviar el código");
        return;
      }

      setEmailValue(data.email);
      setStep("code");
      toast.success("Código de verificación enviado a tu correo");

      // En desarrollo, mostrar el código si no se pudo enviar por email
      if (result.code) {
        setDevCode(result.code);
      }
    } catch (err) {
      logger.error("Forgot password: send code failed", err instanceof Error ? err : new Error(String(err)), {
        component: "ForgotPasswordPage",
        action: "sendResetCode",
      });
      toast.error("Error al enviar el código");
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2: Verificar código + setear nueva contraseña
  const onResetPassword = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    try {
      // Obtener el código de los inputs individuales
      const codeInputs = document.querySelectorAll<HTMLInputElement>('input[data-otp-input]');
      const otpCode = Array.from(codeInputs).map(input => input.value).join("");

      if (otpCode.length !== 6) {
        toast.error("Ingresa el código de 6 dígitos");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          code: otpCode,
          password: data.password,
        }),
      });
      const result = await res.json();

      if (!result.ok) {
        toast.error(result.error || "Error al verificar el código");
        setIsLoading(false);
        return;
      }

      setStep("done");
      toast.success("Contraseña restablecida correctamente");
    } catch (err) {
      logger.error("Forgot password: verify code failed", err instanceof Error ? err : new Error(String(err)), {
        component: "ForgotPasswordPage",
        action: "verifyResetCode",
      });
      toast.error("Error al verificar el código");
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar inputs del código OTP
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[data-otp-input]');
    if (digit && index < 5) {
      const next = inputs[index + 1];
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[data-otp-input]');
      inputs[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const inputs = document.querySelectorAll<HTMLInputElement>('input[data-otp-input]');
    pasted.split("").forEach((digit, i) => {
      if (inputs[i]) inputs[i].value = digit;
    });
    if (inputs[pasted.length]) inputs[pasted.length].focus();
  };

  return (
    <div className="auth-shell premium-bg-base">
      <div className="auth-card">
        {step === "email" && (
          <>
            <div className="text-center">
              <p className="auth-brand">Claims Hub</p>
              <h1 className="auth-title">Recuperar Contraseña</h1>
              <p className="auth-subtitle">
                Te enviaremos un código de verificación a tu correo
              </p>
            </div>
            <form onSubmit={emailForm.handleSubmit(onSendCode)} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  {...emailForm.register("email")}
                  aria-invalid={emailForm.formState.errors.email ? "true" : "false"}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-4 pt-2">
                <Button type="submit" className="w-full btn-run btn-lg-block" disabled={isLoading}>
                  {isLoading ? "Enviando..." : "Enviar código"}
                </Button>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors text-center"
                >
                  Volver al login
                </Link>
              </div>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <div className="text-center">
              <p className="auth-brand">Claims Hub</p>
              <h1 className="auth-title">Verificar Código</h1>
              <p className="auth-subtitle">
                Ingresa el código de 6 dígitos enviado a<br />
                <span className="font-medium text-foreground">{emailValue}</span>
              </p>
            </div>
            {devCode && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                <p className="text-xs text-amber-700">Modo desarrollo - código:</p>
                <p className="text-lg font-bold text-amber-900 tracking-widest">{devCode}</p>
              </div>
            )}
            <form onSubmit={passwordForm.handleSubmit(onResetPassword)} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Código de verificación</Label>
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      data-otp-input
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="h-12 w-12 rounded-lg border border-input bg-background text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("password")}
                  aria-invalid={passwordForm.formState.errors.password ? "true" : "false"}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("confirmPassword")}
                  aria-invalid={passwordForm.formState.errors.confirmPassword ? "true" : "false"}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-4 pt-2">
                <Button type="submit" className="w-full btn-save btn-lg-block" disabled={isLoading}>
                  {isLoading ? "Verificando..." : "Verificar y restablecer"}
                </Button>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors text-center"
                >
                  Cambiar correo
                </button>
              </div>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <div className="text-center">
              <p className="auth-brand">Claims Hub</p>
              <h1 className="auth-title">Contraseña Restablecida</h1>
              <p className="auth-subtitle">
                Tu contraseña se ha actualizado correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-4">
              <Button onClick={() => router.push("/login")} className="w-full btn-save btn-lg-block">
                Ir al login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

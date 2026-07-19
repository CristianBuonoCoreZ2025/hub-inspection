"use client";

import { FileText, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Módulo: Propuestas
 *
 * ESTADO: Pendiente de definición.
 *
 * Este módulo está reservado para un futuro sistema de propuestas de liquidación
 * (ofertas al asegurado / contrapropuestas). Actualmente no tiene funcionalidad.
 *
 * Posible alcance futuro:
 * - Crear propuesta de liquidación asociada a un siniestro
 * - Enviar propuesta al asegurado para aceptación/rechazo
 * - Historial de propuestas (versión, estado, contraofertas)
 * - Generar PDF de la propuesta
 * - Notificar por email al asegurado
 *
 * Mientras no se defina el alcance, se muestra esta página placeholder.
 */
export default function PropuestasPage() {
  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Propuestas</h1>
        <p className="app-page-lead">
          Sistema de propuestas de liquidación.
        </p>
      </header>

      <section className="app-panel">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/30 mb-4">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">Módulo en desarrollo</h2>
          <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground">
            Este módulo permitirá crear y gestionar propuestas de liquidación
            asociadas a siniestros, enviarlas al asegurado para aceptación o
            rechazo, y generar el documento PDF correspondiente.
          </p>
          <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Pendiente de definición de alcance</span>
          </div>
          <Link
            href="/dashboard/claims"
            className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
          >
            Volver a siniestros
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

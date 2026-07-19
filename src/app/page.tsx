"use client";

import Link from "next/link";
import {
  ShieldCheck,
  FileText,
  Camera,
  Video,
  BrainCircuit,
  Workflow,
  CheckCircle2,
  ArrowRight,
  Building2,
  Users,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const features = [
  {
    icon: Workflow,
    title: "Workflow automático",
    desc: "Gestiones que se crean solas según el tipo de siniestro. Cobertura, reserva, inspección, ajuste — todo encadenado.",
  },
  {
    icon: FileText,
    title: "Gestión documental",
    desc: "Recepción Total de Antecedentes con auto-emisión. Subí un documento y el sistema avanza solo.",
  },
  {
    icon: Video,
    title: "Inspección remota",
    desc: "Videollamada integrada con captura de evidencias, croquis y firma electrónica en tiempo real.",
  },
  {
    icon: Camera,
    title: "Evidencias geolocalizadas",
    desc: "Fotos y videos con metadata GPS, organizados por espacio dañado y categoría.",
  },
  {
    icon: BrainCircuit,
    title: "IA + OCR",
    desc: "Extracción automática de datos de documentos y análisis de daños asistido por IA.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría completa",
    desc: "Historial inmutable de cada acción: quién emitió, revisó, aprobó o reversó cada gestión.",
  },
];

const stats = [
  { value: "70%", label: "Menos tiempo de liquidación" },
  { value: "100%", label: "Trazabilidad del expediente" },
  { value: "24/7", label: "Disponibilidad de la plataforma" },
  { value: "0", label: "Papel utilizado" },
];

const flow = [
  { icon: FileText, title: "Apertura", desc: "Registro del siniestro y creación automática del workflow" },
  { icon: Workflow, title: "Gestiones", desc: "Cobertura, reserva, NSA y RTA se encadenan automáticamente" },
  { icon: Video, title: "Inspección", desc: "Videollamada con evidencias y firma digital" },
  { icon: CheckCircle2, title: "Liquidación", desc: "Informe final generado y expediente cerrado" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold tracking-tight">Claims Hub</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Funcionalidades
            </Link>
            <Link href="#flujo" className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Flujo
            </Link>
            <Link href="#stats" className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Métricas
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button className="pg-btn-platinum" onClick={() => window.location.href = "/login"}>
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border px-4 py-16 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium">
                <span className="mr-2 flex size-1.5 rounded-full bg-emerald-500" />
                Claims Lifecycle Management
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Liquidación de siniestros{" "}
                <span className="text-primary">digital y automática</span>
              </h1>
              <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                Desde la apertura del caso hasta la liquidación final. Workflow automático de gestiones,
                inspección remota con evidencias, y trazabilidad completa del expediente.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="pg-btn-platinum" onClick={() => window.location.href = "/login"}>
                  Iniciar Sesión
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-4 pt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="size-3" /> Acceso por invitación
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" /> Multi-empresa
                </span>
                <span className="flex items-center gap-1">
                  <Users className="size-3" /> Multi-rol
                </span>
              </div>
            </div>

            {/* Mock dashboard preview */}
            <div className="relative hidden lg:block">
              <div className="rounded-xl border border-border bg-card p-1 shadow-xl">
                <div className="rounded-lg border border-border bg-background overflow-hidden">
                  {/* Mock header */}
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <div className="flex gap-1">
                      <span className="size-2 rounded-full bg-red-400/70" />
                      <span className="size-2 rounded-full bg-amber-400/70" />
                      <span className="size-2 rounded-full bg-emerald-400/70" />
                    </div>
                    <span className="ml-1 text-[10px] text-muted-foreground">L-000000141 · Siniestro</span>
                  </div>
                  {/* Mock body */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-[10px] font-medium">COB · Coberturas</span>
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">Emitida</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-[10px] font-medium">RES · Reserva</span>
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">Emitida</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-primary/5 border border-primary/20 px-2.5 py-1.5">
                      <span className="text-[10px] font-medium">RTA · Recepción Antecedentes</span>
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">Auto-emitida</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-[10px] font-medium">INS · Inspección</span>
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">En curso</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 opacity-60">
                      <span className="text-[10px] font-medium">PCA · Ajuste</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">Pendiente</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 size-20 rounded-full bg-primary/10 blur-2xl" />
              <div className="absolute -bottom-4 -left-4 size-24 rounded-full bg-primary/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-b border-border bg-muted/30 px-4 py-12 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{s.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Todo en una sola plataforma</h2>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Diseñado para liquidadores, ajustadores, inspectores y supervisores.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-card/50 p-5 transition-colors hover:bg-card"
                >
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <h3 className="text-[14px] font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section id="flujo" className="border-t border-border bg-muted/30 px-4 py-16 lg:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Del siniestro a la liquidación</h2>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Un flujo end-to-end que se automatiza solo.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {flow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative">
                  {i < flow.length - 1 && (
                    <div className="absolute left-full top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                      <ArrowRight className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-card p-5 text-center">
                    <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-[13px] font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-4 py-16 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            ¿Listo para empezar?
          </h2>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Inicia sesión para acceder a tu panel de gestión de siniestros.
          </p>
          <div className="mt-6">
            <Button className="pg-btn-platinum" onClick={() => window.location.href = "/login"}>
              Iniciar Sesión
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-4 py-8 lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="size-3.5" />
              </div>
              <span className="font-heading text-[13px] font-semibold">Claims Hub</span>
            </Link>
            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} Claims Hub Platform. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

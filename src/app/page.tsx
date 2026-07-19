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
  Zap,
  TrendingDown,
  Clock,
  Globe,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const features = [
  {
    icon: Workflow,
    title: "Workflow automático",
    desc: "Las gestiones se crean solas según el tipo de siniestro. Cobertura → Reserva → NSA → RTA, todo encadenado sin intervención manual.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
  },
  {
    icon: FileText,
    title: "Recepción Total de Antecedentes",
    desc: "Subí el último documento y la RTA se auto-emite. Eliminá uno y se reversa automáticamente. Cero fricción.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: Video,
    title: "Inspección remota en vivo",
    desc: "Videollamada integrada con captura de evidencias, croquis digital y firma electrónica en tiempo real. Sin instalar nada.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500",
  },
  {
    icon: Camera,
    title: "Evidencias geolocalizadas",
    desc: "Fotos y videos con metadata GPS, organizados por espacio dañado y categoría. Trazabilidad total del expediente.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
  },
  {
    icon: BrainCircuit,
    title: "IA + OCR integrado",
    desc: "Extracción automática de datos de documentos. Análisis de daños asistido por IA. Menos trabajo manual, más precisión.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-500",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría inmutable",
    desc: "Cada acción queda registrada: quién emitió, revisó, aprobó o reversó cada gestión. Historial completo por siniestro.",
    gradient: "from-indigo-500/20 to-blue-500/20",
    iconColor: "text-indigo-500",
  },
];

const stats = [
  { icon: TrendingDown, value: "70%", label: "Menos tiempo de liquidación", sub: "vs. proceso manual" },
  { icon: CheckCircle2, value: "100%", label: "Trazabilidad del expediente", sub: "auditoría completa" },
  { icon: Clock, value: "24/7", label: "Disponibilidad", sub: "acceso desde cualquier dispositivo" },
  { icon: Globe, value: "0", label: "Papel utilizado", sub: "100% digital" },
];

const modules = [
  "Siniestros", "Coberturas", "Reservas", "Ajuste", "Inspección remota",
  "Evidencias", "Croquis", "Firma digital", "Informes PDF", "Workflow automático",
  "RTA automática", "Auditoría", "Multi-empresa", "Multi-rol", "Catálogos",
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* ═══ Animated gradient background ═══ */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 -left-40 size-[500px] rounded-full bg-violet-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-1/3 -right-40 size-[500px] rounded-full bg-cyan-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "10s" }} />
        <div className="absolute -bottom-40 left-1/3 size-[500px] rounded-full bg-rose-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "12s" }} />
      </div>

      {/* ═══ Navbar ═══ */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldCheck className="size-4.5" />
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
            <Link href="#modulos" className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Módulos
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

      <div className="relative z-10 flex flex-1 flex-col">
        {/* ═══ Hero ═══ */}
        <section className="relative px-4 py-16 lg:px-6 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              {/* Left: copy */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] font-medium backdrop-blur-md">
                  <Sparkles className="size-3 text-primary" />
                  Claims Lifecycle Management Platform
                </div>
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                  Liquidación de siniestros{" "}
                  <span className="bg-linear-to-r from-primary via-violet-500 to-cyan-500 bg-clip-text text-transparent">
                    digital y automática
                  </span>
                </h1>
                <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Desde la apertura del caso hasta la liquidación final. Workflow automático de gestiones,
                  inspección remota con evidencias, y trazabilidad completa del expediente — todo en una plataforma.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button className="pg-btn-platinum" onClick={() => window.location.href = "/login"}>
                    Iniciar Sesión
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3" /> Acceso por invitación
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3" /> Multi-empresa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" /> Multi-rol
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="size-3" /> Tiempo real
                  </span>
                </div>
              </div>

              {/* Right: glass mock dashboard — full app preview */}
              <div className="relative hidden lg:block">
                <div className="rounded-2xl border border-white/20 bg-card/40 p-1.5 shadow-2xl backdrop-blur-xl">
                  <div className="rounded-xl border border-white/10 bg-background/60 overflow-hidden backdrop-blur-md">
                    {/* App header */}
                    <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-400/70" />
                        <span className="size-2.5 rounded-full bg-amber-400/70" />
                        <span className="size-2.5 rounded-full bg-emerald-400/70" />
                      </div>
                      <span className="ml-1 text-[10px] text-muted-foreground">app.claimshub.com/dashboard</span>
                    </div>
                    {/* App body: sidebar + content */}
                    <div className="flex">
                      {/* Mini sidebar */}
                      <div className="w-12 border-r border-border/50 p-2 space-y-2">
                        <div className="size-7 rounded-lg bg-primary/15 flex items-center justify-center">
                          <ShieldCheck className="size-3.5 text-primary" />
                        </div>
                        <div className="size-7 rounded-lg bg-muted/40" />
                        <div className="size-7 rounded-lg bg-muted/40" />
                        <div className="size-7 rounded-lg bg-primary/10" />
                        <div className="size-7 rounded-lg bg-muted/40" />
                        <div className="size-7 rounded-lg bg-muted/40" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 p-3 space-y-2.5">
                        {/* KPIs row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/40 p-2">
                            <div className="text-[8px] text-muted-foreground">Activos</div>
                            <div className="text-[14px] font-bold">47</div>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-2">
                            <div className="text-[8px] text-muted-foreground">Pendientes</div>
                            <div className="text-[14px] font-bold text-amber-500">12</div>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-2">
                            <div className="text-[8px] text-muted-foreground">Cerrados</div>
                            <div className="text-[14px] font-bold text-emerald-500">183</div>
                          </div>
                        </div>
                        {/* Claims table */}
                        <div className="rounded-lg border border-border/40 overflow-hidden">
                          <div className="bg-muted/30 px-2 py-1.5 text-[8px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Siniestros recientes
                          </div>
                          {[
                            { num: "L-000000141", type: "Hogar", status: "En curso", color: "amber", gestiones: "5/6" },
                            { num: "L-000000138", type: "Auto", status: "Emitida", color: "emerald", gestiones: "4/4" },
                            { num: "L-000000135", type: "Hogar", status: "Pendiente", color: "muted", gestiones: "2/5" },
                          ].map((c) => (
                            <div key={c.num} className="flex items-center justify-between border-t border-border/30 px-2 py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono font-medium">{c.num}</span>
                                <span className="text-[8px] text-muted-foreground">{c.type}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] text-muted-foreground">{c.gestiones}</span>
                                <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-medium ${
                                  c.color === "emerald" ? "bg-emerald-500/15 text-emerald-600"
                                  : c.color === "amber" ? "bg-amber-500/15 text-amber-600"
                                  : "bg-muted text-muted-foreground"
                                }`}>{c.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Workflow mini-preview */}
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
                          <div className="text-[8px] font-semibold text-primary mb-1.5">Workflow · L-000000141</div>
                          <div className="flex items-center gap-1">
                            {["COB", "RES", "NSA", "RTA", "INS", "PCA"].map((code, i) => (
                              <div key={code} className="flex items-center">
                                <div className={`size-5 rounded flex items-center justify-center text-[7px] font-bold ${
                                  i < 3 ? "bg-emerald-500/20 text-emerald-600"
                                  : i === 3 ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                                  : i === 4 ? "bg-amber-500/20 text-amber-600"
                                  : "bg-muted/40 text-muted-foreground/50"
                                }`}>{code}</div>
                                {i < 5 && <div className={`w-2 h-px ${i < 3 ? "bg-emerald-500/40" : "bg-border/50"}`} />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Glow effects */}
                <div className="absolute -top-6 -right-6 size-24 rounded-full bg-primary/20 blur-3xl" />
                <div className="absolute -bottom-6 -left-6 size-32 rounded-full bg-violet-500/20 blur-3xl" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Stats ═══ */}
        <section className="border-y border-border/50 bg-background/40 px-4 py-12 backdrop-blur-sm lg:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-xl border border-border/50 bg-card/40 p-4 text-center backdrop-blur-md">
                    <Icon className="mx-auto mb-2 size-5 text-primary" />
                    <div className="text-2xl font-bold tracking-tight sm:text-3xl">{s.value}</div>
                    <div className="mt-1 text-[11px] font-medium text-foreground">{s.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Features ═══ */}
        <section id="features" className="px-4 py-16 lg:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
                <Sparkles className="size-3 text-primary" /> Funcionalidades
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Todo en una sola plataforma
              </h2>
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
                    className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-5 backdrop-blur-md transition-all hover:border-primary/30 hover:bg-card/60"
                  >
                    {/* Gradient glow on hover */}
                    <div className={`absolute -top-12 -right-12 size-32 rounded-full bg-linear-to-br ${f.gradient} opacity-0 blur-2xl transition-opacity group-hover:opacity-100`} />
                    <div className="relative">
                      <div className={`mb-3 flex size-10 items-center justify-center rounded-xl bg-linear-to-br ${f.gradient} ${f.iconColor}`}>
                        <Icon className="size-5" />
                      </div>
                      <h3 className="text-[14px] font-semibold">{f.title}</h3>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Workflow diagram ═══ */}
        <section id="flujo" className="border-y border-border/50 bg-background/40 px-4 py-16 backdrop-blur-sm lg:px-6 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
                <Workflow className="size-3 text-primary" /> Workflow automático
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                El workflow que se encadena solo
              </h2>
              <p className="mt-3 text-[14px] text-muted-foreground">
                Cada gestión dispara la siguiente automáticamente. Sin intervención manual.
              </p>
            </div>

            {/* Workflow visual diagram */}
            <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-md lg:p-8">
              {/* Desktop: horizontal flow with connectors */}
              <div className="hidden lg:flex items-start justify-between gap-1">
                {[
                  { code: "COB", name: "Coberturas", desc: "Verificación de cobertura de la póliza", status: "emitida", icon: ShieldCheck },
                  { code: "RES", name: "Reserva", desc: "Cálculo y emisión de reserva inicial", status: "emitida", icon: FileText },
                  { code: "NSA", name: "Notificación", desc: "Aviso al asegurado y registro de contacto", status: "emitida", icon: Users },
                  { code: "RTA", name: "Recepción Antecedentes", desc: "Auto-emisión al subir el último documento", status: "auto", icon: CheckCircle2 },
                  { code: "INS", name: "Inspección", desc: "Videollamada, evidencias y firma digital", status: "curso", icon: Video },
                  { code: "PCA", name: "Ajuste", desc: "Liquidación final y cierre del expediente", status: "pendiente", icon: Workflow },
                ].map((g, i) => {
                  const Icon = g.icon;
                  const isDone = g.status === "emitida";
                  const isAuto = g.status === "auto";
                  const isCurso = g.status === "curso";
                  return (
                    <div key={g.code} className="relative flex flex-1 flex-col items-center">
                      {/* Node */}
                      <div className={`relative flex size-14 items-center justify-center rounded-2xl border-2 transition-all ${
                        isDone ? "border-emerald-500/40 bg-emerald-500/10"
                        : isAuto ? "border-primary/50 bg-primary/10 ring-4 ring-primary/10"
                        : isCurso ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border bg-muted/20"
                      }`}>
                        <Icon className={`size-6 ${
                          isDone ? "text-emerald-500"
                          : isAuto ? "text-primary"
                          : isCurso ? "text-amber-500"
                          : "text-muted-foreground/50"
                        }`} />
                        {/* Auto badge */}
                        {isAuto && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[7px] font-bold text-primary-foreground whitespace-nowrap">
                            AUTO
                          </span>
                        )}
                      </div>
                      {/* Code */}
                      <span className={`mt-2 text-[11px] font-bold ${
                        isDone ? "text-emerald-500"
                        : isAuto ? "text-primary"
                        : isCurso ? "text-amber-500"
                        : "text-muted-foreground/50"
                      }`}>{g.code}</span>
                      {/* Name */}
                      <span className="mt-0.5 text-[10px] font-medium text-center">{g.name}</span>
                      {/* Desc */}
                      <span className="mt-1 text-[9px] text-muted-foreground text-center leading-tight max-w-[120px]">{g.desc}</span>
                      {/* Connector — positioned relative to this node's wrapper */}
                      {i < 5 && (
                        <div className="absolute top-7 left-[calc(50%+28px)] h-0.5 w-[calc(100%-56px)]">
                          <div className={`h-full ${isDone ? "bg-emerald-500/40" : "bg-border/50"}`} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: vertical flow */}
              <div className="space-y-3 lg:hidden">
                {[
                  { code: "COB", name: "Coberturas", desc: "Verificación de cobertura de la póliza", status: "emitida", icon: ShieldCheck },
                  { code: "RES", name: "Reserva", desc: "Cálculo y emisión de reserva inicial", status: "emitida", icon: FileText },
                  { code: "NSA", name: "Notificación", desc: "Aviso al asegurado y registro de contacto", status: "emitida", icon: Users },
                  { code: "RTA", name: "Recepción Antecedentes", desc: "Auto-emisión al subir el último documento", status: "auto", icon: CheckCircle2 },
                  { code: "INS", name: "Inspección", desc: "Videollamada, evidencias y firma digital", status: "curso", icon: Video },
                  { code: "PCA", name: "Ajuste", desc: "Liquidación final y cierre del expediente", status: "pendiente", icon: Workflow },
                ].map((g) => {
                  const Icon = g.icon;
                  const isDone = g.status === "emitida";
                  const isAuto = g.status === "auto";
                  const isCurso = g.status === "curso";
                  return (
                    <div key={g.code} className="relative flex items-center gap-3">
                      <div className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl border-2 ${
                        isDone ? "border-emerald-500/40 bg-emerald-500/10"
                        : isAuto ? "border-primary/50 bg-primary/10"
                        : isCurso ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border bg-muted/20"
                      }`}>
                        <Icon className={`size-5 ${
                          isDone ? "text-emerald-500"
                          : isAuto ? "text-primary"
                          : isCurso ? "text-amber-500"
                          : "text-muted-foreground/50"
                        }`} />
                        {isAuto && (
                          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary px-1 py-0.5 text-[6px] font-bold text-primary-foreground">
                            AUTO
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[12px] font-bold ${
                            isDone ? "text-emerald-500"
                            : isAuto ? "text-primary"
                            : isCurso ? "text-amber-500"
                            : "text-muted-foreground/50"
                          }`}>{g.code}</span>
                          <span className="text-[12px] font-medium">{g.name}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{g.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-border/30 pt-4">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-emerald-500/40" /> Emitida
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-primary/50 ring-2 ring-primary/20" /> Auto-emitida
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-amber-500/40" /> En curso
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-muted" /> Pendiente
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Modules ═══ */}
        <section id="modulos" className="px-4 py-16 lg:px-6 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
              <Building2 className="size-3 text-primary" /> Módulos
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              15+ módulos integrados
            </h2>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Todo lo que necesitas para gestionar el ciclo de vida completo de un siniestro.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {modules.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-border/50 bg-card/40 px-3.5 py-1.5 text-[12px] font-medium backdrop-blur-md transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="relative px-4 py-20 lg:px-6 lg:py-28">
          <div className="mx-auto max-w-2xl">
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-card/40 p-10 text-center backdrop-blur-xl lg:p-14">
              {/* Glow */}
              <div className="absolute -top-20 left-1/2 size-60 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
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
            </div>
          </div>
        </section>
      </div>

      {/* ═══ Footer ═══ */}
      <footer className="relative z-10 border-t border-border/50 bg-background/60 px-4 py-8 backdrop-blur-md lg:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-linear-to-br from-primary to-primary/70 text-primary-foreground">
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

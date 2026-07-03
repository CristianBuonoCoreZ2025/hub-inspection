"use client";

import Link from "next/link"
import {
  Video,
  Camera,
  Signature,
  FileText,
  BrainCircuit,
  ShieldCheck,
  Home,
  Droplets,
  Flame,
  Zap,
  Mountain,
  Building,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const benefits = [
  {
    icon: Video,
    title: "Videollamadas integradas",
    desc: "Conexión en tiempo real con el asegurado sin salir de la plataforma.",
  },
  {
    icon: Camera,
    title: "Captura de evidencias",
    desc: "Fotos, videos y documentos organizados automáticamente por caso.",
  },
  {
    icon: Signature,
    title: "Firma electrónica",
    desc: "Ambas partes firman digitalmente con trazabilidad completa.",
  },
  {
    icon: FileText,
    title: "Informes automáticos",
    desc: "Generación de PDF profesional al cerrar la inspección.",
  },
  {
    icon: BrainCircuit,
    title: "Inteligencia Artificial",
    desc: "Análisis automático de daños y extracción de datos con OCR.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría completa",
    desc: "Registro inmutable de cada acción para cumplimiento normativo.",
  },
]

const steps = [
  { number: "1", title: "Crear caso", desc: "Registra el siniestro y asigna un especialista." },
  { number: "2", title: "Enviar Magic Link", desc: "El asegurado recibe un enlace seguro de acceso." },
  { number: "3", title: "Realizar inspección", desc: "Videollamada en vivo con captura de evidencias y firma digital." },
  { number: "4", title: "Firmar informe", desc: "Firma digital del asegurado y del especialista." },
  { number: "5", title: "Generar PDF", desc: "Informe final descargable y almacenado en el expediente del caso." },
]

const useCases = [
  { icon: Home, title: "Seguros de hogar", desc: "Inspecciones rápidas de contenido y estructura." },
  { icon: Droplets, title: "Daños por agua", desc: "Documentación de humedades y afectaciones." },
  { icon: Flame, title: "Incendios", desc: "Evaluación de alcance y severidad del daño." },
  { icon: Zap, title: "Daños eléctricos", desc: "Registro de fallas e instalaciones afectadas." },
  { icon: Mountain, title: "Catástrofes naturales", desc: "Respaldo inmediato en eventos masivos." },
  { icon: Building, title: "Inspecciones inmobiliarias", desc: "Revisión de propiedades sin visita presencial." },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">Claims Hub</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#beneficios" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Beneficios
            </Link>
            <Link href="#como-funciona" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Cómo funciona
            </Link>
            <Link href="#casos-de-uso" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Casos de uso
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden md:flex" onClick={() => window.location.href='/login'}>
              Iniciar Sesión
            </Button>
            <Button size="sm" onClick={() => window.location.href='/register'}>
              Solicitar Demo
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-background px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium">
                <span className="mr-2 flex size-2 rounded-full bg-emerald-500" />
                Claims Lifecycle Management Platform
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Gestión Integral de{" "}
                <span className="text-primary">Siniestros</span>
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                La plataforma digital para la gestión integral del ciclo de vida de un siniestro. Desde la apertura hasta la liquidación.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => window.location.href='/register'}>
                  Solicitar Demo
                </Button>
                <Button size="lg" variant="outline" onClick={() => window.location.href='/login'}>
                  Iniciar Sesión
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl border bg-linear-to-br from-muted to-background p-2 shadow-2xl">
                <div className="aspect-[16/10] overflow-hidden rounded-xl border bg-background">
                  <div className="flex h-full flex-col">
                    <div className="flex items-center gap-2 border-b px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="size-3 rounded-full bg-red-400" />
                        <span className="size-3 rounded-full bg-amber-400" />
                        <span className="size-3 rounded-full bg-emerald-400" />
                      </div>
                      <span className="ml-2 text-xs text-muted-foreground">Sala de Inspección · Claims Hub</span>
                    </div>
                    <div className="flex flex-1">
                      <div className="w-2/3 border-r p-4">
                        <div className="flex h-full items-center justify-center rounded-lg bg-muted">
                          <Video className="size-12 text-muted-foreground/40" />
                        </div>
                      </div>
                      <div className="w-1/3 p-4 space-y-3">
                        <div className="h-20 rounded-lg bg-muted" />
                        <div className="h-20 rounded-lg bg-muted" />
                        <div className="h-20 rounded-lg bg-muted" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 size-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="absolute -bottom-6 -left-6 size-32 rounded-full bg-primary/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Todo lo que necesitas en una plataforma</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Diseñado para equipos de siniestros, ajustadores, liquidadores y aseguradoras de primer nivel.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => {
              const Icon = b.icon
              return (
                <Card key={b.title} className="border bg-card/50 transition-colors hover:bg-card">
                  <CardContent className="p-6">
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{b.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-t bg-muted/40 px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Un flujo end-to-end desde la apertura del caso hasta la liquidación final.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <div key={step.number} className="relative text-center">
                <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full border bg-background text-lg font-bold shadow-sm">
                  {step.number}
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="casos-de-uso" className="px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Casos de uso</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Adaptable a cualquier tipo de siniestro: hogar, autos, industria y más.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((uc) => {
              const Icon = uc.icon
              return (
                <Card key={uc.title} className="border bg-card/50 transition-colors hover:bg-card">
                  <CardContent className="p-6">
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{uc.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{uc.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/40 px-4 py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Transforma tu proceso de liquidación hoy
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Únete a las aseguradoras que ya confían en Claims Hub Platform para transformar la gestión de siniestros.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={() => window.location.href='/register'}>
              Solicitar Demo
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.location.href='/login'}>
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-5" />
                </div>
                <span className="font-heading text-base font-semibold">Claims Hub</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                Plataforma empresarial para la gestión integral del ciclo de vida de siniestros.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Producto</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link href="#beneficios" className="hover:text-foreground">Beneficios</Link></li>
                <li><Link href="#como-funciona" className="hover:text-foreground">Cómo funciona</Link></li>
                <li><Link href="#casos-de-uso" className="hover:text-foreground">Casos de uso</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Soporte</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Iniciar Sesión</Link></li>
                <li><span className="hover:text-foreground cursor-pointer">Contacto</span></li>
                <li><span className="hover:text-foreground cursor-pointer">Centro de ayuda</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Legal</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-foreground cursor-pointer">Política de privacidad</span></li>
                <li><span className="hover:text-foreground cursor-pointer">Términos de uso</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Claims Hub Platform. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}

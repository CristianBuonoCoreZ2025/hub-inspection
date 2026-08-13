import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { UiStyleInjector } from "@/components/ui-style-injector";

export const metadata: Metadata = {
  title: "Claims Hub — Gestión Integral de Siniestros",
  description:
    "Plataforma empresarial para la gestión del ciclo de vida de siniestros. Inspecciones remotas, gestión documental, asignaciones y liquidación en un solo lugar.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/claims-hub-mark.svg",
  },
};

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('claimshub-ui-theme');var s=localStorage.getItem('claimshub-ui-style');var dark=false;var skin='nordic-air';if(t==='nordic-air-dark'){dark=true;skin='nordic-air'}else if(t==='fluid-aurora'){dark=true;skin='fluid-aurora'}else if(t==='nordic-air-light'){dark=false;skin='nordic-air'}else if(s==='fluid-aurora'){dark=true;skin='fluid-aurora';t='fluid-aurora'}else if(s==='nordic-air'){dark=document.documentElement.classList.contains('dark');t=dark?'nordic-air-dark':'nordic-air-light';skin='nordic-air'}else{t='nordic-air-light'}document.documentElement.setAttribute('data-ui-style',skin);if(dark){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else{document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <UiStyleInjector />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}

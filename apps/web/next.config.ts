import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist solo se aplica en build (producción).
// En dev, Next.js 16 usa Turbopack y Serwist añade config de webpack que choca.
// El SW se genera en `next build` y se sirve como archivo estático en prod.
const isDev = process.env.NODE_ENV === "development";
const withSerwist = isDev
  ? (config: NextConfig) => config
  : withSerwistInit({
      swSrc: "src/app/sw.ts",
      swDest: "public/sw.js",
      disable: false,
      additionalPrecacheEntries: [
        { url: "/offline.html", revision: "1" },
      ],
    });

const nextConfig: NextConfig = {
  // Next.js 16 usa Turbopack por defecto. Serwist añade una config de webpack
  // para generar el SW, lo que dispara un error sin esta declaración explícita.
  turbopack: {},
  // Permite orígenes dev para previsualización/browser tools en localhost
  allowedDevOrigins: ["127.0.0.1"],
  // sharp se importa dinámicamente en route handlers (optimización de imágenes
  // antes de subir a R2). Si no se marca como serverExternalPackages, Vercel
  // bundlea sharp pero prunea el libvips bundled (@img/sharp-libvips-linux-x64),
  // causando ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3 not found en runtime.
  // Marcándolo externo, Next.js lo resuelve desde node_modules y Vercel incluye
  // los binarios nativos completos en la función serverless.
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
    ],
  },
  // Manifest PWA
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/sw-dev.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);

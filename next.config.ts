import type { NextConfig } from "next";

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
};

export default nextConfig;

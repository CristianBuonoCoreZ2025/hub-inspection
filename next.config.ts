import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

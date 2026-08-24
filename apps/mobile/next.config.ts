import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export estático para Capacitor (sin SSR, sin API routes)
  output: "export",
  // Las imágenes optimizadas no funcionan con export estático
  images: {
    unoptimized: true,
  },
  // No trailing slash para que las rutas funcionen en Capacitor
  trailingSlash: true,
};

export default nextConfig;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hubinspection.app",
  appName: "Claims Hub",
  webDir: "out",
  server: {
    // URL de producción — la app nativa carga esta URL en el WebView
    url: "https://claims.fdpchile.com",
    // Abrir directo en la ruta móvil de inspecciones
    initialRoute: "/mobile/inspecciones",
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
    Camera: {
      permissions: ["camera", "photos"],
    },
    Geolocation: {
      enableHighAccuracy: true,
    },
  },
};

export default config;

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hubinspection.app",
  appName: "Claims Hub",
  // Carga la web app deployada. El SW maneja offline.
  webDir: "out",
  server: {
    // URL de producción — la app nativa carga esta URL en el WebView
    url: "https://claims.fdpchile.com",
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
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

# Claims Hub Mobile

App nativa para iOS y Android usando Capacitor.

## Cómo funciona

La app carga `https://claims.fdpchile.com` en un WebView nativo.
El service worker de la web app maneja el modo offline.
Los plugins nativos de Capacitor mejoran la experiencia:

- **Cámara nativa** — mejor performance que web camera
- **Geolocalización nativa** — GPS de alta precisión
- **Haptics** — vibración táctil en acciones
- **Network** — detección nativa de online/offline
- **Splash Screen** — pantalla de inicio nativa
- **Status Bar** — barra de estado oscura
- **SQLite** — storage nativo (futuro reemplazo de IndexedDB)

## Estructura

```
apps/mobile/
├── src/
│   ├── app/              # Páginas Next.js (static export)
│   │   ├── layout.tsx
│   │   ├── page.tsx      # Pantalla inicial / estado
│   │   └── globals.css
│   └── lib/
│       ├── platform.ts       # Detector de plataforma nativa
│       ├── native-camera.ts  # Cámara nativa con fallback web
│       ├── native-geo.ts     # Geolocalización nativa
│       ├── native-network.ts # Network nativo
│       └── native-haptics.ts # Haptics nativo
├── android/              # Proyecto Android Studio (generado)
├── ios/                  # Proyecto Xcode (generado)
├── out/                  # Build estático (generado)
├── capacitor.config.ts   # Configuración Capacitor
├── next.config.ts        # output: "export"
└── package.json
```

## Comandos

```bash
# Desde la raíz del monorepo
pnpm mobile:build          # Build web + copiar a nativo
pnpm mobile:sync           # Sync assets a nativo
pnpm mobile:ios            # Abrir en Xcode
pnpm mobile:android        # Abrir en Android Studio
```

## Desarrollo local

Para apuntar a localhost en vez de producción:

1. Editar `capacitor.config.ts`:
   ```ts
   server: {
     url: "http://192.168.x.x:3000",  // IP de tu PC en la red local
     cleartext: true,
   }
   ```
2. `pnpm mobile:build && pnpm mobile:sync`
3. Abrir en Android Studio o Xcode

## Deploy

### Android
1. `pnpm mobile:build && pnpm mobile:sync`
2. `pnpm mobile:android` → abre Android Studio
3. Build → Generate Signed Bundle/APK
4. Subir a Google Play Console

### iOS
1. `pnpm mobile:build && pnpm mobile:sync`
2. `pnpm mobile:ios` → abre Xcode
3. Configurar signing (Apple Developer Account)
4. Product → Archive → Distribute App

## Permisos nativos

### Android
Los permisos se configuran en `android/app/src/main/AndroidManifest.xml`:
- `CAMERA` — cámara
- `ACCESS_FINE_LOCATION` — GPS
- `ACCESS_COARSE_LOCATION` — GPS aproximado
- `INTERNET` — red
- `ACCESS_NETWORK_STATE` — estado de red

### iOS
Los permisos se configuran en `ios/App/App/Info.plist`:
- `NSCameraUsageDescription` — cámara
- `NSLocationWhenInUseUsageDescription` — GPS
- `NSPhotoLibraryUsageDescription` — galería

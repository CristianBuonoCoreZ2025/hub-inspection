# Claims Hub Mobile

App nativa para iOS y Android usando Capacitor + Next.js (static export).

## Estructura

```
apps/mobile/
├── src/              # Código de la app (importa de apps/web)
├── ios/              # Proyecto Xcode (generado, no commiteado)
├── android/          # Proyecto Android Studio (generado, no commiteado)
├── out/              # Build estático de Next.js (generado, no commiteado)
├── capacitor.config.ts
├── next.config.ts    # output: "export"
└── package.json
```

## Setup inicial

```bash
# Desde la raíz del monorepo
pnpm install

# Inicializar plataformas nativas (solo la primera vez)
cd apps/mobile
npx cap add ios
npx cap add android
```

## Desarrollo

```bash
# Build web + copiar a nativo
pnpm mobile:build
pnpm mobile:sync

# Abrir en Xcode
pnpm mobile:ios

# Abrir en Android Studio
pnpm mobile:android
```

## Deploy

### iOS
1. `pnpm mobile:build && pnpm mobile:sync`
2. `pnpm mobile:ios` → abre Xcode
3. Configurar signing (Apple Developer Account)
4. Product → Archive → Distribute App

### Android
1. `pnpm mobile:build && pnpm mobile:sync`
2. `pnpm mobile:android` → abre Android Studio
3. Build → Generate Signed Bundle/APK
4. Subir a Google Play Console

"use client";

import { useEffect, useState } from "react";
import { isNativePlatform, getPlatform } from "@/lib/platform";
import { isOnline } from "@/lib/native-network";

export default function HomePage() {
  const [native, setNative] = useState(false);
  const [platform, setPlatform] = useState<string>("web");
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setNative(isNativePlatform());
    setPlatform(getPlatform());
    isOnline().then(setOnline);
  }, []);

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-background gap-4 p-6">
      <div className="flex items-center gap-2">
        <ClipboardCheckIcon />
        <span className="font-semibold text-lg">Claims Hub</span>
      </div>
      <div className="text-sm text-muted-foreground text-center">
        <p>Plataforma: {platform}</p>
        <p>Nativo: {native ? "sí" : "no"}</p>
        <p>Conexión: {online === null ? "verificando..." : online ? "online" : "offline"}</p>
      </div>
      {native && (
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          La app cargará automáticamente la interfaz de inspecciones.
          Si no carga, verifica tu conexión a internet.
        </p>
      )}
    </div>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

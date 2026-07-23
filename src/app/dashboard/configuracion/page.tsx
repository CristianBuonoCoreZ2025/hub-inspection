"use client";

import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  Bell,
  Plug,
  User,
  Shield,
  Save,
  MapPin,
  Loader2,
} from "lucide-react";

import { invalidateSystemSettingCache } from "@/services/settings";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DiagnosticLogToggle from "./DiagnosticLogToggle";

type ConfigTab = "general" | "notificaciones" | "integraciones" | "perfiles";

const profiles = [
  {
    role: "Interno",
    badge: "Administrador",
    description:
      "Usuarios internos del sistema. Pueden crear siniestros, gestionar empresas, invitar usuarios y ver toda la información de la plataforma.",
    permissions: [
      "Ver todos los siniestros",
      "Crear y editar empresas",
      "Invitar y gestionar usuarios",
      "Generar informes",
      "Configurar la plataforma",
    ],
  },
  {
    role: "Liquidador",
    badge: "Asociado a clientes",
    description:
      "Liquidadores asociados a uno o más clientes. Ven todos los siniestros de sus clientes. Pueden intervenir solo en las gestiones de los siniestros donde son el liquidador asignado.",
    permissions: [
      "Ver siniestros de sus clientes",
      "Ver inspecciones de sus clientes",
      "Intervenir en gestiones donde es liquidador",
      "Solo vista en inspecciones (no modificar)",
    ],
  },
  {
    role: "Inspector",
    badge: "Asociado a clientes",
    description:
      "Inspectores asociados a uno o más clientes. Solo pueden ver los casos de sus clientes donde son el inspector asignado. Solo pueden completar la inspección donde están a cargo.",
    permissions: [
      "Ver siniestros donde es inspector",
      "Completar inspección donde está a cargo",
      "Subir evidencias y fotos",
      "No puede modificar otros datos del siniestro",
    ],
  },
  {
    role: "Operativo (Cliente)",
    badge: "Un solo cliente",
    description:
      "Usuarios operativos del cliente. Ven todos los casos de su empresa. Solo lectura, no pueden crear ni editar.",
    permissions: [
      "Ver siniestros de su empresa",
      "Ver agenda de inspecciones",
      "Descargar informes",
      "No pueden crear ni editar",
    ],
  },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<ConfigTab>("general");

  const isInternal = profile?.role === "internal";

  const tabs: { id: ConfigTab; label: string; icon: typeof Settings; internalOnly?: boolean }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "notificaciones", label: "Notificaciones", icon: Bell },
    { id: "integraciones", label: "Integraciones", icon: Plug, internalOnly: true },
    { id: "perfiles", label: "Perfiles", icon: User },
  ];

  const visibleTabs = tabs.filter((t) => !t.internalOnly || isInternal);

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Configuración</h1>
        <p className="app-page-lead">
          Configuración de la plataforma, perfiles de usuario y herramientas.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "notificaciones" && <NotificacionesTab />}
      {tab === "integraciones" && isInternal && <IntegracionesTab />}
      {tab === "perfiles" && <PerfilesTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: General
// ═══════════════════════════════════════════════════════════
function GeneralTab() {
  const queryClient = useQueryClient();
  const [thresholdInput, setThresholdInput] = React.useState("500");

  const { data: geoThreshold, isLoading: isLoadingThreshold } = useQuery({
    queryKey: ["geo-threshold"],
    queryFn: async () => {
      const res = await fetch("/api/settings/geo-threshold");
      const data = await res.json();
      return typeof data.threshold === "number" ? data.threshold : 500;
    },
  });

  React.useEffect(() => {
    if (geoThreshold == null) return;
    const id = setTimeout(() => setThresholdInput(String(geoThreshold)), 0);
    return () => clearTimeout(id);
  }, [geoThreshold]);

  const updateThreshold = useMutation({
    mutationFn: async (value: number) => {
      const res = await fetch("/api/settings/geo-threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateSystemSettingCache("geo_threshold_meters");
      queryClient.invalidateQueries({ queryKey: ["geo-threshold"] });
      toast.success("Umbral de geolocalización actualizado");
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar"),
  });

  const handleSaveThreshold = () => {
    const parsed = Number(thresholdInput);
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("El umbral debe ser un número mayor a 0");
      return;
    }
    updateThreshold.mutate(parsed);
  };

  return (
    <div className="space-y-4">
      <DiagnosticLogToggle />

      <section className="app-panel">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Umbral de geolocalización</h2>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Distancia máxima en metros entre la ubicación capturada y la dirección del siniestro
          para considerar la inspección como verificada.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-[11px] text-muted-foreground">Metros</Label>
            <Input
              type="number"
              min={1}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="500"
              className="app-input"
              disabled={isLoadingThreshold}
            />
          </div>
          <Button
            type="button"
            className="pg-btn-platinum"
            onClick={handleSaveThreshold}
            disabled={isLoadingThreshold || updateThreshold.isPending}
          >
            {updateThreshold.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Guardar
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ejemplos: 10m, 100m, 500m (estándar), 5000m.
        </p>
      </section>

      <MapProvidersSection />

      <section className="app-panel">
        <h2 className="text-sm font-semibold">Información de la cuenta</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Datos básicos de tu sesión activa.
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <span className="text-[13px] font-medium">Rol</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {useAuth().profile?.role || "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sección: Proveedores de mapas
// ═══════════════════════════════════════════════════════════
type MapProvider = "osm" | "mapbox";

function MapProvidersSection() {
  const queryClient = useQueryClient();
  const [primary, setPrimary] = React.useState<MapProvider>("osm");
  const [secondary, setSecondary] = React.useState<MapProvider | "none">("none");
  const [mapboxToken, setMapboxToken] = React.useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["map-providers"],
    queryFn: async () => {
      const res = await fetch("/api/settings/map-providers");
      const data = await res.json();
      return data as { providers: MapProvider[]; tokens: Record<string, string | null> };
    },
  });

  React.useEffect(() => {
    if (!config) return;
    const [p, s] = config.providers;
    const id = setTimeout(() => {
      setPrimary(p || "osm");
      setSecondary(s || "none");
      setMapboxToken(config.tokens?.mapbox || "");
    }, 0);
    return () => clearTimeout(id);
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      const providers: MapProvider[] = [primary];
      if (secondary !== "none" && secondary !== primary) providers.push(secondary);
      const res = await fetch("/api/settings/map-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers,
          tokens: { mapbox: mapboxToken || null },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateSystemSettingCache("map_providers");
      queryClient.invalidateQueries({ queryKey: ["map-providers"] });
      toast.success("Proveedores de mapas actualizados");
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar"),
  });

  return (
    <section className="app-panel">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Proveedores de mapas</h2>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Define el orden de proveedores para geocodificación. Si el primero no encuentra resultados,
        se intenta con el segundo.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Proveedor primario</Label>
          <select
            className="app-input mt-1 w-full h-9 rounded-md border border-input bg-transparent px-2 text-[13px]"
            value={primary}
            onChange={(e) => setPrimary(e.target.value as MapProvider)}
            disabled={isLoading}
          >
            <option value="osm">OpenStreetMap (gratis)</option>
            <option value="mapbox">Mapbox (requiere token)</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Proveedor secundario (fallback)</Label>
          <select
            className="app-input mt-1 w-full h-9 rounded-md border border-input bg-transparent px-2 text-[13px]"
            value={secondary}
            onChange={(e) => setSecondary(e.target.value as MapProvider | "none")}
            disabled={isLoading}
          >
            <option value="none">Ninguno</option>
            <option value="osm">OpenStreetMap (gratis)</option>
            <option value="mapbox">Mapbox (requiere token)</option>
          </select>
        </div>
      </div>
      {primary === "mapbox" || secondary === "mapbox" ? (
        <div className="mt-3">
          <Label className="text-[11px] text-muted-foreground">Token de Mapbox</Label>
          <Input
            type="text"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            placeholder="pk.eyJ1Ijoi..."
            className="app-input mt-1"
            disabled={isLoading}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            El token es obligatorio si seleccionás Mapbox. Se guarda cifrado en la base de datos.
          </p>
        </div>
      ) : null}
      <div className="mt-3">
        <Button
          type="button"
          className="pg-btn-platinum"
          onClick={() => save.mutate()}
          disabled={isLoading || save.isPending || ((primary === "mapbox" || secondary === "mapbox") && !mapboxToken.trim())}
        >
          {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Guardar
        </Button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Notificaciones (preferencias locales)
// ═══════════════════════════════════════════════════════════
function NotificacionesTab() {
  const [prefs, setPrefs] = useState(() => {
    if (typeof window === "undefined") return {
      claimAssigned: true,
      gestionEmitida: true,
      documentUploaded: false,
      inspectionScheduled: true,
      weeklyDigest: false,
    };
    const stored = localStorage.getItem("notif-prefs");
    if (stored) {
      try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return {
      claimAssigned: true,
      gestionEmitida: true,
      documentUploaded: false,
      inspectionScheduled: true,
      weeklyDigest: false,
    };
  });

  const toggle = (key: keyof typeof prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem("notif-prefs", JSON.stringify(next));
    toast.success("Preferencia guardada");
  };

  const items: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: "claimAssigned", label: "Siniestro asignado", desc: "Cuando se te asigna un nuevo siniestro" },
    { key: "gestionEmitida", label: "Gestión emitida", desc: "Cuando se emite o reversa una gestión" },
    { key: "documentUploaded", label: "Documento subido", desc: "Cuando se sube un documento al siniestro" },
    { key: "inspectionScheduled", label: "Inspección agendada", desc: "Cuando se agenda o reagenda una inspección" },
    { key: "weeklyDigest", label: "Resumen semanal", desc: "Email con resumen de actividad de la semana" },
  ];

  return (
    <section className="app-panel">
      <h2 className="text-sm font-semibold">Preferencias de notificaciones</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Define qué eventos te notifican. Las notificaciones por email requieren configurar el módulo de Email.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <label
            key={String(item.key)}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <div>
              <div className="text-[13px] font-medium">{item.label}</div>
              <div className="text-[11px] text-muted-foreground">{item.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={prefs[item.key]}
              onChange={() => toggle(item.key)}
              className="size-4 accent-primary"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Integraciones
// ═══════════════════════════════════════════════════════════
function IntegracionesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["integrations-status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/status");
      if (!res.ok) throw new Error("Error al cargar integraciones");
      const data = await res.json();
      return data as { integrations: { name: string; category: string; status: string; statusColor: string; desc: string; config?: string }[] };
    },
  });

  const integrations = data?.integrations || [];

  return (
    <section className="app-panel">
      <h2 className="text-sm font-semibold">Integraciones</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Servicios conectados a la plataforma. Estado basado en variables de entorno.
      </p>
      <div className="mt-4 space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-4">
            <Loader2 className="size-4 animate-spin" />
            Cargando estado de integraciones...
          </div>
        )}
        {integrations.map((int) => (
          <div
            key={int.name}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40">
                  <Plug className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{int.name}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      {int.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{int.desc}</div>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium shrink-0 ${
                  int.statusColor === "emerald"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : int.statusColor === "rose"
                      ? "bg-rose-500/15 text-rose-600"
                      : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {int.status}
              </span>
            </div>
            {int.config && (
              <div className="text-[10px] text-rose-600 dark:text-rose-400 pl-12">
                {int.config}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Perfiles
// ═══════════════════════════════════════════════════════════
function PerfilesTab() {
  return (
    <section className="app-panel">
      <h2 className="text-sm font-semibold">Perfiles de usuario</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Cuatro tipos de usuario definen el acceso y las capacidades dentro de Claims Hub.
      </p>
      <div className="mt-4 space-y-2">
        {profiles.map((p) => (
          <div
            key={p.role}
            className="rounded-xl border border-border bg-card p-4 shadow-(--shadow-card)"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">{p.role}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {p.badge}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {p.description}
            </p>
            <ul className="mt-2 space-y-1">
              {p.permissions.map((perm) => (
                <li
                  key={perm}
                  className="flex items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

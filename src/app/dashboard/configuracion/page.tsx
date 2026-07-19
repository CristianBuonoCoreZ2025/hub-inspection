"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  Building2,
  Bell,
  Palette,
  Plug,
  User,
  Shield,
  Save,
} from "lucide-react";

import { getCompanies, updateCompany } from "@/services/companies";
import { useAuth } from "@/hooks/use-auth";
import type { CompanyInput } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DiagnosticLogToggle from "./DiagnosticLogToggle";

type ConfigTab = "general" | "marca" | "notificaciones" | "integraciones" | "perfiles";

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
    { id: "marca", label: "Marca", icon: Palette, internalOnly: true },
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
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors border-b-2 ${
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
      {tab === "marca" && isInternal && <MarcaTab />}
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
  return (
    <div className="space-y-4">
      <DiagnosticLogToggle />

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
            <span className="text-[12px] text-muted-foreground">
              {useAuth().profile?.role || "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Marca (branding por empresa)
// ═══════════════════════════════════════════════════════════
function MarcaTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = profile?.company_id;

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const [selectedId, setSelectedId] = useState<string>("");
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Sync selectedId when companies load
  const effectiveSelectedId = selectedId || companyId || companies[0]?.id || "";
  const selected = companies.find((c) => c.id === effectiveSelectedId);

  // Sync form fields when selected company changes
  const formKey = effectiveSelectedId;
  const [lastFormKey, setLastFormKey] = useState("");
  if (formKey !== lastFormKey && selected) {
    setLastFormKey(formKey);
    setName(selected.name || "");
    setPrimaryColor(selected.primary_color || "");
    setLogoUrl(selected.logo_url || "");
    setEmail(selected.email || "");
    setPhone(selected.phone || "");
    setAddress(selected.address || "");
  }

  const updateMut = useMutation({
    mutationFn: async (input: Partial<CompanyInput>) => {
      if (!effectiveSelectedId) throw new Error("Selecciona una empresa");
      return updateCompany(effectiveSelectedId, input);
    },
    onSuccess: () => {
      toast.success("Guardado");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al guardar"),
  });

  const onSave = () => {
    updateMut.mutate({
      name,
      primaryColor,
      logoUrl,
      email,
      phone,
      address,
    } as Partial<CompanyInput>);
  };

  return (
    <div className="space-y-4">
      <section className="app-panel">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Branding por empresa</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Personaliza el logo, color principal y datos de contacto de cada empresa.
            </p>
          </div>
        </div>

        {/* Selector de empresa */}
        {companies.length > 1 && (
          <div className="mt-3 space-y-1.5">
            <Label className="app-field-label">Empresa</Label>
            <select
              value={effectiveSelectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="app-input h-7"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {selected && (
          <div className="mt-4 space-y-3">
            {/* Logo preview */}
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-xl border border-border bg-muted/30 overflow-hidden">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="size-full object-contain" />
                ) : (
                  <Building2 className="size-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="app-field-label">URL del logo</Label>
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="app-input h-7"
                />
              </div>
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <Label className="app-field-label">Nombre de la empresa</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="app-input h-7"
              />
            </div>

            {/* Color principal */}
            <div className="flex items-center gap-3">
              <div className="space-y-1.5 flex-1">
                <Label className="app-field-label">Color principal</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor || "#3b82f6"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-7 rounded-md border border-border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="app-input h-7 max-w-[120px]"
                  />
                </div>
              </div>
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="app-field-label">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@empresa.com"
                  className="app-input h-7"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="app-field-label">Teléfono</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+56 2 1234 5678"
                  className="app-input h-7"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="app-field-label">Dirección</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Principal 123"
                className="app-input h-7"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="pg-btn-platinum"
                onClick={onSave}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? "Guardando..." : "Guardar"}
                {!updateMut.isPending && <Save className="ml-1.5 size-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
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
  const integrations = [
    {
      name: "Supabase",
      category: "Backend",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Base de datos, autenticación y storage",
    },
    {
      name: "Cloudflare R2",
      category: "Storage",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Almacenamiento de archivos y evidencias",
    },
    {
      name: "Resend",
      category: "Email",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Envío de emails (magic links, reset password)",
    },
    {
      name: "Jitsi Meet",
      category: "Video",
      status: "Conectado",
      statusColor: "emerald",
      desc: "Videollamadas para inspecciones remotas",
    },
    {
      name: "OpenRouter",
      category: "IA",
      status: "Pendiente",
      statusColor: "amber",
      desc: "IA para análisis de daños y OCR",
    },
  ];

  return (
    <section className="app-panel">
      <h2 className="text-sm font-semibold">Integraciones</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Servicios conectados a la plataforma.
      </p>
      <div className="mt-4 space-y-2">
        {integrations.map((int) => (
          <div
            key={int.name}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
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
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                int.statusColor === "emerald"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-amber-500/15 text-amber-600"
              }`}
            >
              {int.status}
            </span>
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
            className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
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
                  className="flex items-center gap-2 text-[12px] text-muted-foreground"
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

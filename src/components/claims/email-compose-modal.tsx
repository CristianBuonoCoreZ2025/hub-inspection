"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, X, History, FileText, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HtmlEditor } from "@/components/ui/html-editor";
import { getEmailTemplatesForAction } from "@/services/email-template-actions";
import { fetchClaimContacts, type EmailContact } from "@/services/email-contacts";
import { getSupabaseClient } from "@/lib/supabase/db";
import { toast } from "sonner";
import { getUserTimeZone } from "@/lib/timezone";

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: Record<string, unknown> | null;
  action: {
    id: string;
    company_id: string;
    claim_id: string;
    action_template_id: string;
    action_data?: Record<string, unknown> | null;
    gestion_codigo?: string;
    gestion_nombre?: string;
  };
  businessLineId?: string | null;
}

/**
 * Modal de composición de email — modelo Outlook 365.
 *
 * Layout (de arriba a abajo):
 *  1. Header compacto (icono + título + gestión + cerrar)
 *  2. Action bar: [Enviar] [Plantilla ▼ si hay]     [Historial]
 *  3. Campos: Para → CC → Asunto (con autocomplete de libreta)
 *  4. Toolbar de formato (Bold, tablas, colores…) — solo en HTML
 *  5. Body del correo (HtmlEditor o textarea)
 *
 * La libreta de contactos se invoca de 2 formas:
 *  - Escribiendo en Para/CC: autocomplete con sugerencias filtradas
 *  - Botón [Users] al lado de cada campo: abre popover con la libreta completa
 */

/**
 * Botón de libreta de contactos para un campo de destinatario.
 * Abre un popover con todos los contactos del siniestro, agrupados.
 * Click en un contacto → lo agrega al campo correspondiente.
 */
const GROUP_LABELS: Record<string, string> = {
  participants: "Participantes",
  team: "Equipo",
  advisor: "Asesor",
  global: "Directorio",
};

const GROUP_ORDER = ["participants", "team", "advisor", "global"];

function ContactBookTabs({
  target,
  onChange,
}: {
  target: "to" | "cc";
  onChange: (t: "to" | "cc") => void;
}) {
  return (
    <div className="flex border-b border-border/50 shrink-0">
      <button
        type="button"
        onClick={() => onChange("to")}
        className={`flex-1 px-2 py-1.5 text-[10px] font-medium ${
          target === "to"
            ? "text-foreground border-b-2 border-primary bg-muted/30"
            : "text-muted-foreground hover:bg-muted/20"
        }`}
      >
        Para
      </button>
      <button
        type="button"
        onClick={() => onChange("cc")}
        className={`flex-1 px-2 py-1.5 text-[10px] font-medium ${
          target === "cc"
            ? "text-foreground border-b-2 border-primary bg-muted/30"
            : "text-muted-foreground hover:bg-muted/20"
        }`}
      >
        CC
      </button>
    </div>
  );
}

function ContactBookButton({
  contacts,
  onPick,
  label,
  to,
  cc,
}: {
  contacts: EmailContact[];
  onPick: (email: string, target: "to" | "cc") => void;
  label: string;
  to: string[];
  cc: string[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"to" | "cc">("to");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.fullName?.toLowerCase().includes(q) ?? false) ||
        c.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const map: Record<string, EmailContact[]> = {};
    for (const c of filtered) {
      const g = c.group;
      if (!map[g]) map[g] = [];
      map[g].push(c);
    }
    return GROUP_ORDER
      .filter((g) => map[g])
      .map((g) => ({ key: g, title: GROUP_LABELS[g] || g, items: map[g] }));
  }, [filtered]);

  const inField = (email: string, field: "to" | "cc") =>
    field === "to" ? to.includes(email) : cc.includes(email);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Tooltip>
            <TooltipTrigger className="inline-flex">
              <button
                type="button"
                className="inline-flex h-6 w-16 items-center justify-center gap-1 px-2 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0 text-[11px] font-medium"
              >
                <Users className="h-3.5 w-3.5" />
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Abrir libreta de contactos</p>
            </TooltipContent>
          </Tooltip>
        }
      />
      <PopoverContent align="start" sideOffset={4} className="w-80 max-h-96 p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">Libreta de contactos</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Tabs */}
        <ContactBookTabs target={target} onChange={setTarget} />

        {/* Buscador */}
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="app-grid-search-wrap">
            <Search />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="liquid-search"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Users className="h-6 w-6 opacity-40" />
              <p className="text-[11px]">No hay contactos disponibles</p>
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Search className="h-5 w-5 opacity-40" />
              <p className="text-[11px]">Sin resultados para &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key}>
                <div className="sticky top-0 z-10 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-background/80 backdrop-blur-sm border-b border-border/20">
                  {group.title}
                </div>
                {group.items.map((contact) => {
                  const initials = (contact.fullName || contact.email)
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const alreadyIn = inField(contact.email, target);
                  const other = target === "to" ? cc : to;
                  const inOther = other.includes(contact.email);
                  return (
                    <div
                      key={contact.email}
                      onDoubleClick={() => {
                        if (alreadyIn) return;
                        onPick(contact.email, target);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 border-b border-border/15 transition-colors ${
                        alreadyIn ? "bg-primary/5" : "hover:bg-accent/50 cursor-pointer"
                      }`}
                      aria-label={alreadyIn ? undefined : "Doble clic para agregar"}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-medium text-white shrink-0 email-icon-gradient">
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {contact.fullName || contact.email}
                        </span>
                        {contact.fullName && (
                          <span className="text-[10px] text-muted-foreground truncate font-mono">
                            {contact.email}
                          </span>
                        )}
                      </div>
                      {alreadyIn && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          target === "to"
                            ? "bg-primary/20 text-primary"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        }`}>
                          {target === "to" ? "En Para" : "En CC"}
                        </span>
                      )}
                      {inOther && !alreadyIn && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">
                          {target === "to" ? "En CC" : "En Para"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EmailComposeModal({
  open,
  onOpenChange,
  claim,
  action,
  businessLineId,
}: EmailComposeModalProps) {
  const [mode, setMode] = useState<"template" | "manual">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [toDraft, setToDraft] = useState("");
  const [ccDraft, setCcDraft] = useState("");
  const [subjectOverride, setSubjectOverride] = useState<string | null>(null);
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const htmlEditorRef = useRef<Editor | null>(null);
  const queryClient = useQueryClient();

  // ─── Tracking de cuándo el preview carga por primera vez para cada template ───
  // Fuerza al HtmlEditor a re-montarse cuando el body del preview pasa de vacío
  // a con contenido, asegurando que Tiptap inicialice con el HTML correcto.
  const [previewVersion, setPreviewVersion] = useState(0);
  const lastLoadedTemplate = useRef<string>("");

  // ─── Autocomplete state ───
  const [activeField, setActiveField] = useState<"to" | "cc" | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");

  const changeTemplate = (newId: string) => {
    setSelectedTemplateId(newId);
    setSubjectOverride(null);
    setBodyOverride(null);
    // Reset para que el previewVersion vuelva a incrementar cuando el nuevo template cargue
    lastLoadedTemplate.current = "";
  };

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["email-templates-for-action", action.action_template_id, businessLineId, action.company_id],
    queryFn: () =>
      getEmailTemplatesForAction(action.action_template_id, {
        companyId: action.company_id,
        businessLineId: businessLineId ?? undefined,
        includeInactive: false,
      }),
    enabled: open,
  });

  // ─── Libreta de contactos para autocomplete ───
  const { data: contacts } = useQuery<EmailContact[]>({
    queryKey: ["email-contacts", action.claim_id],
    queryFn: () => fetchClaimContacts(action.claim_id),
    enabled: open,
    staleTime: 60_000,
  });

  // ─── Datos de empresa para el wrapper HTML (nombre, fallback de logo) ───
  // El header_color, logo_url y logo_position vienen de la PLANTILLA,
  // no de la empresa — son configurados en el editor de plantillas.
  interface CompanyForWrapper {
    id: string;
    name: string;
    logo_url: string | null;
  }
  const { data: company } = useQuery<CompanyForWrapper | null>({
    queryKey: ["company-for-email-wrapper", action.company_id],
    queryFn: async () => {
      if (!action.company_id) return null;
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url")
        .eq("id", action.company_id)
        .maybeSingle();
      return data as CompanyForWrapper | null;
    },
    enabled: open && !!action.company_id,
    staleTime: 300_000, // 5 min — los datos de empresa casi no cambian
  });

  interface EmailLogLite {
    id: string;
    to_address: string[];
    subject: string;
    status: string;
    sent_at: string;
    correlativo: number;
    parent_action_code: string | null;
  }

  const { data: logs } = useQuery<EmailLogLite[]>({
    queryKey: ["email-logs", action.id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("email_logs")
        .select("id, to_address, subject, status, sent_at, correlativo, parent_action_code")
        .eq("claim_action_id", action.id)
        .order("sent_at", { ascending: false });
      return (data || []) as EmailLogLite[];
    },
    enabled: open && showHistory,
  });

  const activeTemplates = useMemo(() => templates?.filter((t) => t.is_active) || [], [templates]);

  // ─── Si no hay plantillas vinculadas, forzar modo manual ───
  // (derivado, sin useEffect — si no hay plantillas, siempre es manual)
  const effectiveMode = activeTemplates.length === 0 ? "manual" : mode;

  const defaultTemplateId = useMemo(() => {
    if (activeTemplates.length === 0) return "";
    const def = activeTemplates.find((t) =>
      (t.actions || []).some(
        (a) => a.action_template_id === action.action_template_id && a.is_default
      )
    );
    return def?.id || activeTemplates[0].id;
  }, [activeTemplates, action.action_template_id]);

  const effectiveTemplateId = selectedTemplateId || defaultTemplateId;

  // ─── Plantilla seleccionada (para obtener header_color, logo_url, logo_position) ───
  const selectedTemplate = useMemo(
    () => activeTemplates.find((t) => t.id === effectiveTemplateId) ?? null,
    [activeTemplates, effectiveTemplateId]
  );

  const { data: previewData } = useQuery({
    queryKey: ["email-preview", action.id, effectiveMode, effectiveTemplateId],
    queryFn: async () => {
      try {
        if (effectiveMode === "manual") {
          return {
            subject: subjectOverride ?? "",
            body: bodyOverride ?? "",
            body_format: "html" as const,
          };
        }
        if (!effectiveTemplateId) {
          return { subject: "", body: "", body_format: "html" as const };
        }
        const res = await fetch("/api/email/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            claimActionId: action.id,
            emailTemplateId: effectiveTemplateId,
          }),
        });
        if (!res.ok) return { subject: "", body: "", body_format: "html" as const };
        return await res.json();
      } catch {
        return { subject: "", body: "", body_format: "html" as const };
      }
    },
    enabled: open && (effectiveMode === "manual" || !!effectiveTemplateId),
    staleTime: 0,
    retry: 1,
  });

  const rendered = {
    subject: previewData?.subject ?? "",
    body: previewData?.body ?? "",
    body_format: (previewData?.body_format ?? "plain") as "plain" | "html",
  };

  // ─── Re-montar HtmlEditor cuando el preview carga con body para un template nuevo ───
  useEffect(() => {
    if (
      effectiveMode === "template" &&
      effectiveTemplateId &&
      rendered.body &&
      lastLoadedTemplate.current !== effectiveTemplateId
    ) {
      lastLoadedTemplate.current = effectiveTemplateId;
      setPreviewVersion((v) => v + 1);
    }
  }, [effectiveMode, effectiveTemplateId, rendered.body]);

  const effectiveSubject = subjectOverride ?? rendered.subject;
  // Fallback al body original de la plantilla si el preview API devuelve vacío
  // (evita que el editor se muestre vacío mientras hay contenido disponible).
  const templateBodyFallback = effectiveMode === "template" ? (selectedTemplate?.body ?? "") : "";
  const effectiveBody = bodyOverride ?? (rendered.body || templateBodyFallback);

  // Versión original de la plantilla (para auditoría — se envía al backend)
  const templateOriginalSubject = effectiveMode === "template" ? rendered.subject : null;
  const templateOriginalBody = effectiveMode === "template" ? rendered.body : null;
  const templateOriginalFormat = effectiveMode === "template" ? rendered.body_format : null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toArr = to;
      const ccArr = cc;

      const payload: Record<string, unknown> = {
        claimActionId: action.id,
        to: toArr,
        cc: ccArr,
      };

      if (effectiveMode === "template" && effectiveTemplateId) {
        payload.emailTemplateId = effectiveTemplateId;
        payload.templateSubject = templateOriginalSubject;
        payload.templateBody = templateOriginalBody;
        payload.templateBodyFormat = templateOriginalFormat;
        if (subjectOverride !== null || bodyOverride !== null) {
          payload.manualSubject = effectiveSubject;
          payload.manualBody = effectiveBody;
          payload.manualBodyFormat = "html";
        }
      } else {
        payload.manualSubject = effectiveSubject;
        payload.manualBody = effectiveBody;
        payload.manualBodyFormat = "html";
      }

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error enviando e-mail");
      return json;
    },
    onSuccess: () => {
      toast.success("E-mail enviado");
      queryClient.invalidateQueries({ queryKey: ["email-logs-by-claim", action.claim_id] });
      queryClient.invalidateQueries({ queryKey: ["email-logs", action.id] });
      setTo([]);
      setCc([]);
      setSubjectOverride(null);
      setBodyOverride(null);
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRecipientToField = (email: string, field: "to" | "cc") => {
    const current = field === "to" ? to : cc;
    if (current.includes(email)) return;
    // Si el contacto está en el otro campo, lo movemos (un email no puede estar en Para y CC).
    if (field === "to" && cc.includes(email)) {
      setCc(cc.filter((e) => e !== email));
    } else if (field === "cc" && to.includes(email)) {
      setTo(to.filter((e) => e !== email));
    }
    const setter = field === "to" ? setTo : setCc;
    setter([...(field === "to" ? to : cc).filter((e) => e !== email), email]);
    if (field === "to") setToDraft("");
    else setCcDraft("");
    setAutocompleteQuery("");
    setActiveField(null);
  };

  const removeRecipientFromField = (email: string, field: "to" | "cc") => {
    const setter = field === "to" ? setTo : setCc;
    const current = field === "to" ? to : cc;
    setter(current.filter((e) => e !== email));
  };

  const tryCommitDraft = (field: "to" | "cc") => {
    const draft = field === "to" ? toDraft : ccDraft;
    const email = draft.trim();
    if (!email) return;
    // Email simple validación
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addRecipientToField(email, field);
    }
  };

  const autocompleteSuggestions = useMemo(() => {
    if (!activeField || !contacts) return [];
    const query = autocompleteQuery.toLowerCase().trim();
    if (query.length < 1) return [];
    const existing = activeField === "to" ? to : cc;
    return contacts
      .filter(
        (c) =>
          !existing.includes(c.email) &&
          (c.email.toLowerCase().includes(query) ||
            (c.fullName?.toLowerCase().includes(query) ?? false) ||
            c.roles.some((r) => r.toLowerCase().includes(query)))
      )
      .slice(0, 8);
  }, [activeField, contacts, autocompleteQuery, to, cc]);

  const handleRecipientInput = (value: string, field: "to" | "cc") => {
    if (field === "to") setToDraft(value);
    else setCcDraft(value);
    setActiveField(field);
    setAutocompleteQuery(value.trim().toLowerCase());
  };

  const handleRecipientBlur = (field: "to" | "cc") => {
    // Delay para permitir click en sugerencia
    setTimeout(() => {
      tryCommitDraft(field);
      setActiveField(null);
      setAutocompleteQuery("");
    }, 200);
  };

  const canSend =
    to.length > 0 &&
    effectiveSubject.trim().length > 0 &&
    effectiveBody.trim().length > 0 &&
    !sendMutation.isPending;

  const gestionCode = action.gestion_codigo || (action.action_data as Record<string, unknown> | null)?.codigo as string | undefined;
  const gestionNombre = action.gestion_nombre;
  const liquidationNumber = (claim as Record<string, unknown> | null)?.liquidation_number as string | undefined;
  const hasTemplates = activeTemplates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dismissible={false}>
      <DialogContent className="modal-email p-0! flex flex-col" showCloseButton={false}>

        {/* ═══ 1. HEADER — idéntico al preview (mismo alto y dimensiones) ═══ */}
        <div className="p-4 border-b border-border bg-background flex items-start justify-between gap-3 shrink-0">
          <DialogTitle className="flex items-start gap-3 m-0 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 email-icon-gradient">
              <Mail className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              {liquidationNumber && (
                <span className="email-header-meta">
                  Liquidación {liquidationNumber}
                </span>
              )}
              <span className="email-header-title">
                {gestionCode ? `Gestión ${gestionCode}` : "Correo"}
              </span>
              {gestionNombre && (
                <span className="email-header-subtitle">
                  {gestionNombre}
                </span>
              )}
            </div>
          </DialogTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Historial — derecha */}
            <Tooltip>
              <TooltipTrigger className="inline-flex">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Historial de envíos</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger className="inline-flex">
                <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Cerrar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Historial (colapsable) */}
        {showHistory && (
          <div className="px-4 py-2 border-b border-border bg-muted/10 shrink-0">
            {logs && logs.length > 0 && (
              <div className="rounded-lg border border-border p-2 space-y-1 max-h-40 overflow-auto bg-background/60">
                {logs.map((log) => (
                  <div key={log.id} className="text-[11px] flex items-center justify-between gap-2 border-b last:border-0 pb-1 border-border/30">
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">
                        EML-{String(log.correlativo).padStart(3, "0")}: {log.subject}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {log.to_address.join(", ")} · {new Date(log.sent_at).toLocaleString("es-CL", { timeZone: getUserTimeZone() })}
                      </span>
                    </div>
                    <span className={`shrink-0 px-1.5 rounded text-[10px] font-medium ${
                      log.status === "sent" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : log.status === "queued" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {logs && logs.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">No hay envíos registrados.</p>
            )}
          </div>
        )}

        {/* ═══ 2. CAMPOS — [Enviar] Para → CC (con autocomplete) ═══ */}
        <div className="px-4 py-2 border-b border-border bg-background text-[11px] shrink-0 relative flex gap-2">
          {/* Enviar — columna izquierda, cuadrado, spanea Para + CC (estilo Outlook 365) */}
          <button
            type="button"
            className="email-send-btn shrink-0"
            disabled={!canSend}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Enviar
          </button>

          {/* Columna derecha — Para + CC apilados */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0 relative">
            {/* Fila Para */}
            <div className="flex items-center gap-2 py-0.5 relative">
              <ContactBookButton
                contacts={contacts || []}
                to={to}
                cc={cc}
                onPick={(email, target) => addRecipientToField(email, target)}
                label="Para"
              />
              <div
                className="flex-1 flex flex-wrap items-center gap-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-0"
                onClick={() => {
                  document.getElementById("to-input")?.focus();
                }}
              >
                {to.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecipientFromField(email, "to");
                      }}
                      className="hover:text-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="to-input"
                  value={toDraft}
                  onChange={(e) => handleRecipientInput(e.target.value, "to")}
                  onFocus={() => setActiveField("to")}
                  onBlur={() => handleRecipientBlur("to")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
                      e.preventDefault();
                      tryCommitDraft("to");
                    }
                    if (e.key === "Backspace" && toDraft === "" && to.length > 0) {
                      removeRecipientFromField(to[to.length - 1], "to");
                    }
                  }}
                  placeholder={to.length === 0 ? "nombre o email…" : ""}
                  className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-20"
                />
              </div>
              {/* Toggle Plantilla */}
              <div className="flex items-center gap-2 shrink-0">
                {hasTemplates && !showTemplateModal && effectiveMode !== "template" && (
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Plantilla
                  </button>
                )}
                {effectiveMode === "template" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("manual");
                      setSelectedTemplateId("");
                      setSubjectOverride(null);
                      setBodyOverride(null);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Quitar plantilla
                  </button>
                )}
              </div>
            </div>

            {/* cc — siempre visible */}
            <div className="flex items-center gap-2 py-0.5 relative">
              <ContactBookButton
                contacts={contacts || []}
                to={to}
                cc={cc}
                onPick={(email, target) => addRecipientToField(email, target)}
                label="cc"
              />
              <div
                className="flex-1 flex flex-wrap items-center gap-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-0"
                onClick={() => {
                  document.getElementById("cc-input")?.focus();
                }}
              >
                {cc.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/40 text-foreground text-[10px] font-medium"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecipientFromField(email, "cc");
                      }}
                      className="hover:text-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="cc-input"
                  value={ccDraft}
                  onChange={(e) => handleRecipientInput(e.target.value, "cc")}
                  onFocus={() => setActiveField("cc")}
                  onBlur={() => handleRecipientBlur("cc")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Tab" || e.key === "," || e.key === ";") {
                      e.preventDefault();
                      tryCommitDraft("cc");
                    }
                    if (e.key === "Backspace" && ccDraft === "" && cc.length > 0) {
                      removeRecipientFromField(cc[cc.length - 1], "cc");
                    }
                  }}
                  placeholder={cc.length === 0 ? "con copia…" : ""}
                  className="flex-1 bg-transparent border-0 outline-none text-foreground text-[12px] min-w-20"
                />
              </div>
            </div>
          </div>

          {/* ─── Autocomplete dropdown ─── */}
          {activeField && autocompleteSuggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-auto">
              {autocompleteSuggestions.map((contact) => {
                const initials = (contact.fullName || contact.email)
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <button
                    key={contact.email}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRecipientToField(contact.email, activeField);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent transition-colors border-b last:border-0 border-border/20"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-medium text-white shrink-0 email-icon-gradient">
                      {initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {contact.fullName || contact.email}
                      </span>
                      {contact.fullName && (
                        <span className="text-[10px] text-muted-foreground truncate font-mono">
                          {contact.email}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {contact.roles.slice(0, 2).map((role) => (
                        <span
                          key={role}
                          className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                            contact.isInternal
                              ? "bg-primary/12 text-primary"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ 4 + 5. BODY — Asunto + canvas WYSIWYG ═══ */}
        <div className="flex-1 overflow-hidden flex flex-col bg-background">
          {(() => {
            // No renderizar el canvas hasta que los datos estén listos.
            // Esto evita la race condition donde el editor se monta vacío
            // antes de que el preview API responda.
            const templatesReady = !templatesLoading;
            const previewReady = effectiveMode === "manual" || !!previewData;
            const showSpinner = !templatesReady || !previewReady;
            return showSpinner;
          })() ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-[11px]">Generando correo…</p>
            </div>
          ) : (
            <>
              {/* Asunto — mismo control que el configurador de plantillas */}
              <div className="px-4 py-2.5 bg-background shrink-0 flex flex-col gap-1">
                <Label className="app-field-label">Asunto</Label>
                <Input
                  value={effectiveSubject}
                  onChange={(e) => setSubjectOverride(e.target.value)}
                  placeholder="Asunto del correo"
                  className="h-9"
                />
              </div>

              {/* ─── CANVAS WYSIWYG — se ve como va a salir, editable ─── */}
              {/* Toolbar del Tiptap + header del email (branding) + body editable + footer */}
              <div className="email-composer-canvas-scroll flex-1 min-h-0 overflow-y-auto">
                <div className="email-composer-canvas">
                  <HtmlEditor
                    key={`${effectiveTemplateId || "manual"}-${previewVersion}`}
                    value={effectiveBody || ""}
                    onChange={(html) => setBodyOverride(html)}
                    editorRef={htmlEditorRef}
                    placeholder="Escribe el cuerpo del correo…"
                    className="email-body-render"
                    header={
                      effectiveMode === "template" && selectedTemplate ? (
                        <div
                          className={`email-composer-header email-composer-header-${selectedTemplate.logo_position ?? "center"}`}
                          style={{ backgroundColor: selectedTemplate.header_color ?? "#0095DA" }}
                        >
                          {selectedTemplate.logo_url || company?.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- logo dinámico de la empresa/plantilla
                            <img
                              src={selectedTemplate.logo_url ?? company?.logo_url ?? ""}
                              alt={company?.name ?? "Logo"}
                              className="email-composer-logo"
                            />
                          ) : (
                            <span className="email-composer-company-name">
                              {company?.name ?? "Empresa"}
                            </span>
                          )}
                        </div>
                      ) : null
                    }
                    footer={
                      effectiveMode === "template" && selectedTemplate ? (
                        <div className="email-composer-footer">
                          &copy; <span>{new Date().getFullYear()} ~ FDP Chile</span>
                          {/*{company?.name ?? ""}*/}
                          <br />
                          <span>Este correo fue enviado de forma automática, por favor no responda a este mensaje.</span>
                        </div>
                      ) : null
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═══ MODAL DE PLANTILLAS — se abre al pinchar "Plantilla" ═══ */}
        {showTemplateModal && (
          <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal} dismissible={false}>
            <DialogContent className="modal-md p-0!" showCloseButton={false}>
              <div className="modal-header">
                <DialogTitle className="modal-title flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Seleccionar Plantilla
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="modal-body p-3 space-y-1 max-h-80 overflow-y-auto">
                {activeTemplates.map((t) => {
                  const isDefault = (t.actions || []).some(
                    (a) => a.action_template_id === action.action_template_id && a.is_default
                  );
                  const isSelected = effectiveTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setMode("template");
                        changeTemplate(t.id);
                        setShowTemplateModal(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors border ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50 text-foreground"
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] font-medium truncate">{t.name}</span>
                        {t.description && (
                          <span className="text-[10px] text-muted-foreground truncate">{t.description}</span>
                        )}
                      </div>
                      {isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                          default
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">
                          seleccionada
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="modal-footer">
                <Button
                  className="pg-btn-platinum"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

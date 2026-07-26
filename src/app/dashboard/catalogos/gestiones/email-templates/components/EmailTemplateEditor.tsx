"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { Mail, Save, X, Loader2, Code2, FileText, Info, Eye, AlignLeft, AlignCenter, AlignRight, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { HtmlEditor } from "@/components/ui/html-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  type EmailTemplate,
  type EmailTemplateInput,
  type EmailBodyFormat,
} from "@/services/email-templates";
import { getBusinessLines } from "@/services/catalogs";
import {
  detectEmailTemplatePlaceholders,
  renderEmailTemplate,
  wrapHtmlEmail,
} from "@/services/email-render";
import { FieldInsertor } from "./FieldInsertor";
import { toast } from "sonner";

/** Elimina tags HTML del asunto (compatibilidad con datos viejos con formato). */
function stripHtml(html: string): string {
  if (!html) return "";
  // Si no contiene tags HTML, retornar tal cual
  if (!html.includes("<")) return html;
  // Crear un div temporal para extraer texto plano
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  // Fallback en SSR: regex simple
  return html.replace(/<[^>]*>/g, "");
}

interface Props {
  /** Si viene un id, es edición; si no, es creación. */
  templateId?: string;
}

interface FormState {
  name: string;
  description: string;
  business_line_id: string;
  body_format: EmailBodyFormat;
  subject: string;
  body: string;
  is_active: boolean;
  header_color: string;
  logo_url: string;
  logo_position: "left" | "center" | "right";
}

const emptyForm: FormState = {
  name: "",
  description: "",
  business_line_id: "",
  body_format: "plain",
  subject: "",
  body: "",
  is_active: true,
  header_color: "#0095DA",
  logo_url: "",
  logo_position: "center",
};

export function EmailTemplateEditor({ templateId }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeTarget, setActiveTarget] = useState<"subject" | "body" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loaded, setLoaded] = useState(!templateId);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const htmlEditorRef = useRef<Editor | null>(null);

  // Cargar plantilla existente
  const { data: existing } = useQuery({
    queryKey: ["email-template", templateId],
    queryFn: () => getEmailTemplateById(templateId!, { withActions: true }),
    enabled: !!templateId,
  });

  useEffect(() => {
    if (existing && !loaded) {
      // Hydrate form from server data. This is the standard "load entity into
      // form" pattern; the set-state-in-effect rule is silenced because we
      // only run once (loaded guard) and there's no cleaner way to hydrate
      // from an async query into a form.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: existing.name,
        description: existing.description || "",
        business_line_id: existing.business_line_id,
        body_format: existing.body_format,
        subject: stripHtml(existing.subject),
        body: existing.body,
        is_active: existing.is_active,
        header_color: existing.header_color || "#0095DA",
        logo_url: existing.logo_url || "",
        logo_position: existing.logo_position || "center",
      });
      setLoaded(true);
    }
  }, [existing, loaded]);

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: () => getBusinessLines(),
  });

  const businessLineItems = useMemo(
    () => [
      { value: "__none", label: "Seleccionar..." },
      ...(businessLines || []).map((bl) => ({ value: bl.id, label: bl.name })),
    ],
    [businessLines]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: FormState) => {
      if (!companyId) throw new Error("No se detectó la empresa");
      if (!data.business_line_id) throw new Error("La línea de negocio es obligatoria");
      const placeholders = detectEmailTemplatePlaceholders({
        subject: data.subject,
        body: data.body,
      });
      const input: EmailTemplateInput = {
        company_id: companyId,
        business_line_id: data.business_line_id,
        name: data.name,
        description: data.description || null,
        body_format: data.body_format,
        subject: data.subject,
        body: data.body,
        detected_placeholders: placeholders,
        is_active: data.is_active,
        created_by: profile?.id,
        header_color: data.header_color,
        logo_url: data.logo_url,
        logo_position: data.logo_position,
      };
      if (templateId) {
        return updateEmailTemplate(templateId, input);
      }
      return createEmailTemplate(input);
    },
    onSuccess: (saved: EmailTemplate) => {
      toast.success(templateId ? "Plantilla actualizada" : "Plantilla creada");
      queryClient.invalidateQueries({ queryKey: ["email-templates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["email-template", templateId] });
      if (!templateId) {
        router.push(
          `/dashboard/catalogos/gestiones/email-templates/${saved.id}`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const placeholdersPreview = useMemo(
    () => detectEmailTemplatePlaceholders({ subject: form.subject, body: form.body }),
    [form.subject, form.body]
  );

  const previewData = useMemo(() => {
    return {
      company_logo: form.logo_url || profile?.company?.logo_url || "",
      company_name: profile?.company?.name || "Empresa",
      company_address: profile?.company?.address || "",
      company_phone: profile?.company?.phone || "",
      company_email: profile?.company?.email || "",
      company_header_color: form.header_color,
    };
  }, [form.logo_url, form.header_color, profile?.company]);

  const previewHtml = useMemo(() => {
    if (form.body_format !== "html") return "";
    const rendered = renderEmailTemplate(
      { subject: form.subject, body: form.body, body_format: form.body_format },
      previewData
    );
    return wrapHtmlEmail({
      body: rendered.body || "<p><em>(cuerpo vacío)</em></p>",
      logoUrl: previewData.company_logo,
      headerColor: previewData.company_header_color,
      companyName: previewData.company_name,
      logoPosition: form.logo_position,
    });
  }, [form.body, form.body_format, form.subject, form.logo_position, previewData]);

  // Inserta un placeholder en el campo activo (subject o body), en la posición
  // del cursor. Si no hay cursor (recién enfocado), lo appendea al final.
  const handleInsert = (placeholder: string, target: "subject" | "body") => {
    if (target === "subject") {
      const el = subjectRef.current;
      if (!el) {
        setForm((f) => ({ ...f, subject: f.subject + placeholder }));
        return;
      }
      const start = el.selectionStart ?? form.subject.length;
      const end = el.selectionEnd ?? form.subject.length;
      const next = form.subject.slice(0, start) + placeholder + form.subject.slice(end);
      setForm((f) => ({ ...f, subject: next }));
      // Restaurar el foco y cursor después del render
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
    } else {
      // HTML: insertar como texto en el editor TipTap
      if (form.body_format === "html" && htmlEditorRef.current) {
        const ed = htmlEditorRef.current;
        ed.chain().focus().insertContent(placeholder).run();
        return;
      }
      const el = bodyRef.current;
      if (!el) {
        setForm((f) => ({ ...f, body: f.body + placeholder }));
        return;
      }
      const start = el.selectionStart ?? form.body.length;
      const end = el.selectionEnd ?? form.body.length;
      const next = form.body.slice(0, start) + placeholder + form.body.slice(end);
      setForm((f) => ({ ...f, body: next }));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + placeholder.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  // Drag-and-drop sobre el body
  const handleBodyDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const placeholder = e.dataTransfer.getData("text/plain");
    if (!placeholder) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? form.body.length;
    const next = form.body.slice(0, start) + placeholder + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const canSave = form.name.trim() && form.subject.trim() && form.body.trim() && form.business_line_id;
  const readOnly = !!templateId && !canEdit("catalogos");

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-sky-500 to-blue-500">
            <Mail />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">
              {templateId ? "Editar" : "Nueva"} Plantilla
            </h1>
          </div>
        </div>
        <div className="app-grid-header-right gap-2">
          <Button
            className="pg-btn-platinum"
            variant="outline"
            onClick={() => router.back()}
          >
            <X className="h-3.5 w-3.5" />
            Volver
          </Button>
          <Button
            className="pg-btn-platinum"
            onClick={() => saveMutation.mutate(form)}
            disabled={!canSave || saveMutation.isPending || readOnly}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {templateId ? "Guardar" : "Crear"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Columna principal: formulario */}
        <div className="app-panel space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="app-field-label">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Aviso de asignación"
                className="app-input"
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="app-field-label">
                Línea de negocio <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.business_line_id || "__none"}
                onValueChange={(v: string | null) =>
                  setForm({
                    ...form,
                    business_line_id: v === "__none" || !v ? "" : v,
                  })
                }
                disabled={readOnly || !!templateId}
                items={businessLineItems}
              >
                <SelectTrigger className="app-input h-9 w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Seleccionar...</SelectItem>
                  {(businessLines || []).map((bl) => (
                    <SelectItem key={bl.id} value={bl.id}>
                      {bl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descripción + Formato + Activa en la misma fila */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="app-field-label">Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción interna (opcional)"
                className="app-input h-9"
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="app-field-label">Formato del cuerpo</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, body_format: "plain" })}
                  disabled={readOnly}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-colors ${
                    form.body_format === "plain"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Texto plano
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, body_format: "html" })}
                  disabled={readOnly}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-colors ${
                    form.body_format === "html"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  HTML
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="app-field-label">Activa</Label>
              <ToggleChip
                active={form.is_active}
                onClick={(v) => setForm({ ...form, is_active: v })}
                disabled={readOnly}
              >
                Activa
              </ToggleChip>
            </div>
          </div>

          {/* Asunto */}
          <div className="flex flex-col gap-1">
            <Label className="app-field-label">
              Asunto <span className="text-red-500">*</span>
            </Label>
            <Input
              ref={subjectRef}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              disabled={readOnly}
              placeholder="Ej: Asignación de inspector para siniestro <liquidation_number>"
              className="h-9"
            />
          </div>

          {/* Cuerpo */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <Label className="app-field-label">
                Cuerpo <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </Button>
                {/* Info icon: placeholders de empresa + detectados */}
                {form.body_format === "html" && (
                <div className="group relative inline-flex cursor-help">
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                  <div className="absolute right-0 top-full z-50 mt-2 hidden w-72 rounded-lg border border-border bg-popover p-3 shadow-lg group-hover:block">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">Tip:</span>{" "}
                      insertá <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">&lt;company_logo&gt;</code>,{" "}
                      <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">&lt;company_name&gt;</code>,{" "}
                      <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">&lt;company_address&gt;</code>,{" "}
                      <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">&lt;company_phone&gt;</code> y{" "}
                      <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">&lt;company_email&gt;</code> desde el panel derecho. Al asociar la plantilla a un siniestro, estos se reemplazan automáticamente con los datos de la empresa del siniestro.
                    </p>
                    {placeholdersPreview.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/60">
                        <p className="app-field-label text-[11px] mb-1.5">Placeholders detectados:</p>
                        <div className="flex flex-wrap gap-1">
                          {placeholdersPreview.map((p) => (
                            <span
                              key={p}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            </div>
            {form.body_format === "html" ? (
              <HtmlEditor
                value={form.body}
                onChange={(html) => setForm({ ...form, body: html })}
                disabled={readOnly}
                editorRef={htmlEditorRef}
                placeholder="Escribí el cuerpo del e-mail..."
                className="min-h-40"
              />
            ) : (
              <Textarea
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                onFocus={() => setActiveTarget("body")}
                onBlur={() => setActiveTarget(null)}
                onDrop={handleBodyDrop}
                onDragOver={(e) => e.preventDefault()}
                placeholder="Estimado <insured_full_name>, le informamos..."
                className="app-input min-h-30 font-mono"
                disabled={readOnly}
              />
            )}
            <p className="text-[10px] text-muted-foreground">
              Arrastrá campos desde el panel derecho o hacé clic en ellos para insertar.
            </p>
          </div>

          {/* Apariencia del email (color de header, logo, posición) */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-semibold text-foreground">Apariencia del correo</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Color del header */}
              <div className="space-y-1.5">
                <Label className="app-field-label text-[11px]">Color del Header</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.header_color}
                    onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                    className="h-7 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                  />
                  <Input
                    value={form.header_color}
                    onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                    className="app-input h-7 text-[11px] font-mono"
                    placeholder="#0095DA"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {["#0095DA", "#1f2937", "#0ea5e9", "#16a34a", "#dc2626", "#7c3aed", "#f59e0b", "#000000"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, header_color: c })}
                      className="h-4 w-4 rounded border border-border/60 transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Posición del logo */}
              <div className="space-y-1.5">
                <Label className="app-field-label text-[11px]">Posición del Logo</Label>
                <div className="grid grid-cols-3 gap-1">
                  {([
                    { value: "left", icon: AlignLeft, label: "Izq" },
                    { value: "center", icon: AlignCenter, label: "Centro" },
                    { value: "right", icon: AlignRight, label: "Der" },
                  ] as const).map((opt) => {
                    const Icon = opt.icon;
                    const active = form.logo_position === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, logo_position: opt.value })}
                        className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1.5 text-[10px] transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* URL del logo */}
              <div className="space-y-1.5">
                <Label className="app-field-label text-[11px]">URL del Logo</Label>
                <Input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="app-input h-7 text-[11px]"
                  placeholder="https://..."
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Vacío = usa el logo de la empresa. Si no hay logo, se muestra el nombre.
                </p>
                {profile?.company?.logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: profile.company?.logo_url || "" })}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Usar logo de la empresa
                  </button>
                )}
              </div>
            </div>

            {/* Vista previa del header */}
            <div className="space-y-1.5">
              <Label className="app-field-label text-[11px]">Vista previa del header</Label>
              <div
                className="rounded border border-border p-2 flex items-center min-h-12"
                style={{
                  backgroundColor: form.header_color,
                  justifyContent: form.logo_position,
                }}
              >
                {form.logo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- preview en vivo del header, no necesita optimización */
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="max-h-8 max-w-32 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[11px] font-semibold text-white">
                    {profile?.company?.name || "Empresa"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview modal */}
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-6xl h-[90vh] p-0 flex flex-col" showCloseButton={false}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 shrink-0">
                <DialogTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5" />
                  Preview del e-mail
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {form.body_format === "html" && (
                    <span className="text-[10px] text-muted-foreground">Los cambios se aplican en vivo</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPreviewOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Body: sidebar de controles + preview */}
              <div className="flex flex-1 overflow-hidden">
                {form.body_format === "html" ? (
                  <>
                    {/* Sidebar controles */}
                    <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-3 space-y-4 bg-background">
                      <div>
                        <p className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Palette className="h-3 w-3" />
                          Apariencia
                        </p>
                      </div>

                      {/* Color del header */}
                      <div className="space-y-1.5">
                        <Label className="app-field-label text-[11px]">Color del Header</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={form.header_color}
                            onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                            className="h-7 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
                          />
                          <Input
                            value={form.header_color}
                            onChange={(e) => setForm({ ...form, header_color: e.target.value })}
                            className="app-input h-7 text-[11px] font-mono"
                            placeholder="#0095DA"
                          />
                        </div>
                        {/* Presets */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {["#0095DA", "#1f2937", "#0ea5e9", "#16a34a", "#dc2626", "#7c3aed", "#f59e0b", "#000000"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setForm({ ...form, header_color: c })}
                              className="h-4 w-4 rounded border border-border/60 transition-transform hover:scale-110"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Posición del logo */}
                      <div className="space-y-1.5">
                        <Label className="app-field-label text-[11px]">Posición del Logo</Label>
                        <div className="grid grid-cols-3 gap-1">
                          {([
                            { value: "left", icon: AlignLeft, label: "Izq" },
                            { value: "center", icon: AlignCenter, label: "Centro" },
                            { value: "right", icon: AlignRight, label: "Der" },
                          ] as const).map((opt) => {
                            const Icon = opt.icon;
                            const active = form.logo_position === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setForm({ ...form, logo_position: opt.value })}
                                className={`flex flex-col items-center gap-0.5 rounded border px-1 py-1.5 text-[10px] transition-colors ${
                                  active
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:bg-muted/40"
                                }`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* URL del logo */}
                      <div className="space-y-1.5">
                        <Label className="app-field-label text-[11px]">URL del Logo</Label>
                        <Input
                          value={form.logo_url}
                          onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                          className="app-input h-7 text-[11px]"
                          placeholder="https://..."
                        />
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          Vacío = usa el logo de la empresa. Si no hay logo, se muestra el nombre.
                        </p>
                        {profile?.company?.logo_url && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, logo_url: profile.company?.logo_url || "" })}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Usar logo de la empresa
                          </button>
                        )}
                      </div>

                      {/* Vista previa del header */}
                      <div className="space-y-1.5">
                        <Label className="app-field-label text-[11px]">Vista previa del header</Label>
                        <div
                          className="rounded border border-border p-2 flex items-center min-h-12"
                          style={{
                            backgroundColor: form.header_color,
                            justifyContent: form.logo_position,
                          }}
                        >
                          {form.logo_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- preview en vivo del header, no necesita optimización */
                            <img
                              src={form.logo_url}
                              alt="Logo"
                              className="max-h-8 max-w-32 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-[11px] font-semibold text-white">
                              {profile?.company?.name || "Empresa"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Preview iframe */}
                    <div className="flex-1 overflow-auto p-6 bg-muted/20">
                      <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm mx-auto" style={{ maxWidth: 600 }}>
                        <iframe
                          title="preview"
                          srcDoc={previewHtml}
                          className="w-full bg-white"
                          style={{ minHeight: "70vh", height: "100%" }}
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 overflow-auto p-6 bg-muted/20">
                    <div className="rounded-lg border border-border bg-background p-6 min-h-75 max-w-2xl mx-auto">
                      <div className="whitespace-pre-wrap text-sm text-foreground">
                        {renderEmailTemplate(
                          { subject: form.subject, body: form.body, body_format: form.body_format },
                          previewData
                        ).body || <span className="text-muted-foreground italic">(cuerpo vacío)</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>



          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              className="pg-btn-platinum"
              variant="outline"
              onClick={() => router.back()}
            >
              <X className="h-3.5 w-3.5" />
              Volver
            </Button>
            <Button
              className="pg-btn-platinum"
              onClick={() => saveMutation.mutate(form)}
              disabled={!canSave || saveMutation.isPending || readOnly}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {templateId ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>

        {/* Columna lateral: insertor de campos */}
        <FieldInsertor
          activeTarget={activeTarget}
          onInsert={handleInsert}
          className="sticky top-4 self-start"
        />
      </div>
    </div>
  );
}

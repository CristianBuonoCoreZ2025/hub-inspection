"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
 FileText, Upload, Trash2, Loader2, FileUp, Check,
 ChevronDown, ChevronRight, Tag,
} from "lucide-react";

import {
 getDocumentTemplates,
 createDocumentTemplate,
 updateDocumentTemplate,
 deleteDocumentTemplate,
 type DocumentTemplateInput,
} from "@/services/document-templates";
import { DOCUMENT_FIELDS, FIELD_GROUPS, FIELD_BY_KEY } from "@/lib/document-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
 actionTemplateId: string;
 events: { id: string; name: string }[];
 clients: { id: string; name: string }[];
 insuranceCompanies: { id: string; name: string }[];
 countries: { id: string; name: string }[];
}

interface UploadResult {
 url: string;
 fileId: string;
 fileName: string;
 fileSize: number;
 placeholders: string[];
}

export function DocumentTemplatesCard({ actionTemplateId, events, clients, insuranceCompanies, countries }: Props) {
 const queryClient = useQueryClient();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [showMapping, setShowMapping] = useState<string | null>(null);

 // Query: templates de esta gestión
 const { data: templates, isLoading } = useQuery({
 queryKey: ["document-templates", actionTemplateId],
 queryFn: () => getDocumentTemplates({ actionTemplateId }),
 });

 // Mutation: subir + detectar placeholders
 const uploadMut = useMutation({
 mutationFn: async (file: File) => {
 const formData = new FormData();
 formData.append("file", file);
 formData.append("actionTemplateId", actionTemplateId);
 const res = await fetch("/api/document-templates/upload", {
 method: "POST",
 body: formData,
 });
 if (!res.ok) {
 const body = await res.json().catch(() => ({}));
 throw new Error(body.error || `Error al subir (${res.status})`);
 }
 return (await res.json()) as UploadResult;
 },
 onSuccess: (data) => {
 // Auto-crear el registro con el nombre del archivo y los placeholders detectados
 createMut.mutate({
 name: data.fileName.replace(/\.docx$/i, ""),
 file_url: data.url,
 file_id: data.fileId,
 file_name: data.fileName,
 file_size: data.fileSize,
 detected_placeholders: data.placeholders,
 action_template_id: actionTemplateId,
 });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const createMut = useMutation({
 mutationFn: createDocumentTemplate,
 onSuccess: () => {
 toast.success("Plantilla subida");
 queryClient.invalidateQueries({ queryKey: ["document-templates", actionTemplateId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const updateMut = useMutation({
 mutationFn: ({ id, data }: { id: string; data: Partial<DocumentTemplateInput> }) =>
 updateDocumentTemplate(id, data),
 onSuccess: () => {
 toast.success("Plantilla actualizada");
 queryClient.invalidateQueries({ queryKey: ["document-templates", actionTemplateId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const deleteMut = useMutation({
 mutationFn: deleteDocumentTemplate,
 onSuccess: () => {
 toast.success("Plantilla eliminada");
 queryClient.invalidateQueries({ queryKey: ["document-templates", actionTemplateId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (file) {
 if (!file.name.toLowerCase().endsWith(".docx")) {
 toast.error("Solo se permiten archivos .docx");
 return;
 }
 uploadMut.mutate(file);
 }
 // reset para permitir re-subir el mismo archivo
 if (fileInputRef.current) fileInputRef.current.value = "";
 };

 const handleMappingChange = (
 templateId: string,
 placeholder: string,
 canonicalKey: string | null
 ) => {
 const template = templates?.find((t) => t.id === templateId);
 if (!template) return;
 const newMapping = { ...template.placeholder_mapping };
 if (canonicalKey) {
 newMapping[placeholder] = canonicalKey;
 } else {
 delete newMapping[placeholder];
 }
 updateMut.mutate({ id: templateId, data: { placeholder_mapping: newMapping } });
 };

 const handleAssociationChange = (
 templateId: string,
 field: "event_id" | "company_id" | "insurance_company_id" | "country_id",
 value: string | null
 ) => {
 updateMut.mutate({
 id: templateId,
 data: { [field]: value || null } as Partial<DocumentTemplateInput>,
 });
 };

 const handleRename = (templateId: string, name: string) => {
 updateMut.mutate({ id: templateId, data: { name } });
 };

 const uploading = uploadMut.isPending || createMut.isPending;

 return (
 <section className="app-panel">
 <div className="flex items-center justify-between mb-3">
 <h3 className="app-section-title">
 <FileText className="h-3.5 w-3.5" />
 Plantillas de Documento
 </h3>
 <div className="flex items-center gap-2">
 <input
 ref={fileInputRef}
 type="file"
 accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 onChange={handleFileSelect}
 className="hidden"
 />
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 className="pg-btn-platinum-icon"
 >
 {uploading ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 ) : (
 <Upload className="h-3.5 w-3.5" />
 )}
 Subir
 </button>
 </div>
 </div>

 <p className="text-[11px] text-muted-foreground mb-3">
 Sube plantillas Word (.docx) con placeholders tipo <code className="app-inline-code">{"<claim_number>"}</code>,
 <code className="app-inline-code">{"<insured_name>"}</code>, etc. Al generar un informe, los placeholders se
 rellenan automáticamente con los datos del siniestro.
 </p>

 {/* Lista de templates */}
 {isLoading ? (
 <div className="text-center text-muted-foreground py-4 text-[12px]">
 <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
 Cargando plantillas...
 </div>
 ) : !templates || templates.length === 0 ? (
 <div className="text-center text-muted-foreground py-6 text-[12px] border border-dashed border-border rounded-lg">
 <FileUp className="h-6 w-6 mx-auto mb-2 opacity-40" />
 No hay plantillas asociadas a esta gestión.
 </div>
 ) : (
 <div className="space-y-2">
 {templates.map((tpl) => {
 const expanded = showMapping === tpl.id;
 const unmapped = tpl.detected_placeholders.filter(
 (p) => !tpl.placeholder_mapping[p] && !FIELD_BY_KEY[p]
 );
 return (
 <div
 key={tpl.id}
 className="rounded-lg border border-border/60 overflow-hidden"
 >
 {/* Fila principal */}
 <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
 <button
 type="button"
 onClick={() => setShowMapping(expanded ? null : tpl.id)}
 className="flex items-center gap-2 flex-1 min-w-0 text-left"
 >
 {expanded ? (
 <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 ) : (
 <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 )}
 <FileText className="h-4 w-4 text-[#0095DA] shrink-0" />
 <span className="text-[12px] font-medium truncate">{tpl.name}</span>
 {/* Badges de asociaciones */}
 {!expanded && (
 <span className="flex items-center gap-1 shrink-0">
 {tpl.company_id && (
 <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
 {clients.find(c => c.id === tpl.company_id)?.name || "Cliente"}
 </span>
 )}
 {tpl.insurance_company_id && (
 <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
 {insuranceCompanies.find(c => c.id === tpl.insurance_company_id)?.name || "Cía."}
 </span>
 )}
 {tpl.country_id && (
 <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
 {countries.find(c => c.id === tpl.country_id)?.name || "País"}
 </span>
 )}
 {tpl.event_id && (
 <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
 {events.find(e => e.id === tpl.event_id)?.name || "Evento"}
 </span>
 )}
 {!tpl.company_id && !tpl.insurance_company_id && !tpl.country_id && !tpl.event_id && (
 <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
 Global
 </span>
 )}
 </span>
 )}
 {tpl.detected_placeholders.length > 0 && (
 <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary shrink-0">
 <Tag className="h-2.5 w-2.5" />
 {tpl.detected_placeholders.length}
 </span>
 )}
 {unmapped.length > 0 && (
 <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
 {unmapped.length} sin mapear
 </span>
 )}
 </button>
 <button
 type="button"
 onClick={() => {
 if (confirm("¿Eliminar esta plantilla?")) deleteMut.mutate(tpl.id);
 }}
 className="btn-danger btn-icon shrink-0"
 title="Eliminar"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </div>

 {/* Detalle expandido: asociaciones + mapeo de placeholders */}
 {expanded && (
 <div className="border-t border-border/60 px-3 py-3 bg-muted/20 space-y-3">
 {/* Nombre (6 cols) */}
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-2">
 <div className="flex flex-col gap-1 xl:col-span-6">
 <Label className="text-[10px] text-muted-foreground">Nombre</Label>
 <Input
 value={tpl.name}
 onChange={(e) => handleRename(tpl.id, e.target.value)}
 className="app-input"
 />
 </div>
 </div>

 {/* Asociaciones: Cliente (principal) + Cía. Seguros + País + Evento (todas opcionales) */}
 <div>
 <Label className="text-[10px] text-muted-foreground mb-2 block">
 Aplicabilidad — deja vacío para que aplique a todo
 </Label>
 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-2">
 {/* Cliente (principal) */}
 <div className="flex flex-col gap-1 xl:col-span-2">
 <Label className="text-[10px] text-muted-foreground">Cliente</Label>
 <Select
 value={tpl.company_id || "__all"}
 onValueChange={(v) => handleAssociationChange(tpl.id, "company_id", v === "__all" ? "" : v)}
 items={[{ value: "__all", label: "Todos" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input h-7">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todos</SelectItem>
 {clients.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {/* Cía. de Seguros */}
 <div className="flex flex-col gap-1 xl:col-span-2">
 <Label className="text-[10px] text-muted-foreground">Cía. de Seguros</Label>
 <Select
 value={tpl.insurance_company_id || "__all"}
 onValueChange={(v) => handleAssociationChange(tpl.id, "insurance_company_id", v === "__all" ? "" : v)}
 items={[{ value: "__all", label: "Todas" }, ...insuranceCompanies.map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input h-7">
 <SelectValue placeholder="Todas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todas</SelectItem>
 {insuranceCompanies.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {/* País */}
 <div className="flex flex-col gap-1 xl:col-span-1">
 <Label className="text-[10px] text-muted-foreground">País</Label>
 <Select
 value={tpl.country_id || "__all"}
 onValueChange={(v) => handleAssociationChange(tpl.id, "country_id", v === "__all" ? "" : v)}
 items={[{ value: "__all", label: "Todos" }, ...countries.map((c) => ({ value: c.id, label: c.name }))]}
 >
 <SelectTrigger className="app-input h-7">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todos</SelectItem>
 {countries.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {/* Evento */}
 <div className="flex flex-col gap-1 xl:col-span-1">
 <Label className="text-[10px] text-muted-foreground">Evento</Label>
 <Select
 value={tpl.event_id || "__all"}
 onValueChange={(v) => handleAssociationChange(tpl.id, "event_id", v === "__all" ? "" : v)}
 items={[{ value: "__all", label: "Todos" }, ...events.map((ev) => ({ value: ev.id, label: ev.name }))]}
 >
 <SelectTrigger className="app-input h-7">
 <SelectValue placeholder="Todos" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todos</SelectItem>
 {events.map((ev) => (
 <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* Placeholders detectados + mapeo */}
 {tpl.detected_placeholders.length > 0 ? (
 <div>
 <Label className="text-[10px] text-muted-foreground mb-2 block">
 Placeholders detectados y mapeo a campos del siniestro
 </Label>
 <div className="space-y-1.5">
 {tpl.detected_placeholders.map((ph) => {
 const mapped = tpl.placeholder_mapping[ph];
 const isCanonical = !!FIELD_BY_KEY[ph];
 const resolved = mapped || (isCanonical ? ph : "");
 return (
 <div
 key={ph}
 className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1.5 bg-card"
 >
 <code className="text-[11px] font-mono text-primary shrink-0 min-w-[120px]">
 {"<" + ph + ">"}
 </code>
 {isCanonical && !mapped && (
 <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
 <Check className="h-3 w-3 inline mr-1" />
 auto
 </span>
 )}
 <span className="text-[10px] text-muted-foreground shrink-0">→</span>
 <Select
 value={resolved || "__none"}
 onValueChange={(v) => handleMappingChange(tpl.id, ph, v === "__none" ? null : v)}
 items={[{ value: "__none", label: "— Sin mapeo —" }, ...DOCUMENT_FIELDS.map((f) => ({ value: f.key, label: f.label }))]}
 >
 <SelectTrigger className="app-input h-6 text-[11px] flex-1">
 <SelectValue placeholder="Sin mapeo (vacío)" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">— Sin mapeo —</SelectItem>
 {FIELD_GROUPS.map((group) => (
 <SelectGroup key={group} label={group}>
 {DOCUMENT_FIELDS.filter((f) => f.group === group).map((f) => (
 <SelectItem key={f.key} value={f.key}>
 {f.label}
 </SelectItem>
 ))}
 </SelectGroup>
 ))}
 </SelectContent>
 </Select>
 </div>
 );
 })}
 </div>
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground">
 No se detectaron placeholders en este documento. Usa la sintaxis
 <code className="app-inline-code mx-1">{"<campo>"}</code>
 en el Word para que se rellene automáticamente.
 </p>
 )}

 {/* Catálogo de campos disponibles (referencia) */}
 <details className="text-[11px]">
 <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
 Ver catálogo de campos disponibles ({DOCUMENT_FIELDS.length} campos)
 </summary>
 <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 pt-2 border-t border-border/40">
 {FIELD_GROUPS.map((group) => (
 <div key={group} className="contents">
 {DOCUMENT_FIELDS.filter((f) => f.group === group).map((f) => (
 <div key={f.key} className="flex items-center gap-1.5">
 <code className="text-[10px] font-mono text-primary">{"<" + f.key + ">"}</code>
 <span className="text-[10px] text-muted-foreground">— {f.label}</span>
 </div>
 ))}
 </div>
 ))}
 </div>
 </details>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </section>
 );
}

// SelectGroup wrapper (algunas UIs de select no exponen SelectGroup, lo emulamos)
function SelectGroup({ label, children }: { label: string; children: React.ReactNode }) {
 return (
 <div className="py-1">
 <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
 {label}
 </div>
 {children}
 </div>
 );
}

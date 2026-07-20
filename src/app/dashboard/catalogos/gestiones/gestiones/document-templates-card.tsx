"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
 FileText, Upload, Trash2, Loader2, FileUp, Check,
 ChevronDown, ChevronRight, Tag, Download, Power,
} from "lucide-react";

import {
 getDocumentTemplates,
 createDocumentTemplate,
 updateDocumentTemplate,
 deleteDocumentTemplate,
 type DocumentTemplateInput,
} from "@/services/document-templates";
import { DOCUMENT_FIELDS, FIELD_GROUPS, findFieldByKeyInsensitive } from "@/lib/document-fields";
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
 originalFilename: string;
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
 queryFn: () => getDocumentTemplates({ actionTemplateId, includeInactive: true }),
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
 // Auto-crear el registro con el nombre original como display,
 // file_name con el código (ej: HIFL-00001.docx),
 // y original_filename con el nombre original del archivo.
 createMut.mutate({
 name: data.originalFilename.replace(/\.docx$/i, ""),
 file_url: data.url,
 file_id: data.fileId,
 file_name: data.fileName,
 original_filename: data.originalFilename,
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
 (p) => !tpl.placeholder_mapping[p] && !findFieldByKeyInsensitive(p)
 );
 return (
 <div
 key={tpl.id}
 className={`rounded-lg border border-border/60 overflow-hidden transition-opacity ${
 tpl.is_active ? "" : "opacity-60"
 }`}
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
 <span className="flex flex-col leading-tight min-w-0">
 <span className="text-[12px] font-medium truncate flex items-center gap-1.5">
 {tpl.file_name}
 {!tpl.is_active && (
 <span className="inline-flex items-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
 Inactiva
 </span>
 )}
 </span>
 {tpl.original_filename && tpl.original_filename !== tpl.file_name && (
 <span className="text-[10px] text-muted-foreground/70 truncate">{tpl.original_filename.replace(/\.docx$/i, "")}</span>
 )}
 </span>
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
 {/* Descargar plantilla .docx */}
 {tpl.file_url && (
 <a
 href={tpl.file_url}
 download={tpl.file_name}
 target="_blank"
 rel="noopener noreferrer"
 className="btn-icon-sm btn-default-hover shrink-0"
 title={`Descargar ${tpl.file_name}`}
 onClick={(e) => e.stopPropagation()}
 >
 <Download className="h-3.5 w-3.5" />
 </a>
 )}
 {/* Toggle activo/inactivo — define si la plantilla se usa al generar documentos.
     Las plantillas inactivas NO se pierden: siguen visibles aquí, solo no se usan. */}
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 updateMut.mutate({ id: tpl.id, data: { is_active: !tpl.is_active } });
 }}
 title={tpl.is_active ? "Activa — click para desactivar (no se usará al generar documentos, pero no se pierde)" : "Inactiva — click para activar"}
 className={`btn-icon-sm shrink-0 ${
 tpl.is_active
 ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
 : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
 }`}
 aria-label={tpl.is_active ? "Desactivar plantilla" : "Activar plantilla"}
 >
 <Power className="h-3.5 w-3.5" />
 </button>
 <button
 type="button"
 onClick={() => {
 if (confirm("¿Eliminar esta plantilla?")) deleteMut.mutate(tpl.id);
 }}
 className="btn-icon-sm btn-danger-hover shrink-0"
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
 (() => {
 // Clasificar placeholders en 3 grupos
 const toFix: string[] = [];   // sin mapeo ni campo canónico → requieren atención
 const auto: string[] = [];    // campo canónico (mapeo automático)
 const manual: string[] = [];  // mapeo manual ya asignado
 for (const ph of tpl.detected_placeholders) {
 const mapped = tpl.placeholder_mapping[ph];
 const isCanonical = !!findFieldByKeyInsensitive(ph);
 if (mapped) manual.push(ph);
 else if (isCanonical) auto.push(ph);
 else toFix.push(ph);
 }
 return (
 <div>
 {/* Resumen */}
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <Label className="text-[10px] text-muted-foreground">
 Placeholders detectados: {tpl.detected_placeholders.length}
 </Label>
 {auto.length > 0 && (
 <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
 <Check className="h-2.5 w-2.5" />
 {auto.length} auto
 </span>
 )}
 {manual.length > 0 && (
 <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
 {manual.length} mapeados
 </span>
 )}
 {toFix.length > 0 && (
 <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
 {toFix.length} sin mapear
 </span>
 )}
 </div>

 {/* Solo los que requieren corrección */}
 {toFix.length > 0 && (
 <div className="space-y-1.5">
 <Label className="text-[10px] text-amber-700 dark:text-amber-400 block">
 Requieren mapeo — asigná cada placeholder a un campo del sistema
 </Label>
 {toFix.map((ph) => {
 const mapped = tpl.placeholder_mapping[ph];
 const isBracketFormat = ph === ph.toUpperCase() && ph !== ph.toLowerCase();
 const phDisplay = isBracketFormat ? `[${ph}]` : `<${ph}>`;
 return (
 <div
 key={ph}
 className="flex items-center gap-2 rounded-md border border-amber-300/50 dark:border-amber-700/50 px-2 py-1.5 bg-amber-50/50 dark:bg-amber-950/10"
 >
 <code className="text-[11px] font-mono text-amber-700 dark:text-amber-400 shrink-0 min-w-[120px]">
 {phDisplay}
 </code>
 <span className="text-[10px] text-muted-foreground shrink-0">→</span>
 <Select
 value={mapped || "__none"}
 onValueChange={(v) => handleMappingChange(tpl.id, ph, v === "__none" ? null : v)}
 items={[{ value: "__none", label: "— Sin mapeo —" }, ...DOCUMENT_FIELDS.map((f) => ({ value: f.key, label: f.label }))]}
 >
 <SelectTrigger className="app-input h-6 text-[11px] flex-1">
 <SelectValue placeholder="Asignar a campo…" />
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
 )}

 {/* Ya mapeados (colapsable, solo referencia) */}
 {(auto.length > 0 || manual.length > 0) && (
 <details className="text-[11px] mt-2">
 <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
 Ver mapeos ya resueltos ({auto.length + manual.length})
 </summary>
 <div className="mt-2 space-y-1 pt-2 border-t border-border/40">
 {[...auto, ...manual].map((ph) => {
 const mapped = tpl.placeholder_mapping[ph];
 const field = mapped ? findFieldByKeyInsensitive(mapped) : findFieldByKeyInsensitive(ph);
 const isBracketFormat = ph === ph.toUpperCase() && ph !== ph.toLowerCase();
 const phDisplay = isBracketFormat ? `[${ph}]` : `<${ph}>`;
 const label = field?.label ?? (mapped ?? "—");
 return (
 <div key={ph} className="flex items-center gap-2 px-2 py-1">
 <code className="text-[11px] font-mono text-primary shrink-0 min-w-[120px]">
 {phDisplay}
 </code>
 <span className="text-[10px] text-muted-foreground shrink-0">→</span>
 <span className="text-[11px] text-foreground/80 truncate">{label}</span>
 {auto.includes(ph) && (
 <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto">
 auto
 </span>
 )}
 </div>
 );
 })}
 </div>
 </details>
 )}
 </div>
 );
 })()
 ) : (
 <p className="text-[11px] text-muted-foreground">
 No se detectaron placeholders en este documento. Usa la sintaxis
 <code className="app-inline-code mx-1">{"<campo>"}</code>
 o
 <code className="app-inline-code mx-1">{"[CAMPO]"}</code>
 en el Word para que se rellene automáticamente.
 </p>
 )}

 {/* Catálogo de campos disponibles (referencia) */}
 <details className="text-[11px]">
 <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
 Ver catálogo de campos disponibles ({DOCUMENT_FIELDS.length} campos)
 </summary>
 <div className="mt-2 space-y-2 pt-2 border-t border-border/40">
 {FIELD_GROUPS.map((group) => {
 const style = GROUP_STYLES[group] ?? { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: "•" };
 const fields = DOCUMENT_FIELDS.filter((f) => f.group === group);
 return (
 <div key={group} className={`rounded-md border ${style.border} ${style.bg} px-2 py-1.5`}>
 <div className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 mb-1 ${style.color}`}>
 <span className="text-[11px]">{style.icon}</span>
 <span>{group}</span>
 <span className="ml-auto opacity-60 font-normal normal-case">{fields.length}</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5">
 {fields.map((f) => (
 <div key={f.key} className="flex items-center gap-1.5">
 <code className="text-[10px] font-mono text-primary shrink-0">{"<" + f.key + ">"}</code>
 <span className="text-[10px] text-muted-foreground truncate">— {f.label}</span>
 </div>
 ))}
 </div>
 </div>
 );
 })}
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
// Cabeceras con distintivo visual: color + borde superior + badge
const GROUP_STYLES: Record<string, { color: string; bg: string; border: string; icon: string }> = {
 "Siniestro": { color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-900", icon: "📋" },
 "Clasificación": { color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-900", icon: "🏷️" },
 "Póliza": { color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-900", icon: "📄" },
 "Recovery": { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900", icon: "♻️" },
 "Empresas": { color: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-900", icon: "🏢" },
 "Geografía Siniestro": { color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-900", icon: "📍" },
 "Asegurado": { color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-900", icon: "👤" },
 "Contratista": { color: "text-lime-700 dark:text-lime-300", bg: "bg-lime-50 dark:bg-lime-950/40", border: "border-lime-200 dark:border-lime-900", icon: "👷" },
 "Beneficiario": { color: "text-pink-700 dark:text-pink-300", bg: "bg-pink-50 dark:bg-pink-950/40", border: "border-pink-200 dark:border-pink-900", icon: "💝" },
 "Ejecutivo": { color: "text-teal-700 dark:text-teal-300", bg: "bg-teal-50 dark:bg-teal-950/40", border: "border-teal-200 dark:border-teal-900", icon: "👔" },
 "Contacto": { color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-900", icon: "📞" },
 "Asignaciones": { color: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-950/40", border: "border-sky-200 dark:border-sky-900", icon: "👥" },
 "Gestiones: Fechas": { color: "text-fuchsia-700 dark:text-fuchsia-300", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", border: "border-fuchsia-200 dark:border-fuchsia-900", icon: "📅" },
 "Gestiones: Reserva": { color: "text-red-700 dark:text-red-300", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-900", icon: "💰" },
 "Gestiones: Ajuste": { color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-900", icon: "🔧" },
 "Gestiones: Coberturas": { color: "text-green-700 dark:text-green-300", bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-900", icon: "🛡️" },
 "Gestiones: Coordinación": { color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-200 dark:border-purple-900", icon: "📆" },
 "Gestiones: Aviso Asignación": { color: "text-stone-700 dark:text-stone-300", bg: "bg-stone-50 dark:bg-stone-950/40", border: "border-stone-200 dark:border-stone-900", icon: "✉️" },
};

function SelectGroup({ label, children }: { label: string; children: React.ReactNode }) {
 const style = GROUP_STYLES[label] ?? { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: "•" };
 return (
 <div className={`py-1.5 border-t first:border-t-0 ${style.border}`}>
 <div className={`mx-1 px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${style.color} ${style.bg}`}>
 <span className="text-[11px]">{style.icon}</span>
 <span>{label}</span>
 </div>
 <div className="mt-0.5">{children}</div>
 </div>
 );
}

"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDocumentTemplates } from "@/services/document-templates";
import type { GestionScreenProps } from "./types";

export default function EmailScreen({ action, onChange, readOnly }: GestionScreenProps) {
 const data = (action.action_data || {}) as Record<string, string>;
 const { data: templates } = useQuery({
 queryKey: ["doc-templates-by-action", action.action_template_id],
 queryFn: () => getDocumentTemplates({ actionTemplateId: action.action_template_id || undefined }),
 enabled: !!action.action_template_id,
 });

 const [form, setForm] = useState({
 contacto: data.contacto || "",
 tipo_contacto: data.tipo_contacto || "email",
 aviso: data.aviso || new Date().toISOString().slice(0, 16),
 detalles: data.detalles || "",
 plantilla_id: data.plantilla_id || "",
 plantilla_nombre: data.plantilla_nombre || "",
 preview: data.preview || "",
 });

 useEffect(() => {
 onChange?.(form);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [form]);

 return (
 <div className="space-y-3">
 <div>
 <Label className="app-field-label text-[11px]">Contacto *</Label>
 <select
 className="app-input h-8 w-full"
 value={form.contacto}
 onChange={(e) => setForm({ ...form, contacto: e.target.value })}
 disabled={readOnly}
 >
 <option value="">Seleccionar contacto...</option>
 <option value="asegurado">Asegurado - Nicanor Parra</option>
 <option value="contacto">Contacto</option>
 <option value="corredor">Corredor</option>
 </select>
 </div>

 <div>
 <Label className="app-field-label text-[11px]">Tipo de Contacto *</Label>
 <select
 className="app-input h-8 w-full"
 value={form.tipo_contacto}
 onChange={(e) => setForm({ ...form, tipo_contacto: e.target.value })}
 disabled={readOnly}
 >
 <option value="email">Email</option>
 <option value="sms">SMS</option>
 <option value="whatsapp">WhatsApp</option>
 </select>
 </div>

 <div>
 <Label className="app-field-label text-[11px]">Aviso *</Label>
 <Input
 type="datetime-local"
 className="app-input h-8 "
 value={form.aviso}
 onChange={(e) => setForm({ ...form, aviso: e.target.value })}
 disabled={readOnly}
 />
 </div>

 <div>
 <Label className="app-field-label text-[11px]">Detalles de Contacto *</Label>
 <Textarea
 className="app-input min-h-[60px]"
 value={form.detalles}
 onChange={(e) => setForm({ ...form, detalles: e.target.value })}
 disabled={readOnly}
 placeholder="Aviso de Asignación automático"
 />
 </div>

 <div>
 <Label className="app-field-label text-[11px]">Plantilla *</Label>
 <select
 className="app-input h-8 w-full"
 value={form.plantilla_id}
 onChange={(e) => {
 const tpl = templates?.find((t) => t.id === e.target.value);
 setForm({
 ...form,
 plantilla_id: e.target.value,
 plantilla_nombre: tpl?.name || "",
 preview: buildPreview(tpl?.name || "", form.contacto),
 });
 }}
 disabled={readOnly}
 >
 <option value="">Seleccionar plantilla...</option>
 {templates?.map((tpl) => (
 <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
 ))}
 {!templates?.length && (
 <option value="aviso-asignacion">Aviso de Asignación automática</option>
 )}
 </select>
 </div>

 <div>
 <Label className="app-field-label text-[11px]">Preview del Mensaje</Label>
 <div className="rounded-md border border-border bg-white dark:bg-zinc-900 p-4 min-h-[180px] text-[13px] leading-relaxed whitespace-pre-wrap text-black dark:text-zinc-100">
 {form.preview || "Vista previa del mensaje..."}
 </div>
 </div>
 </div>
 );
}

function buildPreview(templateName: string, contacto: string): string {
 const name = contacto ? contacto.split(" - ")[1] || contacto : "Cliente";
 if (templateName.toLowerCase().includes("reasignación") || templateName.toLowerCase().includes("re-envio")) {
 return `Estimado ${name}\n\nHemos sido asignados para liquidar su siniestro N° 333443434\n\nreenvio aviso\n\nSaludos cordiales\n\nMcLarens\nwww.mclarens.cl`;
 }
 return `Estimado ${name}\n\nHemos sido asignados para liquidar su siniestro N° 333443434\n\nSaludos cordiales\n\nMcLarens\nwww.mclarens.cl`;
}

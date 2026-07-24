"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 <Label className="app-field-label">Contacto *</Label>
 <Select
 value={form.contacto || ""}
 onValueChange={(v) => setForm({ ...form, contacto: v || "" })}
 disabled={readOnly}
 >
 <SelectTrigger className="app-input w-full h-7">
 <SelectValue placeholder="Seleccionar contacto..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Seleccionar contacto...</SelectItem>
 <SelectItem value="asegurado">Asegurado - Nicanor Parra</SelectItem>
 <SelectItem value="contacto">Contacto</SelectItem>
 <SelectItem value="corredor">Corredor</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label className="app-field-label">Tipo de Contacto *</Label>
 <Select
 value={form.tipo_contacto || ""}
 onValueChange={(v) => setForm({ ...form, tipo_contacto: v || "" })}
 disabled={readOnly}
 >
 <SelectTrigger className="app-input w-full h-7">
 <SelectValue placeholder="Seleccionar tipo..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="email">Email</SelectItem>
 <SelectItem value="sms">SMS</SelectItem>
 <SelectItem value="whatsapp">WhatsApp</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label className="app-field-label">Aviso *</Label>
 <Input
 type="datetime-local"
 className="app-input"
 value={form.aviso}
 onChange={(e) => setForm({ ...form, aviso: e.target.value })}
 disabled={readOnly}
 />
 </div>

 <div>
 <Label className="app-field-label">Detalles de Contacto *</Label>
 <Textarea
 className="app-input h-auto! py-2! min-h-15"
 value={form.detalles}
 onChange={(e) => setForm({ ...form, detalles: e.target.value })}
 disabled={readOnly}
 placeholder="Aviso de Asignación automático"
 />
 </div>

 <div>
 <Label className="app-field-label">Plantilla *</Label>
 <Select
 value={form.plantilla_id || ""}
 onValueChange={(v) => {
 const tpl = templates?.find((t) => t.id === v);
 setForm({
 ...form,
 plantilla_id: v || "",
 plantilla_nombre: tpl?.name || "",
 preview: buildPreview(tpl?.name || "", form.contacto),
 });
 }}
 disabled={readOnly}
 >
 <SelectTrigger className="app-input w-full h-7">
 <SelectValue placeholder="Seleccionar plantilla..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Seleccionar plantilla...</SelectItem>
 {templates?.map((tpl) => (
 <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
 ))}
 {!templates?.length && (
 <SelectItem value="aviso-asignacion">Aviso de Asignación automática</SelectItem>
 )}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label className="app-field-label">Preview del Mensaje</Label>
 <div className="app-panel p-4 min-h-[180px]">
 {form.preview ? (
 <p className="app-body whitespace-pre-wrap">{form.preview}</p>
 ) : (
 <p className="app-body text-muted-foreground italic">Vista previa del mensaje...</p>
 )}
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

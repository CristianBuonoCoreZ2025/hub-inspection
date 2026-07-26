"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fromDateTimeLocalInput, toDateTimeLocalInput } from "@/lib/timezone";
import type { GestionScreenProps } from "./types";

export default function CoordinacionScreen({ action, onChange, readOnly }: GestionScreenProps) {
 const data = (action.action_data || {}) as Record<string, string>;
 const [form, setForm] = useState({
 inspector: data.inspector || "",
 ubicacion: data.ubicacion || "",
 fecha_hora: data.fecha_hora || "",
 tipo_contacto: data.tipo_contacto || "sms",
 contacto: data.contacto || "",
 comentarios: data.comentarios || "",
 tipo_coordinacion: data.tipo_coordinacion || "pendiente",
 });

 useEffect(() => {
 onChange?.(form);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [form]);

 return (
 <div className="space-y-3">
 <div className="rounded-lg border border-border p-3 space-y-3">
 <p className="text-[11px] font-semibold">Datos Coordinación</p>
 <div>
 <Label className="app-field-label text-[11px]">Inspector</Label>
 <Select
 value={form.inspector || "__none"}
 onValueChange={(v) => setForm({ ...form, inspector: v === "__none" || !v ? "" : v })}
 >
 <SelectTrigger className="app-input h-8 w-full" disabled={readOnly}>
 <SelectValue placeholder="Seleccionar inspector..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar inspector...</SelectItem>
 <SelectItem value="torres-paula">Torres Pizarro, Paula</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Ubicación *</Label>
 <Input
 className="app-input h-8 "
 value={form.ubicacion}
 onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
 disabled={readOnly}
 placeholder="domicilio asegurado"
 />
 </div>
 </div>

 <div className="rounded-lg border border-border p-3 space-y-3">
 <p className="text-[11px] font-semibold">Datos Inspección</p>
 <div>
 <Label className="app-field-label text-[11px]">Fecha y Hora de Inspección *</Label>
 <Input
 type="datetime-local"
 className="app-input h-8 "
 value={form.fecha_hora ? toDateTimeLocalInput(form.fecha_hora) : ""}
 onChange={(e) => {
 // El input datetime-local devuelve "yyyy-MM-ddTHH:mm" (hora local, sin offset).
 // Convertir a ISO con offset antes de guardar para evitar desfase horario.
 const iso = e.target.value ? fromDateTimeLocalInput(e.target.value) : "";
 setForm({ ...form, fecha_hora: iso });
 }}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Tipo de Contacto *</Label>
 <Select
 value={form.tipo_contacto}
 onValueChange={(v) => setForm({ ...form, tipo_contacto: v === "__none" || !v ? "" : v })}
 >
 <SelectTrigger className="app-input h-8 w-full" disabled={readOnly}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="sms">SMS</SelectItem>
 <SelectItem value="email">Email</SelectItem>
 <SelectItem value="whatsapp">WhatsApp</SelectItem>
 <SelectItem value="llamada">Llamada</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Contacto *</Label>
 <Input
 className="app-input h-8 "
 value={form.contacto}
 onChange={(e) => setForm({ ...form, contacto: e.target.value })}
 disabled={readOnly}
 placeholder="Asegurado"
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Comentarios</Label>
 <Textarea
 className="app-input min-h-[60px]"
 value={form.comentarios}
 onChange={(e) => setForm({ ...form, comentarios: e.target.value })}
 disabled={readOnly}
 placeholder="coordinación por whatsapp"
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Tipo Coordinación *</Label>
 <Select
 value={form.tipo_coordinacion}
 onValueChange={(v) => setForm({ ...form, tipo_coordinacion: v === "__none" || !v ? "" : v })}
 >
 <SelectTrigger className="app-input h-8 w-full" disabled={readOnly}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pendiente">Pendiente</SelectItem>
 <SelectItem value="completada">Completada</SelectItem>
 <SelectItem value="reprogramada">Reprogramada</SelectItem>
 <SelectItem value="cancelada">Cancelada</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 );
}

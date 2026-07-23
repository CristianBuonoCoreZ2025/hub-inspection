"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
 <select
 className="app-input h-8 w-full"
 value={form.inspector}
 onChange={(e) => setForm({ ...form, inspector: e.target.value })}
 disabled={readOnly}
 >
 <option value="">Seleccionar inspector...</option>
 <option value="torres-paula">Torres Pizarro, Paula</option>
 </select>
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
 value={form.fecha_hora}
 onChange={(e) => setForm({ ...form, fecha_hora: e.target.value })}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Tipo de Contacto *</Label>
 <select
 className="app-input h-8 w-full"
 value={form.tipo_contacto}
 onChange={(e) => setForm({ ...form, tipo_contacto: e.target.value })}
 disabled={readOnly}
 >
 <option value="sms">SMS</option>
 <option value="email">Email</option>
 <option value="whatsapp">WhatsApp</option>
 <option value="llamada">Llamada</option>
 </select>
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
 <select
 className="app-input h-8 w-full"
 value={form.tipo_coordinacion}
 onChange={(e) => setForm({ ...form, tipo_coordinacion: e.target.value })}
 disabled={readOnly}
 >
 <option value="pendiente">Pendiente</option>
 <option value="completada">Completada</option>
 <option value="reprogramada">Reprogramada</option>
 <option value="cancelada">Cancelada</option>
 </select>
 </div>
 </div>
 </div>
 );
}

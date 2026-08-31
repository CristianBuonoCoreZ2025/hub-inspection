"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GestionScreenProps } from "./types";

export default function ReservaScreen({ action, onChange, readOnly }: GestionScreenProps) {
 const data = (action.action_data || {}) as Record<string, string>;
 const [form, setForm] = useState({
 monto: data.monto || "",
 moneda: data.moneda || "CLP",
 cuentaBancaria: data.cuentaBancaria || "",
 instruccionPago: data.instruccionPago || "",
 fechaPago: data.fechaPago || "",
 });

 useEffect(() => {
 onChange?.(form);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [form]);

 return (
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label className="app-field-label text-[11px]">Monto Reservado</Label>
 <Input
 type="number"
 className="app-input h-8 "
 value={form.monto}
 onChange={(e) => setForm({ ...form, monto: e.target.value })}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Moneda</Label>
 <Select
 value={form.moneda}
 onValueChange={(v) => setForm({ ...form, moneda: v === "__none" || !v ? "" : v })}
 >
 <SelectTrigger className="app-input h-8 w-full" disabled={readOnly}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="CLP">CLP</SelectItem>
 <SelectItem value="USD">USD</SelectItem>
 <SelectItem value="EUR">EUR</SelectItem>
 <SelectItem value="UF">UF</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="col-span-2">
 <Label className="app-field-label text-[11px]">Cuenta Bancaria</Label>
 <Input
 className="app-input h-8 "
 value={form.cuentaBancaria}
 onChange={(e) => setForm({ ...form, cuentaBancaria: e.target.value })}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label text-[11px]">Fecha Pago</Label>
 <DatePicker
 value={form.fechaPago}
 onChange={(value) => setForm({ ...form, fechaPago: value })}
 disabled={readOnly}
 className="w-32.5"
 />
 </div>
 <div className="col-span-2">
 <Label className="app-field-label text-[11px]">Instrucción de Pago</Label>
 <Textarea
 className="app-input min-h-20"
 value={form.instruccionPago}
 onChange={(e) => setForm({ ...form, instruccionPago: e.target.value })}
 disabled={readOnly}
 />
 </div>
 </div>
 );
}

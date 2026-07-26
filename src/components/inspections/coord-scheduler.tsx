"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, CheckCircle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getInspectorSchedule } from "@/services/inspections";
import { toUserISO, formatUserDateTime } from "@/lib/timezone";

interface CoordSchedulerProps {
  /** ID del inspector */
  inspectorId: string;
  /** Tipo de inspección: onsite o remote */
  inspectionType: "onsite" | "remote";
  /** Valor actual (ISO datetime) */
  value?: string;
  /** Callback cuando se selecciona un slot */
  onChange: (isoDatetime: string) => void;
  /** Solo lectura */
  readOnly?: boolean;
  /** Días máximos para emitir (alarma, no bloqueo) */
  daysToIssue?: number;
  /** Fecha mínima (YYYY-MM-DD). Default: hoy */
  minDate?: string;
  /** Fecha máxima (YYYY-MM-DD) */
  maxDate?: string;
  /** ID de sesión a excluir del schedule (la sesión actual al reagendar) */
 excludeSessionId?: string;
}

/**
 * CoordScheduler — Selector de fecha + slots de disponibilidad de inspector.
 *
 * Mismo formato compacto que la coordinación en DynamicScreen:
 * - DatePicker a la izquierda
 * - Grid de 12 columnas con slots a la derecha
 * - Slots normales (verde), extra (ámbar), ocupados (muted con line-through)
 * - Horario personalizado opcional
 * - Leyenda compacta abajo
 *
 * Duración por tipo:
 *   remote  → 30 min
 *   onsite  → 180 min (3h)
 *
 * Rangos: 06-22 hrs, normal 09-19, extra 06-09 y 19-22.
 */
export function CoordScheduler({
  inspectorId,
  inspectionType,
  value,
  onChange,
  readOnly,
  daysToIssue,
  minDate,
  maxDate,
  excludeSessionId,
}: CoordSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState("12:00");

  // Duración según tipo de inspección
  const slotMinutes = inspectionType === "remote" ? 30 : 180;

  // Rangos horarios
  const DAY_START = 6, DAY_END = 22, NORMAL_START = 9, NORMAL_END = 19;

  // Fecha mínima por defecto: hoy
  const [todayLocal] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]
  );
  const effectiveMinDate = minDate || todayLocal;

  // Cargar disponibilidad del inspector para la fecha seleccionada
  // staleTime: 0 + refetchOnMount: always → siempre datos frescos
  const { data: schedule, isFetching: scheduleFetching } = useQuery({
    queryKey: ["inspector-schedule", inspectorId, selectedDate],
    queryFn: () => {
      const start = `${selectedDate}T00:00:00`;
      const end = `${selectedDate}T23:59:59`;
      return getInspectorSchedule(inspectorId, start, end);
    },
    enabled: !!inspectorId && !!selectedDate,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Generar slots disponibles
  const slots = useMemo(() => {
    if (!selectedDate || !schedule) return [];
    const result: { time: string; label: string; available: boolean; extra: boolean; bookedInfo?: string }[] = [];
    const totalMin = (DAY_END - DAY_START) * 60;
    const now = new Date();
    const isToday =
      selectedDate ===
      new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];

    for (let offset = 0; offset + slotMinutes <= totalMin; offset += slotMinutes) {
      const startHour = DAY_START + Math.floor(offset / 60);
      const startMin = offset % 60;
      const endHour = DAY_START + Math.floor((offset + slotMinutes) / 60);
      const endMin = (offset + slotMinutes) % 60;
      const timeStr = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
      const endStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

      // Si es hoy, saltar slots que ya pasaron
      if (isToday) {
        const slotStartCheck = new Date(`${selectedDate}T${timeStr}:00`);
        if (slotStartCheck <= now) continue;
      }

      const isExtra = startHour < NORMAL_START || startHour >= NORMAL_END;
      const slotStart = new Date(`${selectedDate}T${timeStr}:00`);
      const slotEnd = new Date(`${selectedDate}T${endStr}:00`);
      const booked = schedule.find((s) => {
        // Excluir la sesión actual al reagendar (sigue activa pero no cuenta como ocupada)
        if (excludeSessionId && s.id === excludeSessionId) return false;
        const sStart = new Date(s.scheduled_at);
        const sDuration = s.inspection_type === "onsite" ? 180 : 30;
        const sEnd = new Date(sStart.getTime() + sDuration * 60000);
        return sStart < slotEnd && sEnd > slotStart;
      });

      result.push({
        time: timeStr,
        label: `${timeStr} - ${endStr}`,
        available: !booked,
        extra: isExtra,
        bookedInfo: booked ? `Ocupado: ${booked.claim?.claim_number}` : undefined,
      });
    }
    return result;
  }, [selectedDate, slotMinutes, schedule, excludeSessionId]);

  // Valor actual formateado
  const currentValue = String(value || "");
  const valDate = currentValue ? new Date(currentValue) : null;
  const isPast = valDate && valDate < new Date();

  // ¿La fecha seleccionada excede daysToIssue?
  const isOverMaxDate =
    daysToIssue && daysToIssue > 0 && selectedDate
      ? (() => {
          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + daysToIssue);
          const sel = new Date(selectedDate + "T23:59:59");
          return sel > maxDate;
        })()
      : false;

  // Fecha seleccionada formateada
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  // Asignar un slot
  const assignSlot = (timeStr: string) => {
    const datetimeStr = toUserISO(selectedDate, timeStr);
    onChange(datetimeStr);
  };

  // Asignar horario personalizado
  const assignCustom = () => {
    const datetimeStr = toUserISO(selectedDate, customTime);
    onChange(datetimeStr);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Control doble: fecha a la izquierda, slots a la derecha */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Columna izquierda: date picker + fecha centrada verticalmente */}
        <div className="flex flex-col justify-center gap-1 sm:w-32.5 shrink-0">
          <DatePicker
            value={selectedDate}
            onChange={(v) => setSelectedDate(v)}
            placeholder="dd-mm-aaaa"
            disabled={readOnly}
            minDate={effectiveMinDate}
            maxDate={maxDate}
            className={`w-full ${isOverMaxDate ? "border-amber-500" : ""}`}
          />
          {currentValue && valDate && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 w-fit app-body px-1 py-0">
              <CheckCircle className="inline h-3 w-3 mr-1" />
              {formatUserDateTime(currentValue)}
            </Badge>
          )}
          {selectedDateLabel && (
            <p className="app-body text-muted-foreground leading-tight">{selectedDateLabel}</p>
          )}
        </div>

        {/* Columna derecha: slots + barra inferior con info */}
        {inspectorId && selectedDate ? (
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {scheduleFetching ? (
              <p className="app-body text-muted-foreground py-2">Cargando disponibilidades...</p>
            ) : slots.length === 0 ? (
              <p className="app-body text-muted-foreground py-2">No hay slots disponibles.</p>
            ) : (
              <>
                {/* Grid de slots — 12 columnas, compactos (24px) */}
                <div className="grid grid-cols-12 gap-1">
                  {slots.map((slot) => {
                    const isSelected = currentValue === `${selectedDate}T${slot.time}`;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={readOnly || !slot.available}
                        onClick={() => assignSlot(slot.time)}
                        className={`h-6 max-h-6 rounded app-body font-medium transition-colors flex items-center justify-center gap-0.5 ${
                          !slot.available
                            ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through border border-border/30"
                            : slot.extra
                            ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20"
                        } ${isSelected ? "ring-2 ring-primary bg-primary/5" : ""}`}
                        title={slot.bookedInfo || `${slot.label}${slot.extra ? " (extra)" : ""}`}
                      >
                        {slot.time}
                        {slot.extra && <Star className="h-3 w-3 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
                {/* Barra inferior: tipo + leyenda + horario personalizado */}
                <div className="flex flex-wrap items-center gap-2 mt-0.5 pt-1 border-t border-border/30 app-body text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {inspectionType === "remote" ? "Remota · 30 min" : "Presencial · 3 hrs"}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded bg-emerald-500/40" /> 09-19
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded bg-amber-500/40" /> Extra{" "}
                      <Star className="h-3 w-3 text-amber-500" />
                    </span>
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded bg-muted" /> Ocupado
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setShowCustomTime(true)}
                      className="text-sky-600 hover:underline ml-1"
                    >
                      + Horario personalizado
                    </button>
                  )}
                </div>
                {showCustomTime && !readOnly && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      className="app-input h-6 app-body w-auto"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={assignCustom}
                      className="px-2 py-0.5 rounded app-body font-medium bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 border border-sky-500/20"
                    >
                      Asignar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomTime(false)}
                      className="app-body text-muted-foreground hover:underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : !selectedDate ? (
          <div className="flex-1 flex items-center justify-center app-body text-muted-foreground py-2">
            Seleccione una fecha para ver horarios.
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center app-body text-muted-foreground py-2">
            Seleccione un inspector para ver disponibilidades.
          </div>
        )}
      </div>

      {/* Alertas compactas abajo */}
      {(isPast || isOverMaxDate || (daysToIssue && daysToIssue > 0 && !isPast && !isOverMaxDate)) && (
        <div className="flex flex-wrap gap-2 app-body">
          {isPast && <span className="text-red-600 font-medium">Fecha en el pasado.</span>}
          {isOverMaxDate && (
            <span className="text-amber-600 font-medium">Excede máx {daysToIssue} días.</span>
          )}
          {daysToIssue && daysToIssue > 0 && !isPast && !isOverMaxDate && (
            <span className="text-muted-foreground">Máx: {daysToIssue} días</span>
          )}
        </div>
      )}
    </div>
  );
}

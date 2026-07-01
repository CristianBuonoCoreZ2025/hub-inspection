"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInspectionSessions } from "@/services/inspections";
import { getUsers } from "@/services/users";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InspectionSession } from "@/types";

const sessionStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  scheduled: "Agendada",
  active: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const sessionStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  active: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  completed: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function getWeekDays(base: Date) {
  const day = base.getDay(); // 0=domingo
  const diff = base.getDate() - day + (day === 0 ? -6 : 1); // lunes
  const monday = new Date(base);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function sameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(new Date());
  const [inspectorFilter, setInspectorFilter] = useState<string>("all");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const inspectors = users?.filter((u) => u.role === "inspector") || [];

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const filteredSessions = useMemo(() => {
    return sessions?.filter((s) => {
      const matchesInspector = inspectorFilter === "all" || s.claim?.inspector_id === inspectorFilter;
      return matchesInspector && (s.status === "scheduled" || s.status === "active");
    }) || [];
  }, [sessions, inspectorFilter]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const todayWeek = () => setWeekStart(new Date());

  const monthLabel = `${monthNames[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`;

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Agenda</h1>
        <p className="app-page-lead">
          Calendario semanal de inspecciones programadas y en progreso.
        </p>
      </header>

      {/* Toolbar */}
      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {monthLabel}
          </span>
          <Button variant="outline" size="sm" className="h-8" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={todayWeek}>
            Hoy
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={inspectorFilter} onValueChange={(v) => setInspectorFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-full sm:w-[200px] text-[13px]">
              <SelectValue placeholder="Todos los inspectores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los inspectores</SelectItem>
              {inspectors.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.full_name || i.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Vista Semanal */}
      <div className="app-panel p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">Cargando agenda...</span>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory border-b">
            {weekDays.map((day, idx) => {
              const isToday = sameDay(day, new Date());
              const daySessions = filteredSessions.filter((s) => {
                if (!s.scheduled_at) return false;
                const sDate = new Date(s.scheduled_at);
                return sameDay(sDate, day);
              });

              return (
                <div
                  key={idx}
                  className={`flex flex-col border-r last:border-r-0 min-h-[200px] sm:min-h-[320px] snap-start shrink-0 w-[85%] sm:w-1/3 md:w-1/4 lg:w-auto lg:flex-1 ${
                    isToday ? "bg-primary/5" : ""
                  }`}
                >
                  {/* Header del dia */}
                  <div className={`px-3 py-2 text-center border-b ${isToday ? "bg-primary/10" : "bg-muted/40"}`}>
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">
                      {dayNames[idx]}
                    </p>
                    <p className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                      {day.getDate()}
                    </p>
                  </div>

                  {/* Eventos del dia */}
                  <div className="flex-1 p-2 space-y-2">
                    {daySessions.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center mt-4">
                        Sin inspecciones
                      </p>
                    ) : (
                      daySessions.map((s) => (
                        <EventCard key={s.id} session={s} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Agendada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-500" />
          En progreso
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          Completada
        </div>
      </div>
    </div>
  );
}

function EventCard({ session }: { session: InspectionSession & { claim?: any } }) {
  const time = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    : "";
  const insuredName = session.claim?.claims_participants?.[0]?.full_name;
  const isRemote = session.inspection_type === "remote";

  return (
    <a
      href={`/dashboard/inspecciones/${session.id}`}
      className="block rounded-lg border border-border bg-card p-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <Badge className={`text-[10px] px-1 py-0 ${sessionStatusColors[session.status]}`}>
          {sessionStatusLabels[session.status]}
        </Badge>
        {time && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {time}
          </span>
        )}
      </div>
      <p className="text-[11px] font-medium truncate leading-tight">
        #{session.claim?.claim_number}
      </p>
      <p className="text-[10px] text-muted-foreground truncate">
        {insuredName || "—"}
      </p>
      <div className="flex items-center gap-0.5 mt-1 text-[10px] text-muted-foreground">
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{session.claim?.claim_address || "—"}</span>
      </div>
      {isRemote && (
        <div className="mt-1">
          <Badge className="text-[9px] px-1 py-0 bg-violet-500/10 text-violet-600 border-violet-500/20">
            Remota
          </Badge>
        </div>
      )}
    </a>
  );
}

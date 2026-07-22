"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getInspectionSessions, type SessionWithRelations } from "@/services/inspections";
import { getUsersByRoleForCompany } from "@/services/users";
import {
 ChevronLeft,
 ChevronRight,
 Clock,
 MapPin,
 Video,
 Home,
 CalendarDays,
 User,
 ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
 SelectGroup,
 SelectLabel,
 SelectSeparator,
} from "@/components/ui/select";

// ═══ Helpers ═══

function getWeekDays(base: Date) {
 const day = base.getDay();
 const diff = base.getDate() - day + (day === 0 ? -6 : 1);
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

function isInRange(date: Date, start: Date, end: Date) {
 const d = new Date(date);
 d.setHours(0, 0, 0, 0);
 const s = new Date(start);
 s.setHours(0, 0, 0, 0);
 const e = new Date(end);
 e.setHours(23, 59, 59, 999);
 return d >= s && d <= e;
}

const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const monthNames = [
 "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ═══ Colores por tipo de inspección (estilo macOS Calendar) ═══

const typeStyles = {
 remote: {
 card: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/60 hover:border-violet-400 dark:hover:border-violet-600",
 dot: "bg-violet-500",
 bar: "bg-violet-500",
 text: "text-violet-700 dark:text-violet-300",
 label: "Remota",
 icon: Video,
 },
 onsite: {
 card: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 hover:border-sky-400 dark:hover:border-sky-600",
 dot: "bg-sky-500",
 bar: "bg-sky-500",
 text: "text-sky-700 dark:text-sky-300",
 label: "Presencial",
 icon: Home,
 },
} as const;

const statusBadge: Record<string, string> = {
 scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
 active: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
 completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
 cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
};

const statusLabel: Record<string, string> = {
 scheduled: "Agendada",
 active: "En progreso",
 completed: "Completada",
 cancelled: "Cancelada",
};

// ═══ Componente principal ═══

export default function AgendaPage() {
 const [weekStart, setWeekStart] = useState(new Date());
 const [inspectorFilter, setInspectorFilter] = useState<string>("all");

 const { data: sessions, isLoading } = useQuery({
 queryKey: ["inspection-sessions"],
 queryFn: () => getInspectionSessions(),
 });

 const { data: inspectorCandidates } = useQuery({
 queryKey: ["users-by-role", "inspector"],
 queryFn: () => getUsersByRoleForCompany("inspector"),
 });

 const inspectors = useMemo(
 () => inspectorCandidates || [],
 [inspectorCandidates]
 );
 const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
 const weekStart_ = weekDays[0];
 const weekEnd = weekDays[6];

 // Sessions visibles en la semana actual (scheduled + active + completed + cancelled)
 const weekSessions = useMemo(() => {
 return sessions?.filter((s) => {
 if (!s.scheduled_at) return false;
 return isInRange(new Date(s.scheduled_at), weekStart_, weekEnd);
 }) || [];
 }, [sessions, weekStart_, weekEnd]);

 // Inspectores que tienen casos en la semana
 const inspectorIdsWithCases = useMemo(() => {
 const ids = new Set<string>();
 for (const s of weekSessions) {
 const iid = s.inspector_id || s.claim?.inspector_id;
 if (iid) ids.add(iid);
 }
 return ids;
 }, [weekSessions]);

 // Inspectores ordenados: con casos primero, luego sin casos
 const sortedInspectors = useMemo(() => {
 return [...inspectors].sort((a, b) => {
 const aHas = inspectorIdsWithCases.has(a.id);
 const bHas = inspectorIdsWithCases.has(b.id);
 if (aHas && !bHas) return -1;
 if (!aHas && bHas) return 1;
 return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
 });
 }, [inspectors, inspectorIdsWithCases]);

 const inspectorsWithCases = sortedInspectors.filter((i) => inspectorIdsWithCases.has(i.id));
 const inspectorsWithoutCases = sortedInspectors.filter((i) => !inspectorIdsWithCases.has(i.id));

 // Sessions filtradas por inspector
 const filteredSessions = useMemo(() => {
 return weekSessions.filter((s) => {
 const sessionInspectorId = s.inspector_id || s.claim?.inspector_id;
 const matchesInspector = inspectorFilter === "all" || sessionInspectorId === inspectorFilter;
 return matchesInspector;
 });
 }, [weekSessions, inspectorFilter]);

 // Contar por tipo para stats
 const stats = useMemo(() => {
 const remote = filteredSessions.filter((s) => s.inspection_type === "remote").length;
 const onsite = filteredSessions.filter((s) => s.inspection_type !== "remote").length;
 return { remote, onsite, total: filteredSessions.length };
 }, [filteredSessions]);

 // Mapa inspectorId → nombre
 const inspectorName = (id?: string) => {
 if (!id) return null;
 const u = inspectors.find((u) => u.id === id);
 return u?.full_name || u?.email || null;
 };

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
 const isFiltered = inspectorFilter !== "all";

 return (
 <div className="app-page">
 <header className="app-page-header">
 <h1 className="app-page-title">Agenda</h1>
 <p className="app-page-lead">
 <span className="agenda-stats inline-flex items-center gap-1.5">
 {stats.total} en esta semana
 {stats.total > 0 && (
 <span className="text-muted-foreground">
 · {stats.onsite} presenciales · {stats.remote} remotas
 </span>
 )}
 </span>
 </p>
 </header>

 {/* Toolbar — pill flotante liquid glass */}
 <div className="agenda-toolbar">
 <div className="flex items-center gap-2">
 <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevWeek}>
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <span className="text-sm font-semibold min-w-[150px] text-center">
 {monthLabel}
 </span>
 <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextWeek}>
 <ChevronRight className="h-4 w-4" />
 </Button>
 <Button variant="outline" size="sm" className="h-8" onClick={todayWeek}>
 <CalendarDays className="h-3.5 w-3.5 mr-1" />
 Hoy
 </Button>
 </div>

 <div className="flex items-center gap-2 ml-auto">
 <Select
 value={inspectorFilter || "all"}
 onValueChange={(v) => setInspectorFilter(v ?? "all")}
 items={[
 { value: "all", label: "Todos" },
 ...inspectors.map((i) => ({ value: i.id, label: i.full_name || i.email })),
 ]}
 >
 <SelectTrigger className="app-input w-[260px] max-w-[260px] min-w-[260px]">
 <User className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
 <SelectValue placeholder="Todos">
 {(val: string) => {
 if (val === "all") return "Todos";
 const insp = inspectors.find((i) => i.id === val);
 return insp?.full_name || insp?.email || "Todos";
 }}
 </SelectValue>
 </SelectTrigger>
 <SelectContent className="agenda-inspector-dropdown">
 <SelectItem value="all">Todos</SelectItem>
 {inspectorsWithCases.length > 0 && (
 <SelectGroup>
 <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">
 Con inspecciones esta semana
 </SelectLabel>
 {inspectorsWithCases.map((i) => {
 const count = weekSessions.filter((s) =>
 (s.inspector_id || s.claim?.inspector_id) === i.id
 ).length;
 return (
 <SelectItem
 key={i.id}
 value={i.id}
 >
 <span className="flex items-center gap-2">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
 {i.full_name || i.email}
 <span className="text-[10px] text-muted-foreground ml-1">({count})</span>
 {i.source === "internal" && <span className="text-[9px] text-amber-600 ml-1">· Interno</span>}
 </span>
 </SelectItem>
 );
 })}
 </SelectGroup>
 )}
 {inspectorsWithoutCases.length > 0 && (
 <>
 <SelectSeparator />
 <SelectGroup>
 <SelectLabel className="text-[10px] text-muted-foreground uppercase tracking-wide">
 Sin inspecciones esta semana
 </SelectLabel>
 {inspectorsWithoutCases.map((i) => (
 <SelectItem
 key={i.id}
 value={i.id}
 >
 <span className="flex items-center gap-2 text-muted-foreground">
 <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
 {i.full_name || i.email}
 {i.source === "internal" && <span className="text-[9px] text-amber-600 ml-1">· Interno</span>}
 </span>
 </SelectItem>
 ))}
 </SelectGroup>
 </>
 )}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Vista Semanal — calendario liquid glass estilo macOS */}
 <div className="agenda-calendar">
 {isLoading ? (
 <div className="flex items-center justify-center py-20">
 <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
 <span className="ml-2 text-muted-foreground text-sm">Cargando agenda...</span>
 </div>
 ) : (
 <div className="flex overflow-x-auto border-b border-border/30">
 {weekDays.map((day, idx) => {
 const isToday = sameDay(day, new Date());
 const daySessions = filteredSessions
 .filter((s) => s.scheduled_at && sameDay(new Date(s.scheduled_at), day))
 .sort((a, b) => {
 const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
 const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
 return ta - tb;
 });

 return (
 <div
 key={idx}
 className={`flex flex-col border-r border-border/20 last:border-r-0 min-h-[280px] sm:min-h-[400px] shrink-0 w-[85%] sm:w-1/3 md:w-1/4 lg:w-auto lg:flex-1 ${
 isToday ? "bg-primary/3" : ""
 }`}
 >
 {/* Header del día */}
 <div className={`agenda-day-header px-3 py-2.5 text-center border-b border-border/20 ${isToday ? "bg-primary/10" : "bg-muted/20"}`}>
 <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
 {dayNames[idx]}
 </p>
 <p className={`text-xl font-bold leading-tight ${isToday ? "text-primary" : "text-foreground"}`}>
 {day.getDate()}
 </p>
 {daySessions.length > 0 && (
 <p className="text-[9px] text-muted-foreground mt-0.5">
 {daySessions.length} {daySessions.length === 1 ? "inspección" : "inspecciones"}
 </p>
 )}
 </div>

 {/* Eventos del día */}
 <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
 {daySessions.length === 0 ? (
 <div className="flex items-center justify-center h-full min-h-[60px]">
 <p className="text-[10px] text-muted-foreground/40">—</p>
 </div>
 ) : (
 daySessions.map((s) => (
 <EventCard
 key={s.id}
 session={s}
 inspectorName={inspectorName(s.inspector_id || s.claim?.inspector_id)}
 showInspector={!isFiltered}
 />
 ))
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Leyenda — pill glass */}
 <div className="agenda-legend text-[11px] text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
 Presencial
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
 Remota
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
 Con casos esta semana
 </div>
 <div className="flex items-center gap-1.5">
 <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
 Sin casos
 </div>
 </div>
 </div>
 );
}

// ═══ EventCard — tarjeta de inspección estilo macOS ═══

function EventCard({
 session,
 inspectorName,
 showInspector,
}: {
 session: SessionWithRelations;
 inspectorName: string | null;
 showInspector: boolean;
}) {
 const router = useRouter();
 const time = session.scheduled_at
 ? new Date(session.scheduled_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
 : "";
 const isRemote = session.inspection_type === "remote";
 const style = isRemote ? typeStyles.remote : typeStyles.onsite;
 const TypeIcon = style.icon;
 const liquidationNumber = session.claim?.liquidation_number;
 const insuredName = session.claim?.claims_participants?.[0]?.full_name;

 return (
 <div
 role="link"
 tabIndex={0}
 onClick={() => router.push(`/dashboard/inspecciones/${session.id}`)}
 onKeyDown={(e) => {
 if (e.key === "Enter" || e.key === " ") {
 e.preventDefault();
 router.push(`/dashboard/inspecciones/${session.id}`);
 }
 }}
 className={`agenda-event block border ${style.card} p-2 group cursor-pointer`}
 >
 {/* Barra de color superior (estilo macOS) */}
 <div className={`h-0.5 rounded-full ${style.bar} mb-1.5`} />

 <div className="flex items-start justify-between gap-1">
 <div className="flex items-center gap-1 min-w-0">
 <TypeIcon className={`h-3 w-3 shrink-0 ${style.text}`} />
 <span className="text-[10px] font-semibold text-foreground">
 {time || "—"}
 </span>
 </div>
 <span className={`text-[9px] px-1 py-0 rounded ${statusBadge[session.status] || ""}`}>
 {statusLabel[session.status] || session.status}
 </span>
 </div>

 {/* Liquidation number — clickable al siniestro */}
 <div className="mt-1 flex items-center gap-1">
 {liquidationNumber ? (
 <Link
 href={`/dashboard/claims?liquidation=${liquidationNumber}`}
 className="text-[11px] font-bold text-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
 onClick={(e) => e.stopPropagation()}
 >
 {liquidationNumber}
 <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
 </Link>
 ) : (
 <span className="text-[11px] font-medium text-muted-foreground">
 #{session.claim?.claim_number}
 </span>
 )}
 </div>

 {/* Asegurado */}
 {insuredName && (
 <p className="text-[10px] text-muted-foreground truncate mt-0.5">
 {insuredName}
 </p>
 )}

 {/* Dirección (solo presencial) */}
 {!isRemote && session.claim?.claim_address && (
 <div className="flex items-center gap-0.5 mt-0.5 text-[9px] text-muted-foreground">
 <MapPin className="h-2.5 w-2.5 shrink-0" />
 <span className="truncate">{session.claim.claim_address}</span>
 </div>
 )}

 {/* Inspector (solo si no estamos filtrando por inspector) */}
 {showInspector && inspectorName && (
 <div className="flex items-center gap-0.5 mt-1 pt-1 border-t border-border/50 text-[9px] text-muted-foreground">
 <User className="h-2.5 w-2.5 shrink-0" />
 <span className="truncate">{inspectorName}</span>
 </div>
 )}
 </div>
 );
}

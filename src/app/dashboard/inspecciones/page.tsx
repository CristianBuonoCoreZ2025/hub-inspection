"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
 getInspectionSessions,
 updateInspectionSession,
} from "@/services/inspections";
import { getUsers } from "@/services/users";
import { formatUserDateTime as formatDateTime } from "@/lib/timezone";
import { usePermissions } from "@/hooks/use-permissions";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import {
 Search,
 Calendar,
 MapPin,
 User,
 ClipboardCheck,
 Eye,
 Play,
 Ban,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import type { InspectionSession } from "@/types";

const sessionStatusLabels: Record<string, string> = {
 scheduled: "Agendada",
 active: "En progreso",
 completed: "Completada",
 cancelled: "Cancelada",
};



export default function InspectionsPage() {
 return (
 <Suspense fallback={<div className="app-page"><p className="text-muted-foreground py-20 text-center">Cargando...</p></div>}>
 <InspectionsPageContent />
 </Suspense>
 );
}

function InspectionsPageContent() {
 const queryClient = useQueryClient();
 const router = useRouter();
 const searchParams = useSearchParams();
 const { canEdit } = usePermissions();
 useRealtime("inspection_sessions", [["inspection-sessions"], ["inspection-sessions-all"]]);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>(() => {
 const s = searchParams.get("status");
 return s && ["all", "scheduled", "active", "completed", "cancelled"].includes(s) ? s : "all";
 });

 const { data: sessions, isLoading, error: sessionsError } = useQuery({
 queryKey: ["inspection-sessions"],
 queryFn: () => getInspectionSessions(),
 });

 const { data: users } = useQuery({
 queryKey: ["users"],
 queryFn: () => getUsers(),
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
 updateInspectionSession(id, input),
 onSuccess: () => {
 toast.success("Estado actualizado");
 queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const filtered = sessions?.filter((s) => {
 const insuredName = s.claim?.claims_participants?.[0]?.full_name;
 const matchesSearch =
 [s.claim?.claim_number, insuredName, s.claim?.claim_address]
 .filter(Boolean)
 .join(" ")
 .toLowerCase()
 .includes(search.toLowerCase()) ||
 sessionStatusLabels[s.status]?.toLowerCase().includes(search.toLowerCase());
 const matchesStatus = statusFilter === "all" || s.status === statusFilter;
 return matchesSearch && matchesStatus;
 }) ?? [];

 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(filtered);

 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-amber-500 to-orange-500">
 <ClipboardCheck />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Inspecciones</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 </div>
 </div>

 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input
 placeholder="Buscar inspeccion..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="liquid-search"
 />
 </div>
 <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v ?? "all")} items={[{ value: "all", label: "Todos los estados" }, { value: "scheduled", label: "Agendada" }, { value: "active", label: "En progreso" }, { value: "completed", label: "Completada" }, { value: "cancelled", label: "Cancelada" }]}>
 <SelectTrigger className="app-input app-filter-narrow">
 <SelectValue placeholder="Todos los estados" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los estados</SelectItem>
 <SelectItem value="scheduled">Agendada</SelectItem>
 <SelectItem value="active">En progreso</SelectItem>
 <SelectItem value="completed">Completada</SelectItem>
 <SelectItem value="cancelled">Cancelada</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th className="min-w-[120px] sm:w-[140px]">Inspección</th>
 <th className="min-w-[90px] sm:w-[110px]">N° Interno</th>
 <th className="min-w-[90px] sm:w-[110px]">Ref. Cliente</th>
 <th className="min-w-[100px] sm:w-[140px]">Inspector</th>
 <th className="min-w-[100px] sm:w-[160px]">Asegurado</th>
 <th className="w-60 sm:w-80">Direccion</th>
 <th className="min-w-[80px] sm:w-[90px]">Estado</th>
 <th className="w-32">Programada</th>
 <th className="min-w-[90px] sm:w-[160px] text-right">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr>
 <td colSpan={9} className="py-8 text-center text-muted-foreground">
 Cargando inspecciones...
 </td>
 </tr>
 ) : sessionsError ? (
 <tr>
 <td colSpan={9} className="py-8 text-center text-destructive">
 Error al cargar inspecciones: {sessionsError.message}
 </td>
 </tr>
 ) : filtered?.length === 0 ? (
 <tr>
 <td colSpan={9} className="py-8 text-center text-muted-foreground">
 No hay inspecciones registradas.
 </td>
 </tr>
 ) : (
 paginatedData.map((session) => (
 <tr
 key={session.id}
 className="row-clickable"
 onClick={() => router.push(`/dashboard/inspecciones/${session.id}`)}
 >
 <td className="whitespace-nowrap">
 <div className="flex items-center gap-2">
 <Link
 href={`/dashboard/inspecciones/${session.id}`}
 className="font-mono text-[11px] font-semibold text-primary hover:underline"
 onClick={(e) => e.stopPropagation()}
 >
 {session.inspection_number?.split("-").slice(-2).join("-") || session.id.slice(0, 8)}
 </Link>
 <StatusBadge
 tone={session.inspection_type === "remote" ? "sky" : "emerald"}
 label={session.inspection_type === "remote" ? "Remota" : "Presencial"}
 size="sm"
 />
 </div>
 </td>
 <td className="whitespace-nowrap">
 <span className="font-mono text-[11px] font-medium">
 {session.claim?.liquidation_number ? (
 <Link href={`/dashboard/claims/${session.claim_id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
 {session.claim.liquidation_number}
 </Link>
 ) : (
 "—"
 )}
 </span>
 </td>
 <td className="whitespace-nowrap">
 <span className="text-[11px] text-muted-foreground">
 {session.claim?.client_reference || "—"}
 </span>
 </td>
 <td>
 <div className="flex items-center gap-1">
 <User className="h-3 w-3 text-muted-foreground shrink-0" />
 <span className="text-[11px]">
 {users?.find((u) => u.id === (session.inspector_id || session.claim?.inspector_id))?.full_name || "—"}
 </span>
 </div>
 </td>
 <td>
 <span className="text-[11px]">
 {session.claim?.claims_participants?.[0]?.full_name || "—"}
 </span>
 </td>
 <td className="max-w-60 sm:max-w-80">
 <div className="flex items-center gap-1">
 <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
 <span className="text-[11px] truncate">
 {session.claim?.claim_address || "—"}
 </span>
 </div>
 </td>
 <td>
 <StatusBadge
 tone={session.status === "active" ? "zinc" : undefined}
 status={session.status}
 label={sessionStatusLabels[session.status] || session.status}
 />
 </td>
 <td>
 <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
 {session.scheduled_at ? (
 <>
 <Calendar className="h-3 w-3 text-muted-foreground" />
 {formatDateTime(session.scheduled_at)}
 </>
 ) : (
 <span className="text-muted-foreground">Sin programar</span>
 )}
 </div>
 </td>
 <td>
 <div className="app-row-actions" onClick={(e) => e.stopPropagation()}>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 title="Ver"
 onClick={() => router.push(`/dashboard/inspecciones/${session.id}`)}
 >
 <Eye className="h-4 w-4" />
 </Button>
 {canEdit("inspecciones") && session.status === "scheduled" && (
 <>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 title="Iniciar"
 onClick={() =>
 updateMutation.mutate({
 id: session.id,
 input: { status: "active" },
 })
 }
 >
 <Play className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm"
 title="Cancelar"
 onClick={() =>
 updateMutation.mutate({
 id: session.id,
 input: { status: "cancelled" },
 })
 }
 >
 <Ban className="h-4 w-4" />
 </Button>
 </>
 )}
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 </div>
 );
}

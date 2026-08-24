"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getOfflineDownloadedSessions, forceReleaseOfflineSession } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { Unlock, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LiberarOfflinePage() {
  const { profile } = useAuth();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions", "offline-downloaded"],
    queryFn: () => getOfflineDownloadedSessions(),
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      forceReleaseOfflineSession(id, profile?.id),
    onSuccess: () => {
      toast.success("Inspección liberada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", "offline-downloaded"] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (sessions || []).filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (s.inspection_number || "").toLowerCase().includes(term) ||
      (s.claim?.liquidation_number || "").toLowerCase().includes(term) ||
      (s.claim?.client_reference || "").toLowerCase().includes(term) ||
      (s.inspector?.full_name || "").toLowerCase().includes(term)
    );
  });

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
    inspection_number: (s) => s.inspection_number,
    liquidation_number: (s) => s.claim?.liquidation_number || "",
    inspector: (s) => s.inspector?.full_name || "",
    offline_downloaded_at: (s) => s.offline_downloaded_at || "",
  }, "offline_downloaded_at");

  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

  const handleRelease = async (sessionId: string, inspectorName: string) => {
    const ok = await confirm({
      title: "Liberar inspección offline",
      description: `Se liberará la inspección descargada por ${inspectorName}. El dispositivo ya no podrá sincronizar cambios.`,
      confirmLabel: "Liberar",
      destructive: true,
    });
    if (!ok) return;
    releaseMutation.mutate({ id: sessionId });
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-purple">
            <Unlock />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Liberar Inspecciones Offline</h1>
          </div>
        </div>
      </div>

      <div className="app-panel">
        <h2 className="app-section-title mb-2">Inspecciones Descargadas</h2>
        <p className="app-body text-muted-foreground mb-4">
          Inspecciones que un inspector tiene descargadas en su dispositivo.
          Al liberar, el dispositivo pierde la sincronización y no podrá subir cambios.
        </p>

        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search />
              <Input
                placeholder="Buscar por inspección, liquidación, inspector..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="liquid-search"
              />
            </div>
          </div>
          <Pagination
            variant="controls"
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? "No se encontraron inspecciones." : "No hay inspecciones descargadas offline."}
          </p>
        ) : (
          <>
            <div className="app-data-table-wrap max-h-75">
              <table className="app-data-table">
                <thead>
                  <tr>
                    <SortableTh sortKey="inspection_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>N° Inspección</SortableTh>
                    <SortableTh sortKey="liquidation_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Liquidación</SortableTh>
                    <SortableTh sortKey="inspector" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Inspector</SortableTh>
                    <SortableTh sortKey="offline_downloaded_at" currentKey={sortKey} direction={sortDir} onSort={toggleSort}>Descargada</SortableTh>
                    <th className="w-15"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((session) => (
                    <tr key={session.id}>
                      <td className="text-[11px] font-mono">{session.inspection_number || "—"}</td>
                      <td className="text-[11px]">{session.claim?.liquidation_number || "—"}</td>
                      <td className="text-[11px]">{session.inspector?.full_name || "—"}</td>
                      <td className="text-[11px]">
                        {session.offline_downloaded_at
                          ? new Date(session.offline_downloaded_at).toLocaleDateString("es-CL")
                          : "—"}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canEdit || releaseMutation.isPending}
                          onClick={() => handleRelease(session.id, session.inspector?.full_name || "el inspector")}
                        >
                          {releaseMutation.isPending && releaseMutation.variables?.id === session.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Liberar"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

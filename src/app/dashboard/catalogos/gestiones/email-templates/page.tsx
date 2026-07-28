"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Mail, Plus, Pencil, Ban, Search, Loader2, FileText, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getEmailTemplates,
  deleteEmailTemplate,
} from "@/services/email-templates";
import { getBusinessLines } from "@/services/catalogs";
import { toast } from "sonner";

export default function EmailTemplatesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [search, setSearch] = useState("");
  const [businessLineFilter, setBusinessLineFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", companyId],
    queryFn: () =>
      getEmailTemplates({
        companyId: companyId!,
        includeInactive: true,
        withActions: true,
      }),
    enabled: !!companyId,
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: () => getBusinessLines(),
  });

  const businessLineFilterItems = useMemo(
    () => [
      { value: "all", label: "Todas las líneas" },
      ...(businessLines || []).map((bl) => ({ value: bl.id, label: bl.name })),
    ],
    [businessLines]
  );

  const formatFilterItems = useMemo(
    () => [
      { value: "all", label: "Todos los formatos" },
      { value: "plain", label: "Texto plano" },
      { value: "html", label: "HTML" },
    ],
    []
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => {
      toast.success("Plantilla desactivada");
      queryClient.invalidateQueries({ queryKey: ["email-templates", companyId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (businessLineFilter !== "all" && t.business_line_id !== businessLineFilter) return false;
      if (formatFilter !== "all" && t.body_format !== formatFilter) return false;
      if (!q) return true;
      const inName = t.name.toLowerCase().includes(q);
      const inSubject = t.subject.toLowerCase().includes(q);
      const inActions = (t.actions || [])
        .map((a) => a.action_template?.code || a.action_template?.name || "")
        .join(" ")
        .toLowerCase()
        .includes(q);
      return inName || inSubject || inActions;
    });
  }, [templates, search, businessLineFilter, formatFilter]);

  const businessLineName = (id: string) =>
    businessLines?.find((bl) => bl.id === id)?.name || "—";

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-sky-500 to-blue-500">
            <Mail />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Plantillas De E-mail</h1>
          </div>
        </div>
        <div className="app-grid-header-right">
          {canCreate("catalogos") && (
            <Button
              className="pg-btn-platinum"
              onClick={() => router.push("/dashboard/catalogos/gestiones/email-templates/new")}
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </Button>
          )}
        </div>
      </div>

      <div className="app-panel">
        {/* Toolbar: buscador + filtros */}
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <div className="app-grid-search-wrap">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="liquid-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={businessLineFilter} onValueChange={(v) => setBusinessLineFilter(v ?? "all")} items={businessLineFilterItems}>
              <SelectTrigger className="app-input app-filter-narrow h-7">
                <SelectValue placeholder="Todas las líneas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las líneas</SelectItem>
                {(businessLines || []).map((bl) => (
                  <SelectItem key={bl.id} value={bl.id}>
                    {bl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={formatFilter} onValueChange={(v) => setFormatFilter(v ?? "all")} items={formatFilterItems}>
              <SelectTrigger className="app-input app-filter-narrow h-7">
                <SelectValue placeholder="Todos los formatos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los formatos</SelectItem>
                <SelectItem value="plain">Texto plano</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla */}
        <div className="app-data-table-wrap">
          <table className="app-data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Línea</th>
                <th>Formato</th>
                <th>Asunto</th>
                <th>Acciones vinculadas</th>
                <th>Activa</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Cargando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-6">
                    No se encontraron plantillas.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const linkedActions = t.actions || [];
                  return (
                    <tr
                      key={t.id}
                      className="row-clickable"
                      onClick={() =>
                        router.push(`/dashboard/catalogos/gestiones/email-templates/${t.id}`)
                      }
                    >
                      <td className="text-[12px] font-medium">{t.name}</td>
                      <td className="text-[11px] text-muted-foreground">
                        {businessLineName(t.business_line_id)}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
                            t.body_format === "html"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                          }`}
                        >
                          {t.body_format === "html" ? (
                            <>
                              <Code2 className="h-3 w-3" />
                              HTML
                            </>
                          ) : (
                            <>
                              <FileText className="h-3 w-3" />
                              Plano
                            </>
                          )}
                        </span>
                      </td>
                      <td className="text-[11px] text-muted-foreground truncate max-w-55">
                        {t.subject || "—"}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {linkedActions.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground/60 italic">
                              Sin vincular
                            </span>
                          ) : (
                            linkedActions.map((a) => (
                              <span
                                key={a.id}
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                                  a.is_default
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold"
                                    : "bg-muted text-muted-foreground"
                                }`}
                                title={a.action_template?.name || ""}
                              >
                                {a.action_template?.code || a.action_template?.name || "—"}
                                {a.is_default && " · default"}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        {t.is_active ? (
                          <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Sí
                          </span>
                        ) : (
                          <span className="inline-flex rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            No
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="app-row-actions">
                          {canEdit("catalogos") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="btn-icon-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/dashboard/catalogos/gestiones/email-templates/${t.id}`
                                );
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete("catalogos") && t.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="btn-icon-sm btn-danger-hover"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("¿Desactivar esta plantilla?")) {
                                  deleteMutation.mutate(t.id);
                                }
                              }}
                              title="Desactivar"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

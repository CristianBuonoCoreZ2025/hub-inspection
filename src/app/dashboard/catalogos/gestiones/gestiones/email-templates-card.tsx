"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  X,
  Star,
  Loader2,
  Search,
  FileText,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getEmailTemplates,
  type EmailTemplate,
} from "@/services/email-templates";
import {
  getEmailTemplatesForAction,
  linkTemplateToAction,
  unlinkTemplateFromAction,
  setDefaultTemplate,
} from "@/services/email-template-actions";
import { getBusinessLines } from "@/services/catalogs";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  actionTemplateId: string;
  /** Línea de negocio de la gestión (para filtrar plantillas compatibles). */
  businessLineId?: string | null;
}

/**
 * Card "Plantillas de E-mail" para la ficha de una gestión (action_template).
 * Espejo de DocumentTemplatesCard pero para e-mail.
 *
 * - Lista las plantillas vinculadas a esta acción (vía junction).
 * - Permite vincular nuevas plantillas (multi-select filtrado por línea de negocio).
 * - Permite marcar/desmarcar "por defecto" (solo una por acción+línea).
 * - Permite desvincular (NO borra la plantilla, solo la junction).
 */
export function EmailTemplatesCard({ actionTemplateId, businessLineId }: Props) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Plantillas vinculadas a esta acción
  const linkedQuery = useQuery({
    queryKey: ["email-templates-for-action", actionTemplateId, companyId],
    queryFn: () =>
      getEmailTemplatesForAction(actionTemplateId, {
        companyId: companyId!,
        businessLineId: businessLineId ?? undefined,
        includeInactive: true,
      }),
    enabled: !!companyId,
  });

  // Todas las plantillas de la empresa (para el modal de vincular)
  const allTemplatesQuery = useQuery({
    queryKey: ["email-templates", companyId, { withActions: true }],
    queryFn: () =>
      getEmailTemplates({
        companyId: companyId!,
        includeInactive: false,
        withActions: true,
      }),
    enabled: !!companyId && linkModalOpen,
  });

  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: () => getBusinessLines(),
  });

  const linkedIds = useMemo(
    () => new Set((linkedQuery.data || []).map((t) => t.id)),
    [linkedQuery.data]
  );

  // Plantillas disponibles para vincular: de la misma línea de negocio (o sin
  // restricción si la gestión no tiene línea), no vinculadas todavía, y que
  // coincidan con la búsqueda.
  const availableToLink = useMemo(() => {
    const all = allTemplatesQuery.data || [];
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (linkedIds.has(t.id)) return false;
      // Filtrar por línea de negocio compatible
      if (businessLineId && t.business_line_id !== businessLineId) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    });
  }, [allTemplatesQuery.data, linkedIds, businessLineId, search]);

  const linkMutation = useMutation({
    mutationFn: (templateId: string) =>
      linkTemplateToAction({
        email_template_id: templateId,
        action_template_id: actionTemplateId,
        is_default: (linkedQuery.data || []).length === 0, // primera vinculada → default
      }),
    onSuccess: () => {
      toast.success("Plantilla vinculada");
      queryClient.invalidateQueries({
        queryKey: ["email-templates-for-action", actionTemplateId, companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["email-templates", companyId, { withActions: true }],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: (templateId: string) =>
      unlinkTemplateFromAction(templateId, actionTemplateId),
    onSuccess: () => {
      toast.success("Plantilla desvinculada");
      queryClient.invalidateQueries({
        queryKey: ["email-templates-for-action", actionTemplateId, companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["email-templates", companyId, { withActions: true }],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (templateId: string) =>
      setDefaultTemplate(templateId, actionTemplateId),
    onSuccess: () => {
      toast.success("Plantilla marcada como por defecto");
      queryClient.invalidateQueries({
        queryKey: ["email-templates-for-action", actionTemplateId, companyId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const businessLineName = (id: string) =>
    businessLines?.find((bl) => bl.id === id)?.name || "—";

  const isDefaultTemplate = (t: EmailTemplate) =>
    (t.actions || []).some(
      (a) => a.action_template_id === actionTemplateId && a.is_default
    );

  return (
    <section className="app-panel">
      <div className="flex items-center justify-between mb-3">
        <h3 className="app-section-title">
          <Mail className="h-3.5 w-3.5" />
          Plantillas De E-mail
        </h3>
        <Button
          type="button"
          className="pg-btn-platinum"
          onClick={() => {
            setSearch("");
            setLinkModalOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Vincular
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Vinculá plantillas de e-mail a esta gestión. Una misma plantilla puede
        usarse en varias gestiones. Marcá una como <strong>por defecto</strong> para
        el auto-envío.
      </p>

      {linkedQuery.isLoading ? (
        <div className="text-center text-muted-foreground py-4 text-[11px]">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Cargando...
        </div>
      ) : !linkedQuery.data || linkedQuery.data.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 text-[11px] border border-dashed border-border rounded-lg">
          <Mail className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No hay plantillas vinculadas a esta gestión.
        </div>
      ) : (
        <div className="space-y-2">
          {linkedQuery.data.map((t) => {
            const isDefault = isDefaultTemplate(t);
            return (
              <div
                key={t.id}
                className={`rounded-lg border border-border/60 overflow-hidden transition-opacity ${
                  t.is_active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                  <Mail className="h-4 w-4 text-[#0095DA] shrink-0" />
                  <div className="flex flex-col leading-tight min-w-0 flex-1">
                    <span className="text-[11px] font-medium truncate">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground/70 truncate">
                      {businessLineName(t.business_line_id)} ·{" "}
                      {t.subject || "sin asunto"}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                      t.body_format === "html"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                    }`}
                  >
                    {t.body_format === "html" ? (
                      <Code2 className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    {t.body_format === "html" ? "HTML" : "Plano"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDefaultMutation.mutate(t.id)}
                    disabled={isDefault || setDefaultMutation.isPending}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                      isDefault
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold cursor-default"
                        : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700"
                    }`}
                    title={isDefault ? "Plantilla por defecto" : "Marcar como por defecto"}
                  >
                    <Star
                      className={`h-3 w-3 ${isDefault ? "fill-current" : ""}`}
                    />
                    {isDefault ? "Default" : "Marcar"}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="btn-icon-sm btn-danger-hover"
                    onClick={() => {
                      if (confirm("¿Desvincular esta plantilla? (no se borra)")) {
                        unlinkMutation.mutate(t.id);
                      }
                    }}
                    title="Desvincular"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: vincular plantillas existentes */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">Vincular Plantillas</DialogTitle>
          </div>
          <div className="modal-body space-y-3">
            <div className="app-grid-search-wrap w-full">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar plantilla..."
                className="liquid-search w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {businessLineId
                ? `Solo se muestran plantillas de la línea: ${businessLineName(businessLineId)}`
                : "La gestión no tiene línea de negocio; se muestran todas las plantillas activas."}
            </p>
            <div className="max-h-[320px] overflow-auto space-y-1 rounded-lg border border-border">
              {allTemplatesQuery.isLoading ? (
                <div className="text-center py-4 text-[11px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Cargando...
                </div>
              ) : availableToLink.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-muted-foreground">
                  No hay plantillas disponibles para vincular.
                </div>
              ) : (
                availableToLink.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => linkMutation.mutate(t.id)}
                    disabled={linkMutation.isPending}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 disabled:opacity-50 transition-colors border-b border-border/40 last:border-0"
                  >
                    <Mail className="h-3.5 w-3.5 text-[#0095DA] shrink-0" />
                    <div className="flex flex-col leading-tight min-w-0 flex-1">
                      <span className="text-[11px] font-medium truncate">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground/70 truncate">
                        {businessLineName(t.business_line_id)} ·{" "}
                        {t.subject || "sin asunto"}
                      </span>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="modal-footer">
            <Button
              className="pg-btn-platinum"
              onClick={() => setLinkModalOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

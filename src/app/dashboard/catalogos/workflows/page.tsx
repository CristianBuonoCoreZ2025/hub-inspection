"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  ChevronRight, ChevronDown, Plus, Trash2,
  GitBranch, Workflow, ArrowRight, X, Settings2,
  Globe, Calendar, Layers, Zap, Shield, Sparkles, Ban,
} from "lucide-react";
import {
  getWorkflowConfigs, getWorkflowSteps,
  createWorkflowConfig, deleteWorkflowConfig, setWorkflowStatus,
  createWorkflowStepWithChain, updateWorkflowStep, deleteWorkflowStep,
  getAvailableCountriesForStatus,
  getAvailableEventsForStatusAndCountry,
  getAvailableLinesForStatusCountryEvent,
  type WorkflowConfig, type WorkflowStep, type WorkflowStatus,
} from "@/services/workflow-configs";
import { getActionTemplatesByClaimStatus } from "@/services/claim-actions";
import { getClaimStatuses } from "@/services/actions";
import { getChildTemplateCodes } from "@/services/template-dependencies";

// ── Iconos por nivel del arbol ──
const STATUS_ICONS: Record<string, { icon: typeof Zap; color: string; bg: string }> = {
  created:     { icon: Sparkles,   color: "text-sky-400",    bg: "from-sky-500/20 to-sky-600/5" },
  adjustment:  { icon: Zap,        color: "text-violet-400", bg: "from-violet-500/20 to-violet-600/5" },
  dispatchment:{ icon: ArrowRight,  color: "text-amber-400",  bg: "from-amber-500/20 to-amber-600/5" },
  closed:      { icon: Shield,     color: "text-emerald-400",bg: "from-emerald-500/20 to-emerald-600/5" },
  reopened:    { icon: GitBranch,  color: "text-rose-400",   bg: "from-rose-500/20 to-rose-600/5" },
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [showAddStep, setShowAddStep] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  // Queries
  const { data: configs } = useQuery({ queryKey: ["workflow-configs"], queryFn: getWorkflowConfigs, staleTime: 30000 });
  const { data: claimStatuses } = useQuery({ queryKey: ["claim-statuses"], queryFn: getClaimStatuses, staleTime: 60000 });

  const { data: steps } = useQuery({
    queryKey: ["workflow-steps", selectedConfigId],
    queryFn: () => getWorkflowSteps(selectedConfigId!),
    enabled: !!selectedConfigId,
    staleTime: 15000,
  });

  // Mutations
  const createConfigMut = useMutation({
    mutationFn: createWorkflowConfig,
    onSuccess: (data) => {
      toast.success("Workflow creado");
      queryClient.invalidateQueries({ queryKey: ["workflow-configs"] });
      setOpenCreateModal(false);
      // Auto-expandir el nuevo
      setSelectedConfigId(data.id);
      setExpandedNodes(prev => new Set([...prev, `l-${data.id}`]));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteConfigMut = useMutation({
    mutationFn: deleteWorkflowConfig,
    onSuccess: () => { toast.success("Workflow eliminado"); queryClient.invalidateQueries({ queryKey: ["workflow-configs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkflowStatus }) => setWorkflowStatus(id, status),
    onSuccess: (_, vars) => {
      const msg = vars.status === "online" ? "Workflow puesto en línea" : vars.status === "suspended" ? "Workflow suspendido" : "Workflow en borrador";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["workflow-configs"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createStepMut = useMutation({
    mutationFn: createWorkflowStepWithChain,
    onSuccess: (steps) => {
      toast.success(steps.length > 1 ? `Gestión agregada con ${steps.length - 1} dependientes` : "Gestión agregada");
      queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] });
      setShowAddStep(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStepMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateWorkflowStep>[1] }) => updateWorkflowStep(id, input),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); },
    onError: (e: Error) => { toast.error(e.message); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); },
  });

  const deleteStepMut = useMutation({
    mutationFn: deleteWorkflowStep,
    onSuccess: () => { toast.success("Gestión quitada"); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); setSelectedStepId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Lookup para nombres
  const lookupMap = useMemo(() => {
    const m = new Map<string, { name: string; code?: string }>();
    configs?.forEach(c => {
      if (c.country) m.set(c.country.id, { name: c.country.name });
      if (c.business_line) m.set(c.business_line.id, { name: c.business_line.name });
      if (c.event) m.set(c.event.id, { name: c.event.name });
      if (c.claim_status) m.set(c.claim_status.id, { name: c.claim_status.name, code: c.claim_status.code });
    });
    claimStatuses?.forEach(s => m.set(s.id, { name: s.name, code: s.code }));
    return m;
  }, [configs, claimStatuses]);

  const getName = (id: string): string => lookupMap.get(id)?.name || "—";
  const getStatusCode = (id: string): string => lookupMap.get(id)?.code || "";

  // Agrupar configs por jerarquia: Estado > Pais > Evento > Linea
  const tree = useMemo(() => {
    const tree = new Map<string, Map<string, Map<string, Map<string, WorkflowConfig>>>>();
    for (const c of (configs || [])) {
      const sk = c.claim_status_id;
      const ck = c.country_id;
      const ek = c.event_id;
      const lk = c.business_line_id;
      if (!tree.has(sk)) tree.set(sk, new Map());
      if (!tree.get(sk)!.has(ck)) tree.get(sk)!.set(ck, new Map());
      if (!tree.get(sk)!.get(ck)!.has(ek)) tree.get(sk)!.get(ck)!.set(ek, new Map());
      tree.get(sk)!.get(ck)!.get(ek)!.set(lk, c);
    }
    return tree;
  }, [configs]);

  const toggleNode = useCallback((key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Steps agrupados por nivel
  const stepsByLevel = useMemo(() => {
    if (!steps) return new Map<number, WorkflowStep[]>();
    const map = new Map<number, WorkflowStep[]>();
    for (const s of steps) {
      if (!map.has(s.level)) map.set(s.level, []);
      map.get(s.level)!.push(s);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [steps]);

  const usedTemplateIds = useMemo(() => new Set((steps || []).map(s => s.action_template_id)), [steps]);
  const selectedStep = (steps || []).find(s => s.id === selectedStepId);
  const selectedConfig = configs?.find(c => c.id === selectedConfigId);

  const { data: availableTemplates } = useQuery({
    queryKey: ["available-templates", selectedConfig?.claim_status_id, selectedConfig?.business_line_id],
    queryFn: () => getActionTemplatesByClaimStatus(selectedConfig!.claim_status_id, selectedConfig?.business_line_id || undefined),
    enabled: !!selectedConfig && !!showAddStep,
    staleTime: 30000,
  });

  // Cargar codigos de templates que son hijos (dependientes) para ocultarlos
  const { data: childTemplateCodes } = useQuery({
    queryKey: ["child-template-codes"],
    queryFn: getChildTemplateCodes,
    staleTime: 60000,
  });

  const availableToAdd = useMemo(() => {
    const childCodes = childTemplateCodes || new Set<string>();
    return (availableTemplates || [])
      .filter(t => !usedTemplateIds.has(t.id))
      .filter(t => !childCodes.has(t.code || "")) // Ocultar templates que son dependientes
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [availableTemplates, usedTemplateIds, childTemplateCodes]);

  // Auto-expandir primer estado
  useEffect(() => {
    if (configs && configs.length > 0 && expandedNodes.size === 0) {
      const firstStatus = configs[0].claim_status_id;
      setExpandedNodes(new Set([`s-${firstStatus}`]));
    }
  }, [configs, expandedNodes.size]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/5
                      bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                      shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]
                      px-5 py-4">
        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl
                          bg-linear-to-br from-violet-500/20 to-sky-500/20 backdrop-blur-sm
                          border border-white/10">
            <Workflow className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Workflows</h1>
            <p className="text-[11px] text-muted-foreground">Configuración del flujo automático de gestiones</p>
          </div>
          <div className="flex-1" />
          {canCreate("catalogos") && (
            <button
              onClick={() => setOpenCreateModal(true)}
              className="group flex items-center gap-2 rounded-lg px-3 h-8
                         bg-linear-to-r from-violet-500/80 to-sky-500/80 hover:from-violet-500 hover:to-sky-500
                         text-white text-[12px] font-medium shadow-lg shadow-violet-500/20
                         transition-all duration-200 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 transition-transform group-hover:rotate-90 duration-200" />
              Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Arbol colapsable */}
        <div className="flex-1 relative overflow-auto rounded-2xl border border-white/10 dark:border-white/5
                        bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                        shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]
                        p-4">
          {configs && configs.length === 0 ? (
            <EmptyState onCreate={() => setOpenCreateModal(true)} canCreate={canCreate("catalogos")} />
          ) : !configs ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
            </div>
          ) : (
            <div className="text-[12px] space-y-0.5">
              {Array.from(tree.entries()).map(([statusId, countriesMap]) => {
                const statusCode = getStatusCode(statusId);
                const statusMeta = STATUS_ICONS[statusCode] || STATUS_ICONS["adjustment"];
                const StatusIcon = statusMeta.icon;
                const isExp = expandedNodes.has(`s-${statusId}`);

                return (
                  <div key={statusId}>
                    <GlassTreeNode
                      isExpanded={isExp}
                      onToggle={() => toggleNode(`s-${statusId}`)}
                      icon={<StatusIcon className={`h-4 w-4 ${statusMeta.color}`} />}
                      label={getName(statusId)}
                      bold
                      gradient={statusMeta.bg}
                      count={countriesMap.size}
                    />
                    {isExp && (
                      <div className="ml-3 border-l border-white/5 pl-3 mt-0.5 space-y-0.5">
                        {Array.from(countriesMap.entries()).map(([countryId, eventsMap]) => {
                          const cExp = expandedNodes.has(`c-${statusId}-${countryId}`);
                          return (
                            <div key={countryId}>
                              <GlassTreeNode
                                isExpanded={cExp}
                                onToggle={() => toggleNode(`c-${statusId}-${countryId}`)}
                                icon={<Globe className="h-3.5 w-3.5 text-amber-400/80" />}
                                label={getName(countryId)}
                                count={eventsMap.size}
                              />
                              {cExp && (
                                <div className="ml-3 border-l border-white/5 pl-3 mt-0.5 space-y-0.5">
                                  {Array.from(eventsMap.entries()).map(([eventId, linesMap]) => {
                                    const eExp = expandedNodes.has(`e-${statusId}-${countryId}-${eventId}`);
                                    return (
                                      <div key={eventId}>
                                        <GlassTreeNode
                                          isExpanded={eExp}
                                          onToggle={() => toggleNode(`e-${statusId}-${countryId}-${eventId}`)}
                                          icon={<Calendar className="h-3.5 w-3.5 text-rose-400/80" />}
                                          label={getName(eventId)}
                                          count={linesMap.size}
                                        />
                                        {eExp && (
                                          <div className="ml-3 border-l border-white/5 pl-3 mt-0.5 space-y-0.5">
                                            {Array.from(linesMap.entries()).map(([lineId, config]) => {
                                              const lExp = expandedNodes.has(`l-${config.id}`);
                                              const isSelected = selectedConfigId === config.id;
                                              const isOnline = config.status === "online";
                                              const statusBadge = config.status === "online"
                                                ? { label: "Online", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
                                                : config.status === "suspended"
                                                ? { label: "Suspendido", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
                                                : { label: "Borrador", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
                                              return (
                                                <div key={lineId}>
                                                  <GlassTreeNode
                                                    isExpanded={lExp}
                                                    onToggle={() => { toggleNode(`l-${config.id}`); setSelectedConfigId(config.id); }}
                                                    icon={<Layers className="h-3.5 w-3.5 text-emerald-400/80" />}
                                                    label={getName(lineId)}
                                                    bold
                                                    active={isSelected}
                                                    count={selectedConfigId === config.id ? (steps?.length || 0) : undefined}
                                                    actions={
                                                      <div className="flex items-center gap-1.5">
                                                        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}>
                                                          {statusBadge.label}
                                                        </span>
                                                        {/* Botones de status */}
                                                        {config.status === "draft" && canEdit("catalogos") && (
                                                          <button
                                                            className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
                                                            title="Poner en línea"
                                                            onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: config.id, status: "online" }); }}
                                                          >
                                                            <Shield className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                        {config.status === "online" && canEdit("catalogos") && (
                                                          <button
                                                            className="text-amber-400/70 hover:text-amber-400 transition-colors"
                                                            title="Suspender"
                                                            onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: config.id, status: "suspended" }); }}
                                                          >
                                                            <Ban className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                        {config.status === "suspended" && canEdit("catalogos") && (
                                                          <button
                                                            className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
                                                            title="Poner en línea"
                                                            onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: config.id, status: "online" }); }}
                                                          >
                                                            <Shield className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                        {/* Eliminar solo si no esta online */}
                                                        {canDelete("catalogos") && !isOnline && (
                                                          <button
                                                            className="text-muted-foreground/60 hover:text-rose-400 transition-colors"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              if (confirm("¿Eliminar este workflow completo?")) deleteConfigMut.mutate(config.id);
                                                            }}
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    }
                                                  />
                                                  {lExp && selectedConfigId === config.id && (
                                                    <div className="ml-2 mt-2 mb-3">
                                                      {isOnline && (
                                                        <div className="mb-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400/80 flex items-center gap-1.5">
                                                          <Shield className="h-3 w-3" />
                                                          Workflow en línea — no editable. Suspender para modificar.
                                                        </div>
                                                      )}
                                                      <StepsCanvas
                                                        stepsByLevel={stepsByLevel}
                                                        selectedStepId={selectedStepId}
                                                        hoveredStep={hoveredStep}
                                                        onSelectStep={setSelectedStepId}
                                                        onHoverStep={setHoveredStep}
                                                        canEdit={canEdit("catalogos") && !isOnline}
                                                        onAddStep={() => !isOnline && setShowAddStep(config.id)}
                                                        isLoading={!steps}
                                                        steps={steps || []}
                                                      />
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel lateral: configuracion del step */}
        {selectedStep && (
          <div className="w-[280px] shrink-0 relative overflow-auto rounded-2xl border border-white/10 dark:border-white/5
                          bg-white/5 dark:bg-white/[0.02] backdrop-blur-xl
                          shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]
                          p-4">
            <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <GitBranch className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <span className="font-mono text-[13px] font-semibold">{selectedStep.action_template?.code}</span>
                </div>
                <button
                  onClick={() => setSelectedStepId(null)}
                  className="text-muted-foreground/60 hover:text-foreground transition-colors rounded-md p-1 hover:bg-white/5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground mb-4">{selectedStep.action_template?.name}</p>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1
                                bg-sky-500/10 border border-sky-500/20">
                  <span className="text-[10px] text-muted-foreground">Nivel</span>
                  <span className="text-[12px] font-mono font-bold text-sky-400">{selectedStep.level}</span>
                </div>
                {selectedStep.depends_on_template && (
                  <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1
                                  bg-violet-500/10 border border-violet-500/20">
                    <ArrowRight className="h-2.5 w-2.5 text-violet-400" />
                    <span className="text-[10px] text-muted-foreground">desde</span>
                    <span className="text-[12px] font-mono font-bold text-violet-400">{selectedStep.depends_on_template?.code}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <GlassToggle
                  active={selectedStep.is_automatic}
                  onClick={(v) => updateStepMut.mutate({ id: selectedStep.id, input: { is_automatic: v } })}
                  label="Automática"
                  description="Se crea solo al cumplirse la dependencia"
                  activeColor="emerald"
                />
                <GlassToggle
                  active={selectedStep.is_required}
                  onClick={(v) => updateStepMut.mutate({ id: selectedStep.id, input: { is_required: v } })}
                  label="Obligatoria"
                  description="Se recrea si se rechaza"
                  activeColor="rose"
                />
              </div>

              {canDelete("catalogos") && (
                <button
                  className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg
                             px-3 h-8 text-[12px] font-medium
                             bg-rose-500/10 hover:bg-rose-500/20
                             border border-rose-500/20 text-rose-400
                             transition-all duration-200 active:scale-95"
                  onClick={() => { if (confirm("¿Quitar esta gestión del workflow?")) deleteStepMut.mutate(selectedStep.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                  Quitar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: crear workflow con cascading dropdowns */}
      <CreateWorkflowModal
        open={openCreateModal}
        claimStatuses={claimStatuses || []}
        onSubmit={(data) => createConfigMut.mutate(data)}
        onClose={() => setOpenCreateModal(false)}
        existingCombos={configs || []}
      />

      {/* Modal: agregar step */}
      <Dialog open={!!showAddStep} onOpenChange={(v) => !v && setShowAddStep(null)}>
        <DialogContent className="modal-sm !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border-white/20 dark:!border-white/10 !shadow-2xl">
          <div className="modal-header">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/20 to-sky-500/20 border border-white/10">
              <Plus className="h-4 w-4 text-violet-400" />
            </div>
            Agregar Gestión
          </div>
          <div className="modal-body space-y-1.5">
            {availableToAdd.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6">
                No hay gestiones disponibles.
                <br />
                Todas las gestiones de este estado y línea ya están en el workflow.
              </p>
            ) : (
              availableToAdd.map(t => {
                return (
                  <button
                    key={t.id}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
                               bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10
                               border border-white/10 hover:border-violet-500/30
                               text-left transition-all duration-200 active:scale-[0.98]
                               group"
                    onClick={() => {
                      createStepMut.mutate({
                        workflow_config_id: showAddStep!,
                        action_template_id: t.id,
                        level: 1,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20
                                      group-hover:scale-110 transition-transform">
                        <span className="font-mono text-[10px] font-bold text-violet-400">{(t.code || "?").slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="font-mono text-[12px] font-semibold">{t.code}</div>
                        <div className="text-[10px] text-muted-foreground">{t.name}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Modal: crear workflow con cascading dropdowns
// ═══════════════════════════════════════════════════════════════════

function CreateWorkflowModal({
  open, claimStatuses, onSubmit, onClose, existingCombos,
}: {
  open: boolean;
  claimStatuses: { id: string; code: string; name: string }[];
  onSubmit: (data: { country_id: string; business_line_id: string; event_id: string; claim_status_id: string }) => void;
  onClose: () => void;
  existingCombos: WorkflowConfig[];
}) {
  const [statusId, setStatusId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [eventId, setEventId] = useState("");
  const [lineId, setLineId] = useState("");

  useEffect(() => {
    if (open) {
      setStatusId("");
      setCountryId("");
      setEventId("");
      setLineId("");
    }
  }, [open]);

  // Cascading queries
  const { data: countries } = useQuery({
    queryKey: ["wf-countries", statusId],
    queryFn: () => getAvailableCountriesForStatus(statusId),
    enabled: !!statusId,
    staleTime: 60000,
  });

  const { data: events } = useQuery({
    queryKey: ["wf-events", statusId, countryId],
    queryFn: () => getAvailableEventsForStatusAndCountry(statusId, countryId),
    enabled: !!statusId && !!countryId,
    staleTime: 60000,
  });

  const { data: lines } = useQuery({
    queryKey: ["wf-lines", statusId, countryId, eventId],
    queryFn: () => getAvailableLinesForStatusCountryEvent(statusId, countryId, eventId),
    enabled: !!statusId && !!countryId && !!eventId,
    staleTime: 60000,
  });

  // Verificar si la combinacion ya existe
  const alreadyExists = useMemo(() => {
    if (!statusId || !countryId || !eventId || !lineId) return false;
    return existingCombos.some(c =>
      c.claim_status_id === statusId &&
      c.country_id === countryId &&
      c.event_id === eventId &&
      c.business_line_id === lineId
    );
  }, [statusId, countryId, eventId, lineId, existingCombos]);

  const canSubmit = statusId && countryId && eventId && lineId && !alreadyExists;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="modal-sm !bg-white/80 dark:!bg-zinc-900/80 !backdrop-blur-xl !border-white/20 dark:!border-white/10 !shadow-2xl">
        <div className="modal-header">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-violet-500/20 to-sky-500/20 border border-white/10">
            <Workflow className="h-4 w-4 text-violet-400" />
          </div>
          Nuevo Workflow
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit({ country_id: countryId, business_line_id: lineId, event_id: eventId, claim_status_id: statusId });
        }}>
          <div className="modal-body space-y-3">
            {/* Paso 1: Estado */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[9px] font-bold">1</span>
                Estado
              </Label>
              <select
                className="app-input w-full"
                value={statusId}
                onChange={(e) => { setStatusId(e.target.value); setCountryId(""); setEventId(""); setLineId(""); }}
                required
              >
                <option value="">Seleccionar estado...</option>
                {claimStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Paso 2: Pais */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${countryId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>2</span>
                País
              </Label>
              <select
                className="app-input w-full disabled:opacity-40"
                value={countryId}
                onChange={(e) => { setCountryId(e.target.value); setEventId(""); setLineId(""); }}
                disabled={!statusId || !countries}
                required
              >
                <option value="">{!statusId ? "Primero selecciona estado..." : !countries ? "Cargando..." : "Seleccionar país..."}</option>
                {countries?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Paso 3: Evento */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${eventId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>3</span>
                Evento
              </Label>
              <select
                className="app-input w-full disabled:opacity-40"
                value={eventId}
                onChange={(e) => { setEventId(e.target.value); setLineId(""); }}
                disabled={!countryId || !events}
                required
              >
                <option value="">{!countryId ? "Primero selecciona país..." : !events ? "Cargando..." : "Seleccionar evento..."}</option>
                {events?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* Paso 4: Linea */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${lineId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>4</span>
                Línea de Negocio
              </Label>
              <select
                className="app-input w-full disabled:opacity-40"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                disabled={!eventId || !lines}
                required
              >
                <option value="">{!eventId ? "Primero selecciona evento..." : !lines ? "Cargando..." : "Seleccionar línea..."}</option>
                {lines?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {/* Warning: ya existe */}
            {alreadyExists && (
              <div className="rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
                Ya existe un workflow para esta combinación. No se pueden crear workflows duplicados.
              </div>
            )}
          </div>
          <div className="modal-footer">
            <Button type="button" className="btn-cancel btn-footer" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="btn-save btn-footer" disabled={!canSubmit}>Crear</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: Nodo del arbol con glassmorphism
// ═══════════════════════════════════════════════════════════════════

function GlassTreeNode({
  isExpanded, onToggle, icon, label, bold, active, count, actions, gradient,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  bold?: boolean;
  active?: boolean;
  count?: number;
  actions?: React.ReactNode;
  gradient?: string;
}) {
  return (
    <div
      className={`group relative flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer
                  transition-all duration-150
                  ${active
                    ? "bg-violet-500/10 border border-violet-500/20"
                    : "hover:bg-white/5 dark:hover:bg-white/5 border border-transparent"
                  }
                  ${gradient ? `bg-linear-to-r ${gradient}` : ""}`}
      onClick={onToggle}
    >
      <span className="shrink-0 text-muted-foreground/60 transition-transform duration-150
                       group-hover:text-muted-foreground">
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </span>
      <span className="shrink-0">{icon}</span>
      <span className={`truncate text-[12px] ${bold ? "font-semibold" : "font-normal"}`}>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1
                         text-[9px] font-medium bg-white/10 dark:bg-white/10 text-muted-foreground">
          {count}
        </span>
      )}
      {actions && (
        <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">{actions}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: Canvas de steps por nivel
// ═══════════════════════════════════════════════════════════════════

function StepsCanvas({
  stepsByLevel, selectedStepId, hoveredStep,
  onSelectStep, onHoverStep, canEdit, onAddStep, isLoading, steps,
}: {
  stepsByLevel: Map<number, WorkflowStep[]>;
  selectedStepId: string | null;
  hoveredStep: string | null;
  onSelectStep: (id: string) => void;
  onHoverStep: (id: string | null) => void;
  canEdit: boolean;
  onAddStep: () => void;
  isLoading: boolean;
  steps: WorkflowStep[];
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 dark:border-white/5 p-4 text-center">
        <p className="text-[11px] text-muted-foreground italic mb-2">Sin gestiones configuradas</p>
        {canEdit && (
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-7
                       bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20
                       text-violet-400 text-[11px] font-medium transition-all active:scale-95"
            onClick={onAddStep}
          >
            <Plus className="h-3 w-3" />
            Agregar
          </button>
        )}
      </div>
    );
  }

  const levels = Array.from(stepsByLevel.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-1">
      {levels.map(([level, levelSteps], idx) => (
        <div key={level}>
          <div className="flex items-center gap-2 mb-1.5 mt-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Nivel {level}
            </span>
            <span className="text-[9px] text-muted-foreground/40">
              {level === 1 ? "al entrar al estado" : "dependientes"}
            </span>
            <div className="flex-1 h-px bg-white/5 dark:bg-white/5" />
          </div>

          <div className="flex flex-wrap gap-2">
            {levelSteps.map(step => (
              <StepCard
                key={step.id}
                step={step}
                selected={selectedStepId === step.id}
                hovered={hoveredStep === step.id}
                onClick={() => onSelectStep(step.id)}
                onHover={() => onHoverStep(step.id)}
                onLeave={() => onHoverStep(null)}
              />
            ))}
          </div>

          {idx < levels.length - 1 && (
            <div className="flex justify-center my-1.5">
              <div className="flex flex-col items-center gap-0.5">
                <div className="h-3 w-px bg-linear-to-b from-violet-500/40 to-transparent" />
                <ArrowRight className="h-2.5 w-2.5 text-violet-500/40 rotate-90" />
                <div className="h-3 w-px bg-linear-to-b from-transparent to-violet-500/40" />
              </div>
            </div>
          )}
        </div>
      ))}

      {canEdit && (
        <button
          className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 h-7
                     bg-transparent hover:bg-violet-500/10 border border-dashed border-white/10 hover:border-violet-500/30
                     text-muted-foreground hover:text-violet-400 text-[11px] font-medium
                     transition-all active:scale-95"
          onClick={onAddStep}
        >
          <Plus className="h-3 w-3" />
          Agregar gestión
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: Card de step
// ═══════════════════════════════════════════════════════════════════

function StepCard({
  step, selected, hovered, onClick, onHover, onLeave,
}: {
  step: WorkflowStep;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl cursor-pointer
                  transition-all duration-200 active:scale-95
                  ${selected
                    ? "bg-violet-500/15 border border-violet-500/40 shadow-lg shadow-violet-500/10"
                    : hovered
                    ? "bg-white/10 dark:bg-white/10 border border-white/20 dark:border-white/10"
                    : "bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 hover:bg-white/8 dark:hover:bg-white/8"
                  }`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className="font-mono text-[11px] font-bold tracking-tight">{step.action_template?.code}</span>

      <div className="flex items-center gap-1">
        {step.is_automatic && (
          <span className="flex items-center gap-0.5 rounded px-1 py-0.5
                           bg-emerald-500/10 text-emerald-400 text-[8px] font-medium">
            <Zap className="h-2 w-2" />
            Auto
          </span>
        )}
        {step.is_required && (
          <span className="flex items-center gap-0.5 rounded px-1 py-0.5
                           bg-rose-500/10 text-rose-400 text-[8px] font-medium">
            <Shield className="h-2 w-2" />
            Req
          </span>
        )}
      </div>

      {step.depends_on_template && (
        <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground/60">
          <ArrowRight className="h-2 w-2" />
          {step.depends_on_template?.code}
        </span>
      )}

      {selected && (
        <div className="pointer-events-none absolute -inset-px rounded-xl bg-violet-500/5 blur-sm -z-10" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: Toggle glassmorphism
// ═══════════════════════════════════════════════════════════════════

function GlassToggle({
  active, onClick, label, description, activeColor,
}: {
  active: boolean;
  onClick: (v: boolean) => void;
  label: string;
  description: string;
  activeColor: "emerald" | "rose";
}) {
  const colors = {
    emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
    rose: { bg: "bg-rose-500/15", border: "border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
  };
  const c = colors[activeColor];

  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 active:scale-[0.98]
                  ${active
                    ? `${c.bg} ${c.border}`
                    : "bg-white/5 dark:bg-white/5 border-white/10 dark:border-white/5 hover:bg-white/8 dark:hover:bg-white/8"
                  }`}
      onClick={() => onClick(!active)}
    >
      <div className={`flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200
                       ${active ? `${c.bg} ${c.border}` : "bg-white/5 border border-white/10"}`}>
        <div className={`h-2 w-2 rounded-full transition-all duration-200 ${active ? c.dot : "bg-muted-foreground/30"}`} />
      </div>
      <div className="text-left flex-1">
        <div className={`text-[12px] font-medium ${active ? c.text : ""}`}>{label}</div>
        <div className="text-[9px] text-muted-foreground/60">{description}</div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Empty state
// ═══════════════════════════════════════════════════════════════════

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-violet-500/10 blur-2xl rounded-full" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl
                        bg-linear-to-br from-violet-500/10 to-sky-500/10 border border-white/10">
          <Workflow className="h-7 w-7 text-violet-400/60" />
        </div>
      </div>
      <p className="text-[13px] font-medium mb-1">No hay workflows configurados</p>
      <p className="text-[11px] text-muted-foreground mb-4 text-center max-w-xs">
        Crea un workflow para definir qué gestiones se generan automáticamente
        cuando un siniestro entra a un estado específico.
      </p>
      {canCreate && (
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-lg px-4 h-8
                     bg-linear-to-r from-violet-500/80 to-sky-500/80 hover:from-violet-500 hover:to-sky-500
                     text-white text-[12px] font-medium shadow-lg shadow-violet-500/20
                     transition-all active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Crear primer workflow
        </button>
      )}
    </div>
  );
}

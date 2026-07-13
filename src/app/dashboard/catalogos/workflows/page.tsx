"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, type DragStartEvent, type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  useSortable, SortableContext, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  GitBranch, Workflow, ArrowRight, X, Settings2,
  Globe, Calendar, Zap, Shield, Sparkles, Ban, Pencil,
} from "lucide-react";
import {
  getWorkflowConfigs, getWorkflowSteps,
  createWorkflowConfig, deleteWorkflowConfig, setWorkflowStatus,
  createWorkflowStepWithChain, updateWorkflowStep, deleteWorkflowStep,
  reorderWorkflowSteps,
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

// ═══ Collision detection custom ═══
// Cuando arrastramos un nodo del arbol, solo considerar hermanos (mismo nivel + mismo padre)
// como drop targets para reordenar. Para palette, usar closestCenter normal.
function createWorkflowCollisionDetection(steps: WorkflowStep[]): CollisionDetection {
  return (args) => {
    const activeId = args.active.id as string;
    const activeData = args.active.data.current;

    // Si es un item de paleta, usar closestCenter normal (considera canvas + nodos)
    if (activeData?.source === "palette") {
      return closestCenter(args);
    }

    // Si es un nodo del arbol, filtrar droppables a solo hermanos + canvas-root
    const activeStep = steps.find(s => s.id === activeId);
    if (!activeStep) return closestCenter(args);

    const siblingIds = new Set(
      steps
        .filter(s =>
          s.level === activeStep.level &&
          (s.depends_on_template_id || null) === (activeStep.depends_on_template_id || null)
        )
        .map(s => s.id)
    );

    const filteredContainers = args.droppableContainers.filter(
      c => siblingIds.has(c.id as string) || c.id === "canvas-root"
    );

    return closestCenter({
      ...args,
      droppableContainers: filteredContainers,
    });
  };
}

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [addDependentParent, setAddDependentParent] = useState<WorkflowStep | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ id: string; type: "palette" | "node"; label: string; code: string } | null>(null);

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
      setAddDependentParent(null);
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

  const reorderMut = useMutation({
    mutationFn: reorderWorkflowSteps,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); },
    onError: (e: Error) => { toast.error(e.message); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); },
  });

  // Sensores DnD
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Collision detection: solo hermanos para reorder, closestCenter para palette
  const workflowCollisionDetection = useMemo(
    () => createWorkflowCollisionDetection(steps || []),
    [steps],
  );

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

  const usedTemplateIds = useMemo(() => new Set((steps || []).map(s => s.action_template_id)), [steps]);
  const selectedStep = (steps || []).find(s => s.id === selectedStepId);
  const selectedConfig = configs?.find(c => c.id === selectedConfigId);

  const { data: availableTemplates } = useQuery({
    queryKey: ["available-templates", selectedConfig?.claim_status_id, selectedConfig?.business_line_id],
    queryFn: () => getActionTemplatesByClaimStatus(selectedConfig!.claim_status_id, selectedConfig?.business_line_id || undefined),
    enabled: !!selectedConfig,
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

  // ═══ DnD Handlers ═══
  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.source === "palette") {
      setActiveDrag({ id: e.active.id as string, type: "palette", label: data.label, code: data.code });
    } else if (data?.source === "node") {
      const step = (steps || []).find(s => s.id === e.active.id);
      if (step) setActiveDrag({ id: e.active.id as string, type: "node", label: step.action_template?.code || "", code: step.action_template?.code || "" });
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over || !selectedConfigId) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Drop desde paleta → agregar al workflow
    if (activeData?.source === "palette") {
      const templateId = activeData.templateId as string;
      const overStepId = overData?.stepId as string | undefined;

      if (overStepId) {
        // Drop sobre un step existente → crear como dependiente
        const parentStep = (steps || []).find(s => s.id === overStepId);
        if (parentStep) {
          createStepMut.mutate({
            workflow_config_id: selectedConfigId,
            action_template_id: templateId,
            level: parentStep.level + 1,
            depends_on_template_id: parentStep.action_template_id,
          });
          return;
        }
      }
      // Drop en el canvas (no sobre un step) → crear como raíz
      // over.id puede ser "canvas-root" o un step id
      createStepMut.mutate({
        workflow_config_id: selectedConfigId,
        action_template_id: templateId,
        level: 1,
      });
      return;
    }

    // Reorder dentro del árbol — usar sortable
    if (activeData?.source === "node") {
      const activeStep = (steps || []).find(s => s.id === active.id);
      if (!activeStep) return;

      // Con useSortable, over.id es directamente el step id
      const overStep = (steps || []).find(s => s.id === over.id);
      if (!overStep) return;
      if (activeStep.id === overStep.id) return;

      // Solo reordenar si están en el mismo nivel y mismo padre
      const sameLevel = activeStep.level === overStep.level;
      const sameParent = (activeStep.depends_on_template_id || null) === (overStep.depends_on_template_id || null);
      if (!sameLevel || !sameParent) return;

      // Reordenar por sort_order
      const siblings = (steps || [])
        .filter(s => s.level === activeStep.level && (s.depends_on_template_id || null) === (activeStep.depends_on_template_id || null))
        .sort((a, b) => a.sort_order - b.sort_order);

      const oldIdx = siblings.findIndex(s => s.id === activeStep.id);
      const newIdx = siblings.findIndex(s => s.id === overStep.id);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

      // Recalcular sort_order
      const reordered = [...siblings];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      reorderMut.mutate(reordered.map((s, i) => ({ id: s.id, sort_order: i })));
    }
  };

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
                      bg-white/5 dark:bg-white/2 backdrop-blur-xl
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
                        bg-white/5 dark:bg-white/2 backdrop-blur-xl
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
                                              const isSuspended = config.status === "suspended";
                                              const isDraft = config.status === "draft";

                                              // Icono y estilo segun status
                                              const statusIcon = isOnline
                                                ? <Shield className="h-3.5 w-3.5 text-emerald-400" />
                                                : isSuspended
                                                ? <Ban className="h-3.5 w-3.5 text-amber-400" />
                                                : <Pencil className="h-3.5 w-3.5 text-zinc-500" />;

                                              // Opacidad del nodo: online = brillante, draft/suspended = apagado
                                              const nodeOpacity = isOnline ? "opacity-100" : "opacity-60";

                                              const statusBadge = isOnline
                                                ? { label: "Online", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
                                                : isSuspended
                                                ? { label: "Suspendido", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
                                                : { label: "Borrador", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
                                              return (
                                                <div key={lineId}>
                                                  <div className={nodeOpacity}>
                                                  <GlassTreeNode
                                                    isExpanded={lExp}
                                                    onToggle={() => { toggleNode(`l-${config.id}`); setSelectedConfigId(config.id); }}
                                                    icon={statusIcon}
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
                                                        {isDraft && canEdit("catalogos") && (
                                                          <button
                                                            className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
                                                            title="Poner en línea"
                                                            onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: config.id, status: "online" }); }}
                                                          >
                                                            <Shield className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                        {isOnline && canEdit("catalogos") && (
                                                          <button
                                                            className="text-amber-400/70 hover:text-amber-400 transition-colors"
                                                            title="Suspender"
                                                            onClick={(e) => { e.stopPropagation(); statusMut.mutate({ id: config.id, status: "suspended" }); }}
                                                          >
                                                            <Ban className="h-3 w-3" />
                                                          </button>
                                                        )}
                                                        {isSuspended && canEdit("catalogos") && (
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
                                                  </div>
                                                  {lExp && selectedConfigId === config.id && (
                                                    <div className="ml-2 mt-2 mb-3">
                                                      {isOnline ? (
                                                        <div className="mb-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-400/80 flex items-center gap-1.5">
                                                          <Shield className="h-3 w-3" />
                                                          Workflow en línea — no editable. Suspender para modificar.
                                                        </div>
                                                      ) : (
                                                        <div className="mb-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 text-[11px] text-amber-400 flex items-center gap-1.5 animate-pulse">
                                                          <Settings2 className="h-3 w-3" />
                                                          Modo edición — arrastra las gestiones de abajo al flujo
                                                        </div>
                                                      )}
                                                      <DndContext
                                                        sensors={dndSensors}
                                                        collisionDetection={workflowCollisionDetection}
                                                        onDragStart={onDragStart}
                                                        onDragEnd={onDragEnd}
                                                      >
                                                      <StepsCanvas
                                                        selectedStepId={selectedStepId}
                                                        hoveredStep={hoveredStep}
                                                        onSelectStep={setSelectedStepId}
                                                        onHoverStep={setHoveredStep}
                                                        canEdit={canEdit("catalogos") && !isOnline}
                                                        onAddDependent={(parent) => { setAddDependentParent(parent); }}
                                                        isLoading={!steps}
                                                        steps={steps || []}
                                                        isPaletteDrag={activeDrag?.type === "palette"}
                                                        businessLineName={config.business_line?.name}
                                                      />
                                                      {/* Paleta de gestiones disponibles — DRAGGABLE (solo si no esta online) */}
                                                      {!isOnline && canEdit("catalogos") && (
                                                        <div className="mt-2 rounded-xl border border-dashed border-white/10 dark:border-white/5
                                                                        bg-white/2 backdrop-blur-sm p-2">
                                                          <div className="flex items-center gap-1.5 mb-1.5 px-1">
                                                            <GripVertical className="h-3 w-3 text-violet-400" />
                                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                              Gestiones disponibles
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground/50">
                                                              arrastrar al flujo
                                                            </span>
                                                          </div>
                                                          {availableToAdd.length === 0 ? (
                                                            <p className="text-[10px] text-muted-foreground/60 italic px-1 py-1">
                                                              No hay gestiones disponibles para este estado y línea.
                                                            </p>
                                                          ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                              {availableToAdd.map(t => (
                                                                <DraggablePaletteItem
                                                                  key={t.id}
                                                                  templateId={t.id}
                                                                  code={t.code || "?"}
                                                                  name={t.name}
                                                                />
                                                              ))}
                                                            </div>
                                                          )}
                                                          {addDependentParent && (
                                                            <div className="mt-1.5 flex items-center gap-2 px-1">
                                                              <span className="text-[9px] text-sky-400">
                                                                Agregando como dependiente de: <strong>{addDependentParent.action_template?.code}</strong>
                                                              </span>
                                                              <button
                                                                className="text-[9px] text-muted-foreground hover:text-rose-400 transition-colors"
                                                                onClick={() => setAddDependentParent(null)}
                                                              >
                                                                cancelar
                                                              </button>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      {/* Drag overlay */}
                                                      <DragOverlay>
                                                        {activeDrag ? (
                                                          <div className="flex items-center gap-2 rounded-lg border border-violet-500/40
                                                                          bg-card/80 backdrop-blur-xl px-3 py-1.5
                                                                          shadow-[0_8px_30px_rgba(139,92,246,0.2)]">
                                                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/20 border border-violet-500/30">
                                                              <span className="font-mono text-[8px] font-bold text-violet-400">
                                                                {activeDrag.code.slice(0, 2)}
                                                              </span>
                                                            </div>
                                                            <span className="font-mono text-[10px] font-semibold">{activeDrag.label}</span>
                                                          </div>
                                                        ) : null}
                                                      </DragOverlay>
                                                      </DndContext>
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
                          bg-white/5 dark:bg-white/2 backdrop-blur-xl
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
              <Select
                value={statusId || "__none"}
                onValueChange={(v) => {
                  const val = !v || v === "__none" ? "" : v;
                  setStatusId(val); setCountryId(""); setEventId(""); setLineId("");
                }}
                items={[
                  { value: "__none", label: "Seleccionar estado..." },
                  ...claimStatuses.map(s => ({ value: s.id, label: s.name })),
                ]}
                required
              >
                <SelectTrigger className="app-input h-7">
                  <SelectValue placeholder="Seleccionar estado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Seleccionar estado...</SelectItem>
                  {claimStatuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Paso 2: Pais */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${countryId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>2</span>
                País
              </Label>
              <Select
                value={countryId || "__none"}
                onValueChange={(v) => {
                  const val = !v || v === "__none" ? "" : v;
                  setCountryId(val); setEventId(""); setLineId("");
                }}
                items={[
                  { value: "__none", label: !statusId ? "Primero selecciona estado..." : !countries ? "Cargando..." : "Seleccionar país..." },
                  ...(countries?.map(c => ({ value: c.id, label: c.name })) || []),
                ]}
                disabled={!statusId || !countries}
                required
              >
                <SelectTrigger className="app-input h-7">
                  <SelectValue placeholder={!statusId ? "Primero selecciona estado..." : !countries ? "Cargando..." : "Seleccionar país..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{!statusId ? "Primero selecciona estado..." : !countries ? "Cargando..." : "Seleccionar país..."}</SelectItem>
                  {countries?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Paso 3: Evento */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${eventId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>3</span>
                Evento
              </Label>
              <Select
                value={eventId || "__none"}
                onValueChange={(v) => {
                  const val = !v || v === "__none" ? "" : v;
                  setEventId(val); setLineId("");
                }}
                items={[
                  { value: "__none", label: !countryId ? "Primero selecciona país..." : !events ? "Cargando..." : "Seleccionar evento..." },
                  ...(events?.map(e => ({ value: e.id, label: e.name })) || []),
                ]}
                disabled={!countryId || !events}
                required
              >
                <SelectTrigger className="app-input h-7">
                  <SelectValue placeholder={!countryId ? "Primero selecciona país..." : !events ? "Cargando..." : "Seleccionar evento..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{!countryId ? "Primero selecciona país..." : !events ? "Cargando..." : "Seleccionar evento..."}</SelectItem>
                  {events?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Paso 4: Linea */}
            <div>
              <Label className="app-field-label flex items-center gap-1.5">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${lineId ? "bg-violet-500/20 text-violet-400" : "bg-muted text-muted-foreground"}`}>4</span>
                Línea de Negocio
              </Label>
              <Select
                value={lineId || "__none"}
                onValueChange={(v) => {
                  const val = !v || v === "__none" ? "" : v;
                  setLineId(val);
                }}
                items={[
                  { value: "__none", label: !eventId ? "Primero selecciona evento..." : !lines ? "Cargando..." : "Seleccionar línea..." },
                  ...(lines?.map(l => ({ value: l.id, label: l.name })) || []),
                ]}
                disabled={!eventId || !lines}
                required
              >
                <SelectTrigger className="app-input h-7">
                  <SelectValue placeholder={!eventId ? "Primero selecciona evento..." : !lines ? "Cargando..." : "Seleccionar línea..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{!eventId ? "Primero selecciona evento..." : !lines ? "Cargando..." : "Seleccionar línea..."}</SelectItem>
                  {lines?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
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

// ═══════════════════════════════════════════════════════════════════
// Componente: StepsCanvas (diagrama de flujo con glassmorphism)
// Muestra los steps como un arbol visual con flechas de dependencia
// ═══════════════════════════════════════════════════════════════════

function StepsCanvas({
  selectedStepId, hoveredStep,
  onSelectStep, onHoverStep, canEdit, onAddDependent, isLoading, steps,
  isPaletteDrag, businessLineName,
}: {
  selectedStepId: string | null;
  hoveredStep: string | null;
  onSelectStep: (id: string) => void;
  onHoverStep: (id: string | null) => void;
  canEdit: boolean;
  onAddDependent: (parentStep: WorkflowStep) => void;
  isLoading: boolean;
  steps: WorkflowStep[];
  isPaletteDrag?: boolean;
  businessLineName?: string;
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
      <div className="relative overflow-hidden rounded-xl border border-dashed border-white/10 dark:border-white/5
                      bg-white/2 backdrop-blur-sm p-6 text-center">
        <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-violet-500/5 blur-2xl" />
        <Workflow className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-[11px] text-muted-foreground italic">Sin gestiones — arrastra desde la paleta</p>
      </div>
    );
  }

  // Construir arbol: cada step -> sus hijos (steps que dependen de el)
  const childrenMap = new Map<string, WorkflowStep[]>();
  const roots: WorkflowStep[] = [];
  for (const s of steps) {
    if (s.depends_on_template_id) {
      const parentKey = s.depends_on_template_id;
      if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
      childrenMap.get(parentKey)!.push(s);
    } else {
      roots.push(s);
    }
  }

  // Renderizar arbol recursivamente
  function renderNode(step: WorkflowStep, level: number): React.ReactNode {
    const children = childrenMap.get(step.action_template_id) || [];
    const levelColors = [
      { bg: "from-violet-500/15 to-violet-600/5", border: "border-violet-500/30", text: "text-violet-400", glow: "bg-violet-500/10" },
      { bg: "from-sky-500/15 to-sky-600/5", border: "border-sky-500/30", text: "text-sky-400", glow: "bg-sky-500/10" },
      { bg: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/30", text: "text-emerald-400", glow: "bg-emerald-500/10" },
      { bg: "from-amber-500/15 to-amber-600/5", border: "border-amber-500/30", text: "text-amber-400", glow: "bg-amber-500/10" },
    ];
    const lc = levelColors[Math.min(level, 3)];

    return (
      <div key={step.id} className="relative">
        <SortableNode
          step={step}
          lc={lc}
          isSelected={selectedStepId === step.id}
          canEdit={canEdit}
          onSelect={() => onSelectStep(step.id)}
          onHover={() => onHoverStep(step.id)}
          onLeave={() => onHoverStep(null)}
          onAddDependent={() => onAddDependent(step)}
        />
        {/* Hijos con conector visual — SortableContext por grupo de hermanos */}
        {children.length > 0 && (
          <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="ml-4 pl-4 border-l-2 border-white/10 dark:border-white/5 space-y-1">
              {children.map((child) => (
                <div key={child.id} className="relative">
                  {/* Conector horizontal */}
                  <div className="absolute -left-4 top-5 h-px w-4 bg-white/10 dark:bg-white/5" />
                  {renderNode(child, level + 1)}
                </div>
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 dark:border-white/5
                    bg-white/2 backdrop-blur-sm p-4">
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-sky-500/5 blur-3xl" />

      {/* Drop zone para el canvas completo (recibe drops de la paleta) */}
      <DroppableCanvas isPaletteDrag={isPaletteDrag} businessLineName={businessLineName}>
        <div className="relative space-y-1">
          {roots.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-4">
              Configuración inválida — no hay gestiones raíz
            </p>
          ) : (
            <SortableContext items={roots.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {roots.map((step) => renderNode(step, 0))}
            </SortableContext>
          )}
        </div>
      </DroppableCanvas>
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

// ═══════════════════════════════════════════════════════════════════
// Componente: DraggablePaletteItem — item arrastrable de la paleta
// ═══════════════════════════════════════════════════════════════════

function DraggablePaletteItem({ templateId, code, name }: { templateId: string; code: string; name: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette_${templateId}`,
    data: { source: "palette", templateId, code, label: code },
  });

  // Con DragOverlay, NO aplicar transform al original — el overlay sigue el cursor
  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1
                 bg-white/5 hover:bg-violet-500/15
                 border border-white/10 hover:border-violet-500/30
                 transition-all duration-200 active:scale-95 group
                 cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-violet-400 transition-colors" />
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 border border-violet-500/20
                      group-hover:scale-110 transition-transform">
        <span className="font-mono text-[8px] font-bold text-violet-400">{code.slice(0, 2)}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[10px] font-semibold leading-tight">{code}</span>
        <span className="text-[8px] text-muted-foreground leading-tight max-w-[100px] truncate">{name}</span>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: SortableNode — nodo del arbol (sortable + droppable)
// Usa useSortable para reordenar dentro del mismo nivel con pixel-perfect
// ═══════════════════════════════════════════════════════════════════

function SortableNode({
  step, lc, isSelected, canEdit,
  onSelect, onHover, onLeave, onAddDependent,
}: {
  step: WorkflowStep;
  lc: { bg: string; border: string; text: string; glow: string };
  isSelected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
  onAddDependent: () => void;
}) {
  // useSortable combina draggable + droppable + animacion de reorden
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, active,
  } = useSortable({
    id: step.id,
    data: { source: "node", stepId: step.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  // Detectar si hay un item arrastrandose sobre este (para feedback de drop de paleta)
  const isDropTarget = isOver && active?.data.current?.source === "palette";

  return (
    <div className="flex items-center gap-1.5 mb-0.5">
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`relative flex items-center gap-1.5 rounded-lg px-2 py-1
                    bg-linear-to-br ${lc.bg} backdrop-blur-sm
                    border ${lc.border}
                    cursor-grab active:cursor-grabbing transition-all duration-150 active:scale-95
                    ${isSelected ? "ring-1 ring-offset-0 ring-violet-500/40 " : "hover:scale-[1.02]"}
                    ${isDropTarget ? "ring-2 ring-violet-500/60 scale-105 " : ""}`}
        onClick={onSelect}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
      >
        {/* Glow decorativo */}
        <div className={`pointer-events-none absolute -inset-0.5 rounded-lg ${lc.glow} blur-sm opacity-30 -z-10`} />

        {/* Grip handle */}
        <GripVertical className="h-2.5 w-2.5 text-muted-foreground/30 hover:text-violet-400 transition-colors shrink-0" />

        {/* Icono del codigo */}
        <div className={`flex h-5 w-5 items-center justify-center rounded-md ${lc.glow} border ${lc.border}`}>
          <span className={`font-mono text-[8px] font-bold ${lc.text}`}>
            {(step.action_template?.code || "?").slice(0, 2)}
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold leading-tight">{step.action_template?.code}</span>
          <span className="text-[8px] text-muted-foreground leading-tight max-w-[120px] truncate">
            {step.action_template?.name}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-0.5">
          {step.is_automatic && (
            <span className="flex items-center rounded px-0.5 py-0.5 bg-emerald-500/10 text-emerald-400">
              <Zap className="h-1.5 w-1.5" />
            </span>
          )}
          {step.is_required && (
            <span className="flex items-center rounded px-0.5 py-0.5 bg-rose-500/10 text-rose-400">
              <Shield className="h-1.5 w-1.5" />
            </span>
          )}
        </div>

        {/* Boton agregar dependiente */}
        {canEdit && (
          <button
            className="ml-0.5 flex h-4 w-4 items-center justify-center rounded
                       bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/30
                       text-muted-foreground hover:text-violet-400 transition-all active:scale-90"
            title="Agregar gestión dependiente"
            onClick={(e) => { e.stopPropagation(); onAddDependent(); }}
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        )}

        {/* Indicador de drop hover (paleta) */}
        {isDropTarget && (
          <div className="pointer-events-none absolute -inset-1 rounded-lg border-2 border-violet-500/40 bg-violet-500/5 animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Componente: DroppableCanvas — zona de drop del canvas completo
// Recibe drops de la paleta que no caen sobre un nodo especifico
// ═══════════════════════════════════════════════════════════════════

function DroppableCanvas({ children, isPaletteDrag, businessLineName }: {
  children: React.ReactNode;
  isPaletteDrag?: boolean;
  businessLineName?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { source: "canvas" },
  });

  const showDropIndicator = isPaletteDrag && isOver;

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all duration-200 rounded-xl
        ${showDropIndicator
          ? "ring-2 ring-violet-500/50 bg-violet-500/5 border border-violet-500/30"
          : isPaletteDrag
          ? "ring-1 ring-violet-500/20 border border-violet-500/15 border-dashed"
          : ""
        }`}
    >
      {children}
      {/* Indicador de drop para gestión raíz */}
      {showDropIndicator && (
        <div className="absolute inset-x-0 -bottom-8 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1
                          bg-violet-500/20 border border-violet-500/40 backdrop-blur-sm
                          text-violet-300 text-[10px] font-medium animate-pulse">
            <Plus className="h-2.5 w-2.5" />
            Soltar para gestión raíz (nivel 1)
            {businessLineName && <span className="text-violet-400/70">· {businessLineName}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

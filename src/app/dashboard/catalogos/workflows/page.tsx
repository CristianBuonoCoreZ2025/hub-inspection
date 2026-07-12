"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2,
  GitBranch, Workflow, ArrowDown, X, Settings2,
} from "lucide-react";
import {
  getWorkflowConfigs, getWorkflowSteps, createWorkflowConfig,
  updateWorkflowConfig, deleteWorkflowConfig,
  createWorkflowStep, updateWorkflowStep, deleteWorkflowStep,
  getIntrinsicDependency,
  type WorkflowConfig, type WorkflowStep,
} from "@/services/workflow-configs";
import { getActionTemplatesByClaimStatus } from "@/services/claim-actions";
import { getCountries, getBusinessLines, getEvents } from "@/services/catalogs";
import { getClaimStatuses } from "@/services/actions";

// Tipos del arbol
interface TreeNode {
  config: WorkflowConfig;
  steps: WorkflowStep[];
}

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [openConfigModal, setOpenConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<WorkflowConfig | null>(null);
  const [showAddStep, setShowAddStep] = useState<string | null>(null);

  // Queries
  const { data: configs } = useQuery({ queryKey: ["workflow-configs"], queryFn: getWorkflowConfigs });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });
  const { data: businessLines } = useQuery({ queryKey: ["business-lines"], queryFn: getBusinessLines });
  const { data: events } = useQuery({ queryKey: ["events"], queryFn: getEvents });
  const { data: claimStatuses } = useQuery({ queryKey: ["claim-statuses"], queryFn: getClaimStatuses });

  const { data: steps } = useQuery({
    queryKey: ["workflow-steps", selectedConfigId],
    queryFn: () => getWorkflowSteps(selectedConfigId!),
    enabled: !!selectedConfigId,
  });

  // Mutations
  const createConfigMut = useMutation({
    mutationFn: createWorkflowConfig,
    onSuccess: () => { toast.success("Workflow creado"); queryClient.invalidateQueries({ queryKey: ["workflow-configs"] }); setOpenConfigModal(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateConfigMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateWorkflowConfig>[1] }) => updateWorkflowConfig(id, input),
    onSuccess: () => { toast.success("Workflow actualizado"); queryClient.invalidateQueries({ queryKey: ["workflow-configs"] }); setOpenConfigModal(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteConfigMut = useMutation({
    mutationFn: deleteWorkflowConfig,
    onSuccess: () => { toast.success("Workflow eliminado"); queryClient.invalidateQueries({ queryKey: ["workflow-configs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createStepMut = useMutation({
    mutationFn: createWorkflowStep,
    onSuccess: () => { toast.success("Gestión agregada"); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); setShowAddStep(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStepMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateWorkflowStep>[1] }) => updateWorkflowStep(id, input),
    onSuccess: () => { toast.success("Gestión actualizada"); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStepMut = useMutation({
    mutationFn: deleteWorkflowStep,
    onSuccess: () => { toast.success("Gestión quitada"); queryClient.invalidateQueries({ queryKey: ["workflow-steps", selectedConfigId] }); setSelectedStepId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrupar configs por jerarquia: Estado > Pais > Evento > Linea
  const tree = useMemo(() => {
    if (!configs) return new Map<string, Map<string, Map<string, Map<string, WorkflowConfig>>>>();
    const tree = new Map<string, Map<string, Map<string, Map<string, WorkflowConfig>>>>();
    for (const c of configs) {
      const statusKey = c.claim_status_id;
      const countryKey = c.country_id || "__all__";
      const eventKey = c.event_id || "__all__";
      const lineKey = c.business_line_id || "__all__";
      if (!tree.has(statusKey)) tree.set(statusKey, new Map());
      if (!tree.get(statusKey)!.has(countryKey)) tree.get(statusKey)!.set(countryKey, new Map());
      if (!tree.get(statusKey)!.get(countryKey)!.has(eventKey)) tree.get(statusKey)!.get(countryKey)!.set(eventKey, new Map());
      tree.get(statusKey)!.get(countryKey)!.get(eventKey)!.set(lineKey, c);
    }
    return tree;
  }, [configs]);

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getName = (id: string, type: "country" | "line" | "event" | "status") => {
    if (id === "__all__") return "(todos)";
    if (type === "country") return countries?.find(c => c.id === id)?.name || "?";
    if (type === "line") return businessLines?.find(l => l.id === id)?.name || "?";
    if (type === "event") return events?.find(e => e.id === id)?.name || "?";
    if (type === "status") return claimStatuses?.find(s => s.id === id)?.name || "?";
    return "?";
  };

  // Steps agrupados por nivel
  const stepsByLevel = useMemo(() => {
    if (!steps) return new Map<number, WorkflowStep[]>();
    const map = new Map<number, WorkflowStep[]>();
    for (const s of steps) {
      if (!map.has(s.level)) map.set(s.level, []);
      map.get(s.level)!.push(s);
    }
    return map;
  }, [steps]);

  const usedTemplateIds = useMemo(() => {
    return new Set((steps || []).map(s => s.action_template_id));
  }, [steps]);

  const selectedStep = (steps || []).find(s => s.id === selectedStepId);

  // Templates disponibles para agregar (filtrados por estado + linea del config)
  const selectedConfig = configs?.find(c => c.id === selectedConfigId);
  const { data: availableTemplates } = useQuery({
    queryKey: ["available-templates", selectedConfig?.claim_status_id, selectedConfig?.business_line_id],
    queryFn: () => getActionTemplatesByClaimStatus(selectedConfig!.claim_status_id, selectedConfig?.business_line_id || undefined),
    enabled: !!selectedConfig && !!showAddStep,
  });

  const availableToAdd = (availableTemplates || []).filter(t => !usedTemplateIds.has(t.id));

  return (
    <div className="app-page">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="app-page-title flex items-center gap-2 shrink-0">
          <Workflow className="h-5 w-5" />
          Workflows
        </h1>
        <div className="flex-1" />
        {canCreate("catalogos") && (
          <Button onClick={() => { setEditingConfig(null); setOpenConfigModal(true); }} className="btn-create btn-sm shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Nuevo
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        {/* Arbol colapsable */}
        <div className="flex-1 app-panel min-h-[400px]">
          {configs && configs.length === 0 ? (
            <p className="text-center text-muted-foreground text-[13px] py-8">
              No hay workflows configurados.
            </p>
          ) : (
            <div className="text-[12px]">
              {Array.from(tree.entries()).map(([statusId, countriesMap]) => (
                <div key={statusId}>
                  {/* Estado */}
                  <TreeRow
                    icon={expandedNodes.has(`s-${statusId}`) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    folderIcon={expandedNodes.has(`s-${statusId}`) ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />}
                    label={getName(statusId, "status")}
                    bold
                    onClick={() => toggleNode(`s-${statusId}`)}
                  />
                  {expandedNodes.has(`s-${statusId}`) && (
                    <div className="ml-5 border-l border-border pl-2">
                      {Array.from(countriesMap.entries()).map(([countryId, eventsMap]) => (
                        <div key={countryId}>
                          <TreeRow
                            icon={expandedNodes.has(`c-${statusId}-${countryId}`) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            folderIcon={expandedNodes.has(`c-${statusId}-${countryId}`) ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />}
                            label={getName(countryId, "country")}
                            onClick={() => toggleNode(`c-${statusId}-${countryId}`)}
                          />
                          {expandedNodes.has(`c-${statusId}-${countryId}`) && (
                            <div className="ml-5 border-l border-border pl-2">
                              {Array.from(eventsMap.entries()).map(([eventId, linesMap]) => (
                                <div key={eventId}>
                                  <TreeRow
                                    icon={expandedNodes.has(`e-${statusId}-${countryId}-${eventId}`) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    folderIcon={expandedNodes.has(`e-${statusId}-${countryId}-${eventId}`) ? <FolderOpen className="h-4 w-4 text-rose-500" /> : <Folder className="h-4 w-4 text-rose-500" />}
                                    label={getName(eventId, "event")}
                                    onClick={() => toggleNode(`e-${statusId}-${countryId}-${eventId}`)}
                                  />
                                  {expandedNodes.has(`e-${statusId}-${countryId}-${eventId}`) && (
                                    <div className="ml-5 border-l border-border pl-2">
                                      {Array.from(linesMap.entries()).map(([lineId, config]) => (
                                        <div key={lineId}>
                                          <TreeRow
                                            icon={expandedNodes.has(`l-${config.id}`) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                            folderIcon={expandedNodes.has(`l-${config.id}`) ? <FolderOpen className="h-4 w-4 text-emerald-500" /> : <Folder className="h-4 w-4 text-emerald-500" />}
                                            label={getName(lineId, "line")}
                                            bold
                                            onClick={() => { toggleNode(`l-${config.id}`); setSelectedConfigId(config.id); }}
                                            actions={canEdit("catalogos") ? (
                                              <button
                                                className="text-muted-foreground hover:text-foreground"
                                                onClick={(e) => { e.stopPropagation(); setEditingConfig(config); setOpenConfigModal(true); }}
                                              >
                                                <Settings2 className="h-3 w-3" />
                                              </button>
                                            ) : undefined}
                                          />
                                          {expandedNodes.has(`l-${config.id}`) && selectedConfigId === config.id && (
                                            <div className="ml-3 mt-1 mb-2 space-y-2">
                                              {/* Gestiones por nivel */}
                                              {Array.from(stepsByLevel.entries()).sort((a, b) => a[0] - b[0]).map(([level, levelSteps]) => (
                                                <div key={level}>
                                                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                                    Nivel {level}
                                                    {level === 1 && " — al entrar al estado"}
                                                    {level > 1 && " — dependientes"}
                                                  </div>
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {levelSteps.map(step => (
                                                      <StepBox
                                                        key={step.id}
                                                        step={step}
                                                        selected={selectedStepId === step.id}
                                                        onClick={() => setSelectedStepId(step.id)}
                                                      />
                                                    ))}
                                                  </div>
                                                  {/* Flecha conectora */}
                                                  {levelSteps.length > 0 && level < 10 && (
                                                    <div className="flex justify-center my-1">
                                                      <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                              {/* Boton agregar */}
                                              {canEdit("catalogos") && (
                                                <button
                                                  className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                                                  onClick={() => setShowAddStep(config.id)}
                                                >
                                                  <Plus className="h-3 w-3" />
                                                  Agregar gestión
                                                </button>
                                              )}
                                              {(steps || []).length === 0 && (
                                                <p className="text-[11px] text-muted-foreground italic">Sin gestiones configuradas</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral: configuracion del step seleccionado */}
        {selectedStep && (
          <div className="w-[260px] app-panel shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {selectedStep.action_template?.code}
              </h3>
              <button onClick={() => setSelectedStepId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">{selectedStep.action_template?.name}</p>

            <div className="space-y-3">
              <div>
                <Label className="app-field-label text-[10px]">Nivel</Label>
                <div className="text-[12px] font-mono">{selectedStep.level}</div>
              </div>

              {selectedStep.depends_on_template && (
                <div>
                  <Label className="app-field-label text-[10px]">Se genera desde</Label>
                  <div className="text-[12px] font-mono text-primary">
                    {selectedStep.depends_on_template?.code}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <ToggleChip
                  active={selectedStep.is_automatic}
                  onClick={(v) => updateStepMut.mutate({ id: selectedStep.id, input: { is_automatic: v } })}
                >
                  Automática
                </ToggleChip>
                <ToggleChip
                  active={selectedStep.is_required}
                  onClick={(v) => updateStepMut.mutate({ id: selectedStep.id, input: { is_required: v } })}
                >
                  Obligatoria
                </ToggleChip>
              </div>

              {canDelete("catalogos") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn-danger btn-sm w-full mt-3"
                  onClick={() => { if (confirm("¿Quitar esta gestión del workflow?")) deleteStepMut.mutate(selectedStep.id); }}
                >
                  <Trash2 className="h-3 w-3" /> Quitar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: crear/editar config */}
      <ConfigModal
        open={openConfigModal}
        editing={editingConfig}
        countries={countries || []}
        businessLines={businessLines || []}
        events={events || []}
        claimStatuses={claimStatuses || []}
        onSubmit={(data) => {
          if (editingConfig) updateConfigMut.mutate({ id: editingConfig.id, input: data });
          else createConfigMut.mutate(data);
        }}
        onClose={() => setOpenConfigModal(false)}
      />

      {/* Modal: agregar step */}
      <Dialog open={!!showAddStep} onOpenChange={(v) => !v && setShowAddStep(null)}>
        <DialogContent className="modal-sm">
          <div className="modal-header">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
              <Plus className="h-4 w-4" />
            </div>
            Agregar Gestión
          </div>
          <div className="modal-body space-y-2">
            {availableToAdd.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">
                No hay gestiones disponibles para agregar.
                Todas las gestiones configuradas para este estado y línea ya están en el workflow.
              </p>
            ) : (
              availableToAdd.map(t => {
                const intrinsic = getIntrinsicDependency(t.code || "");
                const maxLevel = Math.max(0, ...(steps || []).map(s => s.level));
                return (
                  <button
                    key={t.id}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border hover:bg-muted/50 text-left transition-colors"
                    onClick={() => {
                      // Determinar nivel y dependencia
                      let level = 1;
                      let dependsOn: string | null = null;

                      if (intrinsic) {
                        // Buscar si el template del que depende ya esta en el arbol
                        const depStep = (steps || []).find(s => s.action_template?.code === intrinsic);
                        if (depStep) {
                          level = depStep.level + 1;
                          dependsOn = depStep.action_template_id;
                        }
                      }

                      createStepMut.mutate({
                        workflow_config_id: showAddStep!,
                        action_template_id: t.id,
                        level,
                        depends_on_template_id: dependsOn,
                      });
                    }}
                  >
                    <div>
                      <div className="text-[12px] font-mono font-semibold text-primary">{t.code}</div>
                      <div className="text-[11px] text-muted-foreground">{t.name}</div>
                    </div>
                    {intrinsic && (
                      <span className="text-[9px] text-muted-foreground">
                        dep: {intrinsic}
                      </span>
                    )}
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

// Componente: fila del arbol
function TreeRow({
  icon, folderIcon, label, bold, onClick, actions,
}: {
  icon: React.ReactNode;
  folderIcon: React.ReactNode;
  label: string;
  bold?: boolean;
  onClick: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1 group" onClick={onClick}>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="shrink-0">{folderIcon}</span>
      <span className={`truncate ${bold ? "font-semibold" : "font-normal"}`}>{label}</span>
      {actions && <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">{actions}</span>}
    </div>
  );
}

// Componente: caja de step
function StepBox({
  step, selected, onClick,
}: {
  step: WorkflowStep;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border cursor-pointer transition-all ${
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
      }`}
      onClick={onClick}
    >
      <span className="font-mono text-[10px] font-semibold text-primary">{step.action_template?.code}</span>
      <div className="flex items-center gap-1">
        {step.is_automatic && <span className="text-[8px] text-emerald-600 font-medium">Auto</span>}
        {step.is_required && <span className="text-[8px] text-rose-600 font-medium">Req</span>}
      </div>
      {step.depends_on_template && (
        <span className="text-[8px] text-muted-foreground">← {step.depends_on_template?.code}</span>
      )}
    </div>
  );
}

// Modal: crear/editar config
function ConfigModal({
  open, editing, countries, businessLines, events, claimStatuses, onSubmit, onClose,
}: {
  open: boolean;
  editing: WorkflowConfig | null;
  countries: { id: string; name: string }[];
  businessLines: { id: string; name: string }[];
  events: { id: string; name: string }[];
  claimStatuses: { id: string; code: string; name: string }[];
  onSubmit: (data: { name: string; description?: string; country_id?: string | null; business_line_id?: string | null; event_id?: string | null; claim_status_id: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countryId, setCountryId] = useState("");
  const [eventId, setEventId] = useState("");
  const [lineId, setLineId] = useState("");
  const [statusId, setStatusId] = useState("");

  // Reset al abrir
  useMemo(() => {
    if (open) {
      setName(editing?.name || "");
      setDescription(editing?.description || "");
      setCountryId(editing?.country_id || "");
      setEventId(editing?.event_id || "");
      setLineId(editing?.business_line_id || "");
      setStatusId(editing?.claim_status_id || "");
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="modal-sm">
        <div className="modal-header">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
            <Workflow className="h-4 w-4" />
          </div>
          {editing ? "Editar" : "Nuevo"} Workflow
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("El nombre es requerido"); return; }
          if (!statusId) { toast.error("El estado es requerido"); return; }
          onSubmit({
            name,
            description: description || undefined,
            country_id: countryId || null,
            event_id: eventId || null,
            business_line_id: lineId || null,
            claim_status_id: statusId,
          });
        }}>
          <div className="modal-body space-y-3">
            <div>
              <Label className="app-field-label">Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="app-input" placeholder="Ej: Liquidación Hogar Chile" required />
            </div>
            <div>
              <Label className="app-field-label">Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="app-input text-[12px] resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="app-field-label">Estado *</Label>
                <select className="app-input w-full" value={statusId} onChange={(e) => setStatusId(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {claimStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="app-field-label">País</Label>
                <select className="app-input w-full" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
                  <option value="">(todos)</option>
                  {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="app-field-label">Evento</Label>
                <select className="app-input w-full" value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">(todos)</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="app-field-label">Línea de Negocio</Label>
                <select className="app-input w-full" value={lineId} onChange={(e) => setLineId(e.target.value)}>
                  <option value="">(todas)</option>
                  {businessLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <Button type="button" className="btn-cancel btn-footer" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="btn-save btn-footer">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

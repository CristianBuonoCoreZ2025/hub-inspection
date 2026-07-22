"use client";

import { useMemo } from "react";
import type { ClaimAction } from "@/types";
import { CheckCircle, Clock, XCircle, AlertTriangle, Circle, ArrowRight, GitBranch } from "lucide-react";

interface WorkflowViewProps {
  actions: ClaimAction[];
  onOpenAction?: (actionId: string) => void;
}

type NodeState = "done" | "pending" | "late" | "alert" | "rejected" | "none";

const stateConfig: Record<NodeState, { color: string; bg: string; border: string; icon: typeof CheckCircle; label: string }> = {
  done:     { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 dark:bg-emerald-500/15", border: "border-emerald-500/20 dark:border-emerald-500/30", icon: CheckCircle, label: "Completada" },
  pending:  { color: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-500/10 dark:bg-slate-500/15",    border: "border-slate-500/20 dark:border-slate-500/30",    icon: Clock,        label: "Pendiente" },
  late:     { color: "text-red-600 dark:text-red-400",          bg: "bg-red-500/10 dark:bg-red-500/15",       border: "border-red-500/20 dark:border-red-500/30",       icon: AlertTriangle, label: "Atrasada" },
  alert:    { color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10 dark:bg-amber-500/15",   border: "border-amber-500/20 dark:border-amber-500/30",  icon: AlertTriangle, label: "En alerta" },
  rejected: { color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-500/10 dark:bg-rose-500/15",     border: "border-rose-500/20 dark:border-rose-500/30",     icon: XCircle,       label: "Rechazada" },
  none:     { color: "text-muted-foreground/40",               bg: "bg-transparent",                         border: "border-dashed border-white/10 dark:border-white/5", icon: Circle, label: "N/A" },
};

// Dependencias conocidas entre templates (usa feature codes)
const DEPENDENCIES: Record<string, string[]> = {
  RES: ["COB"],
  AJU: ["RES"],
  RTA: ["SOL"],
};

const CLOSED_STATUSES = new Set(["issued", "reviewed", "approved", "dispatched"]);

function getActionState(action: ClaimAction): NodeState {
  const status = action.action_status?.code || "todo";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "rejected";
  if (status === "issued" || status === "reviewed" || status === "approved" || status === "dispatched") {
    return "done";
  }
  // todo — verificar si está atrasada o en alerta
  const dti = action.action_template?.days_to_issue ?? 0;
  const created = new Date(action.created_on);
  const daysSince = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (dti > 0 && daysSince > dti) return "late";
  if (dti > 0 && daysSince >= dti * 0.7) return "alert";
  return "pending";
}

function getLevelState(action: ClaimAction, level: "issue" | "review" | "approve" | "dispatch"): NodeState {
  const feature = action.action_feature;
  if (!feature) return "none";
  const hasLevel = level === "issue" ? feature.has_issue : level === "review" ? feature.has_review : level === "approve" ? feature.has_approve : false;
  if (!hasLevel) return "none";

  const status = action.action_status?.code || "todo";

  if (level === "issue") {
    if (status === "rejected") return "rejected";
    if (action.issued_on && action.issuer) return "done";
    if (status === "todo") {
      const dti = action.action_template?.days_to_issue ?? 0;
      const created = new Date(action.created_on);
      const daysSince = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (dti > 0 && daysSince > dti) return "late";
      if (dti > 0 && daysSince >= dti * 0.7) return "alert";
      return "pending";
    }
    return "done";
  }

  if (level === "review") {
    if (status === "rejected") return "rejected";
    if (action.reviewed_on && action.reviewer) return "done";
    if (status === "todo" || status === "issued") return "pending";
    return "done";
  }

  if (level === "approve") {
    if (status === "rejected") return "rejected";
    if (action.approved_on && action.approver) return "done";
    if (status === "todo" || status === "issued" || status === "reviewed") return "pending";
    return "done";
  }

  return "none";
}

export default function WorkflowView({ actions, onOpenAction }: WorkflowViewProps) {
  // Agrupar acciones por template_code
  const grouped = useMemo(() => {
    const map = new Map<string, ClaimAction[]>();
    for (const a of actions) {
      const code = a.action_template?.code || "GEN";
      if (!map.has(code)) map.set(code, []);
      map.get(code)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => {
      // Ordenar por dependencias: COB antes que RES, etc
      const order = ["COB", "RES", "AJU", "INS", "CIN", "SOL", "RTA", "CIE", "REA", "PRO", "IMP", "RIN"];
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [actions]);

  // Verificar si una dependencia está cumplida
  const isDependencyMet = (templateCode: string): { met: boolean; dep: string } => {
    const deps = DEPENDENCIES[templateCode];
    if (!deps) return { met: true, dep: "" };
    for (const dep of deps) {
      const depActions = actions.filter(a => a.action_template?.code === dep);
      const met = depActions.some(a => a.action_status?.code && CLOSED_STATUSES.has(a.action_status.code));
      if (!met) return { met: false, dep };
    }
    return { met: true, dep: deps.join(", ") };
  };

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-[13px]">
        No hay gestiones para mostrar el workflow.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Leyenda — glass */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground
                      rounded-lg border border-white/10 dark:border-white/5 bg-white/5 dark:bg-white/5
                      backdrop-blur-md px-3 py-2">
        {(["done", "pending", "alert", "late", "rejected"] as NodeState[]).map(s => {
          const cfg = stateConfig[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className="flex items-center gap-1">
              <Icon className={`h-3 w-3 ${cfg.color}`} />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Grupos de gestiones por tipo — glass */}
      <div className="space-y-2">
        {grouped.map(([templateCode, groupActions]) => {
          const dep = isDependencyMet(templateCode);
          return (
            <div key={templateCode} className={`rounded-xl border ${dep.met ? "border-white/10 dark:border-white/5" : "border-amber-500/30 dark:border-amber-500/20"} bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm`}>
              {/* Header del grupo — glass */}
              <div className="flex items-center justify-between px-3 py-2 bg-white/5 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold">{templateCode}</span>
                  <span className="text-[10px] text-muted-foreground">{groupActions[0].action_feature?.name || groupActions[0].name}</span>
                </div>
                {!dep.met && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Requiere: {dep.dep}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">{groupActions.length} gestión{groupActions.length > 1 ? "es" : ""}</span>
              </div>

              {/* Gestiones del grupo */}
              <div className="divide-y divide-white/5 dark:divide-white/5">
                {groupActions.map(action => {
                  const state = getActionState(action);
                  const cfg = stateConfig[state];
                  const Icon = cfg.icon;
                  const issueState = getLevelState(action, "issue");
                  const reviewState = getLevelState(action, "review");
                  const approveState = getLevelState(action, "approve");
                  const levels = [
                    { label: "E", state: issueState, title: "Emisión" },
                    { label: "R", state: reviewState, title: "Revisión" },
                    { label: "A", state: approveState, title: "Aprobación" },
                  ];

                  return (
                    <div
                      key={action.id}
                      className={`flex items-center gap-3 px-3 py-2 ${onOpenAction ? "cursor-pointer hover:bg-white/5 dark:hover:bg-white/5" : ""} transition-colors`}
                      onClick={() => onOpenAction?.(action.id)}
                    >
                      {/* Estado general */}
                      <div className={`flex items-center gap-1.5 ${cfg.color} shrink-0`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Código */}
                      <span className="font-mono text-[10px] text-primary tabular-nums whitespace-nowrap shrink-0 w-[80px]">
                        {(action.code || "").split("-").slice(2).join("-") || "—"}
                      </span>

                      {/* Nombre */}
                      <span className="text-[11px] font-medium flex-1 truncate">{action.name}</span>

                      {/* Niveles E/R/A — glass circles */}
                      <div className="flex items-center gap-1 shrink-0">
                        {levels.map((lvl, i) => {
                          if (lvl.state === "none") return null;
                          const lcfg = stateConfig[lvl.state];
                          return (
                            <div key={i} className="flex items-center gap-0.5" title={`${lvl.title}: ${lcfg.label}`}>
                              {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />}
                              <div className={`flex items-center justify-center rounded-full ${lcfg.bg} ${lcfg.border} border backdrop-blur-sm w-5 h-5`}>
                                <span className={`text-[9px] font-bold ${lcfg.color}`}>{lvl.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Badge estado — glass */}
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.border} border backdrop-blur-sm ${cfg.color} shrink-0`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

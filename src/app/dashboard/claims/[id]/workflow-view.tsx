"use client";

import { useMemo, type ReactNode } from "react";
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

// Dependencias conocidas entre templates (child -> [parents]).
// El primer padre existente en las gestiones se usa como nodo padre en el árbol.
const DEPENDENCIES: Record<string, string[]> = {
  RES: ["COB"],
  PCA: ["RES"],
  AJU: ["RES"],
  INS: ["CIN"],
  RTA: ["SOL"],
};

const ORDER = ["COB", "RES", "PCA", "AJU", "CIN", "INS", "SOL", "RTA", "CIE", "REA", "PRO", "IMP", "RIN"];

const CLOSED_STATUSES = new Set(["issued", "reviewed", "approved", "dispatched"]);

function getActionState(action: ClaimAction): NodeState {
  const status = action.action_status?.code || "todo";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "rejected";
  if (status === "issued" || status === "reviewed" || status === "approved" || status === "dispatched") {
    return "done";
  }
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

function ActionRow({ action, onOpenAction }: { action: ClaimAction; onOpenAction?: (actionId: string) => void }) {
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
      className={`flex items-center gap-3 px-3 py-2 ${onOpenAction ? "cursor-pointer hover:bg-white/5 dark:hover:bg-white/5" : ""} transition-colors`}
      onClick={() => onOpenAction?.(action.id)}
    >
      <div className={`flex items-center gap-1.5 ${cfg.color} shrink-0`}>
        <Icon className="h-3.5 w-3.5" />
      </div>

      <span className="font-mono text-[10px] text-primary tabular-nums whitespace-nowrap shrink-0 w-[80px]">
        {(action.code || "").split("-").slice(2).join("-") || "—"}
      </span>

      <span className="text-[11px] font-medium flex-1 truncate">{action.name}</span>

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

      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.border} border backdrop-blur-sm ${cfg.color} shrink-0`}>
        {cfg.label}
      </span>
    </div>
  );
}

export default function WorkflowView({ actions, onOpenAction }: WorkflowViewProps) {
  const tree = useMemo(() => {
    const codeToActions = new Map<string, ClaimAction[]>();
    for (const a of actions) {
      const code = a.action_template?.code || "GEN";
      if (!codeToActions.has(code)) codeToActions.set(code, []);
      codeToActions.get(code)!.push(a);
    }
    for (const list of codeToActions.values()) {
      list.sort((x, y) => new Date(x.created_on).getTime() - new Date(y.created_on).getTime());
    }

    const childMap = new Map<string, string[]>();
    const childSet = new Set<string>();
    for (const [code, deps] of Object.entries(DEPENDENCIES)) {
      if (!codeToActions.has(code)) continue;
      for (const dep of deps) {
        if (codeToActions.has(dep)) {
          if (!childMap.has(dep)) childMap.set(dep, []);
          childMap.get(dep)!.push(code);
          childSet.add(code);
          break;
        }
      }
    }

    const orderIndex = (code: string) => {
      const i = ORDER.indexOf(code);
      return i === -1 ? 999 : i;
    };

    const roots = Array.from(codeToActions.keys()).filter(c => !childSet.has(c));
    roots.sort((a, b) => orderIndex(a) - orderIndex(b));
    for (const children of childMap.values()) {
      children.sort((a, b) => orderIndex(a) - orderIndex(b));
    }

    return { codeToActions, childMap, roots };
  }, [actions]);

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

  const renderNode = (code: string): ReactNode => {
    const groupActions = tree.codeToActions.get(code) || [];
    const childCodes = tree.childMap.get(code) || [];
    const dep = isDependencyMet(code);
    const first = groupActions[0];

    return (
      <div key={code} className="rounded-xl border border-white/10 dark:border-white/5 bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm">
        <div className={`flex items-center justify-between px-3 py-2 bg-white/5 dark:bg-white/5 backdrop-blur-sm border-b border-white/10 dark:border-white/5 ${!dep.met ? "border-amber-500/30 dark:border-amber-500/20" : ""}`}>
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold">{code}</span>
            <span className="text-[10px] text-muted-foreground">{first?.action_feature?.name || first?.name || ""}</span>
          </div>
          <div className="flex items-center gap-2">
            {!dep.met && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Requiere: {dep.dep}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{groupActions.length} gestión{groupActions.length > 1 ? "es" : ""}</span>
          </div>
        </div>

        {groupActions.length > 0 && (
          <div className="divide-y divide-white/5 dark:divide-white/5">
            {groupActions.map(action => (
              <ActionRow key={action.id} action={action} onOpenAction={onOpenAction} />
            ))}
          </div>
        )}

        {childCodes.length > 0 && (
          <div className="space-y-2 p-2 pl-3 border-t border-l border-white/5">
            {childCodes.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
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
      {/* Leyenda */}
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

      {/* Árbol de gestiones */}
      <div className="space-y-2">
        {tree.roots.map(code => renderNode(code))}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClaimDocuments,
  deleteClaimDocument,
} from "@/services/claim-documents-physical";
import { getDocumentRequirements } from "@/services/claim-documents";
import {
  getPolicyDocuments,
  getPolicyCoveragesByPolicyIdDirect,
} from "@/services/policies";
import {
  getCoverageCatalog,
  getSubcoveragesByCoverageIds,
} from "@/services/coverage-catalog";
import { getDocumentTypes } from "@/services/catalogs";
import { toast } from "sonner";
import {
  FolderOpen,
  FileText,
  ExternalLink,
  Upload,
  Trash2,
  Shield,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AiProcessingBadge } from "@/components/ai/ai-processing-badge";
import { AiCopyButton } from "@/components/ai/ai-copy-button";
import { cleanMarkdown } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { usePagination } from "@/hooks/use-pagination";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClaimDocumentsTabProps {
  claimId: string;
  policyId: string | null;
}

export default function ClaimDocumentsTab({ claimId, policyId }: ClaimDocumentsTabProps) {
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  // El popover de IA ahora vive dentro de cada fila (no estado global)

  // 1. Documentos físicos del siniestro
  const { data: claimDocs, isLoading: claimDocsLoading } = useQuery({
    queryKey: ["claim-documents", claimId],
    queryFn: () => getClaimDocuments(claimId),
    enabled: !!claimId,
    // Polling cada 5s mientras hay documentos siendo procesados por IA
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs && docs.some((d) => d.ai_status === "pending" || d.ai_status === "processing")) return 3000;
      return false;
    },
  });

  // Obtener business_line_id del siniestro
  const { data: claim } = useQuery({
    queryKey: ["claim-business-line", claimId],
    queryFn: async () => {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("claims")
        .select("business_line_id")
        .eq("id", claimId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!claimId,
  });

  // Tipos de documento = requirements configurados para la línea de negocio
  const { data: documentRequirements } = useQuery({
    queryKey: ["doc-requirements", claim?.business_line_id],
    queryFn: () => getDocumentRequirements(claim?.business_line_id || undefined),
    enabled: !!claim?.business_line_id,
  });

  // Todos los tipos de documento del catálogo (para el resto)
  const { data: allDocumentTypes } = useQuery({
    queryKey: ["document-types"],
    queryFn: getDocumentTypes,
    staleTime: 5 * 60 * 1000,
  });

  // Combinar: primero los de la línea de negocio, luego separador, luego el resto alfabético
  const docOptions = useMemo(() => {
    const lineDocs = (documentRequirements || []).map((r) => ({
      code: r.document_type_code,
      name: r.document_name,
      isLine: true,
    }));
    const lineCodes = new Set(lineDocs.map((d) => d.code));
    const restDocs = (allDocumentTypes || [])
      .filter((d) => d.is_active && d.code && !lineCodes.has(d.code))
      .map((d) => ({ code: d.code!, name: d.name, isLine: false }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { lineDocs, restDocs };
  }, [documentRequirements, allDocumentTypes]);

  // 2. Documentos físicos de la póliza asociada
  const { data: policyDocs } = useQuery({
    queryKey: ["policy-documents", policyId],
    queryFn: () => getPolicyDocuments(policyId!),
    enabled: !!policyId,
  });

  // 3. Documentos online de la póliza (coberturas → CMF)
  const { data: policyCoverages } = useQuery({
    queryKey: ["policy-coverages-direct", policyId],
    queryFn: () => getPolicyCoveragesByPolicyIdDirect(policyId!),
    enabled: !!policyId,
  });

  // 4. Evidencias de tipo documento de las inspecciones del siniestro
  type InspectionDoc = {
    id: string;
    url: string;
    type: string;
    description: string | null;
    metadata: { originalName?: string; fileSize?: number; mimeType?: string } | null;
    ai_summary: string | null;
    ai_model: string | null;
    ai_status: string | null;
    ai_analyzed_at: string | null;
    ai_prompt_snapshot: { system_prompt?: string; user_prompt?: string; refinement_prompt?: string } | null;
    created_at: string;
    session_id: string;
    inspectionNumber: string;
  };
  const { data: inspectionDocs } = useQuery<InspectionDoc[]>({
    queryKey: ["inspection-documents", claimId],
    queryFn: async () => {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      // Buscar sesiones de inspección del siniestro
      const { data: sessions, error: sErr } = await supabase
        .from("inspection_sessions")
        .select("id, inspection_number, claim_action_id")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false });
      if (sErr) throw new Error(sErr.message);
      if (!sessions || sessions.length === 0) return [];
      const sessionIds = sessions.map((s: { id: string }) => s.id);
      // Buscar evidencias de tipo documento (pdf/document) de esas sesiones
      const { data: evidences, error: eErr } = await supabase
        .from("inspection_evidences")
        .select("id, url, type, description, metadata, ai_summary, ai_model, ai_status, ai_analyzed_at, ai_prompt_snapshot, created_at, session_id")
        .in("session_id", sessionIds)
        .in("type", ["pdf", "document"])
        .order("created_at", { ascending: false });
      if (eErr) throw new Error(eErr.message);
      // Con R2 las URLs ya son públicas — no se presigna
      const evs = (evidences || []) as Array<Record<string, unknown>>;
      // Mapear session_id → inspection_number
      const sessionMap = new Map(sessions.map((s: { id: string; inspection_number: string | null; claim_action_id: string | null }) => [s.id, s.inspection_number || s.claim_action_id || "Inspección"]));
      return (evs as Array<Omit<InspectionDoc, "inspectionNumber">>).map((e) => ({
        ...e,
        inspectionNumber: String(sessionMap.get(e.session_id) || "Inspección"),
      }));
    },
    enabled: !!claimId,
    staleTime: 30 * 1000,
    // Polling cada 3s mientras hay documentos siendo procesados por IA
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs && docs.some((d) => d.ai_status === "pending" || d.ai_status === "processing")) return 3000;
      return false;
    },
  });

  const coverageCatalogIds = useMemo(() => {
    if (!policyCoverages) return [];
    const ids = new Set<string>();
    for (const pc of policyCoverages) {
      if (pc.is_active && pc.coverage_catalog_id) ids.add(pc.coverage_catalog_id);
    }
    return Array.from(ids);
  }, [policyCoverages]);

  const { data: coverageCatalog } = useQuery({
    queryKey: ["coverage-catalog"],
    queryFn: () => getCoverageCatalog(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: policySubcoverages } = useQuery({
    queryKey: ["policy-subcoverages-all", coverageCatalogIds],
    queryFn: () => getSubcoveragesByCoverageIds(coverageCatalogIds),
    enabled: coverageCatalogIds.length > 0,
  });

  // Documentos online derivados de coberturas
  const onlineDocuments = useMemo(() => {
    if (!policyCoverages || !coverageCatalog) return [];
    const docs: Array<{
      coverage_name: string;
      subcoverage_name: string | null;
      code: string;
      url: string;
      type: "POL" | "CAD";
    }> = [];
    const seen = new Set<string>();
    for (const pc of policyCoverages) {
      if (!pc.is_active) continue;
      if (pc.coverage_catalog_id) {
        const cat = coverageCatalog.find((c) => c.id === pc.coverage_catalog_id);
        if (cat?.document_url && !seen.has(cat.document_url)) {
          seen.add(cat.document_url);
          docs.push({
            coverage_name: cat.name,
            subcoverage_name: null,
            code: cat.code,
            url: cat.document_url,
            type: "POL",
          });
        }
      }
      if (pc.subcoverage_catalog_id && policySubcoverages) {
        const sub = policySubcoverages.find((s) => s.id === pc.subcoverage_catalog_id);
        if (sub?.document_url && !seen.has(sub.document_url)) {
          seen.add(sub.document_url);
          docs.push({
            coverage_name: pc.coverage_name,
            subcoverage_name: sub.name,
            code: sub.code,
            url: sub.document_url,
            type: "CAD",
          });
        }
      }
    }
    return docs;
  }, [policyCoverages, coverageCatalog, policySubcoverages]);

  // Estado del modal de subida (selección + progreso en uno solo)
  const [uploadModal, setUploadModal] = useState<{
    visible: boolean;
    fileName: string;
    fileSize: number;
    loaded: number;
    speed: number; // KB/s
    elapsed: number; // ms
    status: "idle" | "uploading" | "processing" | "done" | "error";
    errorMsg?: string;
    isDragging: boolean;
  }>({ visible: false, fileName: "", fileSize: 0, loaded: 0, speed: 0, elapsed: 0, status: "idle", isDragging: false });

  // Estado del modal de eliminación
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    docId: string;
    docCode: string;
    docType: string;
    fileName: string;
    reason: string;
    status: "confirming" | "deleting" | "done" | "error";
    errorMsg?: string;
  }>({ visible: false, docId: "", docCode: "", docType: "", fileName: "", reason: "", status: "confirming" });

  // Mutation: subir documento del siniestro (con progreso via XMLHttpRequest)
  const uploadMut = useMutation({
    mutationFn: async ({ file, docTypeCode }: { file: File; docTypeCode: string }) => {
      return new Promise<{ document: unknown }>((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("claimId", claimId);
        if (docTypeCode) formData.append("documentTypeCode", docTypeCode);

        const xhr = new XMLHttpRequest();
        const startTime = Date.now();

        // Progreso de subida (bytes + velocidad)
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const elapsed = Date.now() - startTime;
            const speed = elapsed > 0 ? (e.loaded / 1024) / (elapsed / 1000) : 0;
            setUploadModal((p) => ({
              ...p,
              loaded: e.loaded,
              fileSize: e.total,
              speed,
              elapsed,
              status: "uploading",
            }));
          }
        });

        // Cuando se completa la subida → pasa a "procesando" (server-side)
        // Delay mínimo de 400ms para que se vea la barra al 100% antes de cambiar
        xhr.upload.addEventListener("load", () => {
          const elapsed = Date.now() - startTime;
          const finalSpeed = elapsed > 0 ? (file.size / 1024) / (elapsed / 1000) : 0;
          setUploadModal((p) => ({
            ...p,
            status: "uploading",
            loaded: p.fileSize,
            speed: finalSpeed,
            elapsed,
          }));
          setTimeout(() => {
            setUploadModal((p) => ({ ...p, status: "processing" }));
          }, 400);
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadModal((p) => ({ ...p, status: "done" }));
              resolve(data);
            } catch {
              reject(new Error("Respuesta inválida del servidor"));
            }
          } else {
            let msg = "Error al subir archivo";
            console.error("[upload] xhr error:", {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText?.substring(0, 500),
            });
            try {
              const body = JSON.parse(xhr.responseText);
              if (body.error) msg = body.error;
              else msg = `Error ${xhr.status}: ${JSON.stringify(body).substring(0, 200)}`;
            } catch {
              // Si no es JSON, podría ser una página HTML de error de Vercel
              if (xhr.responseText) {
                msg = `Error ${xhr.status}: ${xhr.responseText.substring(0, 200)}`;
              } else {
                msg = `Error ${xhr.status}: ${xhr.statusText}`;
              }
            }
            setUploadModal((p) => ({ ...p, status: "error", errorMsg: msg }));
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => {
          setUploadModal((p) => ({ ...p, status: "error", errorMsg: "Error de red" }));
          reject(new Error("Error de red al subir archivo"));
        });

        xhr.addEventListener("abort", () => {
          setUploadModal((p) => ({ ...p, status: "error", errorMsg: "Subida cancelada" }));
          reject(new Error("Subida cancelada"));
        });

        xhr.open("POST", "/api/claims/documents/upload");
        xhr.send(formData);
      });
    },
    onMutate: ({ file }) => {
      setUploadModal((p) => ({
        ...p,
        fileName: file.name,
        fileSize: file.size,
        loaded: 0,
        speed: 0,
        elapsed: 0,
        status: "uploading",
      }));
    },
    onSuccess: () => {
      toast.success("Documento subido");
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests"] });
      queryClient.invalidateQueries({ queryKey: ["claim-action"] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
      queryClient.invalidateQueries({ queryKey: ["gestion-screens"] });
      setUploadModal((p) => ({ ...p, status: "done" }));
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setUploadModal((p) => ({ ...p, status: "error", errorMsg: e.message }));
    },
  });

  const deleteMut = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      return deleteClaimDocument(docId, reason || undefined);
    },
    onMutate: () => {
      setDeleteModal((p) => ({ ...p, status: "deleting" }));
    },
    onSuccess: () => {
      toast.success("Documento eliminado");
      setDeleteModal((p) => ({ ...p, status: "done" }));
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests"] });
      queryClient.invalidateQueries({ queryKey: ["claim-action"] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
      queryClient.invalidateQueries({ queryKey: ["gestion-screens"] });
      setTimeout(() => setDeleteModal((p) => ({ ...p, visible: false })), 1200);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDeleteModal((p) => ({ ...p, status: "error", errorMsg: e.message }));
      setTimeout(() => setDeleteModal((p) => ({ ...p, visible: false, status: "confirming" })), 2500);
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    if (!selectedDocType) {
      toast.error("Selecciona un tipo de documento antes de subir");
      return;
    }

    // Subir secuencialmente: uno a uno, esperando que cada uno termine
    for (const file of files) {
      await new Promise<void>((resolve) => {
        uploadMut.mutate({ file, docTypeCode: selectedDocType }, {
          onSettled: () => resolve(),
        });
      });
    }

    // Disparar análisis de IA en background después de que todos suban
    fetch("/api/ai/process-pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    }).catch(() => {});
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const canCreateDocs = canCreate("claims_documentos");
  const canDeleteDocs = canDelete("claims_documentos");

  // ─── Unificar todos los documentos en una sola lista ───
  type UnifiedDoc = {
    id: string;
    origen: "siniestro" | "poliza" | "cmf" | "inspeccion";
    codigo: string;
    nombre: string;
    subnombre?: string | null;
    ext: string;
    tamano: string;
    url: string;
    aiSummary?: string | null;
    aiModel?: string | null;
    aiStatus?: string | null;
    aiAnalyzedAt?: string | null;
    aiPromptSnapshot?: { system_prompt?: string; user_prompt?: string; refinement_prompt?: string } | null;
    docTypeCode?: string;
    canDelete?: boolean;
    docId?: string; // para delete (solo siniestro)
  };

  const allDocuments = useMemo<UnifiedDoc[]>(() => {
    const docs: UnifiedDoc[] = [];

    // 1. Documentos del siniestro
    for (const doc of claimDocs || []) {
      const docTypeName =
        docOptions.lineDocs.find((d) => d.code === doc.document_type)?.name ||
        docOptions.restDocs.find((d) => d.code === doc.document_type)?.name ||
        doc.document_type || "—";
      docs.push({
        id: doc.id,
        origen: "siniestro",
        codigo: doc.doc_code || "—",
        nombre: docTypeName,
        subnombre: doc.original_filename,
        ext: doc.original_filename?.split(".").pop()?.toUpperCase() || "—",
        tamano: formatFileSize(doc.file_size),
        url: doc.document_url || "",
        aiSummary: doc.ai_summary,
        aiModel: doc.ai_model,
        aiStatus: doc.ai_status,
        aiAnalyzedAt: doc.ai_analyzed_at,
        aiPromptSnapshot: doc.ai_prompt_snapshot as { system_prompt?: string; user_prompt?: string; refinement_prompt?: string } | null,
        docTypeCode: doc.document_type || undefined,
        canDelete: canDeleteDocs,
        docId: doc.id,
      });
    }

    // 2. Documentos de la póliza
    for (const doc of policyDocs || []) {
      docs.push({
        id: doc.id,
        origen: "poliza",
        codigo: doc.document_type || "—",
        nombre: doc.document_name,
        subnombre: null,
        ext: doc.document_url?.split(".").pop()?.toUpperCase() || "—",
        tamano: formatFileSize(doc.file_size),
        url: doc.document_url || "",
      });
    }

    // 3. Documentos online (CMF)
    for (const doc of onlineDocuments) {
      docs.push({
        id: `cmf-${doc.code}-${doc.url}`,
        origen: "cmf",
        codigo: doc.code,
        nombre: doc.coverage_name,
        subnombre: doc.subcoverage_name,
        ext: doc.type,
        tamano: "—",
        url: doc.url,
      });
    }

    // 4. Documentos de inspección (evidencias de tipo documento)
    for (const doc of inspectionDocs || []) {
      const meta = doc.metadata as { originalName?: string; fileSize?: number; mimeType?: string } | null;
      docs.push({
        id: doc.id,
        origen: "inspeccion",
        codigo: doc.description || "—",
        nombre: doc.inspectionNumber,
        subnombre: null,
        ext: (meta?.originalName || "").split(".").pop()?.toUpperCase() || doc.type.toUpperCase(),
        tamano: meta?.fileSize ? formatFileSize(meta.fileSize) : "—",
        url: doc.url || "",
        aiSummary: doc.ai_summary,
        aiModel: doc.ai_model,
        aiStatus: doc.ai_status,
        aiAnalyzedAt: doc.ai_analyzed_at,
        aiPromptSnapshot: doc.ai_prompt_snapshot as { system_prompt?: string; user_prompt?: string; refinement_prompt?: string } | null,
        canDelete: false,
        docId: undefined,
      });
    }

    return docs;
  }, [claimDocs, policyDocs, onlineDocuments, inspectionDocs, docOptions, canDeleteDocs]);

  // ─── Paginación ───
  const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } =
    usePagination(allDocuments, 10);

  // Badge de origen
  function OrigenBadge({ origen }: { origen: UnifiedDoc["origen"] }) {
    if (origen === "siniestro") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300">
          <FolderOpen className="h-3 w-3" />
          Siniestro
        </span>
      );
    }
    if (origen === "poliza") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300">
          <Shield className="h-3 w-3" />
          Póliza
        </span>
      );
    }
    if (origen === "inspeccion") {
      return (
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300">
          <ClipboardCheck className="h-3 w-3" />
          Inspección
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-700 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-300">
        <Globe className="h-3 w-3" />
        CMF
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ GRILLA UNIFICADA: todos los documentos ═══ */}
      <div className="app-panel">
        <div className="app-grid-toolbar">
          <div className="app-grid-toolbar-left">
            <h3 className="app-section-title">
              <FolderOpen className="h-4 w-4" />
              Documentos
              {total > 0 && (
                <span className="text-[11px] text-muted-foreground">({total})</span>
              )}
            </h3>
            {canCreateDocs && (
              <button
                type="button"
                className="btn-icon-sm"
                title="Subir documentos"
                onClick={() => setUploadModal((p) => ({ ...p, visible: true, status: "idle", fileName: "", fileSize: 0, loaded: 0, isDragging: false }))}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {total > 0 && (
            <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          )}
        </div>

        {claimDocsLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : paginatedData.length > 0 ? (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="w-25">Origen</th>
                  <th className="w-22.5">Código</th>
                  <th className="w-[min(45vw,420px)]">Tipo / Nombre</th>
                  <th className="w-15">Ext.</th>
                  <th className="w-20">Tamaño</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <OrigenBadge origen={doc.origen} />
                    </td>
                    <td className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                      {doc.codigo}
                    </td>
                    <td className="font-medium wrap-break-word">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="truncate">{doc.nombre}</span>
                        {doc.subnombre && (
                          <>
                            <span className="text-muted-foreground/40 shrink-0">/</span>
                            <span className="text-[10px] text-muted-foreground/70 truncate" title={doc.subnombre}>
                              {doc.subnombre}
                            </span>
                          </>
                        )}
                      </div>
                      {(doc.aiStatus === "pending" || doc.aiStatus === "processing") ? (
                        <AiProcessingBadge status={doc.aiStatus} />
                      ) : null}
                    </td>
                    <td className="text-muted-foreground uppercase text-[11px]">
                      {doc.ext}
                    </td>
                    <td className="text-muted-foreground">{doc.tamano}</td>
                    <td>
                      <div className="app-row-actions">
                        {/* Control segmentado de IA */}
                        {((doc.origen === "siniestro" && doc.docId) || doc.origen === "inspeccion") && (
                          <div className="ai-card-controls">
                            {/* done → re-analizar + ver resultado */}
                            {doc.aiSummary && doc.aiStatus === "done" && (
                              <div className="ai-card-controls-group">
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch("/api/ai/reanalyze", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          table: doc.origen === "inspeccion" ? "inspection_evidences" : "claim_documents",
                                          id: doc.origen === "inspeccion" ? doc.id : doc.docId,
                                          claimId,
                                        }),
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
                                      queryClient.invalidateQueries({ queryKey: ["inspection-documents", claimId] });
                                      toast.success("Re-análisis iniciado");
                                    } catch {
                                      toast.error("No se pudo iniciar el re-análisis");
                                    }
                                  }}
                                  className="ai-card-ctrl-btn ai-card-ctrl-reanalyze"
                                  title="Re-analizar con IA"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Re-IA</span>
                                </button>
                                <Popover>
                                  <PopoverTrigger
                                    render={
                                      <button className="ai-card-ctrl-btn ai-card-ctrl-log" title="Ver log del análisis">
                                        <FileText className="h-3 w-3" />
                                        <span>Ver</span>
                                      </button>
                                    }
                                  />
                                  <PopoverContent side="top" align="start" className="ai-log-popover">
                                    {/* Header: código + fecha */}
                                    <div className="ai-log-header">
                                      <span className="ai-log-code">{doc.codigo}</span>
                                      {doc.aiAnalyzedAt && (
                                        <span className="ai-log-date">
                                          {new Date(doc.aiAnalyzedAt).toLocaleString("es-CL", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      )}
                                      {doc.aiSummary && <AiCopyButton text={cleanMarkdown(doc.aiSummary)} />}
                                    </div>
                                    {doc.aiModel && (
                                      <div className="ai-log-models">
                                        {doc.aiModel.split("|").map((m, i) => {
                                          const trimmed = m.trim();
                                          const isVision = trimmed.startsWith("vision:");
                                          const label = isVision ? "Visión" : "Razonamiento";
                                          const modelName = trimmed.replace(/^(vision|razonamiento):/, "").trim();
                                          return (
                                            <div key={i} className="ai-log-model-row">
                                              <span className="ai-log-model-tag">{label}</span>
                                              <span className="ai-log-model-name">{modelName}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Resumen */}
                                    <div className="ai-log-section ai-log-section-summary">
                                      <div className="ai-log-summary">{cleanMarkdown(doc.aiSummary)}</div>
                                    </div>
                                    {/* Prompt enviado */}
                                    {doc.aiPromptSnapshot && (
                                      <Popover>
                                        <PopoverTrigger
                                          render={
                                            <button className="ai-log-prompt-trigger" title="Ver prompt enviado">
                                              <ChevronDown className="h-2.5 w-2.5" />
                                              <span>Prompt enviado</span>
                                            </button>
                                          }
                                        />
                                        <PopoverContent side="top" align="start" className="ai-prompt-tooltip">
                                          <div className="ai-log-prompt">
                                            {doc.aiPromptSnapshot.system_prompt && (
                                              <div className="ai-log-prompt-block">
                                                <span className="ai-log-prompt-tag">system</span>
                                                <pre className="ai-log-prompt-text">{doc.aiPromptSnapshot.system_prompt}</pre>
                                              </div>
                                            )}
                                            {doc.aiPromptSnapshot.user_prompt && (
                                              <div className="ai-log-prompt-block">
                                                <span className="ai-log-prompt-tag">user</span>
                                                <pre className="ai-log-prompt-text">{doc.aiPromptSnapshot.user_prompt}</pre>
                                              </div>
                                            )}
                                            {doc.aiPromptSnapshot.refinement_prompt && (
                                              <div className="ai-log-prompt-block">
                                                <span className="ai-log-prompt-tag">refinement</span>
                                                <pre className="ai-log-prompt-text">{doc.aiPromptSnapshot.refinement_prompt}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}

                            {/* pending/skipped/error → analizar / re-analizar */}
                            {(!doc.aiSummary || doc.aiStatus === "error" || doc.aiStatus === "skipped") && (
                              <div className="ai-card-controls-group">
                                <button
                                  onClick={async () => {
                                    try {
                                      await fetch("/api/ai/reanalyze", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          table: doc.origen === "inspeccion" ? "inspection_evidences" : "claim_documents",
                                          id: doc.origen === "inspeccion" ? doc.id : doc.docId,
                                          claimId,
                                        }),
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
                                      queryClient.invalidateQueries({ queryKey: ["inspection-documents", claimId] });
                                      toast.success("Re-análisis iniciado");
                                    } catch {
                                      toast.error("No se pudo iniciar el re-análisis");
                                    }
                                  }}
                                  className={`ai-card-ctrl-btn ${doc.aiStatus === "error" ? "ai-card-ctrl-error" : "ai-card-ctrl-reanalyze"}`}
                                  title={doc.aiSummary ? "Re-analizar con IA" : "Analizar con IA"}
                                >
                                  {doc.aiStatus === "error" ? <AlertCircle className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                                  <span>Re-IA</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Ver documento */}
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
                            title="Ver documento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {/* Eliminar */}
                        {doc.canDelete && doc.docId && (
                          <button
                            type="button"
                            className="btn-icon-sm btn-danger-hover"
                            onClick={() => {
                              setDeleteModal({
                                visible: true,
                                docId: doc.docId!,
                                docCode: doc.codigo,
                                docType: doc.docTypeCode || "",
                                fileName: doc.subnombre || doc.nombre,
                                reason: "",
                                status: "confirming",
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay documentos para este siniestro.
          </p>
        )}

        {/* Paginación abajo */}
        {total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* ═══ MODAL: Eliminar documento ═══ */}
      <Dialog
        open={deleteModal.visible}
        onOpenChange={(open) => {
          if (!open && deleteModal.status === "deleting") return;
          setDeleteModal((p) => ({ ...p, visible: open, status: "confirming" }));
        }}
      >
        <DialogContent className="modal-sm" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {deleteModal.status === "done"
                ? "Documento eliminado"
                : deleteModal.status === "error"
                ? "Error"
                : "Eliminar documento"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* Info del documento */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{deleteModal.fileName}</div>
                <div className="text-[10px]">{deleteModal.docCode} · {deleteModal.docType}</div>
              </div>
            </div>

            {/* Fase confirmación: campo motivo + botones */}
            {deleteModal.status === "confirming" && (
              <>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
                  Se borrará el archivo físico. Si la RTA estaba emitida, se reversará automáticamente.
                </div>
                <div className="space-y-1.5">
                  <label className="app-field-label">Motivo de eliminación (opcional)</label>
                  <textarea
                    className="app-input resize-none"
                    rows={2}
                    placeholder="Ej: documento incorrecto, duplicado..."
                    value={deleteModal.reason}
                    onChange={(e) => setDeleteModal((p) => ({ ...p, reason: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* Fase eliminando: spinner */}
            {deleteModal.status === "deleting" && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-[11px] text-muted-foreground">Eliminando...</span>
              </div>
            )}

            {/* Fase done: check */}
            {deleteModal.status === "done" && (
              <div className="flex items-center gap-2 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600">Documento eliminado correctamente</span>
              </div>
            )}

            {/* Fase error: X */}
            {deleteModal.status === "error" && (
              <div className="flex items-center gap-2 py-2">
                <XCircle className="h-4 w-4 text-rose-500" />
                <span className="text-[11px] font-medium text-rose-600">{deleteModal.errorMsg || "Error al eliminar"}</span>
              </div>
            )}
          </div>

          {/* Footer: solo en confirmación */}
          {deleteModal.status === "confirming" && (
            <div className="modal-footer">
              <Button
                className="pg-btn-platinum"
                onClick={() => setDeleteModal((p) => ({ ...p, visible: false }))}
              >
                Cancelar
              </Button>
              <Button
                className="pg-btn-platinum"
                onClick={() => {
                  deleteMut.mutate({ docId: deleteModal.docId, reason: deleteModal.reason });
                }}
              >
                Eliminar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL: Subir documento (selección tipo + drag&drop + progreso) ═══ */}
      <Dialog
        open={uploadModal.visible}
        onOpenChange={(open) => {
          if (!open && (uploadModal.status === "uploading" || uploadModal.status === "processing")) return;
          setUploadModal((p) => ({ ...p, visible: open, status: "idle" }));
        }}
        dismissible={false}
      >
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {uploadModal.status === "done"
                ? "Documento subido"
                : uploadModal.status === "error"
                ? "Error"
                : uploadModal.status === "idle"
                ? "Subir documento"
                : "Subiendo documento"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* ─── Fase idle: selección de tipo + drag&drop ─── */}
            {uploadModal.status === "idle" && (
              <>
                {/* Select de tipo de documento */}
                <div className="space-y-1.5">
                  <label className="app-field-label">Tipo de documento</label>
                  <Select
                    value={selectedDocType}
                    onValueChange={(v) => setSelectedDocType(v ?? "")}
                  >
                    <SelectTrigger className="app-input">
                      <SelectValue placeholder="Seleccionar tipo...">
                        {(value) => {
                          const all = [...docOptions.lineDocs, ...docOptions.restDocs];
                          const found = all.find((d) => d.code === value);
                          return found ? found.name : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {docOptions.lineDocs.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Línea de Negocio</SelectLabel>
                          {docOptions.lineDocs.map((d) => (
                            <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {docOptions.lineDocs.length > 0 && docOptions.restDocs.length > 0 && (
                        <SelectSeparator />
                      )}
                      {docOptions.restDocs.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Otros Documentos</SelectLabel>
                          {docOptions.restDocs.map((d) => (
                            <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Drag & drop area */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setUploadModal((p) => ({ ...p, isDragging: true }));
                  }}
                  onDragLeave={() => setUploadModal((p) => ({ ...p, isDragging: false }))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setUploadModal((p) => ({ ...p, isDragging: false }));
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (!selectedDocType) {
                        toast.error("Selecciona un tipo de documento antes de subir");
                        return;
                      }
                      uploadMut.mutate({ file, docTypeCode: selectedDocType });
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    uploadModal.isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <Upload className={`h-8 w-8 ${uploadModal.isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-[11px] font-medium text-foreground">
                    Arrastra el archivo aquí
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    o haz clic para seleccionar
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="pg-btn-platinum mt-1"
                  >
                    Seleccionar
                  </Button>
                </div>

                <div className="text-[10px] text-muted-foreground text-center">
                  PDF, DOC, XLS, TXT · máx. 50 MB
                </div>
              </>
            )}

            {/* ─── Fase uploading/processing/done/error: info del archivo + progreso ─── */}
            {uploadModal.status !== "idle" && (
              <>
                {/* Info del archivo */}
                <div className="flex items-center gap-2.5 rounded-md bg-muted/40 p-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-foreground">{uploadModal.fileName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatFileSize(uploadModal.fileSize)}</div>
                  </div>
                </div>

                {/* Subiendo: barra de progreso */}
                {uploadModal.status === "uploading" && (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between">
                      <span className="text-[11px] text-muted-foreground">Subiendo...</span>
                      <div className="flex items-end gap-3">
                        {uploadModal.speed > 0 && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {uploadModal.speed < 1024
                              ? `${uploadModal.speed.toFixed(0)} KB/s`
                              : `${(uploadModal.speed / 1024).toFixed(1)} MB/s`}
                          </span>
                        )}
                        <span className="text-lg font-bold tabular-nums text-primary leading-none">
                          {uploadModal.fileSize > 0
                            ? Math.round((uploadModal.loaded / uploadModal.fileSize) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                        style={{
                          width: `${uploadModal.fileSize > 0 ? (uploadModal.loaded / uploadModal.fileSize) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>
                        {formatFileSize(uploadModal.loaded)} / {formatFileSize(uploadModal.fileSize)}
                      </span>
                      <span>
                        {uploadModal.elapsed > 0
                          ? `${(uploadModal.elapsed / 1000).toFixed(1)}s`
                          : ""}
                      </span>
                    </div>
                  </div>
                )}

                {/* Procesando */}
                {uploadModal.status === "processing" && (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-[11px] text-muted-foreground">Vinculando documento y verificando RTA...</span>
                  </div>
                )}

                {/* Done */}
                {uploadModal.status === "done" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-[11px] font-medium text-emerald-600">Documento subido correctamente</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-6">
                      {formatFileSize(uploadModal.fileSize)} · {uploadModal.fileName}
                    </div>
                  </div>
                )}

                {/* Error */}
                {uploadModal.status === "error" && (
                  <div className="flex items-center gap-2 py-1">
                    <XCircle className="h-4 w-4 text-rose-500" />
                    <span className="text-[11px] font-medium text-rose-600">
                      {uploadModal.errorMsg || "Error al subir"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            {uploadModal.status === "idle" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false }))}
              >
                Cancelar
              </Button>
            )}
            {uploadModal.status === "done" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, visible: false, status: "idle" }))}
              >
                Cerrar
              </Button>
            )}
            {uploadModal.status === "error" && (
              <Button
                className="pg-btn-platinum"
                onClick={() => setUploadModal((p) => ({ ...p, status: "idle", fileName: "", fileSize: 0, loaded: 0 }))}
              >
                Reintentar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

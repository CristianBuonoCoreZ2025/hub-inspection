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
  Layers,
  Shield,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
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

  // 1. Documentos físicos del siniestro
  const { data: claimDocs, isLoading: claimDocsLoading } = useQuery({
    queryKey: ["claim-documents", claimId],
    queryFn: () => getClaimDocuments(claimId),
    enabled: !!claimId,
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

  // Estado del modal de progreso de subida
  const [uploadProgress, setUploadProgress] = useState<{
    visible: boolean;
    fileName: string;
    fileSize: number;
    loaded: number;
    speed: number; // KB/s
    elapsed: number; // ms
    status: "uploading" | "processing" | "done" | "error";
    errorMsg?: string;
  }>({ visible: false, fileName: "", fileSize: 0, loaded: 0, speed: 0, elapsed: 0, status: "uploading" });

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
            setUploadProgress((p) => ({
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
          setUploadProgress((p) => ({
            ...p,
            status: "uploading",
            loaded: p.fileSize,
            speed: finalSpeed,
            elapsed,
          }));
          setTimeout(() => {
            setUploadProgress((p) => ({ ...p, status: "processing" }));
          }, 400);
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadProgress((p) => ({ ...p, status: "done" }));
              resolve(data);
            } catch {
              reject(new Error("Respuesta inválida del servidor"));
            }
          } else {
            let msg = "Error al subir archivo";
            try {
              const body = JSON.parse(xhr.responseText);
              if (body.error) msg = body.error;
            } catch {}
            setUploadProgress((p) => ({ ...p, status: "error", errorMsg: msg }));
            reject(new Error(msg));
          }
        });

        xhr.addEventListener("error", () => {
          setUploadProgress((p) => ({ ...p, status: "error", errorMsg: "Error de red" }));
          reject(new Error("Error de red al subir archivo"));
        });

        xhr.addEventListener("abort", () => {
          setUploadProgress((p) => ({ ...p, status: "error", errorMsg: "Subida cancelada" }));
          reject(new Error("Subida cancelada"));
        });

        xhr.open("POST", "/api/claims/documents/upload");
        xhr.send(formData);
      });
    },
    onMutate: ({ file }) => {
      setUploadProgress({
        visible: true,
        fileName: file.name,
        fileSize: file.size,
        loaded: 0,
        speed: 0,
        elapsed: 0,
        status: "uploading",
      });
    },
    onSuccess: () => {
      toast.success("Documento subido");
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests"] });
      queryClient.invalidateQueries({ queryKey: ["claim-action"] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
      queryClient.invalidateQueries({ queryKey: ["gestion-screens"] });
      // Cerrar modal después de 1.5s para que se vea el check verde
      setTimeout(() => {
        setUploadProgress((p) => ({ ...p, visible: false }));
      }, 1500);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setTimeout(() => {
        setUploadProgress((p) => ({ ...p, visible: false }));
      }, 3000);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!selectedDocType) {
        toast.error("Selecciona un tipo de documento antes de subir");
        e.target.value = "";
        return;
      }
      uploadMut.mutate({ file, docTypeCode: selectedDocType });
    }
    e.target.value = "";
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const canCreateDocs = canCreate("claims_documentos");
  const canDeleteDocs = canDelete("claims_documentos");

  return (
    <div className="space-y-4">
      {/* ═══ SECCIÓN 1: Documentos físicos del siniestro ═══ */}
      <div className="app-panel">
        <div className="flex items-center justify-between mb-3">
          <h3 className="app-section-title">
            <FolderOpen className="h-4 w-4" />
            Documentos del Siniestro
          </h3>
          {canCreateDocs && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
              <div className="flex items-center gap-2">
                <Select
                  value={selectedDocType || "__none"}
                  onValueChange={(v) => setSelectedDocType(v === "__none" ? "" : (v ?? ""))}
                >
                  <SelectTrigger className="app-input h-7 w-[200px]">
                    <SelectValue placeholder="Tipo de documento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin selección</SelectItem>
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
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="pg-btn-platinum-icon"
                  disabled={uploadMut.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadMut.isPending ? "Subiendo..." : "Subir"}
                </Button>
              </div>
            </>
          )}
        </div>

        {claimDocsLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando...</p>
        ) : claimDocs && claimDocs.length > 0 ? (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Ext.</th>
                  <th>Tamaño</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {claimDocs.map((doc) => {
                  const docTypeName =
                    docOptions.lineDocs.find((d) => d.code === doc.document_type)?.name ||
                    docOptions.restDocs.find((d) => d.code === doc.document_type)?.name ||
                    doc.document_type || "—";
                  return (
                  <tr key={doc.id}>
                    <td className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                      {doc.doc_code || "—"}
                    </td>
                    <td className="font-medium wrap-break-word">
                      <div>{docTypeName}</div>
                      {doc.original_filename && (
                        <div className="text-[10px] text-muted-foreground/70 truncate max-w-[220px]">
                          {doc.original_filename}
                        </div>
                      )}
                    </td>
                    <td className="text-muted-foreground uppercase text-[11px]">
                      {(doc.original_filename?.split(".").pop() || "—")}
                    </td>
                    <td className="text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                    <td>
                      <div className="app-row-actions">
                        {doc.document_url && (
                          <a
                            href={doc.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
                            title="Ver documento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {canDeleteDocs && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="btn-icon-sm btn-danger-hover"
                            onClick={() => {
                              setDeleteModal({
                                visible: true,
                                docId: doc.id,
                                docCode: doc.doc_code || "",
                                docType: doc.document_type || "",
                                fileName: doc.original_filename || "",
                                reason: "",
                                status: "confirming",
                              });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay documentos del siniestro.
          </p>
        )}
      </div>

      {/* ═══ SECCIÓN 2: Documentos físicos de la póliza asociada ═══ */}
      <div className="app-panel">
        <h3 className="app-section-title mb-3">
          <Shield className="h-4 w-4" />
          Documentos de la Póliza
        </h3>

        {!policyId ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            El siniestro no tiene póliza asociada.
          </p>
        ) : policyDocs && policyDocs.length > 0 ? (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {policyDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium wrap-break-word">{doc.document_name}</td>
                    <td className="text-muted-foreground">
                      {docOptions.lineDocs.find((d) => d.code === doc.document_type)?.name ||
                       docOptions.restDocs.find((d) => d.code === doc.document_type)?.name ||
                       doc.document_type || "—"}
                    </td>
                    <td className="text-muted-foreground">{formatFileSize(doc.file_size)}</td>
                    <td>
                      {doc.document_url && (
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
                          title="Ver documento"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            La póliza no tiene documentos físicos.
          </p>
        )}
      </div>

      {/* ═══ SECCIÓN 3: Documentos online de coberturas (CMF) ═══ */}
      <div className="app-panel">
        <h3 className="app-section-title mb-3">
          <Globe className="h-4 w-4" />
          Documentos Online (CMF)
        </h3>

        {!policyId ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            El siniestro no tiene póliza asociada.
          </p>
        ) : onlineDocuments.length > 0 ? (
          <div className="app-data-table-wrap">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="w-[50px]">Tipo</th>
                  <th className="w-[130px]">Código</th>
                  <th>Cobertura</th>
                  <th>Subcobertura</th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {onlineDocuments.map((doc, i) => (
                  <tr key={i}>
                    <td>
                      {doc.type === "POL" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600">
                          <FileText className="h-3 w-3" /> POL
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600">
                          <Layers className="h-3 w-3" /> CAD
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-[11px] whitespace-nowrap">{doc.code}</td>
                    <td className="wrap-break-word">{doc.coverage_name}</td>
                    <td className="text-muted-foreground wrap-break-word">{doc.subcoverage_name || "-"}</td>
                    <td>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Ver documento CMF"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            La póliza no tiene coberturas con documentos online.
          </p>
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

      {/* ═══ MODAL: Progreso de subida ═══ */}
      <Dialog
        open={uploadProgress.visible}
        onOpenChange={(open) => {
          if (!open && (uploadProgress.status === "uploading" || uploadProgress.status === "processing")) return;
          setUploadProgress((p) => ({ ...p, visible: open }));
        }}
      >
        <DialogContent className="modal-sm" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title">
              {uploadProgress.status === "done"
                ? "Documento subido"
                : uploadProgress.status === "error"
                ? "Error"
                : "Subiendo documento"}
            </DialogTitle>
          </div>

          <div className="modal-body space-y-3">
            {/* Info del archivo: icono + nombre + tamaño total */}
            <div className="flex items-center gap-2.5 rounded-md bg-muted/40 p-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-foreground">{uploadProgress.fileName}</div>
                <div className="text-[10px] text-muted-foreground">{formatFileSize(uploadProgress.fileSize)}</div>
              </div>
            </div>

            {/* Subiendo: barra de progreso con detalle completo */}
            {uploadProgress.status === "uploading" && (
              <div className="space-y-2">
                {/* % grande + velocidad */}
                <div className="flex items-end justify-between">
                  <span className="text-[11px] text-muted-foreground">Subiendo...</span>
                  <div className="flex items-end gap-3">
                    {uploadProgress.speed > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {uploadProgress.speed < 1024
                          ? `${uploadProgress.speed.toFixed(0)} KB/s`
                          : `${(uploadProgress.speed / 1024).toFixed(1)} MB/s`}
                      </span>
                    )}
                    <span className="text-lg font-bold tabular-nums text-primary leading-none">
                      {uploadProgress.fileSize > 0
                        ? Math.round((uploadProgress.loaded / uploadProgress.fileSize) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
                {/* Barra */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                    style={{
                      width: `${uploadProgress.fileSize > 0 ? (uploadProgress.loaded / uploadProgress.fileSize) * 100 : 0}%`,
                    }}
                  />
                </div>
                {/* Bytes subidos / total + tiempo */}
                <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>
                    {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.fileSize)}
                  </span>
                  <span>
                    {uploadProgress.elapsed > 0
                      ? `${(uploadProgress.elapsed / 1000).toFixed(1)}s`
                      : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Procesando: spinner con detalle */}
            {uploadProgress.status === "processing" && (
              <div className="flex items-center gap-2 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-[11px] text-muted-foreground">Vinculando documento y verificando RTA...</span>
              </div>
            )}

            {/* Done: check + resumen */}
            {uploadProgress.status === "done" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px] font-medium text-emerald-600">Documento subido correctamente</span>
                </div>
                <div className="text-[10px] text-muted-foreground pl-6">
                  {formatFileSize(uploadProgress.fileSize)} · {uploadProgress.fileName}
                </div>
              </div>
            )}

            {/* Error: X + mensaje */}
            {uploadProgress.status === "error" && (
              <div className="flex items-center gap-2 py-1">
                <XCircle className="h-4 w-4 text-rose-500" />
                <span className="text-[11px] font-medium text-rose-600">
                  {uploadProgress.errorMsg || "Error al subir"}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

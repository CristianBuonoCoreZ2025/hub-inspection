"use client";

import { useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClaimDocuments,
  createClaimDocument,
  deactivateClaimDocument,
} from "@/services/claim-documents-physical";
import {
  getPolicyDocuments,
  getPolicyCoveragesByPolicyIdDirect,
} from "@/services/policies";
import {
  getCoverageCatalog,
  getSubcoveragesByCoverageIds,
} from "@/services/coverage-catalog";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

interface ClaimDocumentsTabProps {
  claimId: string;
  policyId: string | null;
}

export default function ClaimDocumentsTab({ claimId, policyId }: ClaimDocumentsTabProps) {
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Documentos físicos del siniestro
  const { data: claimDocs, isLoading: claimDocsLoading } = useQuery({
    queryKey: ["claim-documents", claimId],
    queryFn: () => getClaimDocuments(claimId),
    enabled: !!claimId,
  });

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

  // Mutation: subir documento del siniestro
  const uploadMut = useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/inspection/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error al subir archivo");
      const data = await res.json();
      if (!data.url) throw new Error("No se recibió URL");
      return createClaimDocument({
        claim_id: claimId,
        document_name: file.name,
        document_url: data.url,
        document_type: file.type,
        file_size: file.size,
      });
    },
    onSuccess: () => {
      toast.success("Documento subido");
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deactivateClaimDocument,
    onSuccess: () => {
      toast.success("Documento eliminado");
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMut.mutate({ file });
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
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="pg-btn-platinum-icon"
                disabled={uploadMut.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadMut.isPending ? "Subiendo..." : "Subir"}
              </Button>
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
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Tamaño</th>
                  <th className="w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {claimDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium wrap-break-word">{doc.document_name}</td>
                    <td className="text-muted-foreground">{doc.document_type || "-"}</td>
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
                            className="btn-danger btn-icon"
                            onClick={() => {
                              if (confirm("¿Eliminar este documento?")) deleteMut.mutate(doc.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
                    <td className="text-muted-foreground">{doc.document_type || "-"}</td>
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
    </div>
  );
}

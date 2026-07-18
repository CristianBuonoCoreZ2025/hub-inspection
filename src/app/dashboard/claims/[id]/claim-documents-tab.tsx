"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getClaimDocuments,
  deactivateClaimDocument,
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
  Ban,
  Layers,
  Shield,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Mutation: subir documento del siniestro
  const uploadMut = useMutation({
    mutationFn: async ({ file, docTypeCode }: { file: File; docTypeCode: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("claimId", claimId);
      if (docTypeCode) formData.append("documentTypeCode", docTypeCode);
      const res = await fetch("/api/claims/documents/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al subir archivo");
      }
      return res.json();
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
      toast.success("Documento desactivado");
      queryClient.invalidateQueries({ queryKey: ["claim-documents", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
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
                  <th>Nombre</th>
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
                    <td className="font-medium wrap-break-word">
                      <div>{docTypeName}</div>
                      {doc.original_filename && doc.original_filename !== docTypeName && (
                        <div className="text-[10px] text-muted-foreground/70 truncate max-w-[220px]">
                          {doc.original_filename}
                        </div>
                      )}
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
                              if (confirm("¿Desactivar este documento?")) deleteMut.mutate(doc.id);
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" />
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
    </div>
  );
}

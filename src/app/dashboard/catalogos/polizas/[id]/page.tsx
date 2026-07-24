"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Trash2, FileCheck, Search, ChevronDown, ShieldCheck, Check, FileText, Upload, ExternalLink, File, GripVertical, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
 getPolicyById,
 getPolicyCoveragesByPolicyIdDirect,
 createPolicy,
 updatePolicy,
 createPolicyCoveragesBatch,
 updatePolicyCoverage,
 deactivatePolicyCoverage,
 deactivatePolicyCoverageWithSubcoverages,
 getPolicyBusinessLines,
 setPolicyBusinessLines,
 getPolicyDocuments,
 deactivatePolicyDocument,
 type PolicyCoverage,
} from "@/services/policies";
import {
 getCoverageCatalog,
 getCoverageThemes,
 getCoverageCatalogByTheme,
 getSubcoveragesByCoverageId,
 getSubcoveragesByCoverageIds,
} from "@/services/coverage-catalog";
import { getInsuranceCompanies, getBusinessLines, getBrokers, getCountries, getCountryCurrencies } from "@/services/catalogs";
import { AiAnalysisButton } from "@/components/ai/ai-analysis-button";

const statusLabels: Record<string, string> = {
 draft: "Borrador",
 active: "Activa",
 expired: "Vencida",
 cancelled: "Cancelada",
};

export default function PolicyDetailPage() {
 const params = useParams();
 const router = useRouter();
 const queryClient = useQueryClient();
 const { profile } = useAuth();
 const policyId = params.id as string;
 const isNew = policyId === "nueva";

 const { data: policy, isLoading } = useQuery({
 queryKey: ["policy", policyId],
 queryFn: () => getPolicyById(policyId),
 enabled: !isNew,
 });

 const { data: policyCoverages } = useQuery({
 queryKey: ["policy-coverages", policyId],
 queryFn: () => getPolicyCoveragesByPolicyIdDirect(policyId),
 enabled: !isNew,
 });

 // Líneas de negocio de la póliza (múltiples)
 const { data: policyBusinessLines } = useQuery({
 queryKey: ["policy-business-lines", policyId],
 queryFn: () => getPolicyBusinessLines(policyId),
 enabled: !isNew,
 });

 const { data: insuranceCompanies } = useQuery({
 queryKey: ["insurance-companies"],
 queryFn: getInsuranceCompanies,
 });
 const { data: businessLines } = useQuery({
 queryKey: ["business-lines"],
 queryFn: getBusinessLines,
 });
 const { data: brokers } = useQuery({
 queryKey: ["brokers"],
 queryFn: getBrokers,
 });
 const { data: countries } = useQuery({
 queryKey: ["countries"],
 queryFn: getCountries,
 });

 const defaultCountry = countries?.find((c) => c.code === "CL")?.id || "";

 const [form, setForm] = useState(() => {
 const today = new Date();
 const nextYear = new Date(today);
 nextYear.setDate(nextYear.getDate() + 365);
 return {
 policy_name: "",
 policy_number: "",
 policy_type: "individual" as "individual" | "collective",
 insurance_company_id: "",
 country_id: "",
 broker_id: "",
 business_line_id: "",
 currency: "CLP",
 premium_amount: "",
 insured_amount: "",
 start_date: today.toISOString().slice(0, 10),
 end_date: nextYear.toISOString().slice(0, 10),
 status: "active" as "draft" | "active" | "expired" | "cancelled",
 comments: "",
 };
 });

 // Inicializar form cuando carga la póliza
 const [initialized, setInitialized] = useState(false);
 if (policy && !initialized) {
 const today = new Date();
 const nextYear = new Date(today);
 nextYear.setDate(nextYear.getDate() + 365);
 setForm({
 policy_name: policy.policy_name || "",
 policy_number: policy.policy_number || "",
 policy_type: policy.policy_type || "individual",
 insurance_company_id: policy.insurance_company_id || "",
 country_id: policy.country_id || defaultCountry,
 broker_id: policy.broker_id || "",
 business_line_id: policy.business_line_id || "",
 currency: policy.currency || "CLP",
 premium_amount: policy.premium_amount?.toString() || "",
 insured_amount: policy.insured_amount?.toString() || "",
 start_date: policy.start_date || today.toISOString().slice(0, 10),
 end_date: policy.end_date || nextYear.toISOString().slice(0, 10),
 status: policy.status || "active",
 comments: policy.comments || "",
 });
 setInitialized(true);
 }

 // País de la compañía de seguros seleccionada (para filtrar coberturas)
 const selectedCompanyCountryId = useMemo(() => {
 if (form.insurance_company_id && insuranceCompanies) {
 const company = insuranceCompanies.find((c) => c.id === form.insurance_company_id);
 return company?.country_id || defaultCountry;
 }
 return defaultCountry;
 }, [form.insurance_company_id, insuranceCompanies, defaultCountry]);

 // Catálogo de coberturas filtrado por país (para el formulario de agregar)
 const { data: coverageCatalog } = useQuery({
 queryKey: ["coverage-catalog", selectedCompanyCountryId],
 queryFn: () => getCoverageCatalog(selectedCompanyCountryId),
 });

 // Monedas dinámicas según el país de la compañía
 const { data: countryCurrencies } = useQuery({
 queryKey: ["country-currencies-policy", selectedCompanyCountryId],
 queryFn: () => getCountryCurrencies(selectedCompanyCountryId),
 });

 // Catálogo completo sin filtro de país (para buscar códigos en la grilla de coberturas existentes)
 const { data: allCoverageCatalog } = useQuery({
 queryKey: ["coverage-catalog-all"],
 queryFn: () => getCoverageCatalog(),
 });

 // Temas disponibles para el país seleccionado
 const { data: coverageThemes } = useQuery({
 queryKey: ["coverage-themes", selectedCompanyCountryId],
 queryFn: () => getCoverageThemes(selectedCompanyCountryId),
 });

 // Tema seleccionado para filtrar coberturas
 const [selectedTheme, setSelectedTheme] = useState<string>("");
 const { data: themeCoverages } = useQuery({
 queryKey: ["coverage-by-theme", selectedTheme, selectedCompanyCountryId],
 queryFn: () => getCoverageCatalogByTheme(selectedTheme, selectedCompanyCountryId),
 enabled: !!selectedTheme,
 });

 // Subcoberturas de la cobertura seleccionada
 const [selectedCoverageCatalogId, setSelectedCoverageCatalogId] = useState<string>("");
 const { data: subcoverages } = useQuery({
 queryKey: ["subcoverages", selectedCoverageCatalogId],
 queryFn: () => getSubcoveragesByCoverageId(selectedCoverageCatalogId),
 enabled: !!selectedCoverageCatalogId,
 });

 // Todas las subcoberturas de las coberturas que tiene la póliza (para mostrar códigos en la grilla)
 const policyCoverageCatalogIds = useMemo(() => {
 if (!policyCoverages) return [];
 const ids = new Set<string>();
 for (const pc of policyCoverages) {
 if (pc.is_active && pc.coverage_catalog_id) ids.add(pc.coverage_catalog_id);
 }
 return Array.from(ids);
 }, [policyCoverages]);

 const { data: allPolicySubcoverages } = useQuery({
 queryKey: ["policy-subcoverages-all", policyCoverageCatalogIds],
 queryFn: () => getSubcoveragesByCoverageIds(policyCoverageCatalogIds),
 enabled: policyCoverageCatalogIds.length > 0,
 });

 // Mutations para póliza
 const saveMut = useMutation({
 mutationFn: async () => {
 const input = {
 policy_name: form.policy_name,
 policy_number: form.policy_number || null,
 policy_type: form.policy_type,
 insurance_company_id: form.insurance_company_id || null,
 country_id: form.country_id || null,
 broker_id: form.broker_id || null,
 business_line_id: primaryBusinessLine || selectedBusinessLines[0] || null,
 currency: form.currency,
 premium_amount: form.premium_amount ? Number(form.premium_amount) : 0,
 insured_amount: form.insured_amount ? Number(form.insured_amount) : null,
 start_date: form.start_date,
 end_date: form.end_date,
 status: form.status,
 comments: form.comments || null,
 company_id: profile?.company_id || "",
 };
 let savedPolicy;
 if (isNew) {
 savedPolicy = await createPolicy(input);
 } else {
 savedPolicy = await updatePolicy(policyId, input);
 }
 // Guardar líneas de negocio (N:M)
 if (selectedBusinessLines.length > 0) {
 await setPolicyBusinessLines(
 savedPolicy.id,
 selectedBusinessLines,
 primaryBusinessLine || selectedBusinessLines[0]
 );
 }
 return savedPolicy;
 },
 onSuccess: (data) => {
 toast.success(isNew ? "Póliza creada" : "Póliza actualizada");
 queryClient.invalidateQueries({ queryKey: ["policies"] });
 queryClient.invalidateQueries({ queryKey: ["policy", policyId] });
 queryClient.invalidateQueries({ queryKey: ["policy-business-lines", policyId] });
 queryClient.invalidateQueries({ queryKey: ["policy-business-lines", data.id] });
 if (isNew) {
 router.push(`/dashboard/catalogos/polizas/${data.id}`);
 }
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // Mutations para coberturas
 const addCovMut = useMutation({
 mutationFn: async (input: {
 coverage_catalog_id: string;
 coverage_name: string;
 selected_subcoverages: Array<{
 subcoverage_catalog_id: string;
 subcoverage_name: string;
 }>;
 insured_amount?: number | null;
 deductible_amount?: number | null;
 }) => {
 const items = [
 // La cobertura padre
 {
 coverage_catalog_id: input.coverage_catalog_id,
 subcoverage_catalog_id: null,
 coverage_name: input.coverage_name,
 subcoverage_name: null,
 insured_amount: input.insured_amount ?? null,
 deductible_amount: input.deductible_amount ?? null,
 },
 // Las subcoberturas seleccionadas
 ...input.selected_subcoverages.map((s) => ({
 coverage_catalog_id: input.coverage_catalog_id,
 subcoverage_catalog_id: s.subcoverage_catalog_id,
 coverage_name: input.coverage_name,
 subcoverage_name: s.subcoverage_name,
 insured_amount: null as number | null,
 deductible_amount: null as number | null,
 })),
 ];
 return createPolicyCoveragesBatch(
 policyId,
 policy?.policy_number || "",
 items
 );
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["policy-coverages", policyId] });
 queryClient.invalidateQueries({ queryKey: ["policy", policyId] });
 // Mantener el tema seleccionado, solo resetear la cobertura
 setNewCov({ coverage_catalog_id: "", insured_amount: "", deductible_amount: "" });
 setSelectedSubcoverages(new Set());
 setSubDropdownOpen(false);
 setSubSearch("");
 setCovDropdownOpen(false);
 setSelectedCoverageCatalogId("");
 setCovSearch("");
 toast.success("Cobertura agregada");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const updateCovMut = useMutation({
 mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
 updatePolicyCoverage(id, input),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["policy-coverages", policyId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const removeCovMut = useMutation({
 mutationFn: async (cov: { id: string; coverage_catalog_id: string | null; subcoverage_catalog_id: string | null }) => {
 if (cov.coverage_catalog_id && !cov.subcoverage_catalog_id) {
 // Es una cobertura padre: eliminarla junto con todas sus subcoberturas
 return deactivatePolicyCoverageWithSubcoverages(policyId, cov.coverage_catalog_id);
 }
 // Es una subcobertura: eliminar solo esa
 return deactivatePolicyCoverage(cov.id);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["policy-coverages", policyId] });
 queryClient.invalidateQueries({ queryKey: ["policy", policyId] });
 toast.success("Cobertura eliminada");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const [newCov, setNewCov] = useState({
 coverage_catalog_id: "",
 insured_amount: "",
 deductible_amount: "",
 });
 const [activeTab, setActiveTab] = useState<"datos" | "coberturas" | "documentos">("datos");

 // Documentos físicos de la póliza
 const { data: policyDocuments } = useQuery({
 queryKey: ["policy-documents", policyId],
 queryFn: () => getPolicyDocuments(policyId),
 enabled: !!policyId && !isNew,
 });

 // Documentos online: derivados de las coberturas asociadas (document_url del catálogo)
 const onlineDocuments = useMemo(() => {
 if (!policyCoverages || !allCoverageCatalog) return [];
 const docs: Array<{ coverage_name: string; subcoverage_name: string | null; code: string; url: string; type: "POL" | "CAD" }> = [];
 const seen = new Set<string>();
 for (const pc of policyCoverages) {
 if (!pc.is_active) continue;
 if (pc.coverage_catalog_id) {
 const cat = allCoverageCatalog.find((c) => c.id === pc.coverage_catalog_id);
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
 if (pc.subcoverage_catalog_id && allPolicySubcoverages) {
 const sub = allPolicySubcoverages.find((s) => s.id === pc.subcoverage_catalog_id);
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
 }, [policyCoverages, allCoverageCatalog, allPolicySubcoverages]);

 // Mutations para documentos físicos
 const uploadDocMut = useMutation({
 mutationFn: async ({ file }: { file: File }) => {
 const formData = new FormData();
 formData.append("file", file);
 formData.append("policyId", policyId);
 const res = await fetch("/api/policies/documents/upload", { method: "POST", body: formData });
 if (!res.ok) {
 const body = await res.json().catch(() => ({}));
 throw new Error(body.error || "Error al subir archivo");
 }
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["policy-documents", policyId] });
 toast.success("Documento subido");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const removeDocMut = useMutation({
 mutationFn: (id: string) => deactivatePolicyDocument(id),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["policy-documents", policyId] });
 toast.success("Documento eliminado");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 const [covSearch, setCovSearch] = useState("");
 const [selectedSubcoverages, setSelectedSubcoverages] = useState<Set<string>>(new Set());
 const [subDropdownOpen, setSubDropdownOpen] = useState(false);
 const [subSearch, setSubSearch] = useState("");
 const [covDropdownOpen, setCovDropdownOpen] = useState(false);

 // Filtrar coberturas por búsqueda (en todo el catálogo o filtrado por tema opcional)
 const filteredCoverages = useMemo(() => {
 // Si hay tema seleccionado, usar themeCoverages; si no, usar todo el catálogo
 const source = selectedTheme ? (themeCoverages || []) : (coverageCatalog || []);
 const search = covSearch.toLowerCase().trim();
 if (!search) return source;
 return source.filter((c) =>
 c.name.toLowerCase().includes(search) ||
 c.code.toLowerCase().includes(search)
 );
 }, [themeCoverages, coverageCatalog, covSearch, selectedTheme]);

 // Cobertura seleccionada del catálogo (buscar en catálogo completo)
 const selectedCoverage = useMemo(() => {
 if (!newCov.coverage_catalog_id) return null;
 return (
 coverageCatalog?.find((c) => c.id === newCov.coverage_catalog_id) ||
 allCoverageCatalog?.find((c) => c.id === newCov.coverage_catalog_id) ||
 null
 );
 }, [newCov.coverage_catalog_id, coverageCatalog, allCoverageCatalog]);

 // Agrupar coberturas de la póliza por coverage_catalog_id (jerarquía padre → subcoberturas)
 const groupedPolicyCoverages = useMemo(() => {
 if (!policyCoverages) return [];
 const groups: Record<string, { parent: PolicyCoverage; subcoverages: PolicyCoverage[] }> = {};
 policyCoverages.forEach((c) => {
 const key = c.coverage_catalog_id || c.id;
 if (!groups[key]) {
 groups[key] = { parent: c, subcoverages: [] };
 }
 if (c.subcoverage_catalog_id) {
 groups[key].subcoverages.push(c);
 } else {
 groups[key].parent = c;
 }
 });
 return Object.values(groups);
 }, [policyCoverages]);

 // Subcoberturas filtradas por búsqueda
 const filteredSubcoverages = useMemo(() => {
 if (!subcoverages) return [];
 const search = subSearch.toLowerCase().trim();
 if (!search) return subcoverages;
 return subcoverages.filter((s) =>
 s.name.toLowerCase().includes(search) ||
 s.code.toLowerCase().includes(search)
 );
 }, [subcoverages, subSearch]);

 // Líneas de negocio seleccionadas (multi-select, ordenadas por drag-and-drop)
 const [selectedBusinessLines, setSelectedBusinessLines] = useState<string[]>([]);
 const [primaryBusinessLine, setPrimaryBusinessLine] = useState<string>("");
 const [dragIndex, setDragIndex] = useState<number | null>(null);
 const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

 // Inicializar líneas de negocio cuando se cargan
 const [blInitialized, setBlInitialized] = useState(false);
 if (policyBusinessLines && !blInitialized) {
 setSelectedBusinessLines(policyBusinessLines.map((pbl) => pbl.business_line_id));
 const primary = policyBusinessLines.find((pbl) => pbl.is_primary);
 setPrimaryBusinessLine(primary?.business_line_id || policyBusinessLines[0]?.business_line_id || "");
 setBlInitialized(true);
 }

 if (!isNew && isLoading) {
 return <div className="app-page"><p className="text-muted-foreground py-20 text-center">Cargando...</p></div>;
 }

 return (
 <div className="app-page">
 {/* Header */}
 <div className="app-page-header">
 <div className="flex items-center gap-3">
 <Button size="icon" className="btn-icon-sm" onClick={() => router.push("/dashboard/catalogos/polizas")}>
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h1 className="app-page-title">
 {isNew ? "Nueva Póliza" : (policy?.policy_name || policy?.policy_number || "Póliza")}
 </h1>
 {!isNew && policy && (
 <Badge className={policy.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
 {statusLabels[policy.status]}
 </Badge>
 )}
 </div>
 <p className="app-page-lead">
 {isNew ? "Crear nueva póliza" : (policy?.policy_number || "Sin número")}
 </p>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 border-b border-border">
 <button
 onClick={() => setActiveTab("datos")}
 className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
 activeTab === "datos"
 ? "border-primary text-primary"
 : "border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 <FileCheck className="h-3.5 w-3.5 inline mr-1.5" />
 Datos de la Póliza
 </button>
 {!isNew && (
 <>
 <button
 onClick={() => setActiveTab("coberturas")}
 className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
 activeTab === "coberturas"
 ? "border-primary text-primary"
 : "border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 <ShieldCheck className="h-3.5 w-3.5 inline mr-1.5" />
 Coberturas
 {policyCoverages && policyCoverages.length > 0 && (
 <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.5">
 {policyCoverages.length}
 </span>
 )}
 </button>
 <button
 onClick={() => setActiveTab("documentos")}
 className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
 activeTab === "documentos"
 ? "border-primary text-primary"
 : "border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 <FileText className="h-3.5 w-3.5 inline mr-1.5" />
 Documentos
 {(() => {
 const total = (policyDocuments?.length || 0) + onlineDocuments.length;
 return total > 0 ? (
 <span className="ml-1.5 rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.5">
 {total}
 </span>
 ) : null;
 })()}
 </button>
 </>
 )}
 </div>

 {/* Tab: Datos de la póliza */}
 {activeTab === "datos" && (
 <div className="app-panel">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
 <div className="lg:col-span-3">
 <Label className="app-field-label">Nombre <span className="text-red-500">*</span></Label>
 <Input
 className="app-input"
 value={form.policy_name}
 onChange={(e) => setForm({ ...form, policy_name: e.target.value })}
 placeholder="Nombre de la póliza"
 />
 </div>
 <div className="lg:col-span-2">
 <Label className="app-field-label">N° Póliza</Label>
 <Input
 className="app-input"
 value={form.policy_number}
 onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
 placeholder="Vacío = en emisión"
 />
 <p className="text-[10px] text-muted-foreground mt-1">Único por compañía. Vacío si está en emisión</p>
 </div>
 <div>
 <Label className="app-field-label">Tipo <span className="text-red-500">*</span></Label>
 <select
 className="app-input w-full"
 value={form.policy_type}
 onChange={(e) => setForm({ ...form, policy_type: e.target.value as "individual" | "collective" })}
 >
 <option value="individual">Individual</option>
 <option value="collective">Colectiva</option>
 </select>
 </div>
 <div className="lg:col-span-3">
 <Label className="app-field-label">Compañía de Seguros</Label>
 <Select
 value={form.insurance_company_id || "__none"}
 onValueChange={(v) => setForm({ ...form, insurance_company_id: !v || v === "__none" ? "" : v })}
 items={[
 { value: "__none", label: "Seleccionar..." },
 ...(insuranceCompanies?.map((c) => ({ value: c.id, label: c.name })) || []),
 ]}
 >
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar...</SelectItem>
 {insuranceCompanies?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="lg:col-span-2">
 <Label className="app-field-label">Corredor</Label>
 <Select
 value={form.broker_id || "__none"}
 onValueChange={(v) => setForm({ ...form, broker_id: !v || v === "__none" ? "" : v })}
 items={[
 { value: "__none", label: "Seleccionar..." },
 ...(brokers?.map((b) => ({ value: b.id, label: b.name })) || []),
 ]}
 >
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar...</SelectItem>
 {brokers?.map((b) => (
 <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="app-field-label">Moneda <span className="text-red-500">*</span></Label>
 <select
 className="app-input w-full"
 value={form.currency}
 onChange={(e) => setForm({ ...form, currency: e.target.value })}
 >
 <option value="">Seleccionar...</option>
 {(countryCurrencies || []).map((c) => (
 <option key={c.code || c.id} value={c.code || c.id}>{c.code || ""} — {c.name}</option>
 ))}
 </select>
 </div>
 <div className="lg:col-span-6">
 <Label className="app-field-label">Líneas de Negocio <span className="text-red-500">*</span></Label>

 {/* Zona de selección — chips limpios */}
 <div className="mt-1 flex flex-wrap gap-1.5">
 {(businessLines || []).map((b) => {
 const selected = selectedBusinessLines.includes(b.id);
 return (
 <button
 key={b.id}
 type="button"
 onClick={() => {
 if (selected) {
 if (selectedBusinessLines.length === 1) return;
 const next = selectedBusinessLines.filter((id) => id !== b.id);
 setSelectedBusinessLines(next);
 if (primaryBusinessLine === b.id) setPrimaryBusinessLine(next[0] || "");
 } else {
 const next = [...selectedBusinessLines, b.id];
 setSelectedBusinessLines(next);
 if (selectedBusinessLines.length === 0) setPrimaryBusinessLine(b.id);
 }
 }}
 className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
 selected
 ? "bg-teal-500/10 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-500/25"
 : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground ring-1 ring-inset ring-border"
 }`}
 title={selected ? "Click para quitar" : "Click para seleccionar"}
 >
 {selected && <Check className="size-3" />}
 {b.name}
 </button>
 );
 })}
 </div>

 {/* Zona ordenable — panel limpio con drag-and-drop */}
 {selectedBusinessLines.length > 0 && (
 <div className="mt-3 rounded-lg border border-border bg-card/40 overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
 <span className="text-[11px] font-semibold text-foreground">Orden de prioridad</span>
 <span className="text-[10px] text-muted-foreground">
 Arrastra para reordenar · La primera es la principal
 </span>
 </div>

 {/* Items arrastrables */}
 <div>
 {selectedBusinessLines.map((blId, idx) => {
 const bl = businessLines?.find((b) => b.id === blId);
 if (!bl) return null;
 const isPrimary = idx === 0;
 const isDragging = dragIndex === idx;
 const isDragOver = dragOverIndex === idx && dragIndex !== idx;
 return (
 <div
 key={blId}
 draggable
 onDragStart={() => setDragIndex(idx)}
 onDragOver={(e) => {
 e.preventDefault();
 if (dragOverIndex !== idx) setDragOverIndex(idx);
 }}
 onDragLeave={() => {
 if (dragOverIndex === idx) setDragOverIndex(null);
 }}
 onDrop={() => {
 if (dragIndex !== null && dragIndex !== idx) {
 const next = [...selectedBusinessLines];
 const [moved] = next.splice(dragIndex, 1);
 next.splice(idx, 0, moved);
 setSelectedBusinessLines(next);
 setPrimaryBusinessLine(next[0]);
 }
 setDragIndex(null);
 setDragOverIndex(null);
 }}
 onDragEnd={() => {
 setDragIndex(null);
 setDragOverIndex(null);
 }}
 className={`group flex items-center gap-3 px-3 py-2.5 text-[11px] transition-colors cursor-grab active:cursor-grabbing border-b border-border/50 last:border-b-0 ${
 isDragging ? "opacity-40" : ""
 } ${isDragOver ? "bg-teal-500/5" : "hover:bg-muted/40"}`}
 >
 {/* Número de posición */}
 <span className={`flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold shrink-0 ${
 isPrimary
 ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
 : "bg-muted text-muted-foreground"
 }`}>
 {idx + 1}
 </span>

 {/* Handle drag */}
 <GripVertical className="size-3.5 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground transition-colors" />

 {/* Nombre */}
 <span className={`flex-1 truncate ${isPrimary ? "font-semibold" : ""}`}>{bl.name}</span>

 {/* Badge Principal */}
 {isPrimary && (
 <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 shrink-0">
 Principal
 </span>
 )}

 {/* Quitar */}
 {selectedBusinessLines.length > 1 && (
 <button
 type="button"
 onClick={() => {
 const next = selectedBusinessLines.filter((id) => id !== blId);
 setSelectedBusinessLines(next);
 if (isPrimary) setPrimaryBusinessLine(next[0] || "");
 }}
 className="text-muted-foreground/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
 title="Quitar"
 >
 <X className="size-3" />
 </button>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 <div className="lg:col-span-2">
 <Label className="app-field-label">Prima</Label>
 <Input
 type="number"
 className="app-input"
 value={form.premium_amount}
 onChange={(e) => setForm({ ...form, premium_amount: e.target.value })}
 placeholder="0"
 />
 </div>
 <div className="lg:col-span-2">
 <Label className="app-field-label">Monto Asegurado</Label>
 <Input
 type="number"
 className="app-input"
 value={form.insured_amount}
 onChange={(e) => setForm({ ...form, insured_amount: e.target.value })}
 placeholder="0"
 />
 </div>
 <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-2 gap-4">
 <div>
 <Label className="app-field-label">Fecha Inicio <span className="text-red-500">*</span></Label>
 <DatePicker
 value={form.start_date}
 onChange={(value) => {
 const newStart = value;
 const newEnd = newStart && form.end_date && newStart > form.end_date ? newStart : form.end_date;
 setForm({ ...form, start_date: newStart, end_date: newEnd });
 }}
 className="w-full"
 maxDate={form.end_date || undefined}
 />
 </div>
 <div>
 <Label className="app-field-label">Fecha Término <span className="text-red-500">*</span></Label>
 <DatePicker
 value={form.end_date}
 onChange={(value) => {
 const newEnd = value;
 const newStart = newEnd && form.start_date && newEnd < form.start_date ? newEnd : form.start_date;
 setForm({ ...form, end_date: newEnd, start_date: newStart });
 }}
 className="w-full"
 minDate={form.start_date || undefined}
 />
 </div>
 </div>
 <div className="lg:col-span-4">
 <Label className="app-field-label">Estado</Label>
 <select
 className="app-input w-full"
 value={form.status}
 onChange={(e) => setForm({ ...form, status: e.target.value as "draft" | "active" | "expired" | "cancelled" })}
 >
 <option value="draft">Borrador</option>
 <option value="active">Activa</option>
 <option value="expired">Vencida</option>
 <option value="cancelled">Cancelada</option>
 </select>
 </div>
 <div className="lg:col-span-6">
 <Label className="app-field-label">Comentarios</Label>
 <Textarea
 className="app-input min-h-[60px]"
 value={form.comments}
 onChange={(e) => setForm({ ...form, comments: e.target.value })}
 placeholder="Observaciones..."
 />
 </div>
 </div>
 <div className="mt-4 flex justify-end">
 <Button
 size="sm"
 className="pg-btn-platinum"
 disabled={saveMut.isPending || !form.policy_name}
 onClick={() => saveMut.mutate()}
 >
 {saveMut.isPending ? "Guardando..." : "Guardar"}
 </Button>
 </div>
 </div>
 )}

 {/* Tab: Coberturas */}
 {activeTab === "coberturas" && !isNew && (
 <div className="app-panel">
 {/* Formulario para agregar cobertura: búsqueda de POL + subcoberturas */}
 <div className="mb-4 p-4 rounded-lg border border-dashed border-border bg-muted/20">
 {/* Fila 1: Tema (opcional) + Cobertura (POL) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
 {/* Tema (filtro opcional) */}
 <div className="lg:col-span-2">
 <Label className="app-field-label text-[10px]">Tema (opcional)</Label>
 <Select
 value={selectedTheme || "__none"}
 onValueChange={(v) => {
 const val = !v || v === "__none" ? "" : v;
 setSelectedTheme(val);
 setNewCov({ ...newCov, coverage_catalog_id: "" });
 setSelectedCoverageCatalogId("");
 setSelectedSubcoverages(new Set());
 setSubDropdownOpen(false);
 setSubSearch("");
 setCovDropdownOpen(false);
 setCovSearch("");
 }}
 items={[
 { value: "__none", label: "Todos los temas" },
 ...(coverageThemes || []).map((t) => ({ value: t, label: t })),
 ]}
 >
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Todos los temas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Todos los temas</SelectItem>
 {(coverageThemes || []).map((t) => (
 <SelectItem key={t} value={t}>{t}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Cobertura (POL nivel 1) — siempre visible */}
 <div className="lg:col-span-4">
 <Label className="app-field-label text-[10px]">Cobertura (POL)</Label>
 {selectedCoverage ? (
 <div className="flex items-center gap-1 mt-0.5">
 <div className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] min-h-[32px]">
 <span className="font-mono text-[10px] text-muted-foreground">{selectedCoverage.code}</span>
 <span className="font-medium ml-1">{selectedCoverage.name}</span>
 </div>
 <button
 type="button"
 onClick={() => {
 setNewCov({ ...newCov, coverage_catalog_id: "" });
 setSelectedCoverageCatalogId("");
 setSelectedSubcoverages(new Set());
 setCovSearch("");
 }}
 className="text-muted-foreground hover:text-foreground px-1"
 title="Cambiar"
 >
 <ChevronDown className="h-3.5 w-3.5" />
 </button>
 </div>
 ) : (
 <div className="relative mt-0.5">
 <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
 <Input
 className="app-input h-8 pl-7"
 placeholder="Buscar por código o nombre..."
 value={covSearch}
 onChange={(e) => { setCovSearch(e.target.value); setCovDropdownOpen(true); }}
 onFocus={() => setCovDropdownOpen(true)}
 />
 {covDropdownOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setCovDropdownOpen(false)} />
 <div className="absolute z-50 mt-1 w-full max-h-[280px] overflow-auto rounded-md border border-border bg-popover shadow-md">
 {filteredCoverages.length === 0 ? (
 <div className="px-3 py-2 text-[11px] text-muted-foreground">Sin resultados</div>
 ) : (
 filteredCoverages.slice(0, 50).map((c) => (
 <button
 key={c.id}
 type="button"
 className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent transition-colors block"
 onMouseDown={(e) => {
 e.preventDefault();
 setNewCov({ ...newCov, coverage_catalog_id: c.id });
 setSelectedCoverageCatalogId(c.id);
 setSelectedSubcoverages(new Set());
 setSubDropdownOpen(false);
 setSubSearch("");
 setCovSearch("");
 setCovDropdownOpen(false);
 }}
 >
 <span className="font-mono text-[10px] text-muted-foreground">{c.code}</span>
 <span className="font-medium ml-1.5">{c.name}</span>
 <span className="text-[9px] text-muted-foreground ml-1">{c.theme}</span>
 {(c.subcoverage_count ?? 0) > 0 && (
 <span className="text-[9px] text-muted-foreground ml-1">({c.subcoverage_count})</span>
 )}
 </button>
 ))
 )}
 </div>
 </>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Paso 3: Subcoberturas (combobox con checks) */}
 {selectedCoverage && subcoverages && subcoverages.length > 0 && (
 <div className="mb-3">
 <Label className="app-field-label text-[10px]">
 Subcoberturas
 {selectedSubcoverages.size > 0 && (
 <span className="ml-1.5 text-primary font-normal">
 ({selectedSubcoverages.size} seleccionada{selectedSubcoverages.size !== 1 ? "s" : ""})
 </span>
 )}
 </Label>
 <div className="relative mt-0.5">
 {/* Trigger: muestra las seleccionadas o placeholder */}
 <button
 type="button"
 onClick={() => setSubDropdownOpen(!subDropdownOpen)}
 className="app-input h-8 w-full flex items-center justify-between px-2"
 >
 <span className="truncate text-left">
 {selectedSubcoverages.size === 0
 ? "Sin subcoberturas..."
 : selectedSubcoverages.size === 1
 ? subcoverages.find((s) => selectedSubcoverages.has(s.id))?.name || "1 seleccionada"
 : `${selectedSubcoverages.size} subcoberturas seleccionadas`}
 </span>
 <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${subDropdownOpen ? "rotate-180" : ""}`} />
 </button>

 {/* Dropdown */}
 {subDropdownOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setSubDropdownOpen(false)} />
 <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
 {/* Barra de búsqueda + acciones */}
 <div className="flex items-center gap-2 p-2 border-b border-border">
 <Search className="h-3 w-3 text-muted-foreground shrink-0" />
 <input
 type="text"
 placeholder="Buscar..."
 value={subSearch}
 onChange={(e) => setSubSearch(e.target.value)}
 className="flex-1 text-[11px] bg-transparent outline-none"
 autoFocus
 />
 <button
 type="button"
 onClick={() => setSelectedSubcoverages(new Set(subcoverages.map((s) => s.id)))}
 className="text-[10px] text-primary hover:underline shrink-0"
 >
 Todas
 </button>
 <button
 type="button"
 onClick={() => setSelectedSubcoverages(new Set())}
 className="text-[10px] text-muted-foreground hover:underline shrink-0"
 >
 Ninguna
 </button>
 </div>

 {/* Lista con checks */}
 <div className="max-h-[200px] overflow-auto">
 {filteredSubcoverages.length === 0 ? (
 <div className="px-3 py-2 text-[11px] text-muted-foreground">Sin resultados</div>
 ) : (
 filteredSubcoverages.map((s) => {
 const checked = selectedSubcoverages.has(s.id);
 return (
 <button
 key={s.id}
 type="button"
 onClick={() => {
 const next = new Set(selectedSubcoverages);
 if (checked) next.delete(s.id);
 else next.add(s.id);
 setSelectedSubcoverages(next);
 }}
 className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-accent transition-colors text-left"
 >
 <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0 ${
 checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
 }`}>
 {checked && <Check className="h-2.5 w-2.5" />}
 </span>
 <span className="font-mono text-[9px] text-muted-foreground shrink-0">{s.code}</span>
 <span className="truncate">{s.name}</span>
 </button>
 );
 })
 )}
 </div>
 </div>
 </>
 )}
 </div>
 </div>
 )}

 {/* Montos + Botón agregar */}
 {selectedCoverage && (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
 <div className="lg:col-span-2">
 <Label className="app-field-label text-[10px]">Monto Asegurado</Label>
 <Input
 type="number"
 className="app-input h-8 "
 value={newCov.insured_amount}
 onChange={(e) => setNewCov({ ...newCov, insured_amount: e.target.value })}
 placeholder="Opcional"
 />
 </div>
 <div className="lg:col-span-2">
 <Label className="app-field-label text-[10px]">Deducible</Label>
 <Input
 type="number"
 className="app-input h-8 "
 value={newCov.deductible_amount}
 onChange={(e) => setNewCov({ ...newCov, deductible_amount: e.target.value })}
 placeholder="Opcional"
 />
 </div>
 <div className="lg:col-span-2 flex items-end">
 <Button
 size="sm"
 className="pg-btn-platinum w-full"
 disabled={!newCov.coverage_catalog_id || addCovMut.isPending}
 onClick={() => {
 const subs = subcoverages
 ? subcoverages
 .filter((s) => selectedSubcoverages.has(s.id))
 .map((s) => ({
 subcoverage_catalog_id: s.id,
 subcoverage_name: s.name,
 }))
 : [];
 addCovMut.mutate({
 coverage_catalog_id: newCov.coverage_catalog_id,
 coverage_name: selectedCoverage?.name || "",
 selected_subcoverages: subs,
 insured_amount: newCov.insured_amount ? Number(newCov.insured_amount) : null,
 deductible_amount: newCov.deductible_amount ? Number(newCov.deductible_amount) : null,
 });
 }}
 >
 {addCovMut.isPending ? "Agregando..." : "Agregar"}
 </Button>
 </div>
 </div>
 )}
 </div>

 {/* Tabla de coberturas de la póliza (árbol) */}
 {groupedPolicyCoverages.length > 0 ? (
 <div className="rounded-lg border border-border overflow-hidden">
 <table className="app-data-table">
 <thead className="bg-muted/50">
 <tr>
 <th className="px-3 py-2 text-left font-medium" style={{ width: "45%" }}>Cobertura / Subcobertura</th>
 <th className="px-3 py-2 text-right font-medium">Asegurado</th>
 <th className="px-3 py-2 text-right font-medium">Deducible</th>
 <th className="px-3 py-2 text-left font-medium">Moneda</th>
 <th className="w-8" />
 </tr>
 </thead>
 <tbody>
 {groupedPolicyCoverages.map((group) => {
 // Buscar código del POL en el catálogo completo
 const polCode = allCoverageCatalog?.find((c) => c.id === group.parent.coverage_catalog_id)?.code || "";
 return (
 <PolicyCoverageGroup
 key={group.parent.id}
 parent={group.parent}
 parentCode={polCode}
 subcoverages={group.subcoverages}
 subcoverageCodes={Object.fromEntries(
 group.subcoverages
 .map((s) => {
 const sub = allPolicySubcoverages?.find((sc) => sc.id === s.subcoverage_catalog_id);
 return sub ? [s.id, sub.code] : null;
 })
 .filter(Boolean) as [string, string][]
 )}
 onUpdate={(id, input) => updateCovMut.mutate({ id, input })}
 onRemove={(cov) => removeCovMut.mutate(cov)}
 />
 );
 })}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground text-center py-6">
 No hay coberturas cargadas. Seleccione un tema, luego una cobertura y agregue.
 </p>
 )}
 </div>
 )}

 {/* Tab: Documentos */}
 {activeTab === "documentos" && !isNew && (
 <div className="app-panel flex flex-col gap-5">
 {/* Documentos Online (de coberturas asociadas) */}
 <div>
 <div className="flex items-center gap-2 mb-3">
 <ExternalLink className="h-4 w-4 text-primary" />
 <h3 className="text-[13px] font-semibold">Documentos Online</h3>
 <span className="text-[11px] text-muted-foreground">
 (derivados de las coberturas asociadas)
 </span>
 </div>
 {onlineDocuments.length > 0 ? (
 <div className="rounded-lg border border-border overflow-hidden">
 <table className="app-data-table">
 <thead className="bg-muted/50">
 <tr>
 <th className="px-3 py-2 text-left font-medium">Tipo</th>
 <th className="px-3 py-2 text-left font-medium">Código</th>
 <th className="px-3 py-2 text-left font-medium">Cobertura / Subcobertura</th>
 <th className="w-20" />
 </tr>
 </thead>
 <tbody>
 {onlineDocuments.map((doc, i) => (
 <tr key={i} className="border-t border-border/50">
 <td className="px-3 py-2">
 <span className={`font-mono text-[10px] rounded px-1.5 py-0.5 ${
 doc.type === "POL" ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"
 }`}>
 {doc.type}
 </span>
 </td>
 <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{doc.code}</td>
 <td className="px-3 py-2">
 <div className="flex items-center gap-1.5">
 <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
 <span className="truncate">{doc.coverage_name}</span>
 {doc.subcoverage_name && (
 <span className="text-muted-foreground">→ {doc.subcoverage_name}</span>
 )}
 </div>
 </td>
 <td className="px-3 py-2 text-right">
 <a
 href={doc.url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
 >
 <ExternalLink className="h-3 w-3" />
 Ver
 </a>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground py-4 text-center">
 No hay documentos online. Associe coberturas a la póliza para ver sus documentos aquí.
 </p>
 )}
 </div>

 {/* Separador */}
 <div className="border-t border-border" />

 {/* Documentos Físicos (subidos manualmente) */}
 <div>
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Upload className="h-4 w-4 text-primary" />
 <h3 className="text-[13px] font-semibold">Documentos Físicos</h3>
 <span className="text-[11px] text-muted-foreground">
 (subidos manualmente)
 </span>
 </div>
 <label className="cursor-pointer">
 <input
 type="file"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) uploadDocMut.mutate({ file });
 e.target.value = "";
 }}
 />
 <span className="pg-btn-platinum-icon inline-flex items-center gap-1.5">
 <Upload className="h-3.5 w-3.5" />
 Subir
 </span>
 </label>
 </div>
 {policyDocuments && policyDocuments.length > 0 ? (
 <div className="rounded-lg border border-border overflow-hidden">
 <table className="app-data-table">
 <thead className="bg-muted/50">
 <tr>
 <th className="px-3 py-2 text-left font-medium w-[min(60vw,560px)]">Documento</th>
 <th className="px-3 py-2 text-left font-medium w-[120px]">Tipo</th>
 <th className="px-3 py-2 text-right font-medium w-[90px]">Tamaño</th>
 <th className="px-3 py-2 text-left font-medium w-[110px]">Fecha</th>
 <th className="w-20" />
 </tr>
 </thead>
 <tbody>
 {policyDocuments.map((doc) => (
 <tr key={doc.id} className="border-t border-border/50">
 <td className="px-3 py-2">
 <div className="flex items-center gap-1.5">
 <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 <a
 href={doc.document_url || "#"}
 target="_blank"
 rel="noopener noreferrer"
 className="hover:underline truncate"
 >
 {doc.document_name}
 </a>
 </div>
 {doc.ai_summary && (
 <div className="flex items-start gap-1 text-[10px] text-violet-600 dark:text-violet-400 mt-1 pl-5">
 <Zap className="h-3 w-3 shrink-0 mt-0.5" />
 <span className="italic line-clamp-3 wrap-break-word">{doc.ai_summary}</span>
 </div>
 )}
 </td>
 <td className="px-3 py-2 text-muted-foreground text-[11px]">
 {doc.document_type || "—"}
 </td>
 <td className="px-3 py-2 text-right font-mono text-[11px] text-muted-foreground">
 {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
 </td>
 <td className="px-3 py-2 text-muted-foreground text-[11px]">
 {new Date(doc.created_at).toLocaleDateString("es-CL")}
 </td>
 <td className="px-3 py-2 text-right">
 <div className="app-row-actions justify-end">
 <AiAnalysisButton
 table="policy_documents"
 id={doc.id}
 fileName={doc.document_name}
 hasSummary={!!doc.ai_summary}
 queryKey={["policy-documents", policyId]}
 />
 <button
 type="button"
 onClick={() => removeDocMut.mutate(doc.id)}
 className="btn-icon-sm btn-danger-hover"
 title="Eliminar"
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground py-4 text-center">
 No hay documentos subidos. Haga clic en &quot;Subir&quot; para agregar documentos.
 </p>
 )}
 {uploadDocMut.isPending && (
 <p className="text-[11px] text-muted-foreground mt-2">Subiendo documento...</p>
 )}
 </div>
 </div>
 )}
 </div>
 );
}

// ── Componente: grupo de cobertura padre + subcoberturas (árbol) ──
function PolicyCoverageGroup({
 parent,
 parentCode,
 subcoverages,
 subcoverageCodes,
 onUpdate,
 onRemove,
}: {
 parent: PolicyCoverage;
 parentCode: string;
 subcoverages: PolicyCoverage[];
 subcoverageCodes: Record<string, string>;
 onUpdate: (id: string, input: Record<string, unknown>) => void;
 onRemove: (cov: { id: string; coverage_catalog_id: string | null; subcoverage_catalog_id: string | null }) => void;
}) {
 return (
 <>
 {/* Fila padre (POL) */}
 <tr className="border-t border-border bg-muted/20">
 <td className="px-3 py-2">
 <div className="flex items-center gap-2">
 <span className="font-mono text-[10px] text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">
 {parentCode || "POL"}
 </span>
 <span className="font-medium">{parent.coverage_name}</span>
 {subcoverages.length > 0 && (
 <span className="text-[10px] text-muted-foreground">({subcoverages.length} subcob.)</span>
 )}
 </div>
 </td>
 <td className="px-3 py-2 text-right">
 <Input
 type="number"
 className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
 value={parent.insured_amount ?? ""}
 onChange={(e) => onUpdate(parent.id, { insured_amount: e.target.value ? Number(e.target.value) : null })}
 placeholder="—"
 />
 </td>
 <td className="px-3 py-2 text-right">
 <Input
 type="number"
 className="app-input h-7 text-[11px] text-right font-mono w-[80px] ml-auto"
 value={parent.deductible_amount ?? ""}
 onChange={(e) => onUpdate(parent.id, { deductible_amount: e.target.value ? Number(e.target.value) : null })}
 placeholder="—"
 />
 </td>
 <td className="px-3 py-2">{parent.currency || "—"}</td>
 <td className="px-1">
 <button
 type="button"
 onClick={() => onRemove(parent)}
 className="btn-icon-sm btn-danger-hover"
 title={subcoverages.length > 0 ? `Quitar cobertura y ${subcoverages.length} subcoberturas` : "Quitar cobertura"}
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </td>
 </tr>
 {/* Subcoberturas (CAD) */}
 {subcoverages.map((s) => (
 <tr key={s.id} className="border-t border-border/50">
 <td className="px-3 py-1.5">
 <div className="flex items-center gap-2 pl-6">
 <span className="text-muted-foreground shrink-0">└─</span>
 <span className="font-mono text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 shrink-0">
 {subcoverageCodes[s.id] || "CAD"}
 </span>
 <span>{s.subcoverage_name || "—"}</span>
 </div>
 </td>
 <td className="px-3 py-1.5 text-right">
 <Input
 type="number"
 className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
 value={s.insured_amount ?? ""}
 onChange={(e) => onUpdate(s.id, { insured_amount: e.target.value ? Number(e.target.value) : null })}
 placeholder="—"
 />
 </td>
 <td className="px-3 py-1.5 text-right">
 <Input
 type="number"
 className="app-input h-7 text-[11px] text-right font-mono w-[80px] ml-auto"
 value={s.deductible_amount ?? ""}
 onChange={(e) => onUpdate(s.id, { deductible_amount: e.target.value ? Number(e.target.value) : null })}
 placeholder="—"
 />
 </td>
 <td className="px-3 py-1.5">{s.currency || "—"}</td>
 <td className="px-1">
 <button
 type="button"
 onClick={() => onRemove(s)}
 className="btn-icon-sm btn-danger-hover"
 title="Quitar subcobertura"
 >
 <Trash2 className="h-3 w-3" />
 </button>
 </td>
 </tr>
 ))}
 </>
 );
}

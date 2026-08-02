"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { getClaimsLight, getClaimsCount, getClaimsParticipants, createClaimMinimal, checkClaimNumberExists, findParticipantByRut } from "@/services/claims";
import { ClaimLocationSelector } from "@/components/claims/claim-location-selector";
import type { GeocodeCandidate } from "@/lib/geo";
import { getCompanies } from "@/services/companies";
import { getUsersByRoleForCompany } from "@/services/users";
import {
 getClaimCauses,
 getClaimTypes,
 getInsuranceCompanies,
 getBrokers,
 getAdvisors,
 getBusinessLines,
 getInsuranceProducts,
 getRegions,
 getCities,
 getCommunes,
 getCountries,
 getHousingDestinations,
 getDamageClassifications,
 getLookupCatalog,
 getEvents,
 getDocumentTypes,
} from "@/services/catalogs";
import { claimCreateMinimalSchema, type ClaimCreateMinimalInput } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, useWatch } from "react-hook-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { Search, Trash2, FileText, ClipboardCheck, Download, Check, Upload, ChevronDown, Shield, MapPin, CheckCircle2, AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getClaimTypeIcon } from "@/lib/claim-type-icons";
import * as XLSX from "xlsx";

function flagImgUrl(code: string | null): string | null {
 if (!code || code.length !== 2) return null;
 const lower = code.toLowerCase();
 if (!/^[a-z]{2}$/.test(lower)) return null;
 return `https://flagcdn.com/h20/${lower}.png`;
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { SelectItem, Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { FormDatePicker } from "@/components/ui/form-date-picker";
import { FormSelect } from "@/components/ui/form-select";
import { cn } from "@/lib/utils";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";

type Participant = { type: string; full_name?: string | null; first_name?: string | null; last_name?: string | null; rut?: string | null; email?: string | null; phone?: string | null; cell_phone?: string | null; address?: string | null; country?: string | null; region?: string | null; city?: string | null; commune?: string | null };

function getParticipant(claim: { claims_participants?: Participant[] }, type: string) {
 return claim.claims_participants?.find((p) => p.type === type);
}

type ListClaim = {
 liquidation_number?: string | null;
 client_reference?: string | null;
 claim_number?: string | null;
 claims_participants?: Participant[];
 status_id?: string | null;
 claim_date?: string | null;
 report_date?: string | null;
 created_at?: string | null;
};

function FieldError({ message }: { message?: string }) {
 if (!message) return null;
 return <p className="app-body text-red-500 leading-tight">{message}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
 return (
 <div className="col-span-full">
 <h3 className="app-section-title">
 {children}
 </h3>
 </div>
 );
}

const statusOptions = [
 { value: "__all", label: "Todos los estados" },
 { value: "created", label: "Creación" },
 { value: "adjustment", label: "Liquidación" },
 { value: "dispatchment", label: "Despacho" },
 { value: "closed", label: "Cierre" },
 { value: "reopened", label: "Reapertura" },
];

const wizardSteps = [
 { id: 1, label: "Detalles Siniestro", description: "Ingresa los detalles sobre el reclamo." },
 { id: 2, label: "Personas", description: "Asegurado, contratante y beneficiario." },
 { id: 3, label: "Incidente", description: "Detalles del siniestro y dirección." },
 { id: 4, label: "Documentos", description: "Cargue los documentos necesarios." },
];

export default function ClaimsPage() {
 return (
 <Suspense fallback={<div className="app-page"><div className="app-page-header"><h1 className="app-page-title">Siniestros</h1></div></div>}>
 <ClaimsPageContent />
 </Suspense>
 );
}

function ClaimsPageContent() {
 const queryClient = useQueryClient();
 const router = useRouter();
 const searchParams = useSearchParams();
 const { canCreate, canView } = usePermissions();
 const { profile, dataAccess } = useAuth();
 const { statusCode, statusLabel, codeToId } = useClaimStatuses();

 const isUserAssignedToClaim = (claim: { assigned_adjuster_id: string | null; adjuster_id: string | null; inspector_id: string | null; auditor_id: string | null; dispatcher_id: string | null; assistant_id: string | null }): boolean => {
   if (!profile?.id) return false;
   if (dataAccess?.is_admin || dataAccess?.see_all_client_claims) return true;
   const assigneeIds = [
     claim.assigned_adjuster_id,
     claim.adjuster_id,
     claim.inspector_id,
     claim.auditor_id,
     claim.dispatcher_id,
     claim.assistant_id,
   ];
   return assigneeIds.some((id) => id === profile.id);
 };

 const canOpenClaim = (claim: { assigned_adjuster_id: string | null; adjuster_id: string | null; inspector_id: string | null; auditor_id: string | null; dispatcher_id: string | null; assistant_id: string | null }): boolean => canView("claims") && isUserAssignedToClaim(claim);
 useRealtime("claims", [["claims"], ["claims-participants"]]);

 const [sortKey, setSortKey] = useState<string | null>(searchParams.get("sort") ?? null);
 const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
 const toggleSort = (key: string) => {
   if (sortKey === key) {
     setSortDir((d) => (d === "asc" ? "desc" : "asc"));
   } else {
     setSortKey(key);
     setSortDir("asc");
   }
 };

 const [search, setSearch] = useState(searchParams.get("q") ?? "");

 const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
 const [pageSize, setPageSize] = useState(Number(searchParams.get("pageSize")) || 50);
 const handlePageSizeChange = (size: number) => { setPageSize(size); setPage(1); };
 const [statusFilter, setStatusFilter] = useState<string[]>(() => {
   const s = searchParams.get("status");
   return s ? s.split(",").filter(Boolean) : [];
 });
 const [insuranceCompanyFilter, setInsuranceCompanyFilter] = useState<string[]>(() => {
   const s = searchParams.get("insurance");
   return s ? s.split(",").filter(Boolean) : [];
 });
 const [liquidationFilter, setLiquidationFilter] = useState(searchParams.get("liquidation") ?? "");
 const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
 const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
 const [open, setOpen] = useState(false);
 const [step, setStep] = useState(1);
 const [documents, setDocuments] = useState<{ id: string; name: string; type: string; file: File }[]>([]);
 const [dragOver, setDragOver] = useState(false);
 const [expandedPanel, setExpandedPanel] = useState<"contractor" | "beneficiary" | null>(null);
 const [contractorLinked, setContractorLinked] = useState(false);
 const [beneficiaryLinked, setBeneficiaryLinked] = useState(false);
 const [claimAddressLinked, setClaimAddressLinked] = useState(false);
 const [claimNumberWarning, setClaimNumberWarning] = useState<string | null>(null);
 const [locationSelectorOpen, setLocationSelectorOpen] = useState(false);
 const [participantSuggestion, setParticipantSuggestion] = useState<{
 section: "insured" | "contractor" | "beneficiary";
 data: {
 first_name: string | null;
 last_name: string | null;
 rut: string | null;
 email: string | null;
 phone: string | null;
 cell_phone: string | null;
 address: string | null;
 country: string | null;
 region: string | null;
 city: string | null;
 commune: string | null;
 };
 } | null>(null);

 // Resetear a pagina 1 cuando cambian filtros server-side
 useEffect(() => {
   setPage(1);
 }, [statusFilter, insuranceCompanyFilter, liquidationFilter, dateFrom, dateTo, search]);

 const filtersLoaded = useRef(false);

 // Restaurar filtros desde localStorage si la URL esta limpia
 useEffect(() => {
   if (searchParams.toString()) {
     filtersLoaded.current = true;
     return;
   }
   const saved = localStorage.getItem("claims-filters");
   if (!saved) {
     filtersLoaded.current = true;
     return;
   }
   try {
     const filters = JSON.parse(saved);
     if (filters.q) setSearch(filters.q);
     if (filters.page) setPage(filters.page);
     if (filters.pageSize) setPageSize(filters.pageSize);
     if (filters.sort) setSortKey(filters.sort);
     if (filters.dir) setSortDir(filters.dir);
     if (Array.isArray(filters.status)) setStatusFilter(filters.status);
     if (Array.isArray(filters.insurance)) setInsuranceCompanyFilter(filters.insurance);
     if (filters.liquidation) setLiquidationFilter(filters.liquidation);
     if (filters.dateFrom) setDateFrom(filters.dateFrom);
     if (filters.dateTo) setDateTo(filters.dateTo);
   } catch {
     // ignore
   } finally {
     filtersLoaded.current = true;
   }
 }, [searchParams]);

 // Sincronizar filtros y paginacion con la URL y localStorage
 useEffect(() => {
   const params = new URLSearchParams(searchParams.toString());
   if (search) params.set("q", search); else params.delete("q");
   if (page !== 1) params.set("page", String(page)); else params.delete("page");
   if (pageSize !== 50) params.set("pageSize", String(pageSize)); else params.delete("pageSize");
   if (sortKey) { params.set("sort", sortKey); params.set("dir", sortDir); } else { params.delete("sort"); params.delete("dir"); }
   if (statusFilter.length) params.set("status", statusFilter.join(",")); else params.delete("status");
   if (insuranceCompanyFilter.length) params.set("insurance", insuranceCompanyFilter.join(",")); else params.delete("insurance");
   if (liquidationFilter) params.set("liquidation", liquidationFilter); else params.delete("liquidation");
   if (dateFrom) params.set("dateFrom", dateFrom); else params.delete("dateFrom");
   if (dateTo) params.set("dateTo", dateTo); else params.delete("dateTo");
   const newUrl = `${window.location.pathname}?${params.toString()}`;
   window.history.replaceState({}, "", newUrl);

   if (!filtersLoaded.current) return;
   const filters = {
     q: search,
     page,
     pageSize,
     sort: sortKey,
     dir: sortDir,
     status: statusFilter,
     insurance: insuranceCompanyFilter,
     liquidation: liquidationFilter,
     dateFrom,
     dateTo,
   };
   localStorage.setItem("claims-filters", JSON.stringify(filters));
 }, [search, page, pageSize, sortKey, sortDir, statusFilter, insuranceCompanyFilter, liquidationFilter, dateFrom, dateTo, searchParams]);

 type DocumentRow = { id: string; name: string; type: string; file: File };

 const form = useForm<ClaimCreateMinimalInput>({
 resolver: standardSchemaResolver(claimCreateMinimalSchema),
 defaultValues: {
 companyId: "",
 insuranceCompanyId: "",
 claimNumber: "",
 policyNumber: "",
 clientReference: "",
 claimDate: "",
 assignmentDate: "",
 reportDate: "",
 businessLineId: "",
 insuranceProductId: "",
 eventId: "",
 claimTypeId: "",
 advisorId: "",
 brokerId: "",
 inspectorId: "",
 adjusterId: "",
 auditorId: "",
 dispatcherId: "",
 assistantId: "",
 claimCauseId: "",
 summary: "",
 constructionTypeId: "",
 habitabilityId: "",
 destinationHousingId: "",
 propertyClassificationId: "",
 ownerSameAsInsured: false,
 ownerType: "",
 damageClassificationId: "",
 insuredName: "",
 lastName: "",
 rut: "",
 insuredEmail: "",
 cellPhone: "",
 insuredPhone: "",
 insuredAddress: "",
 insuredCountry: "",
 insuredRegion: "",
 insuredCity: "",
 insuredCommune: "",
 claimAddress: "",
 claimCountry: "Chile",
 claimRegion: "",
 claimCity: "",
 claimCommune: "",
 contractorName: "",
 contractorLastName: "",
 contractorRut: "",
 contractorEmail: "",
 contractorCellPhone: "",
 contractorPhone: "",
 contractorAddress: "",
 contractorCountry: "",
 contractorRegion: "",
 contractorCity: "",
 contractorCommune: "",
 beneficiaryName: "",
 beneficiaryLastName: "",
 beneficiaryRut: "",
 beneficiaryEmail: "",
 beneficiaryCellPhone: "",
 beneficiaryPhone: "",
 beneficiaryAddress: "",
 beneficiaryCountry: "",
 beneficiaryRegion: "",
 beneficiaryCity: "",
 beneficiaryCommune: "",
 },
 });

 const { data: rawClaims, isLoading, error } = useQuery({
 queryKey: ["claims", page, pageSize, sortKey, sortDir, statusFilter, insuranceCompanyFilter, liquidationFilter, dateFrom, dateTo],
 queryFn: () => getClaimsLight(undefined, {
   page,
   pageSize,
   statusIds: statusFilter.length ? statusFilter.map((c) => codeToId[c]).filter(Boolean) as string[] : undefined,
   insuranceCompanyIds: insuranceCompanyFilter.length ? insuranceCompanyFilter : undefined,
   liquidation: liquidationFilter || undefined,
   dateFrom: dateFrom || undefined,
   dateTo: dateTo || undefined,
   sortKey,
   sortDir,
 }),
 staleTime: 60_000,
 gcTime: 5 * 60_000,
 });

 const { data: claimsCount } = useQuery({
 queryKey: ["claims-count", statusFilter, insuranceCompanyFilter, liquidationFilter, dateFrom, dateTo],
 queryFn: () => getClaimsCount(undefined, {
   statusIds: statusFilter.length ? statusFilter.map((c) => codeToId[c]).filter(Boolean) as string[] : undefined,
   insuranceCompanyIds: insuranceCompanyFilter.length ? insuranceCompanyFilter : undefined,
   liquidation: liquidationFilter || undefined,
   dateFrom: dateFrom || undefined,
   dateTo: dateTo || undefined,
 }),
 staleTime: 60_000,
 gcTime: 5 * 60_000,
 });

 if (error) {
 toast.error(`Error cargando siniestros: ${(error as Error).message}`);
 }

 const claimIds = rawClaims?.map((c) => c.id) ?? [];
 const { data: participants } = useQuery({
 queryKey: ["claims-participants", claimIds],
 queryFn: () => getClaimsParticipants(claimIds),
 enabled: claimIds.length > 0,
 staleTime: 60_000,
 gcTime: 5 * 60_000,
 });

 const claims = rawClaims?.map((claim) => ({
 ...claim,
 claims_participants: participants?.filter((p) => p.claim_id === claim.id) ?? [],
 }));

 const { data: companies } = useQuery({
 queryKey: ["companies"],
 queryFn: () => getCompanies(),
 });

 const selectedCompanyId = useWatch({ control: form.control, name: "companyId" });
 const watchedClaimNumber = useWatch({ control: form.control, name: "claimNumber" });
 const watchedInsuranceCompanyId = useWatch({ control: form.control, name: "insuranceCompanyId" });

 // Reset render-time cuando faltan datos (evita setState sincrónico en effect)
 if (!watchedClaimNumber || !watchedInsuranceCompanyId) {
 if (claimNumberWarning !== null) setClaimNumberWarning(null);
 }

 // Verificar duplicado de N° siniestro por compañía de seguros
 useEffect(() => {
 if (!watchedClaimNumber || !watchedInsuranceCompanyId) return;
 let cancelled = false;
 const timer = setTimeout(async () => {
 try {
 const exists = await checkClaimNumberExists(watchedClaimNumber, watchedInsuranceCompanyId);
 if (!cancelled) {
 setClaimNumberWarning(exists ? "Este N° de siniestro ya existe para esta compañía" : null);
 }
 } catch {
 if (!cancelled) setClaimNumberWarning(null);
 }
 }, 500);
 return () => { cancelled = true; clearTimeout(timer); };
 }, [watchedClaimNumber, watchedInsuranceCompanyId]);

 // Watchers de RUT para sugerir datos existentes
 const watchedRut = useWatch({ control: form.control, name: "rut" });
 const watchedInsuredCountry = useWatch({ control: form.control, name: "insuredCountry" });
 const watchedContractorRut = useWatch({ control: form.control, name: "contractorRut" });
 const watchedContractorCountry = useWatch({ control: form.control, name: "contractorCountry" });
 const watchedBeneficiaryRut = useWatch({ control: form.control, name: "beneficiaryRut" });
 const watchedBeneficiaryCountry = useWatch({ control: form.control, name: "beneficiaryCountry" });

 // Reset render-time para asegurado (evita setState sincrónico en effect)
 if (!watchedRut || watchedRut.trim().length < 3 || !watchedInsuredCountry) {
 if (participantSuggestion?.section === "insured") setParticipantSuggestion(null);
 }

 // Buscar participante existente por RUT + país (asegurado)
 useEffect(() => {
 if (!watchedRut || watchedRut.trim().length < 3 || !watchedInsuredCountry) return;
 let cancelled = false;
 const timer = setTimeout(async () => {
 try {
 const found = await findParticipantByRut(watchedRut.trim(), watchedInsuredCountry);
 if (!cancelled) {
 if (found && (found.first_name || found.full_name)) {
 setParticipantSuggestion({ section: "insured", data: found });
 } else if (participantSuggestion?.section === "insured") {
 setParticipantSuggestion(null);
 }
 }
 } catch {
 if (!cancelled && participantSuggestion?.section === "insured") setParticipantSuggestion(null);
 }
 }, 600);
 return () => { cancelled = true; clearTimeout(timer); };
 }, [watchedRut, watchedInsuredCountry, participantSuggestion]);

 // Reset render-time para contratante (evita setState sincrónico en effect)
 if (!watchedContractorRut || watchedContractorRut.trim().length < 3 || !watchedContractorCountry) {
 if (participantSuggestion?.section === "contractor") setParticipantSuggestion(null);
 }

 // Buscar participante existente por RUT + país (contratante)
 useEffect(() => {
 if (!watchedContractorRut || watchedContractorRut.trim().length < 3 || !watchedContractorCountry) return;
 let cancelled = false;
 const timer = setTimeout(async () => {
 try {
 const found = await findParticipantByRut(watchedContractorRut.trim(), watchedContractorCountry);
 if (!cancelled) {
 if (found && (found.first_name || found.full_name)) {
 setParticipantSuggestion({ section: "contractor", data: found });
 } else if (participantSuggestion?.section === "contractor") {
 setParticipantSuggestion(null);
 }
 }
 } catch {
 if (!cancelled && participantSuggestion?.section === "contractor") setParticipantSuggestion(null);
 }
 }, 600);
 return () => { cancelled = true; clearTimeout(timer); };
 }, [watchedContractorRut, watchedContractorCountry, participantSuggestion]);

 // Reset render-time para beneficiario (evita setState sincrónico en effect)
 if (!watchedBeneficiaryRut || watchedBeneficiaryRut.trim().length < 3 || !watchedBeneficiaryCountry) {
 if (participantSuggestion?.section === "beneficiary") setParticipantSuggestion(null);
 }

 // Buscar participante existente por RUT + país (beneficiario)
 useEffect(() => {
 if (!watchedBeneficiaryRut || watchedBeneficiaryRut.trim().length < 3 || !watchedBeneficiaryCountry) return;
 let cancelled = false;
 const timer = setTimeout(async () => {
 try {
 const found = await findParticipantByRut(watchedBeneficiaryRut.trim(), watchedBeneficiaryCountry);
 if (!cancelled) {
 if (found && (found.first_name || found.full_name)) {
 setParticipantSuggestion({ section: "beneficiary", data: found });
 } else if (participantSuggestion?.section === "beneficiary") {
 setParticipantSuggestion(null);
 }
 }
 } catch {
 if (!cancelled && participantSuggestion?.section === "beneficiary") setParticipantSuggestion(null);
 }
 }, 600);
 return () => { cancelled = true; clearTimeout(timer); };
 }, [watchedBeneficiaryRut, watchedBeneficiaryCountry, participantSuggestion]);

 // Función para aplicar la sugerencia a la sección correspondiente
 const applySuggestion = (section: "insured" | "contractor" | "beneficiary") => {
 if (!participantSuggestion) return;
 const d = participantSuggestion.data;
 if (section === "insured") {
 form.setValue("insuredName", d.first_name || "");
 form.setValue("lastName", d.last_name || "");
 form.setValue("insuredEmail", d.email || "");
 form.setValue("cellPhone", d.cell_phone || "");
 form.setValue("insuredPhone", d.phone || "");
 form.setValue("insuredAddress", d.address || "");
 form.setValue("insuredCountry", d.country || "");
 form.setValue("insuredRegion", d.region || "");
 form.setValue("insuredCity", d.city || "");
 form.setValue("insuredCommune", d.commune || "");
 } else if (section === "contractor") {
 form.setValue("contractorName", d.first_name || "");
 form.setValue("contractorLastName", d.last_name || "");
 form.setValue("contractorEmail", d.email || "");
 form.setValue("contractorCellPhone", d.cell_phone || "");
 form.setValue("contractorPhone", d.phone || "");
 form.setValue("contractorAddress", d.address || "");
 form.setValue("contractorCountry", d.country || "");
 form.setValue("contractorRegion", d.region || "");
 form.setValue("contractorCity", d.city || "");
 form.setValue("contractorCommune", d.commune || "");
 } else if (section === "beneficiary") {
 form.setValue("beneficiaryName", d.first_name || "");
 form.setValue("beneficiaryLastName", d.last_name || "");
 form.setValue("beneficiaryEmail", d.email || "");
 form.setValue("beneficiaryCellPhone", d.cell_phone || "");
 form.setValue("beneficiaryPhone", d.phone || "");
 form.setValue("beneficiaryAddress", d.address || "");
 form.setValue("beneficiaryCountry", d.country || "");
 form.setValue("beneficiaryRegion", d.region || "");
 form.setValue("beneficiaryCity", d.city || "");
 form.setValue("beneficiaryCommune", d.commune || "");
 }
 setParticipantSuggestion(null);
 };

 // Watchers de ubicación por sección (independientes)
 const selectedClaimCountry = useWatch({ control: form.control, name: "claimCountry" });
 const selectedClaimRegion = useWatch({ control: form.control, name: "claimRegion" });
 const selectedClaimCity = useWatch({ control: form.control, name: "claimCity" });

 const selectedInsuredCountry = useWatch({ control: form.control, name: "insuredCountry" });
 const selectedInsuredRegion = useWatch({ control: form.control, name: "insuredRegion" });
 const selectedInsuredCity = useWatch({ control: form.control, name: "insuredCity" });

 const selectedContractorCountry = useWatch({ control: form.control, name: "contractorCountry" });
 const selectedContractorRegion = useWatch({ control: form.control, name: "contractorRegion" });
 const selectedContractorCity = useWatch({ control: form.control, name: "contractorCity" });

 const selectedBeneficiaryCountry = useWatch({ control: form.control, name: "beneficiaryCountry" });
 const selectedBeneficiaryRegion = useWatch({ control: form.control, name: "beneficiaryRegion" });
 const selectedBeneficiaryCity = useWatch({ control: form.control, name: "beneficiaryCity" });

 // ── Usuarios por rol via RPC (incluye rol principal, secundario e internal) ──
 // Antes se filtraba client-side con u.role === "inspector", lo que no incluía
 // roles secundarios ni usuarios internal. Ahora usamos getUsersByRoleForCompany
 // que es SECURITY DEFINER y bypassa RLS (migración 273).
 const { data: inspectorList } = useQuery({
 queryKey: ["users-by-role", "inspector", selectedCompanyId],
 queryFn: () => getUsersByRoleForCompany("inspector", selectedCompanyId || undefined),
 });
 const { data: adjusterList } = useQuery({
 queryKey: ["users-by-role", "adjuster", selectedCompanyId],
 queryFn: () => getUsersByRoleForCompany("adjuster", selectedCompanyId || undefined),
 });
 const { data: auditorList } = useQuery({
 queryKey: ["users-by-role", "auditor", selectedCompanyId],
 queryFn: () => getUsersByRoleForCompany("auditor", selectedCompanyId || undefined),
 });
 const { data: dispatcherList } = useQuery({
 queryKey: ["users-by-role", "dispatcher", selectedCompanyId],
 queryFn: () => getUsersByRoleForCompany("dispatcher", selectedCompanyId || undefined),
 });
 const { data: assistantList } = useQuery({
 queryKey: ["users-by-role", "assistant", selectedCompanyId],
 queryFn: () => getUsersByRoleForCompany("assistant", selectedCompanyId || undefined),
 });

 const toUserItems = (list?: { id: string; full_name: string; email: string; source?: string }[]) =>
 (list || []).map((u) => ({ value: u.id, label: u.full_name || u.email || "—", isInternal: u.source === "internal" }));

 const inspectorItems = toUserItems(inspectorList);
 const adjusterItems = toUserItems(adjusterList);
 const auditorItems = toUserItems(auditorList);
 const dispatcherItems = toUserItems(dispatcherList);
 const assistantItems = toUserItems(assistantList);

 const { data: claimCauses } = useQuery({
 queryKey: ["claim-causes"],
 queryFn: () => getClaimCauses(),
 });

 const { data: claimTypes } = useQuery({
 queryKey: ["claim-types"],
 queryFn: () => getClaimTypes(),
 });

 const { data: insuranceCompaniesCatalog } = useQuery({
 queryKey: ["insurance-companies"],
 queryFn: () => getInsuranceCompanies(),
 });

 const insuranceCompanyOptions = useMemo(() => {
 const activeIds = new Set<string>();
 claims?.forEach((c) => {
   if (c.insurance_company_id) activeIds.add(c.insurance_company_id);
 });
 const list = Array.from(activeIds).map((id) => {
   const company = insuranceCompaniesCatalog?.find((c) => c.id === id);
   return { value: id, label: company?.name || id };
 });
 return list.sort((a, b) => a.label.localeCompare(b.label));
 }, [claims, insuranceCompaniesCatalog]);

 const { data: businessLinesCatalog } = useQuery({
 queryKey: ["business-lines"],
 queryFn: () => getBusinessLines(),
 });

 const { data: insuranceProductsCatalog } = useQuery({
 queryKey: ["insurance-products"],
 queryFn: () => getInsuranceProducts(),
 });

 const { data: brokersCatalog } = useQuery({
 queryKey: ["brokers"],
 queryFn: () => getBrokers(),
 });

 const { data: advisorsCatalog } = useQuery({
 queryKey: ["advisors"],
 queryFn: () => getAdvisors(),
 });

 const { data: housingDestinationsCatalog } = useQuery({
 queryKey: ["housing-destinations"],
 queryFn: () => getHousingDestinations(),
 });

 const { data: damageClassificationsCatalog } = useQuery({
 queryKey: ["damage-classifications"],
 queryFn: () => getDamageClassifications(),
 });

 const { data: constructionTypesCatalog } = useQuery({
 queryKey: ["lookup-catalog", "construction_type"],
 queryFn: () => getLookupCatalog("construction_type"),
 });

 const { data: eventsCatalog } = useQuery({
 queryKey: ["events"],
 queryFn: () => getEvents(),
 });

 const { data: habitabilityCatalog } = useQuery({
 queryKey: ["lookup-catalog", "habitability"],
 queryFn: () => getLookupCatalog("habitability"),
 });

 const { data: documentTypesCatalog } = useQuery({
 queryKey: ["document-types"],
 queryFn: () => getDocumentTypes(),
 });

 const { data: countriesCatalog } = useQuery({
 queryKey: ["countries"],
 queryFn: () => getCountries(),
 });

 const selectedCountryId = countriesCatalog?.find((c) => c.name === selectedClaimCountry)?.id;

 const filteredInsuranceCompanies = insuranceCompaniesCatalog?.filter(
 (c) => !selectedCountryId || c.country_id === selectedCountryId
 );
 const filteredBrokers = brokersCatalog?.filter(
 (b) => !selectedCountryId || b.country_id === selectedCountryId
 );
 const filteredAdvisors = advisorsCatalog?.filter(
 (a) => !selectedCountryId || a.country_id === selectedCountryId
 );
 const filteredBusinessLines = businessLinesCatalog?.filter(
 (b) => !selectedCountryId || b.country_id === selectedCountryId
 );
 const filteredClaimCauses = claimCauses?.filter(
 (c) => !selectedCountryId || c.country_id === selectedCountryId
 );

 // Reset dependent fields when country changes
 useEffect(() => {
 if (selectedClaimCountry) {
 form.setValue("insuranceCompanyId", "");
 form.setValue("advisorId", "");
 form.setValue("brokerId", "");
 form.setValue("businessLineId", "");
 form.setValue("insuranceProductId", "");
 form.setValue("claimCauseId", "");
 }
 }, [selectedClaimCountry, form]);

 // Queries de ubicación para Dirección del Siniestro
 const { data: regionsCatalog } = useQuery({
 queryKey: ["regions", selectedClaimCountry],
 queryFn: () => {
 const country = countriesCatalog?.find((c) => c.name === selectedClaimCountry);
 return getRegions(country?.id);
 },
 enabled: !!selectedClaimCountry && !!countriesCatalog,
 });

 const { data: citiesCatalog } = useQuery({
 queryKey: ["cities", selectedClaimRegion],
 queryFn: () => {
 const region = regionsCatalog?.find((r) => r.name === selectedClaimRegion);
 return getCities(region?.id);
 },
 enabled: !!selectedClaimRegion && !!regionsCatalog,
 });

 const { data: communesCatalog } = useQuery({
 queryKey: ["communes", selectedClaimCity],
 queryFn: () => {
 const city = citiesCatalog?.find((c) => c.name === selectedClaimCity);
 return getCommunes(city?.id);
 },
 enabled: !!selectedClaimCity && !!citiesCatalog,
 });

 // Queries de ubicación para Asegurado
 const { data: insuredRegions } = useQuery({
 queryKey: ["regions", "insured", selectedInsuredCountry],
 queryFn: () => {
 const country = countriesCatalog?.find((c) => c.name === selectedInsuredCountry);
 return getRegions(country?.id);
 },
 enabled: !!selectedInsuredCountry && !!countriesCatalog,
 });

 const { data: insuredCities } = useQuery({
 queryKey: ["cities", "insured", selectedInsuredRegion],
 queryFn: () => {
 const region = insuredRegions?.find((r) => r.name === selectedInsuredRegion);
 return getCities(region?.id);
 },
 enabled: !!selectedInsuredRegion && !!insuredRegions,
 });

 const { data: insuredCommunes } = useQuery({
 queryKey: ["communes", "insured", selectedInsuredCity],
 queryFn: () => {
 const city = insuredCities?.find((c) => c.name === selectedInsuredCity);
 return getCommunes(city?.id);
 },
 enabled: !!selectedInsuredCity && !!insuredCities,
 });

 // Queries de ubicación para Contratante
 const { data: contractorRegions } = useQuery({
 queryKey: ["regions", "contractor", selectedContractorCountry],
 queryFn: () => {
 const country = countriesCatalog?.find((c) => c.name === selectedContractorCountry);
 return getRegions(country?.id);
 },
 enabled: !!selectedContractorCountry && !!countriesCatalog,
 });

 const { data: contractorCities } = useQuery({
 queryKey: ["cities", "contractor", selectedContractorRegion],
 queryFn: () => {
 const region = contractorRegions?.find((r) => r.name === selectedContractorRegion);
 return getCities(region?.id);
 },
 enabled: !!selectedContractorRegion && !!contractorRegions,
 });

 const { data: contractorCommunes } = useQuery({
 queryKey: ["communes", "contractor", selectedContractorCity],
 queryFn: () => {
 const city = contractorCities?.find((c) => c.name === selectedContractorCity);
 return getCommunes(city?.id);
 },
 enabled: !!selectedContractorCity && !!contractorCities,
 });

 // Queries de ubicación para Beneficiario
 const { data: beneficiaryRegions } = useQuery({
 queryKey: ["regions", "beneficiary", selectedBeneficiaryCountry],
 queryFn: () => {
 const country = countriesCatalog?.find((c) => c.name === selectedBeneficiaryCountry);
 return getRegions(country?.id);
 },
 enabled: !!selectedBeneficiaryCountry && !!countriesCatalog,
 });

 const { data: beneficiaryCities } = useQuery({
 queryKey: ["cities", "beneficiary", selectedBeneficiaryRegion],
 queryFn: () => {
 const region = beneficiaryRegions?.find((r) => r.name === selectedBeneficiaryRegion);
 return getCities(region?.id);
 },
 enabled: !!selectedBeneficiaryRegion && !!beneficiaryRegions,
 });

 const { data: beneficiaryCommunes } = useQuery({
 queryKey: ["communes", "beneficiary", selectedBeneficiaryCity],
 queryFn: () => {
 const city = beneficiaryCities?.find((c) => c.name === selectedBeneficiaryCity);
 return getCommunes(city?.id);
 },
 enabled: !!selectedBeneficiaryCity && !!beneficiaryCities,
 });

 // Visibilidad de campos de ubicación (ocultar si no hay datos)
 const hasClaimRegions = !!regionsCatalog && regionsCatalog.length > 0;
 const hasClaimCities = !!citiesCatalog && citiesCatalog.length > 0;
 const hasClaimCommunes = !!communesCatalog && communesCatalog.length > 0;

 const hasInsuredRegions = !!insuredRegions && insuredRegions.length > 0;
 const hasInsuredCities = !!insuredCities && insuredCities.length > 0;
 const hasInsuredCommunes = !!insuredCommunes && insuredCommunes.length > 0;

 const hasContractorRegions = !!contractorRegions && contractorRegions.length > 0;
 const hasContractorCities = !!contractorCities && contractorCities.length > 0;
 const hasContractorCommunes = !!contractorCommunes && contractorCommunes.length > 0;

 const hasBeneficiaryRegions = !!beneficiaryRegions && beneficiaryRegions.length > 0;
 const hasBeneficiaryCities = !!beneficiaryCities && beneficiaryCities.length > 0;
 const hasBeneficiaryCommunes = !!beneficiaryCommunes && beneficiaryCommunes.length > 0;

 const selectedBusinessLineId = useWatch({ control: form.control, name: "businessLineId" });
 const filteredInsuranceProducts = insuranceProductsCatalog?.filter(
 (p) => !selectedBusinessLineId || p.business_line_id === selectedBusinessLineId
 );

 const createMutation = useMutation({
 mutationFn: (values: ClaimCreateMinimalInput) =>
 createClaimMinimal(
 {
 claimNumber: values.claimNumber,
 policyNumber: values.policyNumber,
 claimDate: values.claimDate,
 clientReference: values.clientReference || null,
 assignmentDate: values.assignmentDate || null,
 reportDate: values.reportDate || null,
 summary: values.summary,
 // Si tiene inspector o liquidador asignado → adjustment, si no → created
 statusId: (values.inspectorId || values.adjusterId)
 ? (codeToId["adjustment"] || codeToId["created"] || null)
 : (codeToId["created"] || null),
 inspectorId: values.inspectorId,
 adjusterId: values.adjusterId || null,
 auditorId: values.auditorId || null,
 dispatcherId: values.dispatcherId || null,
 assistantId: values.assistantId || null,
 insuranceCompanyId: values.insuranceCompanyId,
 claimTypeId: values.claimTypeId,
 claimCauseId: values.claimCauseId || null,
 businessLineId: values.businessLineId || null,
 insuranceProductId: values.insuranceProductId || null,
 advisorId: values.advisorId || null,
 brokerId: values.brokerId || null,
 eventId: values.eventId || null,
 constructionTypeId: values.constructionTypeId || null,
 habitabilityId: values.habitabilityId || null,
 destinationHousingId: values.destinationHousingId || null,
 damageClassificationId: values.damageClassificationId || null,
 propertyClassificationId: values.propertyClassificationId || null,
 ownerSameAsInsured: values.ownerType === "propietario",
 company_id: values.companyId,
 countryId: countriesCatalog?.find((c) => c.name === values.claimCountry)?.id || null,
 },
 {
 insuredName: values.insuredName,
 lastName: values.lastName || null,
 rut: values.rut || null,
 insuredEmail: values.insuredEmail || null,
 insuredPhone: values.insuredPhone || null,
 cellPhone: values.cellPhone,
 insuredAddress: values.insuredAddress || null,
 insuredCountry: values.insuredCountry || null,
 insuredRegion: values.insuredRegion || null,
 insuredCity: values.insuredCity || null,
 insuredCommune: values.insuredCommune || null,
 },
 {
 claimAddress: values.claimAddress,
 claimCountry: values.claimCountry,
 claimRegion: values.claimRegion || null,
 claimCity: values.claimCity,
 claimCommune: values.claimCommune || null,
 claimLatitude: values.claimLatitude ?? null,
 claimLongitude: values.claimLongitude ?? null,
 },
 values.contractorName
 ? {
 contractorName: values.contractorName,
 contractorLastName: values.contractorLastName || null,
 contractorRut: values.contractorRut || null,
 contractorEmail: values.contractorEmail || null,
 contractorCellPhone: values.contractorCellPhone || null,
 contractorPhone: values.contractorPhone || null,
 contractorAddress: values.contractorAddress || null,
 contractorCountry: values.contractorCountry || null,
 contractorRegion: values.contractorRegion || null,
 contractorCity: values.contractorCity || null,
 contractorCommune: values.contractorCommune || null,
 }
 : null,
 values.beneficiaryName
 ? {
 beneficiaryName: values.beneficiaryName,
 beneficiaryLastName: values.beneficiaryLastName || null,
 beneficiaryRut: values.beneficiaryRut || null,
 beneficiaryEmail: values.beneficiaryEmail || null,
 beneficiaryCellPhone: values.beneficiaryCellPhone || null,
 beneficiaryPhone: values.beneficiaryPhone || null,
 beneficiaryAddress: values.beneficiaryAddress || null,
 beneficiaryCountry: values.beneficiaryCountry || null,
 beneficiaryRegion: values.beneficiaryRegion || null,
 beneficiaryCity: values.beneficiaryCity || null,
 beneficiaryCommune: values.beneficiaryCommune || null,
 }
 : null
 ),
 onSuccess: (data) => {
 const liqNum = (data as { liquidation_number?: string })?.liquidation_number;
 toast.success(liqNum ? `Siniestro creado — ${liqNum}` : "Siniestro creado");
 queryClient.invalidateQueries({ queryKey: ["claims"] });
 setOpen(false);
 form.reset();
 setDocuments([]);
 setStep(1);
 setExpandedPanel(null);
 setContractorLinked(false);
 setBeneficiaryLinked(false);
 setClaimAddressLinked(false);
 setClaimNumberWarning(null);
 setParticipantSuggestion(null);
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const onSubmit = (values: ClaimCreateMinimalInput) => {
 createMutation.mutate(values);
 };

 const toggleContractorLink = () => {
 if (!contractorLinked) {
 // Ligar: copiar del asegurado y bloquear
 form.setValue("contractorName", form.getValues("insuredName") || "");
 form.setValue("contractorLastName", form.getValues("lastName") || "");
 form.setValue("contractorRut", form.getValues("rut") || "");
 form.setValue("contractorEmail", form.getValues("insuredEmail") || "");
 form.setValue("contractorCellPhone", form.getValues("cellPhone") || "");
 form.setValue("contractorPhone", form.getValues("insuredPhone") || "");
 form.setValue("contractorAddress", form.getValues("insuredAddress") || "");
 form.setValue("contractorCountry", form.getValues("insuredCountry") || "");
 form.setValue("contractorRegion", form.getValues("insuredRegion") || "");
 form.setValue("contractorCity", form.getValues("insuredCity") || "");
 form.setValue("contractorCommune", form.getValues("insuredCommune") || "");
 setContractorLinked(true);
 } else {
 // Desligar: permitir editar independientemente
 setContractorLinked(false);
 }
 };

 const toggleBeneficiaryLink = () => {
 if (!beneficiaryLinked) {
 // Ligar: copiar del asegurado y bloquear
 form.setValue("beneficiaryName", form.getValues("insuredName") || "");
 form.setValue("beneficiaryLastName", form.getValues("lastName") || "");
 form.setValue("beneficiaryRut", form.getValues("rut") || "");
 form.setValue("beneficiaryEmail", form.getValues("insuredEmail") || "");
 form.setValue("beneficiaryCellPhone", form.getValues("cellPhone") || "");
 form.setValue("beneficiaryPhone", form.getValues("insuredPhone") || "");
 form.setValue("beneficiaryAddress", form.getValues("insuredAddress") || "");
 form.setValue("beneficiaryCountry", form.getValues("insuredCountry") || "");
 form.setValue("beneficiaryRegion", form.getValues("insuredRegion") || "");
 form.setValue("beneficiaryCity", form.getValues("insuredCity") || "");
 form.setValue("beneficiaryCommune", form.getValues("insuredCommune") || "");
 setBeneficiaryLinked(true);
 } else {
 // Desligar: permitir editar independientemente
 setBeneficiaryLinked(false);
 }
 };

 const toggleClaimAddressLink = () => {
 if (!claimAddressLinked) {
 // Ligar: copiar dirección del asegurado y bloquear
 form.setValue("claimAddress", form.getValues("insuredAddress") || "");
 form.setValue("claimCountry", form.getValues("insuredCountry") || "");
 form.setValue("claimRegion", form.getValues("insuredRegion") || "");
 form.setValue("claimCity", form.getValues("insuredCity") || "");
 form.setValue("claimCommune", form.getValues("insuredCommune") || "");
 setClaimAddressLinked(true);
 } else {
 // Desligar: permitir editar independientemente
 setClaimAddressLinked(false);
 }
 };

 const handleFileSelect = (files: FileList | null) => {
 if (!files) return;
 const newFiles = Array.from(files).map((file) => ({
 id: Math.random().toString(36).slice(2),
 name: file.name.replace(/\.[^/.]+$/, ""),
 type: "",
 file,
 }));
 setDocuments((prev) => [...prev, ...newFiles]);
 };

 const removeDocument = (id: string) => {
 setDocuments((prev) => prev.filter((d) => d.id !== id));
 };

 const updateDocument = (id: string, updates: Partial<DocumentRow>) => {
 setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
 };

 const filtered = claims?.filter((c) => {
 const textMatch = [c.claim_number, c.client_reference, c.liquidation_number, getParticipant(c, 'insured')?.full_name, getParticipant(c, 'insured')?.address].join(" ").toLowerCase().includes(search.toLowerCase());
 return textMatch;
 });

 const accessors = useMemo<Record<string, (c: ListClaim) => unknown>>(
() => ({
liquidation_number: (c) => c.liquidation_number || "",
client_reference: (c) => c.client_reference || "",
claim_number: (c) => c.claim_number || "",
insured: (c) => getParticipant(c, 'insured')?.full_name || "",
address: (c) => getParticipant(c, 'insured')?.address || "",
status: (c) => statusLabel(c.status_id) || "",
claim_date: (c) => (c.claim_date ? new Date(c.claim_date).getTime() : 0),
report_date: (c) => (c.report_date ? new Date(c.report_date).getTime() : 0),
created_at: (c) => (c.created_at ? new Date(c.created_at).getTime() : 0),
}),
[statusLabel]
);

const sortedClaims = useMemo(() => {
  if (!sortKey || !filtered) return filtered;
  const accessor = accessors[sortKey];
  if (!accessor) return filtered;
  const sorted = [...filtered].sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "asc" ? va - vb : vb - va;
    }
    const sa = String(va ?? "").toLowerCase();
    const sb = String(vb ?? "").toLowerCase();
    const cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });
  return sorted;
}, [filtered, sortKey, sortDir, accessors]);

// Resetear a pagina 1 cuando cambian filtros u orden
useEffect(() => {
  setPage(1);
}, [statusFilter, insuranceCompanyFilter, liquidationFilter, dateFrom, dateTo, search, sortKey, sortDir]);

const total = claimsCount ?? 0;
const totalPages = Math.max(1, Math.ceil(total / pageSize));
const paginatedData = sortedClaims ?? [];

 // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler no puede memoizar useForm().watch() de react-hook-form; suscripción reactiva intencional a los campos de ubicación.
 const [claimAddressW, claimCityW, claimLatitudeW, claimLongitudeW, claimCommuneW, claimRegionW, claimCountryW] = form.watch([
   "claimAddress",
   "claimCity",
   "claimLatitude",
   "claimLongitude",
   "claimCommune",
   "claimRegion",
   "claimCountry",
 ]);

 return (
 <div className="app-page">
 {/* Header unificado: icono + "Siniestros" + contador + botones Exportar/Nuevo */}
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-violet-500 to-sky-500">
 <Shield />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Siniestros</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 <Button
 className="pg-btn-platinum"
 onClick={() => {
 const rows = filtered || [];
 const headers = [
 "N° Liquidación",
 "N° Ref Cliente",
 "N° Siniestro Cía",
 "Asegurado",
 "Dirección",
 "Ciudad",
 "Estado",
 "Siniestro",
 "Denuncio",
 "Creación",
 "Tipo de Siniestro",
 "País",
 ];
 const data = [
 headers,
 ...rows.map((c) => {
 const claimType = claimTypes?.find((ct) => ct.id === c.claim_type_id);
 const country = countriesCatalog?.find((co) => co.id === c.country_id);
 const insured = getParticipant(c, "insured");
 return [
 c.liquidation_number || "",
 c.client_reference || "",
 c.claim_number || "",
 insured?.full_name || "",
 insured?.address || "",
 insured?.city || "",
 statusLabel(c.status_id) || "",
 c.claim_date ? new Date(c.claim_date).toLocaleDateString("es-CL") : "",
 c.report_date ? new Date(c.report_date).toLocaleDateString("es-CL") : "",
 c.created_at ? new Date(c.created_at).toLocaleDateString("es-CL") : "",
 claimType?.name || "",
 country?.name || "",
 ];
 }),
 ];
 const worksheet = XLSX.utils.aoa_to_sheet(data);
 // Anchos de columna aproximados para legibilidad
 worksheet["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
 const workbook = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(workbook, worksheet, "Siniestros");
 XLSX.writeFile(workbook, `siniestros_${new Date().toISOString().slice(0, 10)}.xlsx`);
 }}
 >
 <Download className="h-3.5 w-3.5" /> Exportar
 </Button>
 {canCreate("claims") && (
 <Button onClick={() => { form.reset(); setDocuments([]); setStep(1); setExpandedPanel(null); setContractorLinked(false); setBeneficiaryLinked(false); setClaimAddressLinked(false); setClaimNumberWarning(null); setParticipantSuggestion(null); setOpen(true); }} className="pg-btn-platinum">
 Nuevo
 </Button>
 )}
 </div>
 </div>

 <Dialog
 open={open}
 dismissible={false}
 onOpenChange={(v) => {
 setOpen(v);
 if (!v) {
 form.reset();
 setStep(1);
 setDocuments([]);
 setExpandedPanel(null);
 setContractorLinked(false);
 setBeneficiaryLinked(false);
 setClaimAddressLinked(false);
 setClaimNumberWarning(null);
 setParticipantSuggestion(null);
 }
 }}
 >
 <DialogContent className="modal-lg" showCloseButton={true}>
 <div className="modal-header">
 <DialogTitle className="modal-title flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
 <ClipboardCheck className="h-4 w-4" />
 </div>
 Crear Siniestro
 </DialogTitle>
 <DialogDescription className="modal-subtitle">
 Completa los datos para crear el siniestro e iniciar una inspección remota.
 </DialogDescription>
 </div>

 <div className="modal-body">
 <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (step === 4) form.handleSubmit(onSubmit)(e); }} id="claim-wizard-form">
 {/* Wizard steps - compact */}
 <div className="flex items-center gap-1 mb-5 px-1">
 {wizardSteps.map((s, idx) => (
 <div key={s.id} className="flex items-center flex-1">
 <div className="flex items-center gap-1.5">
 <div
 className={cn(
 "flex h-5 w-5 items-center justify-center rounded-full app-body font-bold transition-colors",
 step > s.id ? "bg-emerald-500 text-white" : step === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
 )}
 >
 {step > s.id ? <Check className="h-3 w-3" /> : s.id}
 </div>
 <span className={cn("app-body font-medium", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
 {s.label}
 </span>
 </div>
 {idx < wizardSteps.length - 1 && (
 <div
 className={cn(
 "h-px flex-1 mx-2 transition-colors",
 step > s.id ? "bg-emerald-300" : "bg-border"
 )}
 />
 )}
 </div>
 ))}
 </div>

 {/* PASO 1: DETALLES SINIESTRO */}
 {step === 1 && (
 <div className="space-y-3">
 {/* Datos del Siniestro */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <h3 className="app-section-title">Datos del Siniestro</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 País del Siniestro <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="claimCountry"
 placeholder="Seleccionar país..."
 className="app-input"
 onValueChange={() => {
 form.setValue("claimRegion", "");
 form.setValue("claimCity", "");
 form.setValue("claimCommune", "");
 }}
 items={countriesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {countriesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>
 {c.name}
 </SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.claimCountry?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Empresa (Cliente) <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="companyId"
 placeholder="Selecciona una empresa"
 className="app-input"
 items={companies?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {companies?.map((c) => (
 <SelectItem key={c.id} value={c.id}>
 {c.name}
 </SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.companyId?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Compañía de Seguros <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="insuranceCompanyId"
 placeholder="Seleccionar compañía..."
 className="app-input"
 items={filteredInsuranceCompanies?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {filteredInsuranceCompanies?.map((c) => (
 <SelectItem key={c.id} value={c.id}>
 {c.name}
 </SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.insuranceCompanyId?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">N° Interno Cliente</Label>
 <input {...form.register("clientReference")} placeholder="MCL-XXXX" className="app-input" />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 N° Siniestro (Compañía) <span className="text-red-500">*</span>
 </Label>
 <input {...form.register("claimNumber")} placeholder="Ej: 12345678" className={`app-input ${claimNumberWarning ? "border-amber-500 ring-1 ring-amber-500/30" : ""}`} />
 <FieldError message={form.formState.errors.claimNumber?.message} />
 {claimNumberWarning && (
 <p className="app-body text-amber-600 leading-tight flex items-center gap-1">
 <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
 {claimNumberWarning}
 </p>
 )}
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 N° Póliza <span className="text-red-500">*</span>
 </Label>
 <input {...form.register("policyNumber")} placeholder="Ej: POL-2026-001" className="app-input" />
 <FieldError message={form.formState.errors.policyNumber?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Fecha Siniestro <span className="text-red-500">*</span>
 </Label>
 <FormDatePicker control={form.control} name="claimDate" className="w-[130px]" />
 <FieldError message={form.formState.errors.claimDate?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Fecha Denuncio</Label>
 <FormDatePicker control={form.control} name="reportDate" className="w-[130px]" />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Fecha Asignación</Label>
 <FormDatePicker control={form.control} name="assignmentDate" className="w-[130px]" />
 </div>
 </div>
 </div>

 {/* Clasificación */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <h3 className="app-section-title">Clasificación</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Tipo de Siniestro <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="claimTypeId"
 placeholder="Seleccionar tipo..."
 className="app-input"
 onValueChange={() => {
 form.setValue("businessLineId", "");
 form.setValue("insuranceProductId", "");
 }}
 items={claimTypes?.map((t) => ({ value: t.id, label: t.name ?? "" })) || []}
 >
 {claimTypes?.map((t) => (
 <SelectItem key={t.id} value={t.id}>
 {t.name}
 </SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.claimTypeId?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Línea de Negocios</Label>
 <FormSelect
 control={form.control}
 name="businessLineId"
 placeholder="Seleccionar línea..."
 className="app-input"
 clearable
 onValueChange={() => form.setValue("insuranceProductId", "")}
 items={filteredBusinessLines?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {filteredBusinessLines?.map((c) => (
 <SelectItem key={c.id} value={c.id}>
 {c.name}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Ramo/Producto</Label>
 <FormSelect
 control={form.control}
 name="insuranceProductId"
 placeholder="Seleccionar producto..."
 className="app-input"
 disabled={!selectedBusinessLineId}
 clearable
 items={filteredInsuranceProducts?.map((p) => ({ value: p.id, label: p.name ?? "" })) || []}
 >
 {filteredInsuranceProducts?.map((p) => (
 <SelectItem key={p.id} value={p.id}>
 {p.name}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Evento</Label>
 <FormSelect
 control={form.control}
 name="eventId"
 placeholder="Seleccionar evento..."
 className="app-input"
 clearable
 items={eventsCatalog?.map((e) => ({ value: e.id, label: e.name ?? "" })) || []}
 >
 {eventsCatalog?.map((e) => (
 <SelectItem key={e.id} value={e.id}>
 {e.name}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Asesor</Label>
 <FormSelect
 control={form.control}
 name="advisorId"
 placeholder="Seleccionar asesor..."
 className="app-input"
 clearable
 items={filteredAdvisors?.map((a) => ({ value: a.id, label: a.name ?? "" })) || []}
 >
 {filteredAdvisors?.map((a) => (
 <SelectItem key={a.id} value={a.id}>
 {a.name}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Corredor</Label>
 <FormSelect
 control={form.control}
 name="brokerId"
 placeholder="Seleccionar corredor..."
 className="app-input"
 clearable
 items={filteredBrokers?.map((b) => ({ value: b.id, label: b.name ?? "" })) || []}
 >
 {filteredBrokers?.map((b) => (
 <SelectItem key={b.id} value={b.id}>
 {b.name}
 </SelectItem>
 ))}
 </FormSelect>
 </div>
 </div>
 </div>

 {/* Asignación */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <h3 className="app-section-title">Asignación</h3>
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Inspector <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="inspectorId"
 placeholder="Seleccionar inspector..."
 className="app-input"
 items={inspectorItems}
 >
 {inspectorItems.map((item) => (
 <SelectItem
 key={item.value}
 value={item.value}
 className={item.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {item.label}
 {item.isInternal && <span className="app-body text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.inspectorId?.message} />
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Ajustador / Liquidador</Label>
 <FormSelect
 control={form.control}
 name="adjusterId"
 placeholder="Seleccionar ajustador..."
 className="app-input"
 clearable
 items={adjusterItems}
 >
 {adjusterItems.map((item) => (
 <SelectItem
 key={item.value}
 value={item.value}
 className={item.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {item.label}
 {item.isInternal && <span className="app-body text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Auditor</Label>
 <FormSelect
 control={form.control}
 name="auditorId"
 placeholder="Seleccionar auditor..."
 className="app-input"
 clearable
 items={auditorItems}
 >
 {auditorItems.map((item) => (
 <SelectItem
 key={item.value}
 value={item.value}
 className={item.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {item.label}
 {item.isInternal && <span className="app-body text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Despachador</Label>
 <FormSelect
 control={form.control}
 name="dispatcherId"
 placeholder="Seleccionar despachador..."
 className="app-input"
 clearable
 items={dispatcherItems}
 >
 {dispatcherItems.map((item) => (
 <SelectItem
 key={item.value}
 value={item.value}
 className={item.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {item.label}
 {item.isInternal && <span className="app-body text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 ))}
 </FormSelect>
 </div>

 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Asistente</Label>
 <FormSelect
 control={form.control}
 name="assistantId"
 placeholder="Seleccionar asistente..."
 className="app-input"
 clearable
 items={assistantItems}
 >
 {assistantItems.map((item) => (
 <SelectItem
 key={item.value}
 value={item.value}
 className={item.isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {item.label}
 {item.isInternal && <span className="app-body text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 ))}
 </FormSelect>
 </div>
 </div>
 </div>
 </div>
 )}

{/* PASO 2: ASEGURADO, CONTRATANTE, BENEFICIARIO */}
 {step === 2 && (
 <div className="space-y-3">
 {/* Asegurado (siempre expandido) */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <h3 className="app-section-title">Asegurado</h3>
 {participantSuggestion?.section === "insured" && (
 <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
 <div className="app-body text-sky-800">
 <span className="font-semibold">Persona encontrada:</span>{" "}
 {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
 {participantSuggestion.data.address && (
 <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
 )}
 </div>
 <button
 type="button"
 className="btn-link-sm"
 onClick={() => applySuggestion("insured")}
 >
 Usar datos
 </button>
 </div>
 )}
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">RUT</Label>
 <input {...form.register("rut")} placeholder="14185994k" className="app-input" />
 <FieldError message={form.formState.errors.rut?.message} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Nombre <span className="text-red-500">*</span>
 </Label>
 <input {...form.register("insuredName")} placeholder="Cristian" className="app-input" />
 <FieldError message={form.formState.errors.insuredName?.message} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Apellido</Label>
 <input {...form.register("lastName")} placeholder="Zárate" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Email</Label>
 <input {...form.register("insuredEmail")} type="email" placeholder="asegurado@email.com" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Celular <span className="text-red-500">*</span>
 </Label>
 <input {...form.register("cellPhone")} placeholder="9 9999 9999" className="app-input" />
 <FieldError message={form.formState.errors.cellPhone?.message} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Teléfono</Label>
 <input {...form.register("insuredPhone")} placeholder="X XXXX XXXX" className="app-input" />
 </div>
 <div className="flex flex-col gap-1 col-span-full">
 <Label className="app-body text-muted-foreground">Dirección</Label>
 <input {...form.register("insuredAddress")} placeholder="Av. Ricardo Lyon 1351" className="app-input" />
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">País</Label>
 <FormSelect
 control={form.control}
 name="insuredCountry"
 placeholder="Seleccionar país..."
 className="app-input"
 clearable
 onValueChange={() => {
 form.setValue("insuredRegion", "");
 form.setValue("insuredCity", "");
 form.setValue("insuredCommune", "");
 }}
 items={countriesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {countriesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 {hasInsuredRegions && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Región</Label>
 <FormSelect
 control={form.control}
 name="insuredRegion"
 placeholder="Seleccionar región..."
 className="app-input"
 disabled={!selectedInsuredCountry}
 clearable
 onValueChange={() => {
 form.setValue("insuredCity", "");
 form.setValue("insuredCommune", "");
 }}
 items={insuredRegions?.map((r) => ({ value: r.name, label: r.name })) || []}
 >
 {insuredRegions?.map((r) => (
 <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasInsuredCities && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Ciudad</Label>
 <FormSelect
 control={form.control}
 name="insuredCity"
 placeholder="Seleccionar ciudad..."
 className="app-input"
 disabled={!selectedInsuredRegion}
 clearable
 onValueChange={() => form.setValue("insuredCommune", "")}
 items={insuredCities?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {insuredCities?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasInsuredCommunes && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Comuna</Label>
 <FormSelect
 control={form.control}
 name="insuredCommune"
 placeholder="Seleccionar comuna..."
 className="app-input"
 disabled={!selectedInsuredCity}
 clearable
 items={insuredCommunes?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {insuredCommunes?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 </div>
 </div>

 {/* Contratante (colapsable) */}
 <div className="rounded-lg border border-border/50 overflow-hidden">
 <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
 <button
 type="button"
 className="flex items-center gap-2 flex-1"
 onClick={() => setExpandedPanel(expandedPanel === "contractor" ? null : "contractor")}
 >
 <h3 className="app-section-title">Contratante</h3>
 <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPanel === "contractor" ? "rotate-180" : ""}`} />
 </button>
 {expandedPanel === "contractor" && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className={`h-6 app-body w-[150px] justify-center ${contractorLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
 onClick={() => toggleContractorLink()}
 >
 {contractorLinked ? "Desligar" : "Copiar"}
 </Button>
 )}
 </div>
 {expandedPanel === "contractor" && (
 <div className="px-3 pb-3 space-y-2">
 {participantSuggestion?.section === "contractor" && !contractorLinked && (
 <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
 <div className="app-body text-sky-800">
 <span className="font-semibold">Persona encontrada:</span>{" "}
 {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
 {participantSuggestion.data.address && (
 <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
 )}
 </div>
 <button
 type="button"
 className="btn-link-sm"
 onClick={() => applySuggestion("contractor")}
 >
 Usar datos
 </button>
 </div>
 )}
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">RUT</Label>
 <input {...form.register("contractorRut")} readOnly={contractorLinked} placeholder="14185994k" className="app-input" />
 <FieldError message={form.formState.errors.contractorRut?.message} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Nombre</Label>
 <input {...form.register("contractorName")} readOnly={contractorLinked} placeholder="Cristian" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Apellido</Label>
 <input {...form.register("contractorLastName")} readOnly={contractorLinked} placeholder="Zárate" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Email</Label>
 <input {...form.register("contractorEmail")} readOnly={contractorLinked} type="email" placeholder="contratante@email.com" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Celular</Label>
 <input {...form.register("contractorCellPhone")} readOnly={contractorLinked} placeholder="9 9999 9999" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Teléfono</Label>
 <input {...form.register("contractorPhone")} readOnly={contractorLinked} placeholder="X XXXX XXXX" className="app-input" />
 </div>
 <div className="flex flex-col gap-1 col-span-full">
 <Label className="app-body text-muted-foreground">Dirección</Label>
 <input {...form.register("contractorAddress")} readOnly={contractorLinked} placeholder="Av. Ricardo Lyon 1351" className="app-input" />
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">País</Label>
 <FormSelect
 control={form.control}
 name="contractorCountry"
 placeholder="Seleccionar país..."
 className="app-input"
 disabled={contractorLinked}
 clearable
 onValueChange={() => {
 form.setValue("contractorRegion", "");
 form.setValue("contractorCity", "");
 form.setValue("contractorCommune", "");
 }}
 items={countriesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {countriesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 {hasContractorRegions && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Región</Label>
 <FormSelect
 control={form.control}
 name="contractorRegion"
 placeholder="Seleccionar región..."
 className="app-input"
 disabled={contractorLinked || !selectedContractorCountry}
 clearable
 onValueChange={() => {
 form.setValue("contractorCity", "");
 form.setValue("contractorCommune", "");
 }}
 items={contractorRegions?.map((r) => ({ value: r.name, label: r.name })) || []}
 >
 {contractorRegions?.map((r) => (
 <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasContractorCities && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Ciudad</Label>
 <FormSelect
 control={form.control}
 name="contractorCity"
 placeholder="Seleccionar ciudad..."
 className="app-input"
 disabled={contractorLinked || !selectedContractorRegion}
 clearable
 onValueChange={() => form.setValue("contractorCommune", "")}
 items={contractorCities?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {contractorCities?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasContractorCommunes && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Comuna</Label>
 <FormSelect
 control={form.control}
 name="contractorCommune"
 placeholder="Seleccionar comuna..."
 className="app-input"
 disabled={contractorLinked || !selectedContractorCity}
 clearable
 items={contractorCommunes?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {contractorCommunes?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Beneficiario (colapsable) */}
 <div className="rounded-lg border border-border/50 overflow-hidden">
 <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
 <button
 type="button"
 className="flex items-center gap-2 flex-1"
 onClick={() => setExpandedPanel(expandedPanel === "beneficiary" ? null : "beneficiary")}
 >
 <h3 className="app-section-title">Beneficiario</h3>
 <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPanel === "beneficiary" ? "rotate-180" : ""}`} />
 </button>
 {expandedPanel === "beneficiary" && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className={`h-6 app-body w-[150px] justify-center ${beneficiaryLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
 onClick={() => toggleBeneficiaryLink()}
 >
 {beneficiaryLinked ? "Desligar" : "Copiar"}
 </Button>
 )}
 </div>
 {expandedPanel === "beneficiary" && (
 <div className="px-3 pb-3 space-y-2">
 {participantSuggestion?.section === "beneficiary" && !beneficiaryLinked && (
 <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
 <div className="app-body text-sky-800">
 <span className="font-semibold">Persona encontrada:</span>{" "}
 {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
 {participantSuggestion.data.address && (
 <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
 )}
 </div>
 <button
 type="button"
 className="btn-link-sm"
 onClick={() => applySuggestion("beneficiary")}
 >
 Usar datos
 </button>
 </div>
 )}
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">RUT</Label>
 <input {...form.register("beneficiaryRut")} readOnly={beneficiaryLinked} placeholder="14185994k" className="app-input" />
 <FieldError message={form.formState.errors.beneficiaryRut?.message} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Nombre</Label>
 <input {...form.register("beneficiaryName")} readOnly={beneficiaryLinked} placeholder="Cristian" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Apellido</Label>
 <input {...form.register("beneficiaryLastName")} readOnly={beneficiaryLinked} placeholder="Zárate" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Email</Label>
 <input {...form.register("beneficiaryEmail")} readOnly={beneficiaryLinked} type="email" placeholder="beneficiario@email.com" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Celular</Label>
 <input {...form.register("beneficiaryCellPhone")} readOnly={beneficiaryLinked} placeholder="9 9999 9999" className="app-input" />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Teléfono</Label>
 <input {...form.register("beneficiaryPhone")} readOnly={beneficiaryLinked} placeholder="X XXXX XXXX" className="app-input" />
 </div>
 <div className="flex flex-col gap-1 col-span-full">
 <Label className="app-body text-muted-foreground">Dirección</Label>
 <input {...form.register("beneficiaryAddress")} readOnly={beneficiaryLinked} placeholder="Av. Ricardo Lyon 1351" className="app-input" />
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">País</Label>
 <FormSelect
 control={form.control}
 name="beneficiaryCountry"
 placeholder="Seleccionar país..."
 className="app-input"
 disabled={beneficiaryLinked}
 clearable
 onValueChange={() => {
 form.setValue("beneficiaryRegion", "");
 form.setValue("beneficiaryCity", "");
 form.setValue("beneficiaryCommune", "");
 }}
 items={countriesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {countriesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 {hasBeneficiaryRegions && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Región</Label>
 <FormSelect
 control={form.control}
 name="beneficiaryRegion"
 placeholder="Seleccionar región..."
 className="app-input"
 disabled={beneficiaryLinked || !selectedBeneficiaryCountry}
 clearable
 onValueChange={() => {
 form.setValue("beneficiaryCity", "");
 form.setValue("beneficiaryCommune", "");
 }}
 items={beneficiaryRegions?.map((r) => ({ value: r.name, label: r.name })) || []}
 >
 {beneficiaryRegions?.map((r) => (
 <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasBeneficiaryCities && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Ciudad</Label>
 <FormSelect
 control={form.control}
 name="beneficiaryCity"
 placeholder="Seleccionar ciudad..."
 className="app-input"
 disabled={beneficiaryLinked || !selectedBeneficiaryRegion}
 clearable
 onValueChange={() => form.setValue("beneficiaryCommune", "")}
 items={beneficiaryCities?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {beneficiaryCities?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasBeneficiaryCommunes && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Comuna</Label>
 <FormSelect
 control={form.control}
 name="beneficiaryCommune"
 placeholder="Seleccionar comuna..."
 className="app-input"
 disabled={beneficiaryLinked || !selectedBeneficiaryCity}
 clearable
 items={beneficiaryCommunes?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {beneficiaryCommunes?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* PASO 3: INCIDENTE Y DIRECCIÓN */}
 {step === 3 && (
 <div className="space-y-3">
 {/* Incidente */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <h3 className="app-section-title">Incidente</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Causal del Siniestro</Label>
 <FormSelect
 control={form.control}
 name="claimCauseId"
 placeholder="Seleccionar causal..."
 className="app-input"
 clearable
 items={filteredClaimCauses?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {filteredClaimCauses?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Tipo de Construcción</Label>
 <FormSelect
 control={form.control}
 name="constructionTypeId"
 placeholder="Seleccionar tipo..."
 className="app-input"
 clearable
 items={constructionTypesCatalog?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {constructionTypesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Habitabilidad</Label>
 <FormSelect
 control={form.control}
 name="habitabilityId"
 placeholder="Seleccionar habitabilidad..."
 className="app-input"
 clearable
 items={habitabilityCatalog?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {habitabilityCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Destino</Label>
 <FormSelect
 control={form.control}
 name="destinationHousingId"
 placeholder="Seleccionar destino..."
 className="app-input"
 clearable
 items={housingDestinationsCatalog?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {housingDestinationsCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Asegurado/Propietario</Label>
 <FormSelect
 control={form.control}
 name="ownerType"
 placeholder="Seleccionar..."
 className="app-input"
 clearable
 >
 <SelectItem value="propietario">Propietario</SelectItem>
 <SelectItem value="arrendatario">Arrendatario</SelectItem>
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Clasificación del Daño</Label>
 <FormSelect
 control={form.control}
 name="damageClassificationId"
 placeholder="Seleccionar clasificación..."
 className="app-input"
 clearable
 items={damageClassificationsCatalog?.map((c) => ({ value: c.id, label: c.name ?? "" })) || []}
 >
 {damageClassificationsCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 <div className="flex flex-col gap-1 col-span-full">
 <Label className="app-body text-muted-foreground">Resumen</Label>
 <textarea {...form.register("summary")} rows={2} className="app-input resize-none" placeholder="Descripción breve del siniestro..." />
 </div>
 </div>
 </div>

 {/* Dirección del Siniestro */}
 <div className="rounded-lg border border-border/50 p-3 space-y-2">
 <div className="w-full flex items-center justify-between">
 <h3 className="app-section-title">Dirección del Siniestro</h3>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className={`h-6 app-body w-[150px] justify-center ${claimAddressLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
 onClick={() => toggleClaimAddressLink()}
 >
 {claimAddressLinked ? "Desligar" : "Copiar"}
 </Button>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2">
 <div className="flex flex-col gap-1 col-span-full">
 <Label className="app-body text-muted-foreground">
 Dirección <span className="text-red-500">*</span>
 </Label>
 <input {...form.register("claimAddress")} readOnly={claimAddressLinked} placeholder="Av. Ricardo Lyon 1351" className="app-input" />
 <FieldError message={form.formState.errors.claimAddress?.message} />
 </div>
 </div>

 {/* Geocodificación manual: el usuario confirma la ubicación exacta */}
 <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-3">
 <div className="flex items-center justify-between">
 <span className="app-body font-medium">Ubicación en mapa</span>
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="pg-btn-platinum h-6 app-body"
 disabled={!claimAddressW || !claimCityW}
 onClick={() => setLocationSelectorOpen(true)}
 >
 <MapPin className="h-3 w-3 mr-1" />
 Buscar ubicación
 </Button>
 </div>
 {(claimLatitudeW && claimLongitudeW) ? (
 <div className="app-body text-emerald-600 flex items-center gap-2">
 <CheckCircle2 className="h-3.5 w-3.5" />
 <span>
 Ubicación confirmada: {Number(claimLatitudeW).toFixed(6)}, {Number(claimLongitudeW).toFixed(6)}
 </span>
 </div>
 ) : (
 <div className="app-body text-amber-600 flex items-center gap-2">
 <AlertTriangle className="h-3.5 w-3.5" />
 <span>Falta confirmar la ubicación exacta en el mapa.</span>
 </div>
 )}
 </div>
 <div className="grid grid-cols-4 gap-2">
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">País</Label>
 <FormSelect
 control={form.control}
 name="claimCountry"
 placeholder="Seleccionar país..."
 className="app-input"
 disabled={claimAddressLinked}
 onValueChange={() => {
 form.setValue("claimRegion", "");
 form.setValue("claimCity", "");
 form.setValue("claimCommune", "");
 }}
 items={countriesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {countriesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 {hasClaimRegions && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Región</Label>
 <FormSelect
 control={form.control}
 name="claimRegion"
 placeholder="Seleccionar región..."
 className="app-input"
 disabled={!selectedClaimCountry || claimAddressLinked}
 clearable
 onValueChange={() => {
 form.setValue("claimCity", "");
 form.setValue("claimCommune", "");
 }}
 items={regionsCatalog?.map((r) => ({ value: r.name, label: r.name })) || []}
 >
 {regionsCatalog?.map((r) => (
 <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 {hasClaimCities && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">
 Ciudad <span className="text-red-500">*</span>
 </Label>
 <FormSelect
 control={form.control}
 name="claimCity"
 placeholder="Seleccionar ciudad..."
 className="app-input"
 disabled={!selectedClaimRegion || claimAddressLinked}
 onValueChange={() => form.setValue("claimCommune", "")}
 items={citiesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {citiesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 <FieldError message={form.formState.errors.claimCity?.message} />
 </div>
 )}
 {hasClaimCommunes && (
 <div className="flex flex-col gap-1">
 <Label className="app-body text-muted-foreground">Comuna</Label>
 <FormSelect
 control={form.control}
 name="claimCommune"
 placeholder="Seleccionar comuna..."
 className="app-input"
 disabled={!selectedClaimCity || claimAddressLinked}
 clearable
 items={communesCatalog?.map((c) => ({ value: c.name, label: c.name })) || []}
 >
 {communesCatalog?.map((c) => (
 <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
 ))}
 </FormSelect>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* PASO 4: DOCUMENTOS SOPORTE */}
 {step === 4 && (
 <div className="space-y-3">
 <SectionTitle>Documentos Soporte</SectionTitle>
 <div
 className={`border rounded-xl border-dashed p-10 text-center transition-colors ${
 dragOver ? "border-primary bg-primary/5" : "border-border"
 }`}
 onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
 >
 <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
 <p className="text-muted-foreground app-body">
 Arrastra archivo(s) aquí o{" "}
 <label className="cursor-pointer text-primary hover:underline">
 haz clic para seleccionar
 <input
 type="file"
 multiple
 className="hidden"
 onChange={(e) => handleFileSelect(e.target.files)}
 />
 </label>
 </p>
 <p className="text-muted-foreground app-body mt-1">
 Acepta archivos PDF, Word y Excel de hasta 10 MB
 </p>
 </div>

 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <th className="text-left">Nombre de documento</th>
 <th className="text-left">Tipo de documento</th>
 <th className="text-left">Nombre de archivo</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {documents.length === 0 ? (
 <tr>
 <td colSpan={4} className="text-center text-muted-foreground py-6">
 No hay documentos cargados.
 </td>
 </tr>
 ) : (
 documents.map((doc) => (
 <tr key={doc.id}>
 <td>
 <input value={doc.name}
 onChange={(e) =>
 updateDocument(doc.id, { name: e.target.value })
 }
 className="h-8 app-body"
 placeholder="Nombre de documento"
 />
 </td>
 <td>
 <FormSelect
 control={form.control}
 name={`documentType-${doc.id}`}
 placeholder="Tipo..."
 className="h-8 app-body"
 onValueChange={(v) => updateDocument(doc.id, { type: v })}
 items={documentTypesCatalog?.map((t) => ({ value: t.id, label: t.name })) || []}
 >
 {documentTypesCatalog?.map((t) => (
 <SelectItem key={t.id} value={t.id}>
 {t.name}
 </SelectItem>
 ))}
 </FormSelect>
 </td>
 <td className="app-body text-muted-foreground truncate max-w-[180px]">
 {doc.file.name}
 </td>
 <td>
 <Button
 variant="ghost"
 size="icon"
 className="btn-icon-sm btn-danger-hover"
 onClick={() => removeDocument(doc.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </form>
 </div>

 <div className="modal-footer">
 <button
 type="button"
 className="pg-btn-platinum"
 onClick={() => {
 setOpen(false);
 form.reset();
 setStep(1);
 setDocuments([]);
 setExpandedPanel(null);
 setContractorLinked(false);
 setBeneficiaryLinked(false);
 setClaimAddressLinked(false);
 setClaimNumberWarning(null);
 setParticipantSuggestion(null);
 }}
 >
 Cancelar
 </button>
 <div className="flex-1" />
 {step > 1 && (
 <button
 type="button"
 className="pg-btn-platinum"
 onClick={() => setStep(step - 1)}
 >
 Atrás
 </button>
 )}
 {step < 4 ? (
 <button
 type="button"
 className="pg-btn-platinum"
 onClick={() => setStep(step + 1)}
 >
 Siguiente
 </button>
 ) : (
 <button
 type="submit"
 form="claim-wizard-form"
 className="pg-btn-platinum"
 disabled={createMutation.isPending}
 >
 {createMutation.isPending ? "Creando..." : "Crear"}
 </button>
 )}
 </div>

 <ClaimLocationSelector
 open={locationSelectorOpen}
 onOpenChange={setLocationSelectorOpen}
 address={claimAddressW || ""}
 commune={claimCommuneW}
 city={claimCityW}
 region={claimRegionW}
 country={claimCountryW}
 onSelect={(candidate: GeocodeCandidate) => {
 form.setValue("claimLatitude", candidate.lat);
 form.setValue("claimLongitude", candidate.lng);
 }}
 />
 </DialogContent>
 </Dialog>

 <div className="app-panel">
 {/* Toolbar integrado: buscador + filtros + controles de paginación */}
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input
 placeholder="Buscar..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="liquid-search"
 />
 </div>
 <Select
 multiple
 value={statusFilter}
 onValueChange={(v: string[]) => setStatusFilter(v ?? [])}
 items={statusOptions.filter((s) => s.value !== "__all")}
>
 <SelectTrigger className="app-input app-filter-narrow">
 <SelectValue placeholder="Todos los estados" />
 </SelectTrigger>
 <SelectContent>
 {statusOptions.filter((s) => s.value !== "__all").map((s) => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select
 multiple
 value={insuranceCompanyFilter}
 onValueChange={(v: string[]) => setInsuranceCompanyFilter(v ?? [])}
 items={insuranceCompanyOptions}
>
 <SelectTrigger className="app-input app-filter-narrow">
 <SelectValue placeholder="Compañía de seguro" />
 </SelectTrigger>
 <SelectContent>
 {insuranceCompanyOptions.map((c) => (
 <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Input
 type="text"
 placeholder="N° Liquidación"
 value={liquidationFilter}
 onChange={(e) => setLiquidationFilter(e.target.value.replace(/\D/g, ""))}
 className="app-input app-filter-narrow"
 />
 <DatePicker
 value={dateFrom}
 onChange={(value) => {
 setDateFrom(value);
 if (value && dateTo && value > dateTo) setDateTo(value);
 }}
 placeholder="Desde"
 className="max-w-[110px]"
 maxDate={dateTo || undefined}
 />
 <DatePicker
 value={dateTo}
 onChange={(value) => {
 setDateTo(value);
 if (value && dateFrom && value < dateFrom) setDateFrom(value);
 }}
 placeholder="Hasta"
 className="max-w-[110px]"
 minDate={dateFrom || undefined}
 />
 {(statusFilter.length > 0 || insuranceCompanyFilter.length > 0 || liquidationFilter || dateFrom || dateTo) && (
 <button
 onClick={() => { setSearch(""); setPage(1); setStatusFilter([]); setInsuranceCompanyFilter([]); setLiquidationFilter(""); setDateFrom(""); setDateTo(""); }}
 className="app-body text-muted-foreground hover:text-foreground px-2"
 >
 Limpiar
 </button>
 )}
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead>
 <tr>
 <SortableTh sortKey="liquidation_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[130px]">N° Liquidación</SortableTh>
 <SortableTh sortKey="client_reference" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[130px] hidden sm:table-cell">N° Ref Cliente</SortableTh>
 <SortableTh sortKey="claim_number" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[130px] hidden lg:table-cell">N° Siniestro Cía</SortableTh>
 <SortableTh sortKey="insured" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-[200px]">Asegurado</SortableTh>
 <SortableTh sortKey="address" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="min-w-[250px] hidden lg:table-cell">Dirección</SortableTh>
 <SortableTh sortKey="status" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[110px]">Estado</SortableTh>
 <SortableTh sortKey="claim_date" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[100px] hidden lg:table-cell">Siniestro</SortableTh>
 <SortableTh sortKey="report_date" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[100px] hidden lg:table-cell">Denuncio</SortableTh>
 <SortableTh sortKey="created_at" currentKey={sortKey} direction={sortDir} onSort={toggleSort} className="w-[100px] hidden lg:table-cell">Creación</SortableTh>
 <th className="w-[70px] text-center hidden lg:table-cell">Tipo/País</th>
 </tr>
 </thead>
 <tbody>
 {isLoading ? (
 <tr><td colSpan={10} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 ) : filtered?.length === 0 ? (
 <tr><td colSpan={10} className="text-center text-muted-foreground py-4">No se encontraron siniestros.</td></tr>
 ) : (
 paginatedData.map((claim) => {
 const claimType = claimTypes?.find((ct) => ct.id === claim.claim_type_id);
 const country = countriesCatalog?.find((c) => c.id === claim.country_id);
 const flagUrl = flagImgUrl(country?.code ?? null);
 const BlIcon = getClaimTypeIcon(claimType?.icon ?? null);
 const openClaim = canOpenClaim(claim);
 return (
 <tr
 key={claim.id}
 className={openClaim ? "row-clickable" : ""}
 onClick={openClaim ? () => router.push(`/dashboard/claims/${claim.id}?edit=1`) : undefined}
 >
 <td className="font-mono font-semibold text-primary">
 <div className="flex items-center gap-2">
 <FileText className="h-4 w-4 text-muted-foreground" />
 {openClaim ? (
 <Link href={`/dashboard/claims/${claim.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
 {claim.liquidation_number || "—"}
 </Link>
 ) : (
 <span className="text-foreground">{claim.liquidation_number || "—"}</span>
 )}
 </div>
 </td>
 <td className="hidden sm:table-cell">{claim.client_reference || "—"}</td>
 <td className="hidden lg:table-cell">{claim.claim_number || "—"}</td>
 <td>{getParticipant(claim, 'insured')?.full_name || "—"}</td>
 <td className="truncate hidden lg:table-cell">{getParticipant(claim, 'insured')?.address || "—"}, {getParticipant(claim, 'insured')?.city || "—"}</td>
 <td><StatusBadge status={statusCode(claim.status_id) ?? ""} label={statusLabel(claim.status_id) || "—"} /></td>
 <td className="hidden lg:table-cell">{new Date(claim.claim_date).toLocaleDateString("es-CL")}</td>
 <td className="hidden lg:table-cell">{claim.report_date ? new Date(claim.report_date).toLocaleDateString("es-CL") : "—"}</td>
 <td className="hidden lg:table-cell">{new Date(claim.created_at).toLocaleDateString("es-CL")}</td>
 <td className="text-center hidden lg:table-cell">
 <div className="flex items-center justify-center gap-1.5">
 <span title={claimType?.name ?? "Tipo de Siniestro"}>
 <BlIcon className="size-3.5 text-muted-foreground" />
 </span>
 {flagUrl ? (
 <Image
 src={flagUrl}
 alt={country?.code ?? ""}
 className="recent-claim-flag-img"
 title={country?.name ?? ""}
 width={18}
 height={13}
 unoptimized
 />
 ) : null}
 </div>
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />
 <div className="text-center app-body text-muted-foreground/70 -mt-1 pb-0.5">
 {total} siniestro{total !== 1 ? "s" : ""}
 </div>
 </div>
 </div>
 );
}

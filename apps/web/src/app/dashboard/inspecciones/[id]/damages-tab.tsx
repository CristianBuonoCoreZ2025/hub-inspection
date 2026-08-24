"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDamages, createDamage, updateDamage, deleteDamage, getThirdParties, getEvidences } from "@/services/inspections";
import { getDamageSpaces, getContentGoodTypes, getContentGoodProducts, getBrandsByTypeId, getCountryCurrencies, getDamageClassifications } from "@/services/catalogs";
import { ProductSearch, type ProductSearchItem } from "@/components/ui/product-search";
import { useLookupCatalogs } from "@/hooks/use-lookup-catalog";
import { toast } from "sonner";
import { Trash2, Pencil, Building2, Package, Lock, Info, Plus, Save, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useAlert } from "@/hooks/use-alert";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { amountInWords } from "@/lib/amount-words";
import type { InspectionDamage, InspectionEvidence, ThirdParty } from "@/types";
import { mergeInspectionDamages, getGlobalCatalogs, type OfflineCatalogs, type OfflineSession } from "@/db/offline-db";
import { getDownloadedSession } from "@/lib/offline/download-session";
import { addPendingDamageCreated, addPendingDamageDeleted, addPendingDamageUpdated } from "@/lib/offline/sync-session";
import type { SessionDetail } from "@/services/inspections";

const unitOptions = ["UND", "M2", "M3", "KG", "LT", "MT", "GLB"];

// Catálogos de materialidad (mismo patrón del acta)
const MATERIALITY_CATALOGS = [
 "materiality_walls",
 "materiality_roof",
 "materiality_flooring",
 "materiality_ceiling",
 "materiality_interior_finish",
 "materiality_exterior_finish",
 "materiality_closure",
];

const MATERIALITY_CATALOG_LABELS: Record<string, string> = {
 materiality_walls: "Muros",
 materiality_roof: "Cubierta / Techumbre",
 materiality_flooring: "Pavimentos Interiores",
 materiality_ceiling: "Cielos Interiores",
 materiality_interior_finish: "Terminaciones Interiores",
 materiality_exterior_finish: "Terminaciones Exteriores",
 materiality_closure: "Cierre Perimetral",
};

// Categorías de daño constructivo: mismos títulos del acta + Otros
const DAMAGE_CATEGORIES: { label: string; requires_detail: boolean }[] = [
 ...MATERIALITY_CATALOGS.map((c) => ({ label: MATERIALITY_CATALOG_LABELS[c], requires_detail: false })),
 { label: "Otros", requires_detail: true },
];

// Opciones de moneda se construyen dinámicamente desde countryCurrencies en el componente

type DamageType = "building" | "content";

interface DamageForm {
 session_id: string;
 category: string;
 subcategory: string;
 description: string;
 observations: string;
 severity: InspectionDamage["severity"];
 dependency: string;
 sector: string;
 materiality_type: string;
 unit: string;
 quantity: number;
 length: number | null;
 width: number | null;
 height: number | null;
 damage_length: number | null;
 damage_width: number | null;
 damage_height: number | null;
 damage_quantity: number;
 damage_type: DamageType;
 product: string;
 brand_model: string;
 product_id: string;
 brand_id: string;
 purchase_date: string;
 estimated_amount: number;
 currency: string;
 third_party_id: string;
 space_id: string;
 content_good_type_id: string;
 building_damage_category_id: string;
}

function emptyForm(sessionId: string, type: DamageType): DamageForm {
 return {
 session_id: sessionId,
 category: type === "building" ? "structural" : "content",
 subcategory: "",
 description: "",
 observations: "",
 severity: "low",
 dependency: "",
 sector: "",
 materiality_type: "",
 unit: "",
 quantity: 0,
 length: null,
 width: null,
 height: null,
 damage_length: null,
 damage_width: null,
 damage_height: null,
 damage_quantity: 0,
 damage_type: type,
 product: "",
 brand_model: "",
 product_id: "",
 brand_id: "",
 purchase_date: "",
 estimated_amount: 0,
 currency: "CLP",
 third_party_id: "",
 space_id: "",
 content_good_type_id: "",
 building_damage_category_id: "",
 };
}

function computeQuantity(unit: string, length: number | null, width: number | null, height: number | null): number {
  if (unit === "M2") return (length || 0) * (width || 0);
  if (unit === "M3") return (length || 0) * (width || 0) * (height || 0);
  if (unit === "MT") return length || 0;
  return 0;
}

function damageToForm(d: InspectionDamage): DamageForm {
 return {
 session_id: d.session_id,
 category: d.category ?? "structural",
 subcategory: d.subcategory ?? "",
 description: d.description ?? "",
 observations: d.observations ?? "",
 severity: d.severity ?? "low",
 dependency: d.dependency ?? "",
 sector: d.sector ?? "",
 materiality_type: d.materiality_type ?? "",
 unit: d.unit ?? "",
 quantity:
   d.unit === "M2" || d.unit === "M3" || d.unit === "MT"
     ? computeQuantity(d.unit, d.length, d.width, d.height)
     : (d.quantity ?? 0),
 length: d.length ?? null,
 width: d.width ?? null,
 height: d.height ?? null,
 damage_length: d.damage_length ?? null,
 damage_width: d.damage_width ?? null,
 damage_height: d.damage_height ?? null,
 damage_quantity:
   d.unit === "M2" || d.unit === "M3" || d.unit === "MT"
     ? computeQuantity(d.unit, d.damage_length, d.damage_width, d.damage_height)
     : (d.damage_quantity ?? 0),
 damage_type: d.damage_type === "content" ? "content" : "building",
 product: d.product ?? "",
 brand_model: d.brand_model ?? "",
 product_id: d.product_id ?? "",
 brand_id: d.brand_id ?? "",
 purchase_date: d.purchase_date ?? "",
 estimated_amount: d.estimated_amount ?? 0,
 currency: d.currency ?? "CLP",
 third_party_id: d.third_party_id ?? "",
 space_id: d.space_id ?? "",
 content_good_type_id: d.content_good_type_id ?? "",
 building_damage_category_id: d.building_damage_category_id ?? "",
 };
}

export default function DamagesTab({ sessionId, propertyClassification, countryId, sessionStatus, offlineMode = false, onOfflineSaved, offlineCatalogs, session, offlineSession, isMobile = false }: { sessionId: string; propertyClassification?: string | null; countryId?: string | null; sessionStatus?: string; offlineMode?: boolean; onOfflineSaved?: (updated?: OfflineSession) => void | Promise<void>; offlineCatalogs?: OfflineCatalogs | null; session?: SessionDetail | null; offlineSession?: OfflineSession | null; isMobile?: boolean }) {
 const queryClient = useQueryClient();
 const confirmDelete = useConfirm();
 const showAlert = useAlert();
 const [editing, setEditing] = useState<string | null>(null);
 const [form, setForm] = useState<DamageForm>(emptyForm(sessionId, "building"));
 const [newType, setNewType] = useState<DamageType>("building");
 const [amountRaw, setAmountRaw] = useState("");
 const [amountFocused, setAmountFocused] = useState(false);
 const [contentDocType, setContentDocType] = useState("Boleta");
 const [contentDocFile, setContentDocFile] = useState<File | null>(null);
 const [damageTab, setDamageTab] = useState<"building" | "content">("building");
 const readOnly = sessionStatus === "completed" || sessionStatus === "cancelled";

 // Cargar catálogos globales de IndexedDB si estamos offline y no vienen del padre
 const { data: localCatalogs, isLoading: loadingCatalogs } = useQuery({
   queryKey: ["offline-global-catalogs"],
   queryFn: getGlobalCatalogs,
   enabled: offlineMode && !offlineCatalogs,
   staleTime: Infinity,
 });

 // Cargar sesión offline de IndexedDB si estamos offline y no viene del padre
 const { data: localOfflineSession, isError: localOfflineError } = useQuery({
   queryKey: ["offline-session", sessionId],
   queryFn: async () => {
     console.log("[DamagesTab] loading offline session from IndexedDB", sessionId);
     const result = await getDownloadedSession(sessionId);
     console.log("[DamagesTab] getDownloadedSession result", !!result, result?.id);
     return result;
   },
   enabled: offlineMode && !offlineSession,
   staleTime: 0,
 });
 if (localOfflineError) console.error("[DamagesTab] offline session query error");
 const effectiveOfflineSession = offlineSession ?? localOfflineSession ?? null;

 const formatAmount = (value: number) =>
   new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

 const formatMoney = (value: number, currency = "CLP") => {
   try {
     return new Intl.NumberFormat("es-CL", {
       style: "currency",
       currency,
       currencyDisplay: "code",
       minimumFractionDigits: 0,
       maximumFractionDigits: 2,
     }).format(value || 0);
   } catch {
     return `${currency} ${new Intl.NumberFormat("es-CL", {
       minimumFractionDigits: 0,
       maximumFractionDigits: 2,
     }).format(value || 0)}`;
   }
 };

 const MAX_ESTIMATED_AMOUNT = 999_999_999_999_999;

 const parseAmount = (value: string): number => {
   const clampAmount = (v: number) => (isNaN(v) ? 0 : Math.min(v, MAX_ESTIMATED_AMOUNT));
   if (!value) return 0;
   const hasDot = value.includes(".");
   const hasComma = value.includes(",");

   // Ambos separadores: el último es el decimal
   if (hasDot && hasComma) {
     const lastDot = value.lastIndexOf(".");
     const lastComma = value.lastIndexOf(",");
     const n =
       lastComma > lastDot
         ? Number(value.replace(/\./g, "").replace(/,/g, "."))
         : Number(value.replace(/,/g, ""));
     return isNaN(n) ? 0 : clampAmount(n);
   }

   if (hasComma) {
     const parts = value.split(",");
     if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
       return clampAmount(Number(value.replace(/,/g, "")));
     }
     return clampAmount(Number(value.replace(/,/g, ".")));
   }

   if (hasDot) {
     const parts = value.split(".");
     if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
       return clampAmount(Number(value.replace(/\./g, "")));
     }
     return clampAmount(Number(value));
   }

   const n = Number(value);
   return isNaN(n) ? 0 : clampAmount(n);
 };

 const MAX_QUANTITY = 999_999_999_999;
 const MAX_DIMENSION = 9_999_999;
 const parseQuantity = (value: string): number => {
   const n = Number(value);
   return value ? (isNaN(n) ? 0 : Math.min(n, MAX_QUANTITY)) : 0;
 };

 const fmtDamageQty = (quantity: number | null, length: number | null, width: number | null, height: number | null, unit: string | null) => {
   if (quantity == null || quantity === 0) return "—";
   const dimension =
     unit === "M2" && (length || width)
       ? ` (${length || 0}x${width || 0})`
       : unit === "M3" && (length || width || height)
       ? ` (${length || 0}x${width || 0}x${height || 0})`
       : "";
   return `${quantity.toLocaleString("es-CL")} ${unit || ""}${dimension}`;
 };

 const formatQuantity = (d: InspectionDamage) => {
   return (
     <div className="flex justify-end gap-1.5 text-[10px] leading-tight text-right">
       <span className="opacity-80">Sup: {fmtDamageQty(d.quantity, d.length, d.width, d.height, d.unit)}</span>
       <span className="text-slate-400">/</span>
       <span className="opacity-80">Daño: {fmtDamageQty(d.damage_quantity, d.damage_length, d.damage_width, d.damage_height, d.unit)}</span>
     </div>
   );
 };

 const handleDimensionChange = (field: "length" | "width" | "height" | "damage_length" | "damage_width" | "damage_height", value: string) => {
   const raw = value ? Number(value) : null;
   const isDamage = field.startsWith("damage_");
   const surfaceField = isDamage ? (field.replace("damage_", "") as "length" | "width" | "height") : field;
   const surfaceValue = form[surfaceField] as number | null;
   const limit = form.unit === "M2" || form.unit === "M3" || form.unit === "MT" ? (surfaceValue ?? 0) : null;

   if (raw != null && !isNaN(raw)) {
     if (isDamage && limit != null && raw > limit) {
       const label = surfaceField === "length" ? "largo" : surfaceField === "width" ? "ancho" : "alto";
       showAlert({ title: "Valor fuera de rango", description: `El ${label} del daño no puede ser mayor que el de la superficie`, type: "error" });
       return;
     }
   }

   setForm((prev) => {
     const clamped = raw == null || isNaN(raw) ? null : Math.min(raw, MAX_DIMENSION);
     const next = { ...prev, [field]: clamped } as DamageForm;

     if (next.unit === "M2" || next.unit === "M3" || next.unit === "MT") {
       if (isDamage) {
         next.damage_quantity = computeQuantity(next.unit, next.damage_length, next.damage_width, next.damage_height);
       } else {
         next.quantity = computeQuantity(next.unit, next.length, next.width, next.height);
         if (clamped != null) {
           const damageField = `damage_${surfaceField}` as "damage_length" | "damage_width" | "damage_height";
           const damageValue = next[damageField] as number | null;
           if (damageValue != null && damageValue > clamped) {
             next[damageField] = clamped;
           }
           next.damage_quantity = computeQuantity(next.unit, next.damage_length, next.damage_width, next.damage_height);
         }
       }
     }
     return next;
   });
 };

 const handleUnitChange = (unit: string) => {
   setForm((prev) => ({
     ...prev,
     unit,
     quantity: unit === "M2" || unit === "M3" || unit === "MT" ? computeQuantity(unit, prev.length, prev.width, prev.height) : prev.quantity,
     damage_quantity: unit === "M2" || unit === "M3" || unit === "MT" ? computeQuantity(unit, prev.damage_length, prev.damage_width, prev.damage_height) : prev.damage_quantity,
   }));
 };

 const handleQuantityChange = (value: string) => {
   setForm((prev) => {
     const quantity = parseQuantity(value);
     const next = { ...prev, quantity };
     if (next.damage_quantity > quantity) {
       next.damage_quantity = quantity;
     }
     return next;
   });
 };

 const handleDamageQuantityChange = (value: string) => {
   const damage_quantity = parseQuantity(value);
   if (damage_quantity > form.quantity) {
     showAlert({ title: "Valor fuera de rango", description: "La cantidad del daño no puede ser mayor que la de la superficie", type: "error" });
     return;
   }
   setForm((prev) => ({ ...prev, damage_quantity }));
 };

 const { data: onlineDamages, isLoading: damagesLoading } = useQuery({
 queryKey: ["damages", sessionId],
 queryFn: () => getDamages(sessionId),
 enabled: !offlineMode,
 });

 const { data: onlineEvidences } = useQuery({
 queryKey: ["evidences", sessionId],
 queryFn: () => getEvidences(sessionId),
 enabled: !!sessionId && !offlineMode,
 });

 const { data: onlineThirdParties } = useQuery({
 queryKey: ["third-parties", sessionId],
 queryFn: () => getThirdParties(sessionId),
 staleTime: 1000 * 60 * 5,
 enabled: !offlineMode,
 });

 // Datos offline desde el session descargado
 const offlineAvailable = !!effectiveOfflineSession || offlineMode;
 const mergedFromSession = mergeInspectionDamages(
   [
     effectiveOfflineSession?.session.inspection_damages as InspectionDamage[] | undefined,
     session?.inspection_damages as InspectionDamage[] | undefined,
     onlineDamages,
   ],
   effectiveOfflineSession?.pending,
 );
 const damages = mergedFromSession.length > 0
   ? mergedFromSession
   : (offlineMode ? (session?.inspection_damages ?? []) as InspectionDamage[] : (onlineDamages ?? []));
 const evidences = onlineEvidences
   ?? ((effectiveOfflineSession?.session.inspection_evidences ?? session?.inspection_evidences ?? []) as InspectionEvidence[]);
 const thirdParties = onlineThirdParties
   ?? ((effectiveOfflineSession?.session.third_parties ?? session?.third_parties ?? []) as ThirdParty[]);
 const isLoading = (!offlineAvailable && !offlineMode && damagesLoading) || loadingCatalogs;
 const effectiveOfflineCatalogs = offlineCatalogs ?? localCatalogs ?? null;
 const useOfflineCatalogs = (offlineAvailable || offlineMode) && !!effectiveOfflineCatalogs;

 // Catálogos: usar datos offline si estamos en modo offline
 const { data: spaces = [] } = useQuery({
 queryKey: ["damage-spaces"],
 queryFn: getDamageSpaces,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode && !useOfflineCatalogs,
 });

 const { data: goodTypes = [] } = useQuery({
 queryKey: ["content-good-types"],
 queryFn: getContentGoodTypes,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode && !useOfflineCatalogs,
 });

 // Todos los productos (con su tipo) para el buscador inteligente
 const { data: allProducts = [] } = useQuery({
 queryKey: ["content-good-products"],
 queryFn: getContentGoodProducts,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode && !useOfflineCatalogs,
 });

 // Marcas válidas para el tipo de bien seleccionado (vía matriz N:M)
 const { data: brandsByType = [] } = useQuery({
 queryKey: ["brands-by-type", form.content_good_type_id],
 queryFn: () => getBrandsByTypeId(form.content_good_type_id),
 enabled: !!form.content_good_type_id && !offlineMode && !useOfflineCatalogs,
 staleTime: 1000 * 60 * 30,
 });

 const { data: damageClassifications = [] } = useQuery({
 queryKey: ["damage-classifications"],
 queryFn: getDamageClassifications,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode && !useOfflineCatalogs,
 });

 // En modo offline, usar catálogos de IndexedDB
 const offlineSpaces = effectiveOfflineCatalogs?.damage_spaces ?? [];
 const offlineGoodTypes = effectiveOfflineCatalogs?.content_good_types ?? [];
 const offlineAllProducts = effectiveOfflineCatalogs?.content_good_products ?? [];
 const offlineDamageClassifications = effectiveOfflineCatalogs?.damage_classifications ?? [];
 const offlineCountryCurrencies = effectiveOfflineCatalogs?.country_currencies ?? [];
 const offlineMaterialityCatalogs = effectiveOfflineCatalogs?.lookup_catalog ?? {};

 // Valores efectivos (online u offline)
 const effectiveSpaces = useOfflineCatalogs ? offlineSpaces : spaces;
 const effectiveGoodTypes = useOfflineCatalogs ? offlineGoodTypes : goodTypes;
 const effectiveAllProducts = useOfflineCatalogs ? offlineAllProducts : allProducts;
 const effectiveDamageClassifications = useOfflineCatalogs ? offlineDamageClassifications : damageClassifications;

 // Marcas offline: filtrar content_good_type_brands por type_id y mapear a brand
 const offlineBrandsByType = useOfflineCatalogs && form.content_good_type_id
   ? (offlineCatalogs?.content_good_type_brands ?? [])
       .filter((tb) => tb.content_good_type_id === form.content_good_type_id && tb.brand)
       .map((tb) => ({ id: tb.brand!.id, name: tb.brand!.name }))
   : [];
 const effectiveBrandsByType = useOfflineCatalogs ? offlineBrandsByType : brandsByType;

 const severityOptions = effectiveDamageClassifications
   .filter((d) => ("code" in d && d.code) || ("severity" in d && d.severity))
   .map((d) => {
     const dc = d as { code?: string; severity?: string; name: string };
     return { value: (dc.code || dc.severity || "").toLowerCase(), label: dc.name };
   });
 const severityLabelMap = Object.fromEntries(
   effectiveDamageClassifications
     .filter((d) => ("code" in d && d.code) || ("severity" in d && d.severity))
     .map((d) => {
       const dc = d as { code?: string; severity?: string; name: string };
       return [(dc.code || dc.severity || "").toLowerCase(), dc.name];
     })
 );

 const { catalogs: materialityCatalogs } = useLookupCatalogs(MATERIALITY_CATALOGS, !useOfflineCatalogs);
 const effectiveMaterialityCatalogs = useOfflineCatalogs ? offlineMaterialityCatalogs : materialityCatalogs;

 const materialityCategoryCode =
   MATERIALITY_CATALOGS.find((c) => MATERIALITY_CATALOG_LABELS[c] === form.subcategory) || "";
 const selectedCategoryRequiresDetail =
   DAMAGE_CATEGORIES.find((c) => c.label === form.subcategory)?.requires_detail ?? false;
 const currentMaterialityItems = effectiveMaterialityCatalogs[materialityCategoryCode] || [];
 const selectedMaterialityItem = currentMaterialityItems.find((i) => i.name === form.materiality_type);
 const selectedGoodType = effectiveGoodTypes.find((g) => g.id === form.content_good_type_id);
 // requiresDetail aplica a daños constructivos (categoría/materialidad) y a
 // daños de contenido (Tipo de Bien con requires_detail=true).
 const requiresDetail =
   selectedCategoryRequiresDetail ||
   !!(selectedMaterialityItem as { requires_detail?: boolean })?.requires_detail ||
   !!selectedGoodType?.requires_detail;
 const materialitySelectValue = selectedMaterialityItem?.id || "";

// Validación para guardar:
// - Constructivo: necesita espacio, materialidad y categoría (subcategory). Si categoría es "Otros", necesita aclaratoria.
// - Contenido: necesita aclaratoria O tipo de contenido (content_good_type_id).
const isBuildingDamage = form.damage_type === "building";
const isContentDamage = form.damage_type === "content";
const buildingValid =
  !!form.space_id &&
  !!form.subcategory &&
  !!form.materiality_type &&
  (!selectedCategoryRequiresDetail || !!form.description?.trim());
const contentValid =
  !!form.description?.trim() ||
  !!form.content_good_type_id;
const canSaveDamage = isBuildingDamage ? buildingValid : isContentDamage ? contentValid : false;

 // Monedas filtradas por país del siniestro
 const { data: countryCurrencies = [] } = useQuery({
 queryKey: ["country-currencies", countryId],
 queryFn: () => getCountryCurrencies(countryId),
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode && !useOfflineCatalogs,
 });

 // Construir opciones de moneda desde el catálogo del país
 // Fallback: si no hay monedas configuradas, usar CLP
 const currencyOptions = (useOfflineCatalogs ? offlineCountryCurrencies : countryCurrencies).length > 0
 ? (useOfflineCatalogs ? offlineCountryCurrencies : countryCurrencies).map((c) => {
     const cc = c as { code?: string; name?: string };
     return { value: cc.code || cc.name || "CLP", label: `${cc.code} — ${cc.name}` };
   })
 : [{ value: "CLP", label: "CLP — Peso Chileno" }];

 const effectiveThirdParties = thirdParties;

 // Terceros afectados (para asociar daños)
 const affectedThirdParties = effectiveThirdParties.filter((t) => t.party_type === "afectado");
 const evidenceDocs = (evidences || []).filter((e) => e.damage_id === editing);

 // Filtrar espacios según la clasificación del inmueble
 const filteredSpaces = propertyClassification
 ? effectiveSpaces.filter((s) =>
 !s.applicable_classifications ||
 s.applicable_classifications.length === 0 ||
 s.applicable_classifications.includes(propertyClassification)
 )
 : [];

 const createMutation = useMutation({
 mutationFn: async (input: Parameters<typeof createDamage>[0]) => {
   const isOffline = offlineAvailable || offlineMode;
   const timeout = new Promise<never>((_, reject) =>
     setTimeout(
       () => reject(new Error(isOffline ? "Timeout guardando daño offline (>3s)" : "Timeout guardando daño online (>10s)")),
       isOffline ? 3000 : 10000,
     ),
   );
   const work = async () => {
     console.log("[createDamage] start", { offlineAvailable, offlineMode, sessionId, input });
     if (!offlineAvailable) {
       console.log("[createDamage] online mode", { onLine: navigator.onLine });
       if (typeof navigator !== "undefined" && !navigator.onLine) {
         throw new Error("No hay conexión a internet. Conectate o usá la vista mobile con la inspección descargada.");
       }
       return createDamage(input);
     }
     if (!effectiveOfflineSession) {
       console.log("[createDamage] loading session from IndexedDB");
       const loaded = await getDownloadedSession(sessionId);
       if (!loaded) throw new Error("No hay sesión offline descargada. Descargá la inspección primero.");
     }
     const now = new Date().toISOString();
     const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
     const damage = {
       ...input,
       id: tempId,
       created_at: now,
       updated_at: now,
     } as InspectionDamage;
     console.log("[createDamage] calling addPendingDamageCreated", damage.id);
     const updatedOffline = await addPendingDamageCreated(sessionId, damage);
     console.log("[createDamage] addPendingDamageCreated done");
     console.log("[createDamage] calling onOfflineSaved", !!updatedOffline);
     await onOfflineSaved?.(updatedOffline);
     console.log("[createDamage] onOfflineSaved done");
     return damage;
   };
   return Promise.race([work(), timeout]);
 },
 onSuccess: () => {
   if (!offlineAvailable) queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
   setForm(emptyForm(sessionId, newType));
   setEditing(null);
   toast.success("Daño registrado");
 },
 onError: (err: Error) => {
   console.error("[createDamage] error:", err);
   toast.error(err.message);
 },
 });

 const updateMutation = useMutation({
 mutationFn: async ({ id, data }: { id: string; data: Partial<InspectionDamage> }) => {
   console.log("[updateDamage] mutationFn start", { id, offlineAvailable, offlineMode });
   const isOffline = offlineAvailable || offlineMode;
   const timeout = new Promise<never>((_, reject) =>
     setTimeout(
       () => reject(new Error(isOffline ? "Timeout actualizando daño offline (>3s)" : "Timeout actualizando daño online (>10s)")),
       isOffline ? 3000 : 10000,
     ),
   );
   const work = async () => {
     console.log("[updateDamage] work start");
     if (!offlineAvailable) {
       console.log("[updateDamage] online mode");
       return updateDamage(id, data);
     }
     // Cargar sesión offline directamente de IndexedDB si no la tenemos
     let session = effectiveOfflineSession;
     if (!session) {
       console.log("[updateDamage] loading session from IndexedDB");
       session = await getDownloadedSession(sessionId);
       console.log("[updateDamage] session from IndexedDB", !!session);
     }
     if (!session) {
       throw new Error("No hay sesión offline descargada. Descargá la inspección primero.");
     }
     const existing = damages.find((damage) => damage.id === id);
     console.log("[updateDamage] existing damage", !!existing, existing?.id);
     if (!existing) throw new Error("Daño no encontrado");
     const merged = { ...existing, ...data, id, updated_at: new Date().toISOString() } as InspectionDamage;
     console.log("[updateDamage] calling addPendingDamageUpdated");
     const updatedOffline = await addPendingDamageUpdated(sessionId, merged);
     console.log("[updateDamage] addPendingDamageUpdated done");
     await onOfflineSaved?.(updatedOffline);
     console.log("[updateDamage] onOfflineSaved done");
     return merged;
   };
   return Promise.race([work(), timeout]);
 },
 onSuccess: () => {
   if (!offlineAvailable) queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
   setEditing(null);
   toast.success("Daño actualizado");
 },
 onError: (err: Error) => {
   console.error("[updateDamage] error:", err);
   toast.error(err.message);
 },
 });

 const deleteMutation = useMutation({
 mutationFn: async (id: string) => {
   const isOffline = offlineAvailable || offlineMode;
   const timeout = new Promise<never>((_, reject) =>
     setTimeout(
       () => reject(new Error(isOffline ? "Timeout eliminando daño offline (>3s)" : "Timeout eliminando daño online (>10s)")),
       isOffline ? 3000 : 10000,
     ),
   );
   const work = async () => {
     if (!offlineAvailable) return deleteDamage(id);
     if (!effectiveOfflineSession) {
       const loaded = await getDownloadedSession(sessionId);
       if (!loaded) throw new Error("No hay sesión offline descargada. Descargá la inspección primero.");
     }
     const updatedOffline = await addPendingDamageDeleted(sessionId, id);
     await onOfflineSaved?.(updatedOffline);
   };
   return Promise.race([work(), timeout]);
 },
 onSuccess: () => {
   if (!offlineAvailable) queryClient.invalidateQueries({ queryKey: ["damages", sessionId] });
   toast.success("Daño eliminado");
 },
 onError: (err: Error) => {
   console.error("[deleteDamage] error:", err);
   toast.error(err.message);
 },
 });

 const uploadDocMutation = useMutation({
 mutationFn: async ({
   file,
   documentType,
   damageId,
 }: {
   file: File;
   documentType: string;
   damageId: string;
 }) => {
   const data = new FormData();
   data.append("file", file);
   data.append("sessionId", sessionId);
   data.append("damageId", damageId);
   data.append("documentType", documentType);
   data.append("originalName", file.name);
   const res = await fetch("/api/inspection/evidences/upload", {
     method: "POST",
     body: data,
   });
   if (!res.ok) {
     const err = await res.json().catch(() => ({ error: "Error al subir comprobante" }));
     throw new Error(err.error || "Error al subir comprobante");
   }
   return res.json();
 },
 onSuccess: () => {
   toast.success("Comprobante subido");
   setContentDocFile(null);
   queryClient.invalidateQueries({ queryKey: ["evidences", sessionId] });
   queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const isEditingNew = editing === "new";
 const buildingDamages = damages?.filter((d) => d.damage_type !== "content") || [];
 const contentDamages = damages?.filter((d) => d.damage_type === "content") || [];

 // Totales agrupados por moneda
 const totalsByCurrency: Record<string, { building: number; content: number }> = {};
 for (const d of damages || []) {
 const cur = d.currency || "CLP";
 if (!totalsByCurrency[cur]) totalsByCurrency[cur] = { building: 0, content: 0 };
 if (d.damage_type === "content") {
 totalsByCurrency[cur].content += d.estimated_amount || 0;
 } else {
 totalsByCurrency[cur].building += d.estimated_amount || 0;
 }
 }
 const currencyTotals = Object.entries(totalsByCurrency).map(([cur, t]) => ({
 currency: cur,
 building: t.building,
 content: t.content,
 total: t.building + t.content,
 }));

 const spaceName = (id: string | null) => effectiveSpaces.find((s) => s.id === id)?.name || "—";
 const goodTypeName = (id: string | null) => effectiveGoodTypes.find((g) => g.id === id)?.name || "—";

 const handleSubmit = () => {
 if (!canSaveDamage) {
   if (isBuildingDamage) {
     toast.error("Falta: espacio, materialidad y categoría (o aclaratoria si es Otros)");
   } else {
     toast.error("Falta: aclaratoria o tipo de contenido");
   }
   return;
 }
 // Convertir "" y 0 a null para campos opcionales de la API
 const payload = {
 ...form,
 subcategory: form.subcategory || null,
 observations: form.observations || null,
 dependency: form.dependency || null,
 sector: form.sector || null,
 materiality_type: form.materiality_type || null,
 unit: form.unit || null,
 quantity: form.quantity || null,
 product: form.product || null,
 brand_model: form.brand_model || null,
 product_id: form.product_id || null,
 brand_id: form.brand_id || null,
 purchase_date: form.purchase_date || null,
 estimated_amount: form.estimated_amount || null,
 currency: form.currency || "CLP",
 third_party_id: form.third_party_id || null,
 space_id: form.space_id || null,
 content_good_type_id: form.content_good_type_id || null,
 building_damage_category_id: form.building_damage_category_id || null,
 };
 if (editing === "new") {
 console.log("[handleSubmit] creating new damage");
 if (offlineAvailable || offlineMode) {
   // Bypass React Query: guardar offline directamente
   (async () => {
     try {
       console.log("[handleSubmit] creating offline directly");
       let session = effectiveOfflineSession;
       if (!session) {
         console.log("[handleSubmit] loading session from IndexedDB");
         session = await getDownloadedSession(sessionId);
       }
       if (!session) {
         throw new Error("No hay sesión offline descargada. Descargá la inspección primero.");
       }
       const now = new Date().toISOString();
       const tempId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
       const damage = { ...payload, id: tempId, created_at: now, updated_at: now } as InspectionDamage;
       console.log("[handleSubmit] calling addPendingDamageCreated", damage.id);
       const updatedOffline = await addPendingDamageCreated(sessionId, damage);
       console.log("[handleSubmit] addPendingDamageCreated done");
       await onOfflineSaved?.(updatedOffline);
       console.log("[handleSubmit] onOfflineSaved done");
       setForm(emptyForm(sessionId, newType));
       setEditing(null);
       toast.success("Daño registrado");
     } catch (err) {
       console.error("[handleSubmit] offline create error", err);
       toast.error((err as Error).message);
     }
   })();
 } else {
   createMutation.mutate(payload);
 }
 } else if (editing) {
 console.log("[handleSubmit] updating damage", editing);
 if (offlineAvailable || offlineMode) {
   // Bypass React Query: guardar offline directamente
   (async () => {
     try {
       console.log("[handleSubmit] saving offline directly");
       let session = effectiveOfflineSession;
       if (!session) {
         console.log("[handleSubmit] loading session from IndexedDB");
         session = await getDownloadedSession(sessionId);
       }
       if (!session) {
         throw new Error("No hay sesión offline descargada. Descargá la inspección primero.");
       }
       const existing = damages.find((d) => d.id === editing);
       if (!existing) throw new Error("Daño no encontrado");
       const merged = { ...existing, ...payload, id: editing, updated_at: new Date().toISOString() } as InspectionDamage;
       console.log("[handleSubmit] calling addPendingDamageUpdated");
       const updatedOffline = await addPendingDamageUpdated(sessionId, merged);
       console.log("[handleSubmit] addPendingDamageUpdated done");
       await onOfflineSaved?.(updatedOffline);
       console.log("[handleSubmit] onOfflineSaved done");
       setEditing(null);
       toast.success("Daño actualizado");
     } catch (err) {
       console.error("[handleSubmit] offline save error", err);
       toast.error((err as Error).message);
     }
   })();
 } else {
   updateMutation.mutate({ id: editing, data: payload });
 }
 } else {
 console.log("[handleSubmit] no editing value, doing nothing");
 }
 };

 const startNew = (type: DamageType) => {
 setNewType(type);
 setForm(emptyForm(sessionId, type));
 setEditing("new");
 };

 return (
 <div className="app-stack">

 {/* Banner de solo lectura */}
 {readOnly && (
 <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 app-body text-amber-700 dark:text-amber-300">
 <Lock className="h-3.5 w-3.5 shrink-0" />
 Inspección finalizada — los daños son de solo lectura
 </div>
 )}

 {/* Header con totales por moneda */}
 <div className="flex items-center justify-between">
 <div className="app-body text-muted-foreground">
 {damages?.length || 0} registros ·{" "}
 {currencyTotals.length === 0 ? (
 <span className="font-semibold text-foreground">{formatMoney(0, "CLP")}</span>
 ) : currencyTotals.map((t, i) => (
 <span key={t.currency}>
 {i > 0 && " · "}
 <span className="font-semibold text-foreground">
 {formatMoney(t.total, t.currency)}
 </span>
 <span className="app-body ml-1">
 (Const: {formatMoney(t.building, t.currency)} · Cont: {formatMoney(t.content, t.currency)})
 </span>
 </span>
 ))}
 </div>
 </div>

 {/* Botones de nuevo daño — estilo tiles */}
 {!isEditingNew && !readOnly && !isMobile && (
 <div className="grid grid-cols-2 gap-3">
 <Tooltip>
 <TooltipTrigger className="inline-flex">
 <button
 onClick={() => startNew("building")}
 disabled={!propertyClassification}
 className={`group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-blue-400/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${!propertyClassification ? "opacity-50 cursor-not-allowed" : ""}`}
 >
 <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${propertyClassification ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white" : "bg-muted text-muted-foreground"}`}>
 <Building2 className="h-5 w-5" />
 </div>
 <div className="min-w-0">
 <div className="app-title text-foreground">Daño Constructivo</div>
 <div className="app-body text-muted-foreground truncate">{propertyClassification ? "Estructura, muros, pisos, techumbre, instalaciones" : "Requiere clasificación del inmueble"}</div>
 </div>
 </button>
 </TooltipTrigger>
 <TooltipContent side="top">
 <p>{propertyClassification ? "Nuevo daño constructivo" : "Selecciona la clasificación del inmueble en el acta"}</p>
 </TooltipContent>
 </Tooltip>
 <button
 onClick={() => startNew("content")}
 className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-violet-400/50 hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
 >
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400 transition-colors group-hover:bg-violet-500 group-hover:text-white">
 <Package className="h-5 w-5" />
 </div>
 <div className="min-w-0">
 <div className="app-title text-foreground">Daño de Contenido</div>
 <div className="app-body text-muted-foreground truncate">Electrodomésticos, electrónica, muebles, ropa, joyas</div>
 </div>
 </button>
 </div>
 )}

 {/* Tab bar (mobile) */}
 {isMobile && (
 <div className="flex gap-2">
   <button
     onClick={() => editing === null && setDamageTab("building")}
    disabled={editing !== null}
     className={`flex-1 rounded-lg px-3 py-2 app-body font-medium transition-colors ${damageTab === "building" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"} ${editing !== null ? "opacity-50 cursor-not-allowed" : ""}`}
   >
     Constructivos
   </button>
   <button
     onClick={() => editing === null && setDamageTab("content")}
    disabled={editing !== null}
     className={`flex-1 rounded-lg px-3 py-2 app-body font-medium transition-colors ${damageTab === "content" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"} ${editing !== null ? "opacity-50 cursor-not-allowed" : ""}`}
   >
     Contenidos
   </button>
 </div>
 )}

 
{/* Formulario */}
 {editing !== null && (
 <div className="app-panel space-y-3" key={`edit-${editing}-${form.damage_type}`}>
   <div className="flex items-center justify-between gap-2">
     <h3 className="app-section-title flex items-center gap-2">
       {form.damage_type === "building" ? <Building2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
       {editing === "new" ? "Nuevo" : "Editar"} {form.damage_type === "building" ? "Daño Constructivo" : "Daño de Contenido"}
     </h3>
     <div className="flex gap-2">
       <button
         type="button"
         onClick={() => setEditing(null)}
         className="acta-save-btn"
         aria-label="Cancelar"
       >
         <ArrowLeft size={18} strokeWidth={2} />
       </button>
       <button
         type="button"
         onClick={() => { if (canSaveDamage && !createMutation.isPending && !updateMutation.isPending) handleSubmit(); else if (!canSaveDamage) { if (isBuildingDamage) toast.error("Falta: espacio, materialidad y categoría (o aclaratoria si es Otros)"); else toast.error("Falta: aclaratoria o tipo de contenido"); } }}
         className="acta-save-btn"
         aria-label="Guardar"
       >
         {createMutation.isPending || updateMutation.isPending ? (
           <Loader2 size={18} strokeWidth={2} className="animate-spin" />
         ) : (
           <Save size={18} strokeWidth={2} />
         )}
       </button>
     </div>
   </div>
 <div className={isMobile ? "space-y-3" : ""}>

 {form.damage_type === "building" ? (
 /* ── FORMULARIO CONSTRUCTIVO ── */
 <div className="modal-grid-5" key="building-form">
 <div className="modal-field">
 <label className="app-field-label">Espacio / Recinto</label>
 <Select
 value={form.space_id || ""}
 items={filteredSpaces.map((s) => ({ value: s.id, label: s.name }))}
 onValueChange={(v) => {
 const space = effectiveSpaces.find((s) => s.id === v);
 setForm({ ...form, space_id: v || "", dependency: space?.name || "", sector: space?.name || "" });
 }}
 >
 <SelectTrigger className="app-input w-full" disabled={!propertyClassification}>
 <SelectValue>{propertyClassification ? (form.space_id ? spaceName(form.space_id) : "Seleccionar...") : "Selecciona clasificación del inmueble..."}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {filteredSpaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Categoría del Daño</label>
 <Select
 value={form.subcategory || ""}
 onValueChange={(v) => {
 const categoryRequiresDetail = DAMAGE_CATEGORIES.find((c) => c.label === v)?.requires_detail ?? false;
 setForm({ ...form, subcategory: v || "", materiality_type: "", description: categoryRequiresDetail ? form.description : "" });
 }}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {DAMAGE_CATEGORIES.map((c) => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Materialidad</label>
 <Select
   value={materialitySelectValue}
   onValueChange={(v) => {
     const item = currentMaterialityItems.find((i) => i.id === v);
     setForm({
       ...form,
       materiality_type: item?.name || "",
       description: (item as { requires_detail?: boolean })?.requires_detail ? form.description : "",
     });
   }}
 >
   <SelectTrigger className="app-input w-full" disabled={selectedCategoryRequiresDetail}>
     <SelectValue>{selectedMaterialityItem?.name || (selectedCategoryRequiresDetail ? "—" : "Seleccionar...")}</SelectValue>
   </SelectTrigger>
   <SelectContent>
     {currentMaterialityItems.map((item) => (
       <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
     ))}
   </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <label className="app-field-label">Aclaración</label>
 <input
   value={form.description || ""}
   onChange={(e) => setForm({ ...form, description: e.target.value })}
   placeholder={requiresDetail ? "Especificar..." : "No requiere"}
   disabled={!requiresDetail}
   className={`app-input w-full ${requiresDetail && !form.description?.trim() ? "app-input-required" : ""}`}
 />
 </div>
 <div className="modal-field">
 <label className="app-field-label">Daño</label>
 <Select
 value={form.severity || "low"}
 items={severityOptions}
 onValueChange={(v) => setForm({ ...form, severity: (v || "low") as InspectionDamage["severity"] })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue>{severityLabelMap[form.severity] || "Seleccionar..."}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {severityOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field-full col-span-full">
 <div className="damage-dimension-pair">
 <div className="damage-dimension-unit">
 <div className="damage-dimension-title">
 <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
 <span>UNIDAD GLOBAL</span>
 </div>
 <Select
 value={form.unit}
 items={unitOptions.map((u) => ({ value: u, label: u }))}
 onValueChange={(v) => handleUnitChange(v || "")}
 >
 <SelectTrigger className="app-input w-full" aria-label="Unidad">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="damage-dimension-block-surface">
 <div className="damage-dimension-title">
 <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 21V9"/></svg>
 <span>SUPERFICIE TOTAL</span>
 <small>(Elemento completo)</small>
 </div>
 {form.unit === "M2" && (
 <div className="damage-dimension-row cols-3">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.length ?? ""} onChange={(e) => handleDimensionChange("length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Ancho (m)</label>
 <input type="number" step="any" value={form.width ?? ""} onChange={(e) => handleDimensionChange("width", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.quantity} readOnly />
 <span className="damage-dimension-suffix">m²</span>
 </div>
 </div>
 )}
 {form.unit === "M3" && (
 <div className="damage-dimension-row cols-4">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.length ?? ""} onChange={(e) => handleDimensionChange("length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Ancho (m)</label>
 <input type="number" step="any" value={form.width ?? ""} onChange={(e) => handleDimensionChange("width", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Alto (m)</label>
 <input type="number" step="any" value={form.height ?? ""} onChange={(e) => handleDimensionChange("height", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.quantity} readOnly />
 <span className="damage-dimension-suffix">m³</span>
 </div>
 </div>
 )}
 {form.unit === "MT" && (
 <div className="damage-dimension-row cols-2">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.length ?? ""} onChange={(e) => handleDimensionChange("length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.quantity} readOnly />
 <span className="damage-dimension-suffix">m</span>
 </div>
 </div>
 )}
 {!["M2", "M3", "MT"].includes(form.unit) && form.unit && (
 <div className="damage-dimension-row cols-2">
 <div className="damage-dimension-field">
 <label>Valor</label>
 <input type="number" value={form.quantity} onChange={(e) => handleQuantityChange(e.target.value)} placeholder="0" />
 <span className="damage-dimension-suffix">{form.unit}</span>
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.quantity} readOnly />
 <span className="damage-dimension-suffix">{form.unit}</span>
 </div>
 </div>
 )}
 </div>
 <div className="damage-dimension-block-damage">
 <div className="damage-dimension-title">
 <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l-9.5 5.5 9.5 5.5 9.5-5.5z"/><path d="M2.5 17.5l9.5 5.5 9.5-5.5"/><path d="M2.5 10l9.5 5.5 9.5-5.5"/></svg>
 <span>DAÑO</span>
 <small>(Área afectada)</small>
 </div>
 {form.unit === "M2" && (
 <div className="damage-dimension-row cols-3">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.damage_length ?? ""} onChange={(e) => handleDimensionChange("damage_length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Ancho (m)</label>
 <input type="number" step="any" value={form.damage_width ?? ""} onChange={(e) => handleDimensionChange("damage_width", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.damage_quantity} readOnly />
 <span className="damage-dimension-suffix">m²</span>
 </div>
 </div>
 )}
 {form.unit === "M3" && (
 <div className="damage-dimension-row cols-4">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.damage_length ?? ""} onChange={(e) => handleDimensionChange("damage_length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Ancho (m)</label>
 <input type="number" step="any" value={form.damage_width ?? ""} onChange={(e) => handleDimensionChange("damage_width", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field">
 <label>Alto (m)</label>
 <input type="number" step="any" value={form.damage_height ?? ""} onChange={(e) => handleDimensionChange("damage_height", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.damage_quantity} readOnly />
 <span className="damage-dimension-suffix">m³</span>
 </div>
 </div>
 )}
 {form.unit === "MT" && (
 <div className="damage-dimension-row cols-2">
 <div className="damage-dimension-field">
 <label>Largo (m)</label>
 <input type="number" step="any" value={form.damage_length ?? ""} onChange={(e) => handleDimensionChange("damage_length", e.target.value)} placeholder="0" />
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.damage_quantity} readOnly />
 <span className="damage-dimension-suffix">m</span>
 </div>
 </div>
 )}
 {!["M2", "M3", "MT"].includes(form.unit) && form.unit && (
 <div className="damage-dimension-row cols-2">
 <div className="damage-dimension-field">
 <label>Valor</label>
 <input type="number" value={form.damage_quantity} onChange={(e) => handleDamageQuantityChange(e.target.value)} placeholder="0" />
 <span className="damage-dimension-suffix">{form.unit}</span>
 </div>
 <div className="damage-dimension-field damage-dimension-total">
 <label>Cantidad</label>
 <input type="number" value={form.damage_quantity} readOnly />
 <span className="damage-dimension-suffix">{form.unit}</span>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 <div className="modal-field col-span-1 col-start-1">
 <label className="app-field-label">Moneda</label>
 <Select
 value={form.currency}
 items={currencyOptions}
 onValueChange={(v) => setForm({ ...form, currency: v || "CLP" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {currencyOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field col-span-4">
 <label className="app-field-label">Monto Estimado</label>
 <div className="amount-field-row flex items-center gap-1.5">
 <input
 type="text"
 inputMode="decimal"
 value={amountFocused ? amountRaw : formatAmount(form.estimated_amount)}
 onFocus={() => {
 setAmountFocused(true);
 setAmountRaw(String(form.estimated_amount || ""));
 }}
 onBlur={() => setAmountFocused(false)}
 onChange={(e) => {
 const raw = e.target.value;
 const parsed = parseAmount(raw);
 setAmountRaw(parsed >= MAX_ESTIMATED_AMOUNT ? String(MAX_ESTIMATED_AMOUNT) : raw);
 setForm({ ...form, estimated_amount: parsed });
 }}
 placeholder="0"
 className="app-input app-amount-input font-mono"
 />
 <p className="app-amount-words flex-1 min-w-0 self-center">{amountInWords(form.estimated_amount, form.currency)}</p>
 </div>
 </div>
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Observaciones</label>
 <input
 value={form.observations}
 onChange={(e) => setForm({ ...form, observations: e.target.value })}
 placeholder="Ej. El asegurado indicó que el cerámico fue colocado con productos traídos del extranjero..."
 className="app-input w-full"
 />
 </div>
 {affectedThirdParties.length > 0 && (
 <div className="modal-field">
 <label className="app-field-label">Tercero Afectado (opcional)</label>
 <Select
 value={form.third_party_id || ""}
 items={affectedThirdParties.map((t) => ({ value: t.id, label: t.full_name || "Sin nombre" }))}
 onValueChange={(v) => setForm({ ...form, third_party_id: v || "" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue>{affectedThirdParties.find((t) => t.id === form.third_party_id)?.full_name || "Si es daño de un tercero..."}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {affectedThirdParties.map((t) => (
 <SelectItem key={t.id} value={t.id}>{t.full_name || "Sin nombre"}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>
 ) : (
 /* ── FORMULARIO CONTENIDO ── */
 <div className='modal-grid-4' key='content-form'>
 <div className="modal-field">
 <div className='flex items-center gap-1'>
 <label className='app-field-label'>Buscar producto</label>
 <Popover>
 <PopoverTrigger
 render={
 <button type='button' className='p-0 h-auto bg-transparent border-0 cursor-pointer'>
 <Info className='h-3.5 w-3.5 text-muted-foreground' />
 </button>
 }
 />
 <PopoverContent className='p-2 w-64'>
 <div className='space-y-1 text-[11px]'>
 <p><span className='font-semibold'>Tipo de Bien:</span> {selectedGoodType?.name || 'No seleccionado'}</p>
 <p><span className='font-semibold'>Producto:</span> {form.product || 'No se ha seleccionado producto'}</p>
 </div>
 </PopoverContent>
 </Popover>
 </div>
 <ProductSearch
 products={effectiveAllProducts as ProductSearchItem[]}
 selectedProductId={form.product_id || undefined}
 selectedLabel={form.product || undefined}
 onSelect={(p) => {
 const gt = effectiveGoodTypes.find((g) => g.id === p.content_good_type_id);
 setForm({
 ...form,
 content_good_type_id: p.content_good_type_id,
 product_id: p.id,
 product: p.name,
 category: gt?.name || form.category,
 description: gt?.requires_detail ? form.description : "",
 // Reset marca al cambiar producto
 brand_id: "",
 brand_model: "",
 });
 }}
 onClear={() => {
 setForm({
 ...form,
 content_good_type_id: "",
 product_id: "",
 product: "",
 brand_id: "",
 brand_model: "",
 });
 }}
 autoFocus
 />
 </div>
 <div className='modal-field row-span-2 flex flex-col'>
 <label className='app-field-label'>Aclaratoria</label>
 <textarea
 value={form.description || ''}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder={requiresDetail || form.product === 'Otros' ? 'Especificar producto / detalle...' : 'No requiere aclaratoria'}
 disabled={!requiresDetail && form.product !== 'Otros'}
 className={'app-input w-full flex-1 min-h-28 resize-none ' + (requiresDetail && !form.description?.trim() ? 'app-input-required' : '')}
 />
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Marca</label>
 <Select
 value={form.brand_id || "__none"}
 onValueChange={(v) => {
 const brand = effectiveBrandsByType.find((b) => b.id === v);
 setForm({
 ...form,
 brand_id: v === "__none" ? "" : (v ?? ""),
 brand_model: brand?.name || "",
 });
 }}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue>{form.brand_id ? (effectiveBrandsByType.find((b) => b.id === form.brand_id)?.name || "Seleccionar...") : (form.content_good_type_id ? "Seleccionar..." : "Seleccione tipo de bien...")}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Sin selección</SelectItem>
 {effectiveBrandsByType.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Espacio (opcional)</label>
 <Select
 value={form.space_id || ''}
 items={filteredSpaces.map((s) => ({ value: s.id, label: s.name }))}
 onValueChange={(v) => setForm({ ...form, space_id: v || '' })}
 >
 <SelectTrigger className='app-input w-full' disabled={!propertyClassification}>
 <SelectValue>{propertyClassification ? (form.space_id ? spaceName(form.space_id) : 'Si se puede ubicar...') : 'Selecciona clasificación del inmueble...'}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {filteredSpaces.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Daño</label>
 <Select
 value={form.severity || 'low'}
 items={severityOptions}
 onValueChange={(v) => setForm({ ...form, severity: (v || 'low') as InspectionDamage['severity'] })}
 >
 <SelectTrigger className='app-input w-full'>
 <SelectValue>{severityLabelMap[form.severity] || 'Seleccionar...'}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {severityOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Cantidad</label>
 <input
 type='number'
 value={form.quantity}
 onChange={(e) => setForm({ ...form, quantity: parseQuantity(e.target.value) })}
 placeholder='1'
 className='app-input w-full'
 />
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Fecha de compra</label>
 <DatePicker
 value={form.purchase_date}
 onChange={(value) => setForm({ ...form, purchase_date: value || '' })}
 className='w-[130px]'
 />
 </div>
 <div className='modal-field'>
 <label className='app-field-label'>Moneda</label>
 <Select
 value={form.currency}
 items={currencyOptions}
 onValueChange={(v) => setForm({ ...form, currency: v || 'CLP' })}
 >
 <SelectTrigger className='app-input app-currency-select'>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {currencyOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className='modal-field col-span-3'>
 <label className='app-field-label'>Monto estimado</label>
 <div className='amount-field-row flex items-center gap-1.5'>
 <input
 type='text'
 inputMode='decimal'
 value={amountFocused ? amountRaw : formatAmount(form.estimated_amount)}
 onFocus={() => {
 setAmountFocused(true);
 setAmountRaw(String(form.estimated_amount || ''));
 }}
 onBlur={() => setAmountFocused(false)}
 onChange={(e) => {
 const raw = e.target.value;
 const parsed = parseAmount(raw);
 setAmountRaw(parsed >= MAX_ESTIMATED_AMOUNT ? String(MAX_ESTIMATED_AMOUNT) : raw);
 setForm({ ...form, estimated_amount: parsed });
 }}
 placeholder='0'
 className='app-input app-amount-input font-mono'
 />
 <p className='app-amount-words flex-1 min-w-0 self-center'>{amountInWords(form.estimated_amount, form.currency)}</p>
 </div>
 </div>
 <div className='modal-field modal-field-full col-span-4'>
 <label className='app-field-label'>Observaciones</label>
 <input
 value={form.observations}
 onChange={(e) => setForm({ ...form, observations: e.target.value })}
 placeholder='Observaciones adicionales...'
 className='app-input w-full'
 />
 </div>
 {affectedThirdParties.length > 0 && (
 <div className="modal-field">
 <label className="app-field-label">Tercero Afectado (opcional)</label>
 <Select
 value={form.third_party_id || ""}
 items={affectedThirdParties.map((t) => ({ value: t.id, label: t.full_name || "Sin nombre" }))}
 onValueChange={(v) => setForm({ ...form, third_party_id: v || "" })}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue>{affectedThirdParties.find((t) => t.id === form.third_party_id)?.full_name || "Si es daño de un tercero..."}</SelectValue>
 </SelectTrigger>
 <SelectContent>
 {affectedThirdParties.map((t) => (
 <SelectItem key={t.id} value={t.id}>{t.full_name || "Sin nombre"}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 {editing !== "new" && (
 <div className="modal-field modal-field-full">
 <label className="app-field-label">Comprobantes</label>
 <div className="app-panel p-3 space-y-3">
 {evidenceDocs.length > 0 && (
 <ul className="space-y-2">
 {evidenceDocs.map((doc) => (
 <li key={doc.id}>
 <a href={doc.url} target="_blank" rel="noopener noreferrer" className="app-body text-blue-600 hover:underline">
 {doc.description || "Documento"}
 </a>
 </li>
 ))}
 </ul>
 )}
 <div className="flex flex-col sm:flex-row flex-wrap items-end gap-2">
 <div className="w-full sm:w-40">
 <label className="app-field-label">Tipo</label>
 <Select value={contentDocType} onValueChange={(v) => setContentDocType(v || "Boleta")}>
 <SelectTrigger className="app-input w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {["Boleta", "Factura", "Certificado", "Otro"].map((t) => (
 <SelectItem key={t} value={t}>{t}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex-1 min-w-40">
 <input
 type="file"
 accept=".pdf,.jpg,.jpeg,.png"
 onChange={(e) => setContentDocFile(e.target.files?.[0] || null)}
 className="app-input w-full"
 />
 </div>
 <Button
 onClick={() => {
 if (!contentDocFile || !editing) return;
 uploadDocMutation.mutate({ file: contentDocFile, documentType: contentDocType, damageId: editing });
 }}
 disabled={!contentDocFile || uploadDocMutation.isPending}
 className="pg-btn-platinum"
 >
 {uploadDocMutation.isPending ? "Subiendo..." : "Subir"}
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 )}

  {/* Botones ya están arriba del formulario */}
 </div>
 </div>
)}

{/* ── SECCIÓN: DAÑOS CONSTRUCTIVOS ── */}
 {(!isMobile || damageTab === "building" && editing === null) && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
 <Building2 className="h-3.5 w-3.5" />
 </span>
 Daños Constructivos
 <span className="app-body text-muted-foreground font-normal">
 ({buildingDamages.length})
 </span>
 {!readOnly && (
   <button
     onClick={() => startNew("building")}
     disabled={!propertyClassification}
     className={`ml-auto btn-icon-sm ${!propertyClassification ? "opacity-50 cursor-not-allowed" : ""}`}
     aria-label="Nuevo daño constructivo"
   >
     <Plus className="h-3.5 w-3.5" />
   </button>
 )}
 </h3>
 {isLoading ? (
 <div className="text-center py-6 text-muted-foreground app-body">Cargando...</div>
 ) : buildingDamages.length === 0 ? (
 <div className="text-center py-6 text-muted-foreground app-body">
 No hay daños constructivos registrados.
 </div>
 ) : (
 <div className="app-data-table-wrap overflow-auto">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>Sector</th>
 <th>Categoría</th>
 <th>Materialidad</th>
 <th className="text-right">Superficie / Daño</th>
 <th className="text-right">Monto</th>
 <th className="w-20">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {buildingDamages.map((d) => [
 <tr key={d.id} className={d.observations ? "with-observation" : ""}>
 <td className="app-body">{d.sector || d.dependency || "—"}</td>
 <td className="app-body">{d.subcategory || "—"}</td>
 <td className="app-body max-w-50 truncate">{d.description || d.materiality_type || "—"}</td>
 <td className="text-right app-body">{formatQuantity(d)}</td>
 <td className="text-right font-medium app-body">{formatMoney(d.estimated_amount || 0, d.currency || "CLP")}</td>
 <td>
 <div className="app-row-actions">
 {!readOnly && (
 <>
 <button type="button" className="btn-icon-sm" onClick={() => { setEditing(d.id); setForm(damageToForm(d)); }}>
 <Pencil className="h-3.5 w-3.5" />
 </button>
 <button type="button" className="btn-icon-sm text-rose-500 hover:text-rose-600" onClick={async () => { const ok = await confirmDelete({ title: "Eliminar daño", description: "¿Eliminar este daño? Esta acción no se puede deshacer.", destructive: true, confirmLabel: "Eliminar" }); if (ok) { if (offlineAvailable || offlineMode) { (async () => { try { let session = effectiveOfflineSession; if (!session) session = await getDownloadedSession(sessionId); if (!session) throw new Error('No hay sesión offline descargada.'); const updatedOffline = await addPendingDamageDeleted(sessionId, d.id); await onOfflineSaved?.(updatedOffline); toast.success('Daño eliminado'); } catch (err) { console.error('[deleteDamage] offline error', err); toast.error((err as Error).message); } })(); } else { deleteMutation.mutate(d.id); } } }}>
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </>
 )}
 </div>
 </td>
 </tr>,
 d.observations ? (
   <tr key={`${d.id}-obs`} className="observation-row">
     <td colSpan={6} className="grid-observation">
       {d.observations}
     </td>
   </tr>
 ) : null,
 ])}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 {/* ── SECCIÓN: DAÑOS DE CONTENIDO ── */}
 {(!isMobile || damageTab === "content" && editing === null) && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
 <Package className="h-3.5 w-3.5" />
 </span>
 Daños de Contenido
 <span className="app-body text-muted-foreground font-normal">
 ({contentDamages.length})
 </span>
 {!readOnly && (
   <button
     onClick={() => startNew("content")}
     className="ml-auto btn-icon-sm"
     aria-label="Nuevo daño de contenido"
   >
     <Plus className="h-3.5 w-3.5" />
   </button>
 )}
 </h3>
 {isLoading ? (
 <div className="text-center py-6 text-muted-foreground app-body">Cargando...</div>
 ) : contentDamages.length === 0 ? (
 <div className="text-center py-6 text-muted-foreground app-body">
 No hay daños de contenido registrados.
 </div>
 ) : (
 <div className="app-data-table-wrap overflow-auto">
 <table className="app-data-table">
 <thead>
 <tr>
 <th>Tipo de Bien</th>
 <th>Producto</th>
 <th>Marca/Modelo</th>
 <th>Daño</th>
 <th className="text-right">Cantidad</th>
 <th className="text-right">Monto</th>
 <th>Compra</th>
 <th className="w-20">Acciones</th>
 </tr>
 </thead>
 <tbody>
 {contentDamages.map((d) => [
 <tr key={d.id} className={d.observations ? "with-observation" : ""}>
 <td className="app-body">{goodTypeName(d.content_good_type_id)}</td>
 <td className="app-body max-w-[150px] truncate">
   {d.description || d.product || "—"}
 </td>
 <td className="app-body">{d.brand_model || "—"}</td>
 <td>
 <span className={`app-body font-medium px-2 py-0.5 rounded-full ${
 d.severity === "total" ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" :
 d.severity === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" :
 d.severity === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
 "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
 }`}>
 {severityLabelMap[d.severity] || d.severity}
 </span>
 </td>
 <td className="text-right app-body">{d.quantity ? `${d.quantity}${d.unit ? ` ${d.unit}` : ""}` : "—"}</td>
 <td className="text-right font-medium app-body">{formatMoney(d.estimated_amount || 0, d.currency || "CLP")}</td>
 <td className="app-body">{d.purchase_date ? new Date(d.purchase_date).toLocaleDateString('es-CL') : '—'}</td>
 <td>
 <div className="app-row-actions">
 {!readOnly && (
 <>
 <button type="button" className="btn-icon-sm" onClick={() => { setEditing(d.id); setForm(damageToForm(d)); }}>
 <Pencil className="h-3.5 w-3.5" />
 </button>
 <button type="button" className="btn-icon-sm text-rose-500 hover:text-rose-600" onClick={async () => { const ok = await confirmDelete({ title: "Eliminar daño", description: "¿Eliminar este daño? Esta acción no se puede deshacer.", destructive: true, confirmLabel: "Eliminar" }); if (ok) { if (offlineAvailable || offlineMode) { (async () => { try { let session = effectiveOfflineSession; if (!session) session = await getDownloadedSession(sessionId); if (!session) throw new Error('No hay sesión offline descargada.'); const updatedOffline = await addPendingDamageDeleted(sessionId, d.id); await onOfflineSaved?.(updatedOffline); toast.success('Daño eliminado'); } catch (err) { console.error('[deleteDamage] offline error', err); toast.error((err as Error).message); } })(); } else { deleteMutation.mutate(d.id); } } }}>
 <Trash2 className="h-3.5 w-3.5" />
 </button>
 </>
 )}
 </div>
 </td>
 </tr>,
 d.observations ? (
   <tr key={`${d.id}-obs`} className="observation-row">
     <td colSpan={8} className="grid-observation">
       {d.observations}
     </td>
   </tr>
 ) : null,
])}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}
 </div>
 );
}

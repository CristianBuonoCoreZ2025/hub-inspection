import { fetchAll, fetchById, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";
import type {
  ClaimCause,
  InsuranceCompanyCatalog,
  BrokerCatalog,
  BusinessLine,
  InsuranceProduct,
  Advisor,
  Event,
  Region,
  City,
  Commune,
  PropertyClassification,
  DamageClassification,
  PolicyType,
  ClaimType,
  HousingDestination,
  BuildingAge,
  Relationship,
  LookupCatalog,
  Country,
  DocumentType,
  DamageSpace,
  ContentGoodType,
  BuildingDamageCategory,
  Currency,
  CountryCurrency,
  ExchangeRate,
} from "@/types";

// Ordenamiento natural: extrae partes numéricas y las compara como números,
// y las partes de texto como strings. Ej: "1 Año" < "2 Años" < "10 años" < "20 años"
function naturalCompare(a: string, b: string): number {
  const ax: (string | number)[] = [];
  const bx: (string | number)[] = [];
  a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push($1 ? parseInt($1, 10) : $2); return ""; });
  b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push($1 ? parseInt($1, 10) : $2); return ""; });
  while (ax.length && bx.length) {
    const an = ax.shift()!;
    const bn = bx.shift()!;
    const nn = (typeof an === "number" && typeof bn === "number") ? (an as number) - (bn as number) : String(an).localeCompare(String(bn));
    if (nn) return nn;
  }
  return ax.length - bx.length;
}

// fetchAll + ordenamiento natural por nombre (reemplaza order: name de la BD)
async function fetchAllSorted<T extends { name?: string }>(table: string, options: Parameters<typeof fetchAll>[1]): Promise<T[]> {
  const items = await fetchAll<T>(table, options);
  return items.sort((a, b) => naturalCompare(a.name || "", b.name || ""));
}

// ═══════════════════════════════════════════════════════════════
// CLAIM CAUSES
// ═══════════════════════════════════════════════════════════════

export async function getClaimCauses() {
  return fetchAllSorted<ClaimCause>("claim_causes", {
    select: "id, name, description, country_id, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createClaimCause(input: { name: string; description?: string; country_id?: string }) {
  const { country_id, ...rest } = input;
  const object: Record<string, unknown> = { ...rest, is_active: true };
  if (country_id && country_id !== "") object.country_id = country_id;
  return insertRow<ClaimCause>("claim_causes", object, "id, name, description, country_id, is_active");
}

export async function updateClaimCause(id: string, input: Partial<ClaimCause>) {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.country_id && input.country_id !== "") set.country_id = input.country_id;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  return updateRow<ClaimCause>("claim_causes", id, set, "id, name, description, country_id, is_active");
}

export async function deleteClaimCause(id: string) {
  return updateClaimCause(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// INSURANCE COMPANIES
// ═══════════════════════════════════════════════════════════════

export async function getInsuranceCompanies() {
  return fetchAllSorted<InsuranceCompanyCatalog>("insurance_companies", {
    select: "id, name, rut, address, line_of_business, code, type, country_id, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createInsuranceCompany(input: { name: string; rut?: string; address?: string; line_of_business?: string; code?: string; type?: string; country_id?: string }) {
  return insertRow<InsuranceCompanyCatalog>("insurance_companies", {
    ...input,
    is_active: true,
  }, "id, name, rut, address, line_of_business, code, type, country_id, is_active");
}

export async function updateInsuranceCompany(id: string, input: Partial<InsuranceCompanyCatalog>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "country_id" && value === "") continue;
      set[key] = value;
    }
  }
  return updateRow<InsuranceCompanyCatalog>("insurance_companies", id, set, "id, name, rut, address, line_of_business, code, type, country_id, is_active");
}

export async function deleteInsuranceCompany(id: string) {
  return updateInsuranceCompany(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BROKERS
// ═══════════════════════════════════════════════════════════════

export async function getBrokers() {
  return fetchAllSorted<BrokerCatalog>("brokers", {
    select: "id, name, rut, address, contact, country_id, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createBroker(input: { name: string; rut?: string; address?: string; contact?: string; country_id?: string }) {
  return insertRow<BrokerCatalog>("brokers", {
    ...input,
    is_active: true,
  }, "id, name, rut, address, contact, country_id, is_active");
}

export async function updateBroker(id: string, input: Partial<BrokerCatalog>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "country_id" && value === "") continue;
      set[key] = value;
    }
  }
  return updateRow<BrokerCatalog>("brokers", id, set, "id, name, rut, address, contact, country_id, is_active");
}

export async function deleteBroker(id: string) {
  return updateBroker(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS LINES
// ═══════════════════════════════════════════════════════════════

export async function getBusinessLines() {
  try {
    return await fetchAllSorted<BusinessLine>("business_lines", {
      select: "id, country_id, name, code_prefix, claim_type, claim_type_id, ramo_fecu, description, is_active, created_at, updated_at",
      eq: { is_active: true },
    });
  } catch (err) {
    console.error("[getBusinessLines] Error:", err);
    throw err;
  }
}

export async function createBusinessLine(input: { country_id?: string; name: string; code_prefix?: string; claim_type?: string; claim_type_id?: string; ramo_fecu?: string; description?: string }) {
  return insertRow<BusinessLine>("business_lines", {
    ...input,
    is_active: true,
  }, "id, country_id, name, code_prefix, claim_type, claim_type_id, ramo_fecu, description, is_active");
}

export async function updateBusinessLine(id: string, input: Partial<BusinessLine>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "country_id" && value === "") continue;
      set[key] = value;
    }
  }
  return updateRow<BusinessLine>("business_lines", id, set, "id, country_id, name, code_prefix, claim_type, claim_type_id, ramo_fecu, description, is_active");
}

export async function deleteBusinessLine(id: string) {
  return updateBusinessLine(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// INSURANCE PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function getInsuranceProducts() {
  try {
    return await fetchAllSorted<InsuranceProduct>("insurance_products", {
      select: "id, business_line_id, name, description, country_id, is_active, created_at, updated_at",
      eq: { is_active: true },
    });
  } catch (err) {
    console.error("[getInsuranceProducts] Error:", err);
    throw err;
  }
}

export async function createInsuranceProduct(input: { business_line_id: string; name: string; description?: string; country_id?: string }) {
  return insertRow<InsuranceProduct>("insurance_products", {
    ...input,
    is_active: true,
  }, "id, business_line_id, name, description, country_id, is_active");
}

export async function updateInsuranceProduct(id: string, input: Partial<InsuranceProduct>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "country_id" && value === "") continue;
      set[key] = value;
    }
  }
  return updateRow<InsuranceProduct>("insurance_products", id, set, "id, name, description, country_id, is_active");
}

export async function deleteInsuranceProduct(id: string) {
  return updateInsuranceProduct(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// ADVISORS (ASESORES)
// ═══════════════════════════════════════════════════════════════

export async function getAdvisors() {
  return fetchAllSorted<Advisor>("advisors", {
    select: "id, name, email, phone, country_id, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createAdvisor(input: { name: string; email?: string; phone?: string; country_id?: string }) {
  return insertRow<Advisor>("advisors", {
    ...input,
    is_active: true,
  }, "id, name, email, phone, country_id, is_active");
}

export async function updateAdvisor(id: string, input: Partial<Advisor>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      if (key === "country_id" && value === "") continue;
      set[key] = value;
    }
  }
  return updateRow<Advisor>("advisors", id, set, "id, name, email, phone, country_id, is_active");
}

export async function deleteAdvisor(id: string) {
  return updateAdvisor(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// REGIONS (REGIONES)
// ═══════════════════════════════════════════════════════════════

export async function getRegions(countryId?: string) {
  const options: Parameters<typeof fetchAll>[1] = {
    select: "id, country_id, code, name, is_active, created_at, updated_at",
    eq: { is_active: true },
  };
  if (countryId) {
    options.eq = { ...options.eq, country_id: countryId };
  }
  return fetchAllSorted<Region>("regions", options);
}

export async function createRegion(input: { country_id: string; code?: string; name: string }) {
  return insertRow<Region>("regions", {
    ...input,
    is_active: true,
  }, "id, country_id, code, name, is_active");
}

export async function updateRegion(id: string, input: Partial<Region>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<Region>("regions", id, set, "id, country_id, code, name, is_active");
}

export async function deleteRegion(id: string) {
  return updateRegion(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// CITIES (CIUDADES)
// ═══════════════════════════════════════════════════════════════

export async function getCities(regionId?: string) {
  const options: Parameters<typeof fetchAll>[1] = {
    select: "id, region_id, name, is_active, created_at, updated_at",
    eq: { is_active: true },
  };
  if (regionId) {
    options.eq = { ...options.eq, region_id: regionId };
  }
  return fetchAllSorted<City>("cities", options);
}

export async function createCity(input: { region_id: string; name: string }) {
  return insertRow<City>("cities", {
    ...input,
    is_active: true,
  }, "id, region_id, name, is_active");
}

export async function updateCity(id: string, input: Partial<City>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<City>("cities", id, set, "id, region_id, name, is_active");
}

export async function deleteCity(id: string) {
  return updateCity(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// COMMUNES (COMUNAS)
// ═══════════════════════════════════════════════════════════════

export async function getCommunes(cityId?: string) {
  const options: Parameters<typeof fetchAll>[1] = {
    select: "id, city_id, name, is_active, created_at, updated_at",
    eq: { is_active: true },
  };
  if (cityId) {
    options.eq = { ...options.eq, city_id: cityId };
  }
  return fetchAllSorted<Commune>("communes", options);
}

export async function createCommune(input: { city_id: string; name: string }) {
  return insertRow<Commune>("communes", {
    ...input,
    is_active: true,
  }, "id, city_id, name, is_active");
}

export async function updateCommune(id: string, input: Partial<Commune>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<Commune>("communes", id, set, "id, city_id, name, is_active");
}

export async function deleteCommune(id: string) {
  return updateCommune(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function getPropertyClassifications() {
  return fetchAllSorted<PropertyClassification>("property_classifications", {
    select: "id, name, description, is_active, field_config, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createPropertyClassification(input: { name: string; description?: string }) {
  return insertRow<PropertyClassification>("property_classifications", {
    ...input,
    is_active: true,
  }, "id, name, description, is_active, field_config");
}

export async function updatePropertyClassification(id: string, input: Partial<PropertyClassification>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<PropertyClassification>("property_classifications", id, set, "id, name, description, is_active, field_config");
}

export async function deletePropertyClassification(id: string) {
  return updatePropertyClassification(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function getDamageClassifications() {
  return fetchAllSorted<DamageClassification>("damage_classifications", {
    select: "id, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createDamageClassification(input: { name: string; description?: string }) {
  return insertRow<DamageClassification>("damage_classifications", {
    ...input,
    is_active: true,
  }, "id, name, description, is_active");
}

export async function updateDamageClassification(id: string, input: Partial<DamageClassification>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<DamageClassification>("damage_classifications", id, set, "id, name, description, is_active");
}

export async function deleteDamageClassification(id: string) {
  return updateDamageClassification(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// POLICY TYPES
// ═══════════════════════════════════════════════════════════════

export async function getPolicyTypes() {
  return fetchAllSorted<PolicyType>("policy_types", {
    select: "id, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createPolicyType(input: { name: string; description?: string }) {
  return insertRow<PolicyType>("policy_types", {
    ...input,
    is_active: true,
  }, "id, name, description, is_active");
}

export async function updatePolicyType(id: string, input: Partial<PolicyType>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<PolicyType>("policy_types", id, set, "id, name, description, is_active");
}

export async function deletePolicyType(id: string) {
  return updatePolicyType(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// CLAIM TYPES
// ═══════════════════════════════════════════════════════════════

export async function getClaimTypes() {
  return fetchAllSorted<ClaimType>("claim_types", {
    select: "id, name, description, icon, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createClaimType(input: { name: string; description?: string; icon?: string }) {
  return insertRow<ClaimType>("claim_types", {
    ...input,
    is_active: true,
  }, "id, name, description, icon, is_active");
}

export async function updateClaimType(id: string, input: Partial<ClaimType>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<ClaimType>("claim_types", id, set, "id, name, description, icon, is_active");
}

export async function deleteClaimType(id: string) {
  return updateClaimType(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// HOUSING DESTINATIONS
// ═══════════════════════════════════════════════════════════════

export async function getHousingDestinations() {
  return fetchAllSorted<HousingDestination>("housing_destinations", {
    select: "id, name, description, is_active, field_config, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createHousingDestination(input: { name: string; description?: string }) {
  return insertRow<HousingDestination>("housing_destinations", {
    ...input,
    is_active: true,
  }, "id, name, description, is_active, field_config");
}

export async function updateHousingDestination(id: string, input: Partial<HousingDestination>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<HousingDestination>("housing_destinations", id, set, "id, name, description, is_active, field_config");
}

export async function deleteHousingDestination(id: string) {
  return updateHousingDestination(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BUILDING AGES
// ═══════════════════════════════════════════════════════════════

export async function getBuildingAges() {
  return fetchAllSorted<BuildingAge>("building_ages", {
    select: "id, name, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createBuildingAge(input: { name: string }) {
  return insertRow<BuildingAge>("building_ages", {
    ...input,
    is_active: true,
  }, "id, name, is_active");
}

export async function updateBuildingAge(id: string, input: Partial<BuildingAge>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<BuildingAge>("building_ages", id, set, "id, name, is_active");
}

export async function deleteBuildingAge(id: string) {
  return updateBuildingAge(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════

export async function getRelationships() {
  return fetchAllSorted<Relationship>("relationships", {
    select: "id, name, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createRelationship(input: { name: string }) {
  return insertRow<Relationship>("relationships", {
    ...input,
    is_active: true,
  }, "id, name, is_active");
}

export async function updateRelationship(id: string, input: Partial<Relationship>) {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  return updateRow<Relationship>("relationships", id, set, "id, name, is_active");
}

export async function deleteRelationship(id: string) {
  return updateRelationship(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// LOOKUP CATALOG (generic by category)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COUNTRIES
// ═══════════════════════════════════════════════════════════════

export async function getCountries() {
  return fetchAllSorted<Country>("countries", {
    select: "id, code, name, phone_prefix, is_active, created_at",
    eq: { is_active: true },
  });
}

export async function getLookupCatalog(category: string) {
  return fetchAllSorted<LookupCatalog>("lookup_catalog", {
    select: "id, country_id, category, code, name, description, sort_order, is_active",
    eq: { category, is_active: true },
    order: { column: "sort_order", ascending: true },
  }).then((rows) => rows.sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  }));
}

/**
 * Obtiene las monedas asociadas a un país específico desde lookup_catalog.
 * Si el país no tiene monedas configuradas, devuelve todas las monedas
 * activas como fallback (para no bloquear al usuario).
 */
export async function getCountryCurrencies(countryId: string | null | undefined) {
  if (!countryId) {
    // Sin país → traer todas las monedas activas
    return getLookupCatalog("currency");
  }
  const rows = await fetchAllSorted<LookupCatalog>("lookup_catalog", {
    select: "id, country_id, category, code, name, description, sort_order, is_active",
    eq: { category: "currency", is_active: true, country_id: countryId },
    order: { column: "sort_order", ascending: true },
  });
  if (rows.length === 0) {
    // Fallback: si el país no tiene monedas, traer todas
    return getLookupCatalog("currency");
  }
  return rows.sort((a, b) => {
    if (a.sort_order === b.sort_order) return a.name.localeCompare(b.name);
    return a.sort_order - b.sort_order;
  });
}

export async function createLookupCatalogItem(input: { category: string; name: string; code?: string; sort_order?: number }) {
  return insertRow<LookupCatalog>("lookup_catalog", {
    ...input,
    is_active: true,
    sort_order: input.sort_order ?? 0,
  }, "id, category, code, name, sort_order, is_active");
}

export async function updateLookupCatalogItem(id: string, input: Partial<{ name: string; code: string; sort_order: number; is_active: boolean }>) {
  return updateRow<LookupCatalog>("lookup_catalog", id, input, "id, name, code, sort_order, is_active");
}

export async function deleteLookupCatalogItem(id: string) {
  return updateLookupCatalogItem(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════

export async function getEvents() {
  return fetchAllSorted<Event>("events", {
    select: "id, country_id, code, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

// ═══════════════════════════════════════════════════════════════
// GEO LOOKUP BY IDs (para resolver nombres en detalle de claim)
// ═══════════════════════════════════════════════════════════════

export async function getCountryById(id: string) {
  return fetchById<{ id: string; code: string; name: string }>("countries", id, "id, code, name");
}

export async function getRegionById(id: string) {
  return fetchById<{ id: string; name: string }>("regions", id, "id, name");
}

export async function getCityById(id: string) {
  return fetchById<{ id: string; name: string }>("cities", id, "id, name");
}

export async function getCommuneById(id: string) {
  return fetchById<{ id: string; name: string }>("communes", id, "id, name");
}

export async function createEvent(input: { country_id?: string; code?: string; name: string; description?: string }) {
  return insertRow<Event>("events", {
    ...input,
    is_active: true,
  }, "id, country_id, code, name, description, is_active");
}

export async function updateEvent(id: string, input: { country_id?: string; code?: string; name?: string; description?: string; is_active?: boolean }) {
  const set: Record<string, unknown> = {};
  if (input.country_id !== undefined) set.country_id = input.country_id;
  if (input.code !== undefined) set.code = input.code;
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  return updateRow<Event>("events", id, set, "id, country_id, code, name, description, is_active");
}

export async function deleteEvent(id: string) {
  return updateEvent(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TYPES
// ═══════════════════════════════════════════════════════════════

export async function getDocumentTypes() {
  return fetchAllSorted<DocumentType>("document_types", {
    select: "id, country_id, code, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createDocumentType(input: { country_id?: string; code?: string; name: string; description?: string }) {
  return insertRow<DocumentType>("document_types", {
    ...input,
    is_active: true,
  }, "id, country_id, code, name, description, is_active");
}

export async function updateDocumentType(id: string, input: { country_id?: string; code?: string; name?: string; description?: string; is_active?: boolean }) {
  const set: Record<string, unknown> = {};
  if (input.country_id !== undefined) set.country_id = input.country_id;
  if (input.code !== undefined) set.code = input.code;
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  return updateRow<DocumentType>("document_types", id, set, "id, country_id, code, name, description, is_active");
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE SPACES (Espacios/Recintos para daños constructivos)
// ═══════════════════════════════════════════════════════════════

export async function getDamageSpaces() {
  return fetchAllSorted<DamageSpace>("damage_spaces", {
    select: "id, name, description, is_active, applicable_classifications, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function createDamageSpace(input: { name: string; description?: string }) {
  return insertRow<DamageSpace>("damage_spaces", {
    ...input,
    is_active: true,
    applicable_classifications: ["Otros"],
  }, "id, name, description, is_active, applicable_classifications, created_at, updated_at");
}

export async function updateDamageSpace(id: string, input: Partial<DamageSpace>) {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  return updateRow<DamageSpace>("damage_spaces", id, set, "id, name, description, is_active, applicable_classifications, created_at, updated_at");
}

export async function deleteDamageSpace(id: string) {
  await deleteRow("damage_spaces", id);
}

export async function updateDamageSpaceClassifications(updates: { id: string; applicable_classifications: string[] }[]) {
  const results: DamageSpace[] = [];
  for (const u of updates) {
    const r = await updateRow<DamageSpace>("damage_spaces", u.id,
      { applicable_classifications: u.applicable_classifications },
      "id, name, description, is_active, applicable_classifications, created_at, updated_at"
    );
    results.push(r);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GOOD TYPES (Tipos de Bien para daños de contenido)
// ═══════════════════════════════════════════════════════════════

export async function getContentGoodTypes() {
  return fetchAllSorted<ContentGoodType>("content_good_types", {
    select: "id, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

// ═══════════════════════════════════════════════════════════════
// BUILDING DAMAGE CATEGORIES (Categorías de daño constructivo)
// ═══════════════════════════════════════════════════════════════

export async function getBuildingDamageCategories() {
  return fetchAllSorted<BuildingDamageCategory>("building_damage_categories", {
    select: "id, name, description, is_active, created_at, updated_at",
    eq: { is_active: true },
  });
}

export async function deleteDocumentType(id: string) {
  return updateDocumentType(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// CURRENCIES (Catálogo global de monedas)
// ═══════════════════════════════════════════════════════════════

export async function getCurrencies() {
  return fetchAll<Currency>("currencies", {
    select: "id, code, name, symbol, decimals, is_active, created_at, updated_at",
    order: { column: "code", ascending: true },
  });
}

export async function createCurrency(input: { code: string; name: string; symbol?: string; decimals?: number }) {
  return insertRow<Currency>("currencies", {
    ...input,
    decimals: input.decimals ?? 2,
    is_active: true,
  }, "id, code, name, symbol, decimals, is_active, created_at, updated_at");
}

export async function updateCurrency(id: string, input: Partial<{ code: string; name: string; symbol: string; decimals: number; is_active: boolean }>) {
  return updateRow<Currency>("currencies", id, input, "id, code, name, symbol, decimals, is_active, created_at, updated_at");
}

export async function deleteCurrency(id: string) {
  return updateCurrency(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// COUNTRY CURRENCIES (Relación país ↔ moneda)
// ═══════════════════════════════════════════════════════════════

const COUNTRY_CURRENCY_SELECT = `
  id, country_id, currency_code, is_base, sort_order, is_active, created_at, updated_at,
  country:countries!country_currencies_country_id_fkey(id, name, code),
  currency:currencies!country_currencies_currency_code_fkey(code, name, symbol)
`;

export async function getCountryCurrenciesAll() {
  return fetchAll<CountryCurrency>("country_currencies", {
    select: COUNTRY_CURRENCY_SELECT,
    order: { column: "sort_order", ascending: true },
  });
}

export async function getCountryCurrenciesByCountry(countryId: string) {
  return fetchAll<CountryCurrency>("country_currencies", {
    select: COUNTRY_CURRENCY_SELECT,
    eq: { country_id: countryId, is_active: true },
    order: { column: "sort_order", ascending: true },
  });
}

export async function createCountryCurrency(input: { country_id: string; currency_code: string; is_base?: boolean; sort_order?: number }) {
  // Si is_base es true, quitar el flag de la moneda base anterior del país
  if (input.is_base) {
    const existing = await fetchAll<CountryCurrency>("country_currencies", {
      select: "id",
      eq: { country_id: input.country_id, is_base: true },
    });
    for (const row of existing) {
      await updateRow<CountryCurrency>("country_currencies", row.id, { is_base: false });
    }
  }
  return insertRow<CountryCurrency>("country_currencies", {
    ...input,
    is_base: input.is_base ?? false,
    sort_order: input.sort_order ?? 0,
    is_active: true,
  }, COUNTRY_CURRENCY_SELECT);
}

export async function updateCountryCurrency(id: string, input: Partial<{ is_base: boolean; sort_order: number; is_active: boolean }>) {
  // Si se está marcando como base, quitar el flag de la anterior
  if (input.is_base === true) {
    const current = await fetchById<CountryCurrency>("country_currencies", id, "id, country_id");
    if (current) {
      const existing = await fetchAll<CountryCurrency>("country_currencies", {
        select: "id",
        eq: { country_id: current.country_id, is_base: true },
      });
      for (const row of existing) {
        if (row.id !== id) {
          await updateRow<CountryCurrency>("country_currencies", row.id, { is_base: false });
        }
      }
    }
  }
  return updateRow<CountryCurrency>("country_currencies", id, input, COUNTRY_CURRENCY_SELECT);
}

export async function deleteCountryCurrency(id: string) {
  return updateCountryCurrency(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// EXCHANGE RATES (Tipos de cambio por país)
// ═══════════════════════════════════════════════════════════════

const EXCHANGE_RATE_SELECT = `
  id, country_id, currency_code, rate_to_base, effective_date, source, created_at, updated_at,
  country:countries!exchange_rates_country_id_fkey(id, name, code),
  currency:currencies!exchange_rates_currency_code_fkey(code, name, symbol)
`;

export async function getExchangeRates() {
  return fetchAll<ExchangeRate>("exchange_rates", {
    select: EXCHANGE_RATE_SELECT,
    order: { column: "effective_date", ascending: false },
  });
}

export async function getExchangeRatesByCountry(countryId: string) {
  return fetchAll<ExchangeRate>("exchange_rates", {
    select: EXCHANGE_RATE_SELECT,
    eq: { country_id: countryId },
    order: { column: "effective_date", ascending: false },
  });
}

export async function createExchangeRate(input: { country_id: string; currency_code: string; rate_to_base: number; effective_date?: string; source?: string }) {
  return insertRow<ExchangeRate>("exchange_rates", {
    ...input,
    effective_date: input.effective_date || new Date().toISOString().split("T")[0],
    source: input.source || "manual",
  }, EXCHANGE_RATE_SELECT);
}

export async function updateExchangeRate(id: string, input: Partial<{ rate_to_base: number; effective_date: string; source: string }>) {
  return updateRow<ExchangeRate>("exchange_rates", id, input, EXCHANGE_RATE_SELECT);
}

export async function deleteExchangeRate(id: string) {
  return deleteRow("exchange_rates", id);
}

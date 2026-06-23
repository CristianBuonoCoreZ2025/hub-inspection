import { graphqlRequest } from "@/lib/nhost/graphql";
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
} from "@/types";

// ═══════════════════════════════════════════════════════════════
// CLAIM CAUSES
// ═══════════════════════════════════════════════════════════════

export async function getClaimCauses() {
  const query = `
    query GetClaimCauses {
      claim_causes(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name description country country_id is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ claim_causes: ClaimCause[] }>(query);
  return data.claim_causes;
}

export async function createClaimCause(input: { name: string; description?: string; country?: string; country_id?: string }) {
  const mutation = `
    mutation CreateClaimCause($object: claim_causes_insert_input!) {
      insert_claim_causes_one(object: $object) { id name description country country_id is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_claim_causes_one: ClaimCause }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_claim_causes_one;
}

export async function updateClaimCause(id: string, input: Partial<ClaimCause>) {
  const mutation = `
    mutation UpdateClaimCause($id: uuid!, $set: claim_causes_set_input!) {
      update_claim_causes_by_pk(pk_columns: { id: $id }, _set: $set) { id name description country country_id is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description;
  if (input.country !== undefined) set.country = input.country;
  if (input.country_id !== undefined) set.country_id = input.country_id;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  const data = await graphqlRequest<{ update_claim_causes_by_pk: ClaimCause }>(mutation, { id, set });
  return data.update_claim_causes_by_pk;
}

export async function deleteClaimCause(id: string) {
  return updateClaimCause(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// INSURANCE COMPANIES
// ═══════════════════════════════════════════════════════════════

export async function getInsuranceCompanies() {
  const query = `
    query GetInsuranceCompanies {
      insurance_companies(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name rut address line_of_business code type country country_id is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ insurance_companies: InsuranceCompanyCatalog[] }>(query);
  return data.insurance_companies;
}

export async function createInsuranceCompany(input: { name: string; rut?: string; address?: string; line_of_business?: string; code?: string; type?: string; country?: string; country_id?: string }) {
  const mutation = `
    mutation CreateInsuranceCompany($object: insurance_companies_insert_input!) {
      insert_insurance_companies_one(object: $object) { id name rut address line_of_business code type country country_id is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_insurance_companies_one: InsuranceCompanyCatalog }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_insurance_companies_one;
}

export async function updateInsuranceCompany(id: string, input: Partial<InsuranceCompanyCatalog>) {
  const mutation = `
    mutation UpdateInsuranceCompany($id: uuid!, $set: insurance_companies_set_input!) {
      update_insurance_companies_by_pk(pk_columns: { id: $id }, _set: $set) { id name rut address line_of_business code type country country_id is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_insurance_companies_by_pk: InsuranceCompanyCatalog }>(mutation, { id, set });
  return data.update_insurance_companies_by_pk;
}

export async function deleteInsuranceCompany(id: string) {
  return updateInsuranceCompany(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BROKERS
// ═══════════════════════════════════════════════════════════════

export async function getBrokers() {
  const query = `
    query GetBrokers {
      brokers(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name rut address contact country country_id is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ brokers: BrokerCatalog[] }>(query);
  return data.brokers;
}

export async function createBroker(input: { name: string; rut?: string; address?: string; contact?: string; country?: string; country_id?: string }) {
  const mutation = `
    mutation CreateBroker($object: brokers_insert_input!) {
      insert_brokers_one(object: $object) { id name rut address contact country country_id is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_brokers_one: BrokerCatalog }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_brokers_one;
}

export async function updateBroker(id: string, input: Partial<BrokerCatalog>) {
  const mutation = `
    mutation UpdateBroker($id: uuid!, $set: brokers_set_input!) {
      update_brokers_by_pk(pk_columns: { id: $id }, _set: $set) { id name rut address contact country country_id is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_brokers_by_pk: BrokerCatalog }>(mutation, { id, set });
  return data.update_brokers_by_pk;
}

export async function deleteBroker(id: string) {
  return updateBroker(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS LINES
// ═══════════════════════════════════════════════════════════════

export async function getBusinessLines() {
  const query = `
    query GetBusinessLines {
      business_lines(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id country country_id name claim_type ramo_fecu description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ business_lines: BusinessLine[] }>(query);
  return data.business_lines;
}

export async function createBusinessLine(input: { country?: string; country_id?: string; name: string; claim_type?: string; ramo_fecu?: string; description?: string }) {
  const mutation = `
    mutation CreateBusinessLine($object: business_lines_insert_input!) {
      insert_business_lines_one(object: $object) { id country country_id name claim_type ramo_fecu description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_business_lines_one: BusinessLine }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_business_lines_one;
}

export async function updateBusinessLine(id: string, input: Partial<BusinessLine>) {
  const mutation = `
    mutation UpdateBusinessLine($id: uuid!, $set: business_lines_set_input!) {
      update_business_lines_by_pk(pk_columns: { id: $id }, _set: $set) { id country country_id name claim_type ramo_fecu description is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_business_lines_by_pk: BusinessLine }>(mutation, { id, set });
  return data.update_business_lines_by_pk;
}

export async function deleteBusinessLine(id: string) {
  return updateBusinessLine(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// INSURANCE PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function getInsuranceProducts() {
  const query = `
    query GetInsuranceProducts {
      insurance_products(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id business_line_id name description country country_id is_active created_at updated_at
        business_line { id name }
      }
    }
  `;
  const data = await graphqlRequest<{ insurance_products: (InsuranceProduct & { business_line?: { id: string; name: string } })[] }>(query);
  return data.insurance_products;
}

export async function createInsuranceProduct(input: { business_line_id: string; name: string; description?: string; country?: string; country_id?: string }) {
  const mutation = `
    mutation CreateInsuranceProduct($object: insurance_products_insert_input!) {
      insert_insurance_products_one(object: $object) { id business_line_id name description country country_id is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_insurance_products_one: InsuranceProduct }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_insurance_products_one;
}

export async function updateInsuranceProduct(id: string, input: Partial<InsuranceProduct>) {
  const mutation = `
    mutation UpdateInsuranceProduct($id: uuid!, $set: insurance_products_set_input!) {
      update_insurance_products_by_pk(pk_columns: { id: $id }, _set: $set) { id name description country country_id is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_insurance_products_by_pk: InsuranceProduct }>(mutation, { id, set });
  return data.update_insurance_products_by_pk;
}

export async function deleteInsuranceProduct(id: string) {
  return updateInsuranceProduct(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// ADVISORS (ASESORES)
// ═══════════════════════════════════════════════════════════════

export async function getAdvisors() {
  const query = `
    query GetAdvisors {
      advisors(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name email phone country country_id is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ advisors: Advisor[] }>(query);
  return data.advisors;
}

export async function createAdvisor(input: { name: string; email?: string; phone?: string; country?: string; country_id?: string }) {
  const mutation = `
    mutation CreateAdvisor($object: advisors_insert_input!) {
      insert_advisors_one(object: $object) { id name email phone country country_id is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_advisors_one: Advisor }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_advisors_one;
}

export async function updateAdvisor(id: string, input: Partial<Advisor>) {
  const mutation = `
    mutation UpdateAdvisor($id: uuid!, $set: advisors_set_input!) {
      update_advisors_by_pk(pk_columns: { id: $id }, _set: $set) { id name email phone country country_id is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_advisors_by_pk: Advisor }>(mutation, { id, set });
  return data.update_advisors_by_pk;
}

export async function deleteAdvisor(id: string) {
  return updateAdvisor(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// REGIONS (REGIONES)
// ═══════════════════════════════════════════════════════════════

export async function getRegions(countryId?: string) {
  const where = countryId ? `{ country_id: { _eq: "${countryId}" }, is_active: { _eq: true } }` : `{ is_active: { _eq: true } }`;
  const query = `
    query GetRegions {
      regions(where: ${where}, order_by: { name: asc }) {
        id country_id code name is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ regions: Region[] }>(query);
  return data.regions;
}

export async function createRegion(input: { country_id: string; code?: string; name: string }) {
  const mutation = `
    mutation CreateRegion($object: regions_insert_input!) {
      insert_regions_one(object: $object) { id country_id code name is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_regions_one: Region }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_regions_one;
}

export async function updateRegion(id: string, input: Partial<Region>) {
  const mutation = `
    mutation UpdateRegion($id: uuid!, $set: regions_set_input!) {
      update_regions_by_pk(pk_columns: { id: $id }, _set: $set) { id country_id code name is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_regions_by_pk: Region }>(mutation, { id, set });
  return data.update_regions_by_pk;
}

export async function deleteRegion(id: string) {
  return updateRegion(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// CITIES (CIUDADES)
// ═══════════════════════════════════════════════════════════════

export async function getCities(regionId?: string) {
  const where = regionId ? `{ region_id: { _eq: "${regionId}" }, is_active: { _eq: true } }` : `{ is_active: { _eq: true } }`;
  const query = `
    query GetCities {
      cities(where: ${where}, order_by: { name: asc }) {
        id region_id name is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ cities: City[] }>(query);
  return data.cities;
}

export async function createCity(input: { region_id: string; name: string }) {
  const mutation = `
    mutation CreateCity($object: cities_insert_input!) {
      insert_cities_one(object: $object) { id region_id name is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_cities_one: City }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_cities_one;
}

export async function updateCity(id: string, input: Partial<City>) {
  const mutation = `
    mutation UpdateCity($id: uuid!, $set: cities_set_input!) {
      update_cities_by_pk(pk_columns: { id: $id }, _set: $set) { id region_id name is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_cities_by_pk: City }>(mutation, { id, set });
  return data.update_cities_by_pk;
}

export async function deleteCity(id: string) {
  return updateCity(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// COMMUNES (COMUNAS)
// ═══════════════════════════════════════════════════════════════

export async function getCommunes(cityId?: string) {
  const where = cityId ? `{ city_id: { _eq: "${cityId}" }, is_active: { _eq: true } }` : `{ is_active: { _eq: true } }`;
  const query = `
    query GetCommunes {
      communes(where: ${where}, order_by: { name: asc }) {
        id city_id name is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ communes: Commune[] }>(query);
  return data.communes;
}

export async function createCommune(input: { city_id: string; name: string }) {
  const mutation = `
    mutation CreateCommune($object: communes_insert_input!) {
      insert_communes_one(object: $object) { id city_id name is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_communes_one: Commune }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_communes_one;
}

export async function updateCommune(id: string, input: Partial<Commune>) {
  const mutation = `
    mutation UpdateCommune($id: uuid!, $set: communes_set_input!) {
      update_communes_by_pk(pk_columns: { id: $id }, _set: $set) { id city_id name is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_communes_by_pk: Commune }>(mutation, { id, set });
  return data.update_communes_by_pk;
}

export async function deleteCommune(id: string) {
  return updateCommune(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// PROPERTY CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function getPropertyClassifications() {
  const query = `
    query GetPropertyClassifications {
      property_classifications(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name  description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ property_classifications: PropertyClassification[] }>(query);
  return data.property_classifications;
}

export async function createPropertyClassification(input: { name: string; description?: string }) {
  const mutation = `
    mutation CreatePropertyClassification($object: property_classifications_insert_input!) {
      insert_property_classifications_one(object: $object) { id name  description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_property_classifications_one: PropertyClassification }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_property_classifications_one;
}

export async function updatePropertyClassification(id: string, input: Partial<PropertyClassification>) {
  const mutation = `
    mutation UpdatePropertyClassification($id: uuid!, $set: property_classifications_set_input!) {
      update_property_classifications_by_pk(pk_columns: { id: $id }, _set: $set) { id name description is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_property_classifications_by_pk: PropertyClassification }>(mutation, { id, set });
  return data.update_property_classifications_by_pk;
}

export async function deletePropertyClassification(id: string) {
  return updatePropertyClassification(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// DAMAGE CLASSIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function getDamageClassifications() {
  const query = `
    query GetDamageClassifications {
      damage_classifications(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name  description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ damage_classifications: DamageClassification[] }>(query);
  return data.damage_classifications;
}

export async function createDamageClassification(input: { name: string; description?: string }) {
  const mutation = `
    mutation CreateDamageClassification($object: damage_classifications_insert_input!) {
      insert_damage_classifications_one(object: $object) { id name  description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_damage_classifications_one: DamageClassification }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_damage_classifications_one;
}

export async function updateDamageClassification(id: string, input: Partial<DamageClassification>) {
  const mutation = `
    mutation UpdateDamageClassification($id: uuid!, $set: damage_classifications_set_input!) {
      update_damage_classifications_by_pk(pk_columns: { id: $id }, _set: $set) { id name description is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_damage_classifications_by_pk: DamageClassification }>(mutation, { id, set });
  return data.update_damage_classifications_by_pk;
}

export async function deleteDamageClassification(id: string) {
  return updateDamageClassification(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// POLICY TYPES
// ═══════════════════════════════════════════════════════════════

export async function getPolicyTypes() {
  const query = `
    query GetPolicyTypes {
      policy_types(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ policy_types: PolicyType[] }>(query);
  return data.policy_types;
}

export async function createPolicyType(input: { name: string; description?: string }) {
  const mutation = `
    mutation CreatePolicyType($object: policy_types_insert_input!) {
      insert_policy_types_one(object: $object) { id name description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_policy_types_one: PolicyType }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_policy_types_one;
}

export async function updatePolicyType(id: string, input: Partial<PolicyType>) {
  const mutation = `
    mutation UpdatePolicyType($id: uuid!, $set: policy_types_set_input!) {
      update_policy_types_by_pk(pk_columns: { id: $id }, _set: $set) { id name description is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_policy_types_by_pk: PolicyType }>(mutation, { id, set });
  return data.update_policy_types_by_pk;
}

export async function deletePolicyType(id: string) {
  return updatePolicyType(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// CLAIM TYPES
// ═══════════════════════════════════════════════════════════════

export async function getClaimTypes() {
  const query = `
    query GetClaimTypes {
      claim_types(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name  description sw_type icon is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ claim_types: ClaimType[] }>(query);
  return data.claim_types;
}

export async function createClaimType(input: { name: string; description?: string; sw_type?: number; icon?: string }) {
  const mutation = `
    mutation CreateClaimType($object: claim_types_insert_input!) {
      insert_claim_types_one(object: $object) { id name  description sw_type icon is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_claim_types_one: ClaimType }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_claim_types_one;
}

export async function updateClaimType(id: string, input: Partial<ClaimType>) {
  const mutation = `
    mutation UpdateClaimType($id: uuid!, $set: claim_types_set_input!) {
      update_claim_types_by_pk(pk_columns: { id: $id }, _set: $set) { id name description sw_type icon is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_claim_types_by_pk: ClaimType }>(mutation, { id, set });
  return data.update_claim_types_by_pk;
}

export async function deleteClaimType(id: string) {
  return updateClaimType(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// HOUSING DESTINATIONS
// ═══════════════════════════════════════════════════════════════

export async function getHousingDestinations() {
  const query = `
    query GetHousingDestinations {
      housing_destinations(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name  description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ housing_destinations: HousingDestination[] }>(query);
  return data.housing_destinations;
}

export async function createHousingDestination(input: { name: string; description?: string }) {
  const mutation = `
    mutation CreateHousingDestination($object: housing_destinations_insert_input!) {
      insert_housing_destinations_one(object: $object) { id name  description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_housing_destinations_one: HousingDestination }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_housing_destinations_one;
}

export async function updateHousingDestination(id: string, input: Partial<HousingDestination>) {
  const mutation = `
    mutation UpdateHousingDestination($id: uuid!, $set: housing_destinations_set_input!) {
      update_housing_destinations_by_pk(pk_columns: { id: $id }, _set: $set) { id name description is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_housing_destinations_by_pk: HousingDestination }>(mutation, { id, set });
  return data.update_housing_destinations_by_pk;
}

export async function deleteHousingDestination(id: string) {
  return updateHousingDestination(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// BUILDING AGES
// ═══════════════════════════════════════════════════════════════

export async function getBuildingAges() {
  const query = `
    query GetBuildingAges {
      building_ages(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ building_ages: BuildingAge[] }>(query);
  return data.building_ages;
}

export async function createBuildingAge(input: { name: string }) {
  const mutation = `
    mutation CreateBuildingAge($object: building_ages_insert_input!) {
      insert_building_ages_one(object: $object) { id name is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_building_ages_one: BuildingAge }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_building_ages_one;
}

export async function updateBuildingAge(id: string, input: Partial<BuildingAge>) {
  const mutation = `
    mutation UpdateBuildingAge($id: uuid!, $set: building_ages_set_input!) {
      update_building_ages_by_pk(pk_columns: { id: $id }, _set: $set) { id name is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_building_ages_by_pk: BuildingAge }>(mutation, { id, set });
  return data.update_building_ages_by_pk;
}

export async function deleteBuildingAge(id: string) {
  return updateBuildingAge(id, { is_active: false });
}

// ═══════════════════════════════════════════════════════════════
// RELATIONSHIPS
// ═══════════════════════════════════════════════════════════════

export async function getRelationships() {
  const query = `
    query GetRelationships {
      relationships(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id name  is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ relationships: Relationship[] }>(query);
  return data.relationships;
}

export async function createRelationship(input: { name: string }) {
  const mutation = `
    mutation CreateRelationship($object: relationships_insert_input!) {
      insert_relationships_one(object: $object) { id name  is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_relationships_one: Relationship }>(mutation, { object: { ...input, is_active: true } });
  return data.insert_relationships_one;
}

export async function updateRelationship(id: string, input: Partial<Relationship>) {
  const mutation = `
    mutation UpdateRelationship($id: uuid!, $set: relationships_set_input!) {
      update_relationships_by_pk(pk_columns: { id: $id }, _set: $set) { id name is_active }
    }
  `;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) set[key] = value;
  }
  const data = await graphqlRequest<{ update_relationships_by_pk: Relationship }>(mutation, { id, set });
  return data.update_relationships_by_pk;
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
  const query = `
    query GetCountries {
      countries(order_by: { name: asc }) {
        id code name phone_prefix created_at
      }
    }
  `;
  const data = await graphqlRequest<{ countries: Country[] }>(query);
  return data.countries;
}

export async function getLookupCatalog(category: string) {
  const query = `
    query GetLookupCatalog($category: String!) {
      lookup_catalog(where: { category: { _eq: $category }, is_active: { _eq: true } }, order_by: { sort_order: asc, name: asc }) {
        id country_id category code name description sort_order is_active
      }
    }
  `;
  const data = await graphqlRequest<{ lookup_catalog: LookupCatalog[] }>(query, { category });
  return data.lookup_catalog;
}

// ═══════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════

export async function getEvents() {
  const query = `
    query GetEvents {
      events(where: { is_active: { _eq: true } }, order_by: { name: asc }) {
        id country_id code name description is_active created_at updated_at
      }
    }
  `;
  const data = await graphqlRequest<{ events: Event[] }>(query);
  return data.events;
}

export async function createEvent(input: { country_id?: string; code?: string; name: string; description?: string }) {
  const mutation = `
    mutation CreateEvent($object: events_insert_input!) {
      insert_events_one(object: $object) { id country_id code name description is_active }
    }
  `;
  const data = await graphqlRequest<{ insert_events_one: Event }>(mutation, {
    object: { ...input, is_active: true },
  });
  return data.insert_events_one;
}

export async function updateEvent(id: string, input: { country_id?: string; code?: string; name?: string; description?: string; is_active?: boolean }) {
  const mutation = `
    mutation UpdateEvent($id: uuid!, $set: events_set_input!) {
      update_events_by_pk(pk_columns: { id: $id }, _set: $set) { id country_id code name description is_active }
    }
  `;
  const { country_id, code, name, description, is_active, ...rest } = input;
  const set = { country_id, code, name, description, is_active };
  const data = await graphqlRequest<{ update_events_by_pk: Event }>(mutation, { id, set });
  return data.update_events_by_pk;
}

export async function deleteEvent(id: string) {
  return updateEvent(id, { is_active: false });
}

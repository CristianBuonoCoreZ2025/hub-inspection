import { fetchAll, insertRow, updateRow } from "@/lib/supabase/db";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  country_id: string | null;
  tax_id: string;
  person_type: "natural" | "legal";
  first_name: string;
  last_name: string | null;
  business_name: string | null;
  created_at: string;
}

export interface PersonAddress {
  id: string;
  person_id: string;
  address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  commune: string | null;
  source_claim_id: string | null;
  created_at: string;
}

export interface PersonWithAddresses extends Person {
  person_addresses: PersonAddress[];
}

const PERSON_SELECT = "id, country_id, tax_id, person_type, first_name, last_name, business_name, created_at, person_addresses(id, person_id, address, country, region, city, commune, source_claim_id, created_at)";

// ──────────────────────────────────────────────────────────────
// Lookup: buscar persona por país + tax_id
// ──────────────────────────────────────────────────────────────

export async function findPerson(countryId: string, taxId: string): Promise<PersonWithAddresses | null> {
  if (!countryId || !taxId) return null;

  const cleanTaxId = taxId.replace(/[.\s-]/g, "").toUpperCase();

  const persons = await fetchAll<PersonWithAddresses>("persons", {
    select: PERSON_SELECT,
    eq: { country_id: countryId },
    ilike: { tax_id: cleanTaxId },
    limit: 1,
  });

  return persons[0] || null;
}

// ──────────────────────────────────────────────────────────────
// Create: crear o actualizar persona
// ──────────────────────────────────────────────────────────────

export async function upsertPerson(input: {
  country_id: string;
  tax_id: string;
  person_type: "natural" | "legal";
  first_name: string;
  last_name?: string | null;
  business_name?: string | null;
}): Promise<Person> {
  const cleanTaxId = input.tax_id.replace(/[.\s-]/g, "").toUpperCase();

  // Primero buscar si ya existe
  const existing = await findPerson(input.country_id, cleanTaxId);
  if (existing) {
    // Actualizar si hay cambios
    const needsUpdate =
      existing.first_name !== input.first_name ||
      existing.last_name !== (input.last_name || null) ||
      existing.person_type !== input.person_type ||
      existing.business_name !== (input.business_name || null);

    if (needsUpdate) {
      return updateRow<Person>("persons", existing.id, {
        person_type: input.person_type,
        first_name: input.first_name,
        last_name: input.last_name || null,
        business_name: input.business_name || null,
      }, PERSON_SELECT);
    }
    return existing;
  }

  // Crear nueva
  return insertRow<Person>(
    "persons",
    {
      country_id: input.country_id,
      tax_id: cleanTaxId,
      person_type: input.person_type,
      first_name: input.first_name,
      last_name: input.last_name || null,
      business_name: input.business_name || null,
    },
    PERSON_SELECT,
  );
}

// ──────────────────────────────────────────────────────────────
// Add address: agregar dirección a una persona (si no existe ya)
// ──────────────────────────────────────────────────────────────

export async function addPersonAddress(input: {
  person_id: string;
  address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
  source_claim_id?: string | null;
}): Promise<void> {
  // No agregar direcciones vacías
  if (!input.address && !input.country && !input.region && !input.city) return;

  // Verificar si ya existe una dirección idéntica
  const existing = await fetchAll<{ id: string }>("person_addresses", {
    select: "id",
    eq: {
      person_id: input.person_id,
      address: input.address || null,
      country: input.country || null,
      region: input.region || null,
      city: input.city || null,
      commune: input.commune || null,
    },
    limit: 1,
  });

  if (existing.length > 0) return;

  // Insertar nueva dirección
  await insertRow("person_addresses", {
    person_id: input.person_id,
    address: input.address || null,
    country: input.country || null,
    region: input.region || null,
    city: input.city || null,
    commune: input.commune || null,
    source_claim_id: input.source_claim_id || null,
  }, "id");
}

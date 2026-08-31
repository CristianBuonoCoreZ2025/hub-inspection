import { fetchAll, fetchById, insertRow, updateRow, deleteRow } from "@/lib/supabase/db";
import type { Company, CompanyInput } from "@/types";

const COMPANY_FIELDS =
  "id, name, slug, rut, address, phone, email, country_id, logo_url, primary_color, settings, created_at, updated_at";

export async function getCompanies() {
  return fetchAll<Company>("companies", {
    select: COMPANY_FIELDS,
    order: { column: "name", ascending: true },
  });
}

export async function getCompanyById(id: string) {
  return fetchById<Company>("companies", id, COMPANY_FIELDS);
}

export async function createCompany(input: CompanyInput) {
  return insertRow<Company>(
    "companies",
    {
      name: input.name,
      slug: input.slug,
      rut: input.rut || null,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      country_id: input.countryId || null,
      logo_url: input.logoUrl || null,
      primary_color: input.primaryColor || null,
    },
    COMPANY_FIELDS
  );
}

export async function updateCompany(id: string, input: Partial<CompanyInput>) {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.slug !== undefined) set.slug = input.slug;
  if (input.rut !== undefined) set.rut = input.rut || null;
  if (input.address !== undefined) set.address = input.address || null;
  if (input.phone !== undefined) set.phone = input.phone || null;
  if (input.email !== undefined) set.email = input.email || null;
  if (input.countryId !== undefined) set.country_id = input.countryId || null;
  if (input.logoUrl !== undefined) set.logo_url = input.logoUrl || null;
  if (input.primaryColor !== undefined) set.primary_color = input.primaryColor || null;

  return updateRow<Company>("companies", id, set, COMPANY_FIELDS);
}

export async function deleteCompany(id: string) {
  await deleteRow("companies", id);
}

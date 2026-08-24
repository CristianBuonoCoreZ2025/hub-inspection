import { fetchAll } from "@/lib/supabase/db";
import type { Country } from "@/types";

const COUNTRY_FIELDS = "id, code, name, phone_prefix, created_at";

export async function getCountries() {
  return fetchAll<Country>("countries", {
    select: COUNTRY_FIELDS,
    order: { column: "name", ascending: true },
  });
}

import { fetchAll } from "@/lib/supabase/db";
import type { Page } from "@/types";

export async function getPages(): Promise<Page[]> {
  return fetchAll<Page>("pages", {
    select: "code, label, category, actions, parent_code, sort_order, created_at, updated_at",
    order: { column: "sort_order", ascending: true },
  });
}

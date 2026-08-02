import { createAdminClient } from "@/lib/supabase/server";

export async function getUserProfile(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, role, full_name")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

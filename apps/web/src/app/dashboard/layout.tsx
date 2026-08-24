import { redirect } from "next/navigation";
import { NavWrapper } from "@/components/layout/nav-wrapper";
import { createServerClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/db";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const profile = await getUserProfile(user.id);
      if (!profile?.company_id) {
        redirect("/onboarding");
      }
    }
  } catch {
    // Si no hay sesión, el middleware ya redirige a /login
  }

  return (
    <NavWrapper>
      <DashboardClientWrapper>{children}</DashboardClientWrapper>
    </NavWrapper>
  );
}

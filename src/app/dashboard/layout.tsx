import { redirect } from "next/navigation";
import { NavWrapper } from "@/components/layout/nav-wrapper";
import { getNhostServerClient } from "@/lib/nhost/server";
import { getUserProfile } from "@/lib/db";
import { DashboardClientWrapper } from "@/components/dashboard-client-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const nhost = await getNhostServerClient();
    const session = nhost.getUserSession();

    if (session?.user) {
      const profile = await getUserProfile(session.user.id);
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

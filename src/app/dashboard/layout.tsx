import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
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
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <DashboardClientWrapper>{children}</DashboardClientWrapper>
        </main>
      </div>
    </div>
  );
}

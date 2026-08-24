import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/db";
import { MobileLayout } from "@/components/mobile/mobile-layout";

export default async function MobileLayoutRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.company_id) {
      redirect("/onboarding");
    }
  } catch {
    redirect("/login");
  }

  return <MobileLayout>{children}</MobileLayout>;
}

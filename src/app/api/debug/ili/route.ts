import { NextResponse } from "next/server";
import { createAdminClient, createServerClient } from "@/lib/supabase/server";
import { createBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 1. Con admin client (bypass RLS) — estado real de la BD
    const admin = createAdminClient();

    const { data: iliAdmin } = await admin
      .from("action_features")
      .select("id, code, name, has_template, is_active, screen_id")
      .eq("code", "ILI")
      .maybeSingle();

    // 2. Con server client (usa cookies del usuario logueado)
    const serverClient = await createServerClient();

    const { data: iliServer, error: errServer } = await serverClient
      .from("action_features")
      .select("id, code, name, has_template, is_active, screen_id")
      .eq("code", "ILI")
      .maybeSingle();

    const { data: featuresServer, error: errFeaturesServer } = await serverClient
      .from("action_features")
      .select("id, code, name, has_template, is_active")
      .eq("is_active", true)
      .order("code");

    // 3. Verificar sesión
    const cookieStore = await cookies();
    const sessionKeys = cookieStore.getAll().map(c => c.name).filter(n => n.includes('auth') || n.includes('token'));

    return NextResponse.json({
      admin: {
        ili: iliAdmin,
      },
      server: {
        ili: iliServer,
        errorIli: errServer?.message,
        featuresCount: featuresServer?.length ?? 0,
        featuresWithTemplate: featuresServer?.filter(f => f.has_template).map(f => f.code) ?? [],
        errorFeatures: errFeaturesServer?.message,
      },
      session: {
        cookieKeys: sessionKeys,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}



import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para el browser.
 * Usa cookies para persistir la sesión (accesible desde Server Actions).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Singleton para uso en componentes client
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cliente Supabase singleton para uso en componentes client.
 *
 * Durante SSR (incluido el pre-render del build de Next.js), las env vars
 * NEXT_PUBLIC_* pueden no estar disponibles (ej: build de Vercel sin vars
 * configuradas). En ese caso se retorna un cliente placeholder para que
 * createBrowserClient no lance "Invalid supabaseUrl" y el build no se caiga.
 * El cliente placeholder nunca se usa para requests reales en SSR (useAuth
 * y demás hooks solo ejecutan llamadas en useEffect / queryFn del browser).
 * El cliente real se crea la primera vez que se llama en el browser.
 */
export function getSupabaseClient() {
  if (typeof window === "undefined") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return createBrowserClient(
        "https://placeholder.supabase.co",
        "placeholder-anon-key"
      );
    }
    return createBrowserClient(url, key);
  }
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

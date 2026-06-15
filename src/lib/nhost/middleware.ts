import { createServerClient } from "@nhost/nhost-js";
import type { StoredSession } from "@nhost/nhost-js/session";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "nhostSession";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;

  const baseOptions = {
    ...(subdomain && region
      ? { subdomain, region }
      : {
          authUrl: process.env.NEXT_PUBLIC_NHOST_AUTH_URL || "http://placeholder.local",
          graphqlUrl: process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL || "http://placeholder.local",
          storageUrl: process.env.NEXT_PUBLIC_NHOST_STORAGE_URL,
          functionsUrl: process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL,
        }),
  };

  const client = createServerClient({
    ...baseOptions,
    storage: {
      get(): StoredSession | null {
        const raw = request.cookies.get(SESSION_COOKIE)?.value;
        if (!raw) return null;
        try {
          return JSON.parse(raw) as StoredSession;
        } catch {
          return null;
        }
      },
      set(value: StoredSession) {
        response.cookies.set(SESSION_COOKIE, JSON.stringify(value), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      },
      remove() {
        response.cookies.set(SESSION_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      },
    },
    configure: [],
  });

  const session = client.getUserSession();
  const isAuthenticated = !!session;

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/auth");

  const isPublicRoute = request.nextUrl.pathname === "/";

  if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // If Supabase isn't configured (env vars missing on the host), never take
  // the whole site down; pass through and let pages render with fallbacks.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");
  if (!url || !anon) {
    return NextResponse.next({ request });
  }

  // Fast path: no Supabase cookie means nobody is signed in, so skip the auth
  // round-trip entirely. Anonymous navigation stays instant.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) {
    if (isAdmin) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  // getSession() reads the cookie and only hits the network when the access token
  // actually needs refreshing, unlike getUser() which validates on every request.
  // The real admin check still runs server-side in app/admin/layout.tsx.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getSession();
    signedIn = Boolean(data.session);
  } catch {
    // Treat as logged out; pages handle a null user.
  }
  if (!signedIn && isAdmin) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  // A signed-in member has no business on the sign in / sign up screens.
  const path = request.nextUrl.pathname;
  if (signedIn && (path === "/login" || path === "/register")) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

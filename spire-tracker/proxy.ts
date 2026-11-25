import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/manifest.webmanifest", "/sw.js", "/icons"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // The cookie holds an expiring, HMAC-signed token (lib/auth.ts), not
  // SESSION_SECRET itself, so a leaked cookie can't be replayed forever.
  let authenticated = false;
  try {
    authenticated = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    // SESSION_SECRET missing: fail closed.
  }

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // next-auth API routes: pass through.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Phase 13 D8: /api/health is public (non-sensitive health info only).
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // Other API routes: enforce auth (RBAC enforced in the handler via requirePermission).
  // Return 401 JSON, never redirect.
  if (pathname.startsWith("/api/")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Page routes: apply i18n, then auth.
  const intlResponse = intlMiddleware(req);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isSignInPage = pathname.includes("/sign-in");

  if (!token && !isSignInPage) {
    const locale = pathname.split("/")[1] ?? routing.defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (token && isSignInPage) {
    const locale = pathname.split("/")[1] ?? routing.defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return intlResponse ?? NextResponse.next();
}

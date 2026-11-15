import { NextResponse, type NextRequest } from "next/server";
import { INTERNAL_HEADER, SESSION_COOKIE, internalValid, sessionValid } from "@/lib/auth";

// Every page and every API route needs the family password, except the sign-in page itself.
// (Same shape as the newsletter project's src/proxy.ts + updateSession: pages redirect to /login
// with ?next= so the student lands back where they were; API calls get a plain 401.)
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  // One background step starting the next one (lib/pipeline.ts chain) carries a signed header instead of a cookie.
  if (pathname.startsWith("/api/papers/") && pathname.endsWith("/continue") && (await internalValid(request.headers.get(INTERNAL_HEADER)))) {
    return NextResponse.next();
  }

  if (await sessionValid(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

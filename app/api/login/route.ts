import { SESSION_COOKIE, SESSION_DAYS, newSession, passwordMatches, safeNext } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { password?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Something went wrong. Try again." }, { status: 400 });
  }
  const given = typeof body.password === "string" ? body.password : "";
  if (!given || !(await passwordMatches(given))) {
    // A pause on every wrong try makes guessing slow.
    await new Promise((r) => setTimeout(r, 1200));
    return Response.json({ error: "That password is not right. Check it and try again." }, { status: 401 });
  }
  const cookie = [
    `${SESSION_COOKIE}=${await newSession()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 24 * 3600}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ].filter(Boolean).join("; ");
  return Response.json({ next: safeNext(typeof body.next === "string" ? body.next : null) }, { headers: { "Set-Cookie": cookie } });
}

// Sign-in for one family: a single password (APP_PASSWORD), checked once per device, then a signed
// cookie for 90 days. Chosen over email links on 15 Nov 2026 because Supabase's built-in email only
// reaches people on the Supabase account, so the student could never receive a link.
// Uses Web Crypto only, so it works in the proxy as well as in routes.

export const SESSION_COOKIE = "sc_session";
export const SESSION_DAYS = 90;
export const INTERNAL_HEADER = "x-study-copilot-internal";

const enc = new TextEncoder();

function password(): string {
  const p = process.env.APP_PASSWORD;
  if (!p || p.length < 8) throw new Error("APP_PASSWORD is not set (or shorter than 8 characters)");
  return p;
}

async function hmac(message: string): Promise<string> {
  // The key comes from the password, so changing the password signs everyone out.
  const key = await crypto.subtle.importKey("raw", enc.encode(`study-copilot:${password()}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function passwordMatches(given: string): Promise<boolean> {
  // Compare signatures, not the raw strings, so the check takes the same time whatever was typed.
  return same(await hmac(`pw:${given}`), await hmac(`pw:${password()}`));
}

export async function newSession(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  return `${expires}.${await hmac(`session:${expires}`)}`;
}

export async function sessionValid(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || !(Number(expires) > Date.now())) return false;
  return same(sig, await hmac(`session:${expires}`));
}

// Lets one background step start the next (pipeline.ts chain) without a browser cookie.
export async function internalToken(): Promise<string> {
  return hmac("internal");
}

export async function internalValid(value: string | null): Promise<boolean> {
  return Boolean(value) && same(value!, await internalToken());
}

// Where the app can reach itself. On Vercel, the production address (not protected by Vercel's own
// login, unlike one-off deployment addresses); on the laptop, the dev server.
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Only same-site paths, so ?next= can never send someone to another website.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

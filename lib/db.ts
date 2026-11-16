import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The app's only way into the database. Server-side only: it uses the secret key, which can read
// and write everything, so it must never be imported by a browser component.
// (Same pattern as the newsletter project's src/lib/supabase/admin.ts.)
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    // Loud, not silent: a missing key must not look like "no papers yet".
    throw new Error("SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
  }
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const BUCKET = "papers";

type DocTable = "papers" | "self_tests";

export async function loadDoc<T>(table: DocTable, id: string): Promise<T | null> {
  const { data, error } = await db().from(table).select("data").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load ${table}/${id}: ${error.message}`);
  return data ? (data.data as T) : null;
}

export async function listDocs<T>(table: DocTable): Promise<T[]> {
  const { data, error } = await db().from(table).select("data").order("created_at", { ascending: false });
  if (error) throw new Error(`Could not list ${table}: ${error.message}`);
  return (data ?? []).map((r) => r.data as T);
}

export async function saveDoc<T extends { id: string; createdAt: string }>(table: DocTable, doc: T, extra: Record<string, unknown> = {}) {
  const { data: existing, error: readError } = await db().from(table).select("version").eq("id", doc.id).maybeSingle();
  if (readError) throw new Error(`Could not save ${table}/${doc.id}: ${readError.message}`);
  const { error } = await db()
    .from(table)
    .upsert({ id: doc.id, data: doc, created_at: doc.createdAt, version: (existing?.version ?? -1) + 1, ...extra });
  if (error) throw new Error(`Could not save ${table}/${doc.id}: ${error.message}`);
}

// Adds a new row and refuses to overwrite one that exists. Returns false if the id was already taken.
export async function insertDoc<T extends { id: string; createdAt: string }>(table: DocTable, doc: T): Promise<boolean> {
  const { error } = await db().from(table).insert({ id: doc.id, data: doc, created_at: doc.createdAt, version: 0 });
  if (!error) return true;
  if (error.code === "23505") return false; // unique violation: someone else created it a moment ago
  throw new Error(`Could not save ${table}/${doc.id}: ${error.message}`);
}

// Read, change, write back, but only if nobody else wrote in between (the version must still match).
// If someone did, read again and re-apply the change. Two background saves can therefore never
// overwrite each other, the same guarantee the one-process file version had.
// `change` may return false to leave the document as it is.
export async function updateDoc<T>(table: DocTable, id: string, change: (doc: T) => void | boolean): Promise<{ doc: T; changed: boolean }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db().from(table).select("data, version").eq("id", id).maybeSingle();
    if (error) throw new Error(`Could not load ${table}/${id}: ${error.message}`);
    if (!data) throw new Error(`${table === "papers" ? "Paper" : "Self-test"} not found`);
    const doc = data.data as T;
    if (change(doc) === false) return { doc, changed: false };
    const { data: written, error: writeError } = await db()
      .from(table)
      .update({ data: doc, version: data.version + 1 })
      .eq("id", id)
      .eq("version", data.version)
      .select("id");
    if (writeError) throw new Error(`Could not save ${table}/${id}: ${writeError.message}`);
    if (written && written.length > 0) return { doc, changed: true };
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 120));
  }
  throw new Error(`Could not save ${table}/${id}: too many saves at once`);
}

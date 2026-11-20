import { BUCKET, db, listDocs, loadDoc, saveDoc, updateDoc } from "./db";

// All data lives in the study copilot's own Supabase project (tables papers, self_tests,
// topic_doubts, usage; uploaded pages in the private "papers" bucket). See supabase/schema.sql.

export type Option = { label: string; text: string };

export type Question = {
  n: number;
  section: string;
  type: "mcq" | "written";
  text: string;
  options: Option[];
  hasFigure: boolean;
  page: number;
  markedAnswer: string | null;
  cutOff: boolean;
  // Two reads of the paper found different marks here, so the student is asked to pick (see crossCheckMarks).
  markDoubt?: boolean;
  // Added by the tagging step, so results can be grouped by subject and topic across papers.
  subject?: string;
  topic?: string;
};

export type KeyEntry = {
  answer: string | null;
  // printed: taken from the paper's own answer key.
  // solved: two independent AI solves agreed.
  // best: the cheap pair was doubtful and two strong solves agreed (decision 20 Nov 2026). Our best answer, not from a book.
  // unsure: the solves disagreed, or neither found an answer. Not counted.
  source: "printed" | "solved" | "best" | "unsure";
  // A parent entered this from the book. Outranks every other answer.
  book?: boolean;
};

export type MistakeNote = {
  n: number;
  idea: string;
  whyTempting: string;
  aiAnswer: string | null;
  // The student's own choice could also be the book's answer. Not counted, never taught against.
  disputed?: boolean;
};

export type Idea = { name: string; explain: string; questions: number[] };

export type StepName = "read" | "solve" | "recheck" | "tag" | "analyse";

// ---- stage 2: fixing one idea ----

export type FixStep = {
  ask: string;
  options: { text: string; right: boolean; say: string }[];
  hint: string;
};

export type Twist = { text: string; options: { text: string; right: boolean }[]; explain: string };

// A lesson picture: one of a few hand-built animations. The AI only picks the template and fills the labels and numbers.
// Every field is checked in lib/picture.ts before it is stored.
export type Picture =
  | { template: "heating"; thing: string; start: number; boil: number }
  | { template: "depth"; medium: "water" | "air" }
  | { template: "expand"; thing: string; cold: string; hot: string }
  | { template: "cube"; faces: [string, string, string, string, string, string] }; // faces 0+1, 2+3 and 4+5 are opposite pairs

export type Explainer = { why: string; picture: Picture | null };

export type Cursor =
  | { kind: "step"; index: number }
  | { kind: "connect" }
  | { kind: "twist" }
  | { kind: "retry"; index: number }
  | { kind: "done" };

export type Fix = {
  status: "building" | "ready" | "failed";
  startedAt: string;
  job?: string; // the background build holding the lock (see lib/fix.ts)
  error?: string;
  anchor: number;
  steps: FixStep[];
  connect: string; // the idea in plain words (the rule line of a short lesson)
  explainer?: Explainer; // short lesson (18 Nov 2026): why he picked it, and a picture when the idea needs seeing
  deep?: boolean; // the long walkthrough was asked for after a missed new question
  twist: Twist | null;
  retryList: number[];
  cursor: Cursor;
  tries: Record<string, number[]>; // step index -> option indexes chosen, in order
  hints: number[]; // step indexes where a hint was shown
  shown?: number[]; // step indexes where the student said "I don't know" and was shown the answer
  twistChoice: number | null;
  retries: Record<string, string>; // question number -> label chosen on the second try
  doubts: { q: string; a: string; at: string; where: string; flagged?: boolean }[]; // flagged: he said the answer looks wrong
  flagged: string[];
};

export type Paper = {
  id: string;
  title: string;
  createdAt: string;
  fileHash: string;
  files: { name: string; mime: string; stored: string }[];

  questions?: Question[];
  printedKey?: Record<string, string>;
  pageProblems?: { page: number; problem: string }[];
  // How many times the paper has been looked at only for the student's own marks (after a read that found none).
  marksLooks?: number;
  // "waiting": the pages look poor, so nothing is spent solving until the student chooses to carry on.
  qualityHold?: "waiting" | "cleared";
  // The strong re-check of doubtful answers has run (or was not needed).
  rechecked?: boolean;

  answers: Record<string, string>;
  answersSubmitted: boolean;

  // Finished parts of the solving step, kept so a retry only redoes what is missing.
  solveParts?: Record<string, Record<string, string>>;
  key?: Record<string, KeyEntry>;
  notes?: MistakeNote[];
  ideas?: Idea[];
  analysed?: boolean;
  tagged?: boolean;
  // A test run, or any paper that should not count towards "what to work on".
  excluded?: boolean;
  reported: number[];
  fixes?: Record<string, Fix>; // keyed by the idea's position in `ideas`

  // Background work bookkeeping.
  running?: { step: StepName; startedAt: string; label: string; job?: string };
  error?: { step: StepName; message: string; at: string };

  cost: { usd: number; calls: number };
};

// Longer than any background step can run on the host (5 minutes), so a lock older than this
// belongs to a job that died and may be taken over.
export const STALE_MS = 330_000;

export function validId(id: string) {
  return /^[a-z0-9]{6,20}$/.test(id);
}

function objectPath(id: string, stored: string) {
  if (!validId(id)) throw new Error("Bad paper id");
  const name = stored.split("/").pop() ?? stored;
  return `${id}/${name}`;
}

export async function loadPaper(id: string): Promise<Paper | null> {
  if (!validId(id)) return null;
  return loadDoc<Paper>("papers", id);
}

export async function savePaper(paper: Paper) {
  await saveDoc("papers", paper, { file_hash: paper.fileHash });
}

// Read-modify-write that cannot interleave with another save (see updateDoc).
export async function updatePaper(id: string, change: (p: Paper) => void): Promise<Paper> {
  return (await updateDoc<Paper>("papers", id, change)).doc;
}

// Like updatePaper, but `change` can return false to leave the paper untouched. Returns whether it saved.
export async function updatePaperIf(id: string, change: (p: Paper) => boolean): Promise<{ paper: Paper; changed: boolean }> {
  const r = await updateDoc<Paper>("papers", id, change);
  return { paper: r.doc, changed: r.changed };
}

export async function listPapers(): Promise<Paper[]> {
  const papers = await listDocs<Paper>("papers");
  return papers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

// The browser uploads pages straight to storage with these one-time links (Vercel refuses request
// bodies over 4.5 MB, and a few phone photos are more than that).
export async function uploadLink(id: string, stored: string): Promise<{ url: string; path: string }> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(objectPath(id, stored), { upsert: true });
  if (error || !data) throw new Error(`Could not prepare upload: ${error?.message ?? "no link"}`);
  return { url: data.signedUrl, path: data.path };
}

export async function saveUpload(id: string, stored: string, bytes: Buffer, mime: string) {
  const { error } = await db().storage.from(BUCKET).upload(objectPath(id, stored), bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Could not store ${stored}: ${error.message}`);
}

// Uploaded pages never change, so each one is fetched from storage once per server instance.
const g = globalThis as { __pageBytes?: Map<string, Buffer> };
const pageBytes = (g.__pageBytes ??= new Map<string, Buffer>());

export async function readUpload(id: string, stored: string): Promise<Buffer> {
  const key = objectPath(id, stored);
  const cached = pageBytes.get(key);
  if (cached) return cached;
  const { data, error } = await db().storage.from(BUCKET).download(key);
  if (error || !data) throw new Error(`Could not read ${stored}: ${error?.message ?? "missing"}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (pageBytes.size > 60) pageBytes.clear();
  pageBytes.set(key, bytes);
  return bytes;
}

// Every paid AI call, with its cost. A failed write is logged loudly but never stops the student's work.
export async function appendUsage(row: Record<string, unknown>) {
  const { error } = await db()
    .from("usage")
    .insert({
      at: typeof row.at === "string" ? row.at : new Date().toISOString(),
      paper_id: typeof row.paperId === "string" ? row.paperId : null,
      step: typeof row.step === "string" ? row.step : null,
      model: typeof row.model === "string" ? row.model : null,
      usd: typeof row.usd === "number" ? row.usd : null,
      row,
    });
  if (error) console.error("[usage] could not record a cost row", error.message, row);
}

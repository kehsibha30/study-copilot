import { createHash } from "node:crypto";
import { db } from "./db";
import { fingerprintText, labelForText, mayFeedBank, textOfLabel, type KQuestion } from "./keycore";
import type { Paper } from "./store";

// Saved answers (decision 20 Nov 2026). Only answers a person or the paper itself vouched for are saved:
// the paper's printed key (rank 1), an answer key page (rank 2), a parent's book answer (rank 3).
// Never the AI's own answers. Per family: this database holds only this family's papers.
// If the table has not been created yet (supabase/schema.sql), everything here quietly does nothing.

export type BankRank = 1 | 2 | 3;
export type BankHit = { answerText: string; rank: number; from: string };

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);
const fp = (q: KQuestion) => {
  const t = fingerprintText(q);
  return t ? hash(t) : null;
};

export { mayFeedBank };

let warned = false;
function missing(error: { message: string; code?: string } | null) {
  if (!error) return false;
  if (!warned) {
    warned = true;
    console.error(`[bank] saved answers are off: ${error.message}`);
  }
  return true;
}

export async function lookupBank(questions: KQuestion[]): Promise<Map<number, { label: string; from: string }>> {
  const out = new Map<number, { label: string; from: string }>();
  const wanted = questions.map((q) => ({ q, f: fp(q) })).filter((x): x is { q: KQuestion; f: string } => Boolean(x.f));
  if (wanted.length === 0) return out;
  const { data, error } = await db()
    .from("verified_answers")
    .select("fingerprint, answer_text, rank, from_title")
    .in("fingerprint", wanted.map((x) => x.f));
  if (missing(error) || !data) return out;
  const byFp = new Map<string, BankHit>(data.map((r) => [r.fingerprint as string, { answerText: r.answer_text as string, rank: r.rank as number, from: (r.from_title as string) ?? "an earlier paper" }]));
  for (const { q, f } of wanted) {
    const hit = byFp.get(f);
    const label = hit ? labelForText(q, hit.answerText) : null;
    if (hit && label) out.set(q.n, { label, from: hit.from });
  }
  return out;
}

// answers: question number -> the label of the vouched-for answer on this paper.
export async function saveToBank(paper: Paper, answers: Record<string, string>, rank: BankRank): Promise<number> {
  if (!mayFeedBank(paper)) return 0;
  let saved = 0;
  for (const q of paper.questions ?? []) {
    const f = fp(q);
    const label = answers[String(q.n)];
    const text = label ? textOfLabel(q, label) : null;
    if (!f || !text) continue;
    const { error } = await db().rpc("save_verified_answer", { p_fp: f, p_text: text, p_rank: rank, p_from: paper.title.slice(0, 120) });
    if (missing(error)) return saved;
    saved++;
  }
  return saved;
}

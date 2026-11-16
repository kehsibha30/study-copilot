import { cardById, topicById } from "@/lib/speed/cards";
import type { Mark, RunResult, SpeedRun } from "@/lib/speed/stats";
import { loadRun, submitRun } from "@/lib/speed/run";

export type SpeedView = {
  id: string;
  kind: SpeedRun["kind"];
  topic: string | null;
  topicLabel: string;
  cardTitle: string | null;
  questions: { q: string }[];
  submitted: boolean;
  result: RunResult | null;
  // After hand-in only: every question with what he typed and the answer. The answers are never sent before.
  review: { q: string; said: string; a: string; how: string; mark: Mark; ms: number; card: string }[] | null;
};

function view(run: SpeedRun): SpeedView {
  const done = Boolean(run.submittedAt && run.result);
  return {
    id: run.id,
    kind: run.kind,
    topic: run.topic,
    topicLabel: run.kind === "daily" ? "Today's round" : (run.topic && topicById(run.topic)?.label) || "Speed",
    cardTitle: run.card ? (cardById(run.card)?.title ?? null) : null,
    questions: run.questions.map((q) => ({ q: q.q })),
    submitted: done,
    result: done ? run.result! : null,
    review: done
      ? run.questions.map((q, i) => ({ q: q.q, said: run.answers?.[String(i)] ?? "", a: q.a, how: q.how, mark: run.result!.marks[i], ms: run.times?.[String(i)] ?? 0, card: cardById(q.card)?.title ?? "" }))
      : null,
  };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await loadRun(id);
  if (!run) return Response.json({ error: "We could not find that drill." }, { status: 404 });
  return Response.json({ run: view(run) });
}

// Hands the drill in: all answers and the quiet time per question arrive together, and are marked here.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { answers?: Record<string, unknown>; times?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  try {
    const run = await submitRun(id, body.answers ?? {}, body.times ?? {});
    if (!run) return Response.json({ error: "We could not find that drill." }, { status: 404 });
    return Response.json({ run: view(run) });
  } catch (error) {
    console.error(`[speed ${id}] could not hand in`, error);
    return Response.json({ error: "Your answers did not save. Press Hand in again." }, { status: 500 });
  }
}

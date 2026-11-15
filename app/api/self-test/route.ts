import { after, connection } from "next/server";
import { buildSelfTest, listSelfTests, marks, sources, startRecheck, startSelfTest, type TopicPick } from "@/lib/selftest";
import { workOn } from "@/lib/workon";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

// The topics a set can be made from, and the sets already made.
export async function GET() {
  await connection();
  const report = await workOn();
  const open = new Set(report.subjects.flatMap((s) => s.topics.filter((t) => t.concepts.length > 0).map((t) => `${s.name}|${t.name}`)));
  const topics = new Map<string, { subject: string; topic: string; ideas: string[]; open: boolean }>();
  for (const s of await sources()) {
    const key = `${s.subject}|${s.topic}`;
    const row = topics.get(key) ?? { subject: s.subject, topic: s.topic, ideas: [], open: open.has(key) };
    row.ideas.push(s.name);
    topics.set(key, row);
  }
  const sets = (await listSelfTests()).map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    status: t.status,
    submitted: Boolean(t.submittedAt),
    recheck: Boolean(t.recheck),
    excluded: Boolean(t.excluded),
    topics: t.topics.map((x) => x.topic),
    total: t.questions.length,
    ...marks(t),
  }));
  return Response.json({ topics: [...topics.values()].sort((a, b) => Number(b.open) - Number(a.open)), sets });
}

// Starts writing a new set. Safe against a double tap: the second call returns the same set.
export async function POST(request: Request) {
  let body: { topics?: unknown; recheck?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  // A recheck: one new question for each idea whose check is due. Which ideas is decided here, not by the browser.
  if (body.recheck === true) {
    const check = await startRecheck((await workOn()).due.map((c) => c.name));
    if (!check) return Response.json({ error: "No checks are due right now." }, { status: 400 });
    if (check.status === "building") after(() => buildSelfTest(check.id));
    return Response.json({ id: check.id });
  }
  const topics = Array.isArray(body.topics) ? (body.topics as TopicPick[]) : [];
  if (topics.length === 0) return Response.json({ error: "Pick at least one topic." }, { status: 400 });
  const test = await startSelfTest(topics, (await workOn()).keep);
  if (!test) return Response.json({ error: "There is nothing to test on these topics yet." }, { status: 400 });
  if (test.status === "building") after(() => buildSelfTest(test.id));
  return Response.json({ id: test.id });
}

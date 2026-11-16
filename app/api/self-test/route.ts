import { after, connection } from "next/server";
import { buildSelfTest, lastPaperForMix, listSelfTests, marks, sources, startChapter, startMixed, startRecheck, startSelfTest, type TopicPick } from "@/lib/selftest";
import { SYLLABUS } from "@/lib/syllabus";
import { workOn } from "@/lib/workon";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

export type ChapterRow = { topic: string; status: "to_fix" | "getting_there" | "strong" | "tried" | "not_tried"; line: string };

// Everything the Practice screen needs: one suggested set, the other ways to practise, and earlier sets.
export async function GET() {
  await connection();
  const report = await workOn();

  // The suggestion: new questions on the ideas still open (not fixed yet, or slipped), grouped by chapter.
  const openNames = new Set(report.ideas.filter((c) => c.status === "needs_work" || c.status === "slipped").map((c) => c.name.trim().toLowerCase()));
  const weak = (await sources()).filter((s) => openNames.has(s.name.trim().toLowerCase())).slice(0, 6);
  const weakTopics: TopicPick[] = [];
  for (const s of weak) if (!weakTopics.some((t) => t.subject === s.subject && t.topic === s.topic)) weakTopics.push({ subject: s.subject, topic: s.topic });

  const mix = await lastPaperForMix();

  // Chapters per subject: the NCERT list, plus any chapter seen on his papers or practised.
  const fromPapers = new Map(report.subjects.map((s) => [s.name, s.topics]));
  const practised = new Map(report.practice.map((p) => [`${p.subject}|${p.topic}`, p]));
  const subjects = [...new Set([...Object.keys(SYLLABUS), ...report.subjects.map((s) => s.name).filter((n) => n !== "Other")])].map((name) => {
    const seen = fromPapers.get(name) ?? [];
    // One row per chapter: a name seen twice (on a paper and in the NCERT list, say) is shown once.
    const names: string[] = [];
    for (const n of [...seen.map((t) => t.name).filter((t) => t !== "Not sorted yet"), ...(SYLLABUS[name] ?? []), ...report.practice.filter((p) => p.subject === name).map((p) => p.topic)]) {
      if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    }
    const chapters: ChapterRow[] = names.map((topic) => {
      const row = seen.find((t) => t.name === topic);
      const p = practised.get(`${name}|${topic}`);
      const practiceLine = p ? `${p.right} of ${p.total} right in practice` : "";
      if (row && row.concepts.length > 0) return { topic, status: "to_fix", line: `${row.concepts.length} ${row.concepts.length === 1 ? "idea" : "ideas"} to fix` };
      if (row && row.status === "checking") return { topic, status: "getting_there", line: "Fixed, waiting for a check" };
      if (row && row.status === "strong") return { topic, status: "strong", line: "Right across papers" };
      if (p && p.total >= 4 && p.right / p.total >= 0.8) return { topic, status: "strong", line: practiceLine };
      if ((row && row.counted > 0) || p) return { topic, status: "tried", line: [row && row.counted > 0 ? `${row.right} of ${row.counted} right on papers` : "", practiceLine].filter(Boolean).join(" · ") };
      return { topic, status: "not_tried", line: row ? "On a paper, but not answered" : "No questions yet" };
    });
    const order: Record<ChapterRow["status"], number> = { to_fix: 0, getting_there: 1, tried: 2, strong: 3, not_tried: 4 };
    chapters.sort((a, b) => order[a.status] - order[b.status]);
    return { name, chapters };
  });

  const nextCheck = report.checking.map((c) => c.checkOn).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
  const sets = (await listSelfTests()).map((t) => ({
    id: t.id,
    createdAt: t.createdAt,
    status: t.status,
    submitted: Boolean(t.submittedAt),
    recheck: Boolean(t.recheck),
    mode: t.mode ?? "mistakes",
    basis: t.basis ?? null,
    excluded: Boolean(t.excluded),
    topics: t.topics.map((x) => x.topic),
    total: t.questions.length,
    ...marks(t),
  }));

  return Response.json({
    suggestion: weak.length ? { ideas: weak.map((s) => ({ name: s.name, subject: s.subject, topic: s.topic, paper: s.paperTitle })), topics: weakTopics } : null,
    mix: mix ? { title: mix.title, chapters: mix.topics.length } : null,
    check: { due: report.due.length, waiting: report.recheckWaiting, next: nextCheck },
    subjects,
    sets,
  });
}

// Starts writing a set. Safe against a double tap: the second call returns the same set.
export async function POST(request: Request) {
  let body: { mode?: unknown; topics?: unknown; recheck?: unknown; subject?: unknown; topic?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const begin = async (test: Awaited<ReturnType<typeof startSelfTest>>, none: string) => {
    if (!test) return Response.json({ error: none }, { status: 400 });
    if (test.status === "building") after(() => buildSelfTest(test.id));
    return Response.json({ id: test.id });
  };
  // A recheck: one new question for each idea whose check is due. Which ideas is decided here, not by the browser.
  if (body.recheck === true) return begin(await startRecheck((await workOn()).due.map((c) => c.name)), "No checks are due right now.");
  if (body.mode === "mixed") return begin(await startMixed(), "Upload a paper first, so the mix has something to copy.");
  if (body.mode === "chapter") {
    const subject = typeof body.subject === "string" ? body.subject : "";
    const topic = typeof body.topic === "string" ? body.topic : "";
    return begin(await startChapter(subject, topic), "Pick a chapter first.");
  }
  const topics = Array.isArray(body.topics) ? (body.topics as TopicPick[]) : [];
  if (topics.length === 0) return Response.json({ error: "Pick at least one topic." }, { status: 400 });
  return begin(await startSelfTest(topics, (await workOn()).keep), "There is nothing to practise on these topics yet.");
}

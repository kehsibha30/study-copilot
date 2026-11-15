import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { askJson, RefusalError, StepError } from "./claude";
import { stage, verdict } from "./grade";
import { DATA_DIR, appendUsage, listPapers, newId } from "./store";

// "Test yourself": a short set of new questions on the ideas the student got wrong on their papers.
// Every question is written by the AI and then solved blind by a second pass; a question the second
// pass disagrees with is dropped before the student sees it.

const DIR = path.join(DATA_DIR, "selftests");
const WANT = 10;
const BY_LEVEL: Record<number, number> = { 1: 3, 2: 4, 3: 3 };

export type TestQuestion = {
  concept: string;
  level: 1 | 2 | 3;
  text: string;
  options: { text: string; right: boolean }[];
  explain: string;
  // Set on a question from a topic the student is already good at. It checks the topic has not slipped.
  keep?: TopicPick;
};

export type TopicPick = { subject: string; topic: string };

export type SelfTest = {
  id: string;
  createdAt: string;
  status: "building" | "ready" | "failed";
  startedAt: string;
  error?: string;
  topics: TopicPick[];
  // A recheck: one new question for each of these ideas, some days after the student first got them right.
  recheck?: string[];
  // Topics the student is good at; the set carries one question from each (up to two).
  keep?: TopicPick[];
  questions: TestQuestion[];
  answers: Record<string, number>; // question index -> option index
  submittedAt?: string;
  flagged: number[];
  excluded?: boolean;
  cost: { usd: number; calls: number };
};

// ---------- storage: one file per set, on this computer ----------

function file(id: string) {
  if (!/^[a-z0-9]{6,20}$/.test(id)) throw new Error("Bad self-test id");
  return path.join(DIR, `${id}.json`);
}

export function loadSelfTest(id: string): SelfTest | null {
  try {
    const f = file(id);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as SelfTest) : null;
  } catch {
    return null;
  }
}

function save(test: SelfTest) {
  fs.mkdirSync(DIR, { recursive: true });
  const f = file(test.id);
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(test, null, 2));
  fs.renameSync(tmp, f);
}

function update(id: string, change: (t: SelfTest) => void): SelfTest {
  const test = loadSelfTest(id);
  if (!test) throw new Error("Self-test not found");
  change(test);
  save(test);
  return test;
}

export function listSelfTests(): SelfTest[] {
  if (!fs.existsSync(DIR)) return [];
  const out: SelfTest[] = [];
  for (const name of fs.readdirSync(DIR)) {
    if (!name.endsWith(".json")) continue;
    const t = loadSelfTest(name.replace(/\.json$/, ""));
    if (t) out.push(t);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- what the questions are built from: the ideas that went wrong on the student's papers ----------

export type Source = {
  name: string;
  explain: string;
  subject: string;
  topic: string;
  sample: string; // a question the student got wrong on this idea, for level and style only
  sampleText: string; // that question's own words, to catch near copies
  paperTitle: string;
  href: string; // the lesson on this idea
};

export function sources(): Source[] {
  const papers = listPapers()
    .filter((p) => !p.excluded && stage(p) === "done")
    .reverse(); // oldest first, so the latest paper has the last word
  const byName = new Map<string, Source>();
  for (const paper of papers) {
    const byN = new Map((paper.questions ?? []).map((q) => [q.n, q]));
    (paper.ideas ?? []).forEach((idea, index) => {
      if (idea.name === "Other mistakes") return;
      const wrong = idea.questions.map((n) => byN.get(n)).filter((q) => q && verdict(paper, q) === "wrong");
      const first = wrong[0];
      if (!first) return;
      byName.set(idea.name.trim().toLowerCase(), {
        name: idea.name,
        explain: idea.explain,
        subject: first.subject || first.section || "Other",
        topic: first.topic || "Not sorted yet",
        sample: `${first.text}\n${first.options.map((o) => `(${o.label}) ${o.text}`).join("\n")}${first.hasFigure ? "\n(This one had a figure.)" : ""}`,
        sampleText: first.text,
        paperTitle: paper.title,
        href: `/papers/${paper.id}/fix/${index}`,
      });
    });
  }
  return [...byName.values()];
}

function sourcesFor(topics: TopicPick[]): Source[] {
  return sources().filter((s) => topics.some((t) => t.subject === s.subject && t.topic === s.topic));
}

// ---------- one build per set, never two ----------

const g = globalThis as { __selfTestJobs?: Set<string> };
const jobs = (g.__selfTestJobs ??= new Set<string>());

export function startSelfTest(topics: TopicPick[], keep: TopicPick[] = []): SelfTest | null {
  const clean = topics.filter((t) => t && typeof t.subject === "string" && typeof t.topic === "string").slice(0, 12);
  if (sourcesFor(clean).length === 0) return null;
  // A double tap on Start must not build (and pay for) the same set twice.
  const same = (t: SelfTest) => !t.recheck && JSON.stringify(t.topics) === JSON.stringify(clean);
  const twin = listSelfTests().find((t) => same(t) && Date.now() - Date.parse(t.createdAt) < 60_000 && !t.submittedAt);
  if (twin) return twin;
  const extra = keep.filter((k) => !clean.some((t) => t.subject === k.subject && t.topic === k.topic)).slice(0, 2);
  return create({ topics: clean, ...(extra.length ? { keep: extra } : {}) });
}

// A recheck set: one new question for each idea that is due. A recheck that is waiting (not handed in, not
// left out) is returned as it is, so a second tap or a second visit never builds or pays for another one.
export function startRecheck(names: string[]): SelfTest | null {
  const waiting = listSelfTests().find((t) => t.recheck && !t.submittedAt && !t.excluded);
  if (waiting) return waiting;
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
  const ideas = sources().filter((s) => wanted.has(s.name.trim().toLowerCase())).slice(0, 6);
  if (ideas.length === 0) return null;
  const topics: TopicPick[] = [];
  for (const s of ideas) if (!topics.some((t) => t.subject === s.subject && t.topic === s.topic)) topics.push({ subject: s.subject, topic: s.topic });
  return create({ topics, recheck: ideas.map((s) => s.name) });
}

function create(parts: Pick<SelfTest, "topics" | "recheck" | "keep">): SelfTest {
  const now = new Date().toISOString();
  const test: SelfTest = {
    id: newId(),
    createdAt: now,
    startedAt: now,
    status: "building",
    ...parts,
    questions: [],
    answers: {},
    flagged: [],
    cost: { usd: 0, calls: 0 },
  };
  save(test);
  return test;
}

export function restartSelfTest(id: string): SelfTest | null {
  const test = loadSelfTest(id);
  if (!test || test.status !== "failed") return test;
  return update(id, (t) => {
    t.status = "building";
    t.startedAt = new Date().toISOString();
    delete t.error;
  });
}

// A build with no job behind it (the app was restarted) becomes "failed" so the screen offers Try again.
export function markSelfTestIfStalled(test: SelfTest): SelfTest {
  if (test.status !== "building" || jobs.has(test.id)) return test;
  if (Date.now() - Date.parse(test.startedAt) < 20_000) return test;
  return update(test.id, (t) => {
    t.status = "failed";
    t.error = "This stopped partway. Nothing is lost.";
  });
}

const SYSTEM =
  "You write practice questions for a school student in India, based on the ideas they got wrong on their own test papers. " +
  "Every question must be correct, have exactly one right option, and be answerable from its own words with no figure. " +
  "Use only facts that are taught at the student's class level. Never use real people's names. " +
  "Write for a 13-year-old: short plain sentences, no praise or scolding.";

const WriteSchema = z.object({
  questions: z.array(
    z.object({
      concept: z.string(),
      level: z.number(),
      text: z.string(),
      options: z.array(z.object({ text: z.string(), right: z.boolean() })),
      explain: z.string(),
    })
  ),
});

const CheckSchema = z.object({ answers: z.array(z.object({ q: z.number(), choice: z.number() })) });

// How much two questions share, by their words (0 to 1). Used to throw out a "new" question that is really
// one from the student's paper with a word changed. First seen 14 Nov 2026: 2 of 10 were near copies.
// Also used by the topic doubt box, to spot a lesson's new question typed in as a doubt.
export function overlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / Math.min(x.size, y.size);
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function buildSelfTest(id: string): Promise<void> {
  if (jobs.has(id)) return;
  jobs.add(id);
  try {
    const test = loadSelfTest(id);
    if (!test || test.status !== "building") return;
    try {
      const questions = await writeQuestions(test);
      update(id, (t) => {
        t.questions = questions;
        t.answers = {};
        t.flagged = [];
        t.status = "ready";
        delete t.error;
      });
    } catch (error) {
      const known = error instanceof StepError;
      if (!known) console.error(`[self-test ${id}] build failed`, error);
      update(id, (t) => {
        t.status = "failed";
        t.error = known ? (error as Error).message : "Something went wrong on our side. Try again.";
      });
    }
  } finally {
    jobs.delete(id);
  }
}

async function writeQuestions(test: SelfTest): Promise<TestQuestion[]> {
  const wanted = new Set((test.recheck ?? []).map((n) => n.trim().toLowerCase()));
  const ideas = (test.recheck ? sources().filter((s) => wanted.has(s.name.trim().toLowerCase())) : sourcesFor(test.topics)).slice(0, 6);
  if (ideas.length === 0) throw new StepError("There is nothing to test on these topics any more.");
  const ideaKeys = new Set(ideas.map((s) => s.name.trim().toLowerCase()));
  // Questions he has already had on these ideas, so a new set or a recheck is never one he has seen.
  const seen = listSelfTests()
    .filter((t) => t.id !== test.id)
    .flatMap((t) => t.questions.filter((q) => !q.keep && ideaKeys.has(q.concept.trim().toLowerCase())).map((q) => q.text))
    .slice(0, 30);
  const target = test.recheck ? ideas.length : WANT;
  const has = (list: TestQuestion[], name: string) => list.some((k) => k.concept === name);
  const names = new Map(ideas.map((s) => [s.name.trim().toLowerCase(), s.name]));
  const onCost = (usd: number) =>
    update(test.id, (t) => {
      t.cost.usd = Number((t.cost.usd + usd).toFixed(5));
      t.cost.calls += 1;
    });
  const titles = [...new Set(ideas.map((s) => s.paperTitle))].join("; ");
  const ideaList = ideas
    .map((s, i) => `Idea ${i + 1}: ${s.name}\nThe rule: ${s.explain}\nSubject and chapter: ${s.subject}, ${s.topic}\nA question the student got wrong on this idea (for level and style only; do not reuse it or its numbers):\n${s.sample}`)
    .join("\n\n");

  const kept: TestQuestion[] = [];
  for (let round = 1; round <= 2 && kept.length < target; round++) {
    const left = test.recheck ? ideas.filter((s) => !has(kept, s.name)) : ideas;
    const need = test.recheck ? left.length * 2 : round === 1 ? 12 : WANT - kept.length + 2;
    const spread = test.recheck
      ? `Write ${need} new multiple-choice questions: exactly 2 for each of these ideas: ${left.map((s) => s.name).join("; ")}.`
      : `Write ${need} new multiple-choice questions that test these ideas, spread as evenly as you can across the ideas.`;
    const levels = test.recheck
      ? "level: always 2. The question is as hard as the questions on the student's papers."
      : "level: 1, 2 or 3. Level 1 is a direct use of the idea. Level 2 is like the questions on the student's papers. Level 3 is harder: two steps, or the idea in a setting the student has not seen, still inside the syllabus for this class. Write about the same number at each level.";
    const done = [...kept.map((k) => k.text), ...seen];
    const out = await askJson({
      paperId: `selftest:${test.id}`,
      job: "lesson",
      step: `selftest-write-${round}`,
      schema: WriteSchema,
      effort: "medium",
      system: SYSTEM,
      onCost,
      content: [
        {
          type: "text",
          text: `The student's papers: ${titles}. Write for that class level.

${ideaList}

${spread}

For each question:
- concept: the idea it tests, spelled exactly as the idea name above.
- ${levels}
- text: the question. It must be answerable from its own words, with no figure. It must be a new question: a different situation, different examples and different options from the student's own question. Rewording that question, or asking its opposite with the same list or the same options, does not count.
- options: four options, exactly one right. Wrong options must be ones a student could really fall for. Do not use "all of these", "none of these", or options that refer to other options.
- explain: one or two sentences showing why the right option is right.

Check every fact and every piece of arithmetic. Maths in plain text (x^2, 3/4, 10^5).${
            done.length ? `\n\nThese are already written. Do not repeat them:\n${done.map((k) => `- ${k}`).join("\n")}` : ""
          }`,
        },
      ],
    });

    const drafted: TestQuestion[] = [];
    for (const q of out.questions) {
      const concept = names.get(q.concept.trim().toLowerCase());
      const options = q.options.map((o) => ({ text: o.text.trim(), right: o.right })).filter((o) => o.text);
      if (!concept || !q.text.trim() || options.length !== 4 || options.filter((o) => o.right).length !== 1) continue;
      // Not new: too close to a question from the student's paper, or to one already kept.
      const copies = (other: string) => overlap(q.text, other) >= 0.7;
      if (ideas.some((s) => copies(s.sampleText)) || done.some(copies) || drafted.some((d) => copies(d.text))) continue;
      const level = test.recheck ? 2 : q.level <= 1 ? 1 : q.level >= 3 ? 3 : 2;
      drafted.push({ concept, level, text: q.text.trim(), options: shuffle(options), explain: q.explain.trim() });
    }
    if (drafted.length === 0) continue;

    // The second solve cannot see which options were marked right. Anything it disagrees with is not used.
    try {
      const check = await askJson({
        paperId: `selftest:${test.id}`,
        job: "verify",
        step: `selftest-check-${round}`,
        schema: CheckSchema,
        effort: "medium",
        system: SYSTEM,
        onCost,
        content: [
          {
            type: "text",
            text: `Solve each question. Give the number of the option that is correct, or 0 if the question has no single correct option, is unclear, or uses a fact that is wrong.

${drafted.map((d, i) => `Question ${i + 1}: ${d.text}\n${d.options.map((o, j) => `  ${j + 1}. ${o.text}`).join("\n")}`).join("\n\n")}

Give only the numbers.`,
          },
        ],
      });
      drafted.forEach((d, i) => {
        const pick = check.answers.find((a) => a.q === i + 1)?.choice;
        if (pick === undefined || d.options[pick - 1]?.right !== true) return;
        // A recheck is one question per idea: the first that passes the check.
        if (test.recheck && has(kept, d.concept)) return;
        kept.push(d);
      });
    } catch (error) {
      // If the checker declines, nothing from this round counts as checked.
      if (!(error instanceof RefusalError)) throw error;
      console.error(`[self-test ${test.id}] check declined (${error.category ?? "no category"})`);
    }
  }

  if (kept.length === 0) throw new StepError("We could not write questions that passed our own check. Try again.");

  if (test.recheck) {
    appendUsage({ at: new Date().toISOString(), paperId: `selftest:${test.id}`, step: "recheck-built", wanted: ideas.length, used: kept.length, usd: 0 });
    return shuffle(kept);
  }

  // Three easy, four like the paper, three harder where the checked questions allow; then fill from what is left.
  const chosen: TestQuestion[] = [];
  const spare: TestQuestion[] = [];
  for (const level of [1, 2, 3] as const) {
    const at = kept.filter((k) => k.level === level);
    chosen.push(...at.slice(0, BY_LEVEL[level]));
    spare.push(...at.slice(BY_LEVEL[level]));
  }
  chosen.push(...spare.slice(0, Math.max(0, WANT - chosen.length)));
  const extra = await keepQuestions(test, [...chosen.map((c) => c.text), ...seen], onCost);
  appendUsage({ at: new Date().toISOString(), paperId: `selftest:${test.id}`, step: "selftest-built", written: kept.length, used: chosen.length, kept: extra.length, usd: 0 });
  return [...chosen, ...extra].sort((a, b) => a.level - b.level);
}

// One question from each topic the student is already good at (up to two), so the set also shows whether
// a strong topic has slipped. These are extra: if they cannot be written or checked, the set goes ahead without them.
async function keepQuestions(test: SelfTest, taken: string[], onCost: (usd: number) => void): Promise<TestQuestion[]> {
  const topics = (test.keep ?? []).slice(0, 2);
  if (topics.length === 0) return [];
  const papers = listPapers().filter((p) => !p.excluded && stage(p) === "done");
  const samples = topics.map((t) => {
    const qs = papers.flatMap((p) => (p.questions ?? []).filter((q) => (q.subject || q.section) === t.subject && q.topic === t.topic && !q.hasFigure && verdict(p, q) === "correct"));
    return { topic: t, texts: qs.slice(0, 3).map((q) => q.text) };
  });
  const usable = samples.filter((s) => s.texts.length > 0);
  if (usable.length === 0) return [];
  try {
    const out = await askJson({
      paperId: `selftest:${test.id}`,
      job: "lesson",
      step: "selftest-keep-write",
      schema: WriteSchema,
      effort: "medium",
      system: SYSTEM,
      onCost,
      content: [
        {
          type: "text",
          text: `The student's papers: ${[...new Set(papers.map((p) => p.title))].join("; ")}. Write for that class level.

The student does well on these chapters. Write 2 new multiple-choice questions for each chapter, as hard as the sample questions.

${usable.map((s, i) => `Chapter ${i + 1}: ${s.topic.subject}, ${s.topic.topic}\nQuestions from the student's papers on this chapter (for level and style only; do not reuse them):\n${s.texts.map((x) => `- ${x}`).join("\n")}`).join("\n\n")}

For each question:
- concept: the chapter name, spelled exactly as above (the part after the subject).
- level: always 2.
- text: the question. It must be answerable from its own words, with no figure, and must be a new question.
- options: four options, exactly one right. Wrong options must be ones a student could really fall for. Do not use "all of these", "none of these", or options that refer to other options.
- explain: one or two sentences showing why the right option is right.

Check every fact and every piece of arithmetic. Maths in plain text (x^2, 3/4, 10^5).`,
        },
      ],
    });
    const drafted: TestQuestion[] = [];
    for (const q of out.questions) {
      const s = usable.find((u) => u.topic.topic.trim().toLowerCase() === q.concept.trim().toLowerCase());
      const options = q.options.map((o) => ({ text: o.text.trim(), right: o.right })).filter((o) => o.text);
      if (!s || !q.text.trim() || options.length !== 4 || options.filter((o) => o.right).length !== 1) continue;
      const copies = (other: string) => overlap(q.text, other) >= 0.7;
      if (s.texts.some(copies) || taken.some(copies) || drafted.some((d) => copies(d.text))) continue;
      drafted.push({ concept: s.topic.topic, level: 2, text: q.text.trim(), options: shuffle(options), explain: q.explain.trim(), keep: s.topic });
    }
    if (drafted.length === 0) return [];
    const check = await askJson({
      paperId: `selftest:${test.id}`,
      job: "verify",
      step: "selftest-keep-check",
      schema: CheckSchema,
      effort: "medium",
      system: SYSTEM,
      onCost,
      content: [
        {
          type: "text",
          text: `Solve each question. Give the number of the option that is correct, or 0 if the question has no single correct option, is unclear, or uses a fact that is wrong.

${drafted.map((d, i) => `Question ${i + 1}: ${d.text}\n${d.options.map((o, j) => `  ${j + 1}. ${o.text}`).join("\n")}`).join("\n\n")}

Give only the numbers.`,
        },
      ],
    });
    const out2: TestQuestion[] = [];
    drafted.forEach((d, i) => {
      const pick = check.answers.find((a) => a.q === i + 1)?.choice;
      if (pick === undefined || d.options[pick - 1]?.right !== true) return;
      if (out2.some((k) => k.keep?.topic === d.keep?.topic && k.keep?.subject === d.keep?.subject)) return;
      out2.push(d);
    });
    return out2;
  } catch (error) {
    console.error(`[self-test ${test.id}] strong-topic questions skipped`, error);
    return [];
  }
}

// ---------- moves ----------

export type TestAct =
  | { type: "answer"; index: number; choice: number }
  | { type: "submit" }
  | { type: "flag"; index: number }
  | { type: "exclude"; excluded: boolean };

export function actSelfTest(id: string, a: TestAct): SelfTest {
  return update(id, (t) => {
    if (a.type === "exclude") {
      if (a.excluded) t.excluded = true;
      else delete t.excluded;
      return;
    }
    if (t.status !== "ready") return;
    if (a.type === "answer") {
      if (!t.submittedAt && t.questions[a.index]?.options[a.choice]) t.answers[String(a.index)] = a.choice;
    } else if (a.type === "submit") {
      if (!t.submittedAt) t.submittedAt = new Date().toISOString();
    } else if (a.type === "flag") {
      if (!t.submittedAt || !t.questions[a.index]) return;
      t.flagged = t.flagged.includes(a.index) ? t.flagged.filter((x) => x !== a.index) : [...t.flagged, a.index];
    }
  });
}

export function marks(t: SelfTest): { right: number; counted: number } {
  let right = 0;
  let counted = 0;
  t.questions.forEach((q, i) => {
    if (t.flagged.includes(i)) return;
    counted++;
    if (q.options[t.answers[String(i)]]?.right) right++;
  });
  return { right, counted };
}

// ---------- what the browser may see: no answers before the set is handed in ----------

const LEVELS = { 1: "Warm-up", 2: "Like your paper", 3: "Harder" } as const;
const KEEP = "From a topic you do well on";

export type SelfTestView = {
  id: string;
  createdAt: string;
  status: SelfTest["status"];
  error: string | null;
  topics: TopicPick[];
  recheck: boolean;
  submitted: boolean;
  excluded: boolean;
  costUsd: number;
  questions: {
    level: string;
    text: string;
    chosen: number | null;
    options: { text: string; right: boolean | null }[];
    // Only once handed in:
    concept: string | null;
    explain: string | null;
    flagged: boolean;
    lesson: string | null;
  }[];
  result: { right: number; counted: number; next: { name: string; href: string } | null } | null;
};

export function selfTestView(t: SelfTest): SelfTestView {
  const done = Boolean(t.submittedAt);
  const lessons = new Map(sources().map((s) => [s.name.trim().toLowerCase(), s.href]));
  const questions = t.questions.map((q, i) => {
    const chosen = t.answers[String(i)];
    return {
      level: q.keep ? KEEP : LEVELS[q.level],
      text: q.text,
      chosen: chosen === undefined ? null : chosen,
      options: q.options.map((o) => ({ text: o.text, right: done ? o.right : null })),
      // The idea's name can give the answer away, so it is held back until the set is handed in.
      concept: done ? q.concept : null,
      explain: done ? q.explain : null,
      flagged: t.flagged.includes(i),
      lesson: done && !q.keep ? lessons.get(q.concept.trim().toLowerCase()) ?? null : null,
    };
  });
  let result: SelfTestView["result"] = null;
  if (done) {
    const missed = t.questions.find((q, i) => !q.keep && !t.flagged.includes(i) && !q.options[t.answers[String(i)]]?.right);
    const href = missed ? lessons.get(missed.concept.trim().toLowerCase()) : undefined;
    result = { ...marks(t), next: missed && href ? { name: missed.concept, href } : null };
  }
  return {
    id: t.id,
    createdAt: t.createdAt,
    status: t.status,
    error: t.error ?? null,
    topics: t.topics,
    recheck: Boolean(t.recheck),
    submitted: done,
    excluded: Boolean(t.excluded),
    costUsd: t.cost.usd,
    questions: t.status === "ready" ? questions : [],
    result,
  };
}

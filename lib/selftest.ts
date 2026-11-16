import { z } from "zod";
import { askJson, RefusalError, StepError } from "./claude";
import { stage, verdict } from "./grade";
import { STALE_MS, appendUsage, listPapers } from "./store";
import { CLASS_LEVEL } from "./syllabus";
import { createHash } from "node:crypto";
import { insertDoc, listDocs, loadDoc, updateDoc } from "./db";

// Practice (was "Test yourself"): a short set of new questions on the ideas the student got wrong on their papers.
// Every question is written by the AI and then solved blind by a second pass; a question the second
// pass disagrees with is dropped before the student sees it.

const WANT = 10;
export const MAX_QUESTION_MS = 5 * 60_000;
// The pace he is measured against: about one minute a question, as in NEET.
export const PACE_MS = 60_000;
const BY_LEVEL: Record<number, number> = { 1: 3, 2: 4, 3: 3 };

export type TestQuestion = {
  concept: string;
  level: 1 | 2 | 3;
  text: string;
  // why and trap: set on wrong options. why: what mistake leads to this option. trap: that mistake as a short name,
  // reused across sets so the Report can count the traps he falls into again and again.
  options: { text: string; right: boolean; why?: string; trap?: string }[];
  explain: string;
  // Set on a question from a topic the student is already good at. It checks the topic has not slipped.
  keep?: TopicPick;
  // Set on "mixed" and "chapter" questions: the chapter it is on. Its result counts towards that chapter's practice score.
  topic?: TopicPick;
};

export type TopicPick = { subject: string; topic: string };

export type SelfTest = {
  id: string;
  createdAt: string;
  status: "building" | "ready" | "failed";
  startedAt: string;
  error?: string;
  job?: string; // the background build holding the lock
  topics: TopicPick[];
  // A recheck: one new question for each of these ideas, some days after the student first got them right.
  recheck?: string[];
  // Topics the student is good at; the set carries one question from each (up to two).
  keep?: TopicPick[];
  questions: TestQuestion[];
  answers: Record<string, number>; // question index -> option index
  submittedAt?: string;
  flagged: number[];
  // Active time on each question in ms (question index -> ms), measured in the browser while the question is on screen
  // and the app is in front. One question counts at most MAX_QUESTION_MS. Only before hand-in.
  times?: Record<string, number>;
  excluded?: boolean;
  // mistakes (the default): new questions on ideas he got wrong. mixed: all the chapters of his latest paper, at
  // its level. chapter: one chapter from the syllabus, which may have no paper behind it yet.
  mode?: "mistakes" | "mixed" | "chapter";
  basis?: string; // mixed: the paper the set copies; chapter: "Subject: chapter"
  cost: { usd: number; calls: number };
};

// ---------- storage: one row per set, table self_tests ----------

function validId(id: string) {
  return /^[a-z0-9]{6,20}$/.test(id);
}

export async function loadSelfTest(id: string): Promise<SelfTest | null> {
  if (!validId(id)) return null;
  return loadDoc<SelfTest>("self_tests", id);
}

async function update(id: string, change: (t: SelfTest) => void): Promise<SelfTest> {
  return (await updateDoc<SelfTest>("self_tests", id, change)).doc;
}

export async function listSelfTests(): Promise<SelfTest[]> {
  // Speed drills share the table (ids start with "speed-") and are not practice sets.
  const tests = (await listDocs<SelfTest>("self_tests")).filter((t) => !t.id.startsWith("speed-"));
  return tests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export async function sources(): Promise<Source[]> {
  const papers = (await listPapers())
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

async function sourcesFor(topics: TopicPick[]): Promise<Source[]> {
  return (await sources()).filter((s) => topics.some((t) => t.subject === s.subject && t.topic === s.topic));
}

// ---------- one build per set, never two ----------

// The lock is on the set in the database (job), so a double tap or a second server never builds it twice.
function buildingNow(t: SelfTest) {
  return Boolean(t.job) && Date.now() - Date.parse(t.startedAt) < STALE_MS;
}

export async function startSelfTest(topics: TopicPick[], keep: TopicPick[] = []): Promise<SelfTest | null> {
  const clean = topics.filter((t) => t && typeof t.subject === "string" && typeof t.topic === "string").slice(0, 12);
  if ((await sourcesFor(clean)).length === 0) return null;
  // A double tap on Start must not build (and pay for) the same set twice.
  const same = (t: SelfTest) => !t.recheck && JSON.stringify(t.topics) === JSON.stringify(clean);
  const twin = (await listSelfTests()).find((t) => same(t) && Date.now() - Date.parse(t.createdAt) < 60_000 && !t.submittedAt);
  if (twin) return twin;
  const extra = keep.filter((k) => !clean.some((t) => t.subject === k.subject && t.topic === k.topic)).slice(0, 2);
  return await create({ topics: clean, ...(extra.length ? { keep: extra } : {}) });
}

// A recheck set: one new question for each idea that is due. A recheck that is waiting (not handed in, not
// left out) is returned as it is, so a second tap or a second visit never builds or pays for another one.
export async function startRecheck(names: string[]): Promise<SelfTest | null> {
  const waiting = (await listSelfTests()).find((t) => t.recheck && !t.submittedAt && !t.excluded);
  if (waiting) return waiting;
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()));
  const ideas = (await sources()).filter((s) => wanted.has(s.name.trim().toLowerCase())).slice(0, 6);
  if (ideas.length === 0) return null;
  const topics: TopicPick[] = [];
  for (const s of ideas) if (!topics.some((t) => t.subject === s.subject && t.topic === s.topic)) topics.push({ subject: s.subject, topic: s.topic });
  return await create({ topics, recheck: ideas.map((s) => s.name) });
}

// A twin made in the last minute and not handed in is returned, so a double tap never pays twice.
async function twinOf(mode: SelfTest["mode"], basis: string): Promise<SelfTest | null> {
  return (await listSelfTests()).find((t) => t.mode === mode && t.basis === basis && !t.submittedAt && Date.now() - Date.parse(t.createdAt) < 60_000) ?? null;
}

// "Mixed, like my last paper": every chapter that had a counted question on his latest paper.
export async function lastPaperForMix(): Promise<{ title: string; topics: TopicPick[] } | null> {
  const paper = (await listPapers()).find((p) => !p.excluded && stage(p) === "done");
  if (!paper) return null;
  const topics: TopicPick[] = [];
  for (const q of paper.questions ?? []) {
    const subject = q.subject || q.section || "Other";
    const topic = q.topic || "";
    const v = verdict(paper, q);
    if (!topic || q.type !== "mcq" || (v !== "correct" && v !== "wrong")) continue;
    if (!topics.some((t) => t.subject === subject && t.topic === topic)) topics.push({ subject, topic });
  }
  return topics.length ? { title: paper.title, topics: topics.slice(0, 8) } : null;
}

export async function startMixed(): Promise<SelfTest | null> {
  const last = await lastPaperForMix();
  if (!last) return null;
  return (await twinOf("mixed", last.title)) ?? (await create({ topics: last.topics, mode: "mixed", basis: last.title }));
}

export async function startChapter(subject: string, topic: string): Promise<SelfTest | null> {
  const clean = { subject: subject.trim().slice(0, 60), topic: topic.trim().slice(0, 120) };
  if (!clean.subject || !clean.topic) return null;
  const basis = `${clean.subject}: ${clean.topic}`;
  return (await twinOf("chapter", basis)) ?? (await create({ topics: [clean], mode: "chapter", basis }));
}

// Creates a set. Two taps on the same thing within the same minute give the same id, and the database refuses
// a second row with that id, so a double tap can never create (and pay for) two sets. Found 16 Nov 2026:
// a "is there a twin already?" check let two requests through at once, and both sets were written and paid for.
async function create(parts: Pick<SelfTest, "topics" | "recheck" | "keep" | "mode" | "basis">): Promise<SelfTest> {
  const now = new Date().toISOString();
  const what = JSON.stringify([parts.mode ?? "mistakes", parts.recheck ?? null, parts.basis ?? null, parts.topics]);
  const id = createHash("sha256").update(`${what}|${Math.floor(Date.now() / 60_000)}`).digest("hex").slice(0, 12);
  const test: SelfTest = {
    id,
    createdAt: now,
    startedAt: now,
    status: "building",
    ...parts,
    questions: [],
    answers: {},
    flagged: [],
    cost: { usd: 0, calls: 0 },
  };
  if (await insertDoc("self_tests", test)) return test;
  return (await loadSelfTest(id)) ?? test;
}

export async function restartSelfTest(id: string): Promise<SelfTest | null> {
  const test = await loadSelfTest(id);
  if (!test || test.status !== "failed") return test;
  return await update(id, (t) => {
    t.status = "building";
    t.startedAt = new Date().toISOString();
    delete t.error;
  });
}

// A build with no job behind it (the app was restarted) becomes "failed" so the screen offers Try again.
export async function markSelfTestIfStalled(test: SelfTest): Promise<SelfTest> {
  if (test.status !== "building" || buildingNow(test)) return test;
  // Not yet claimed: give the background request time to start.
  if (!test.job && Date.now() - Date.parse(test.startedAt) < 45_000) return test;
  return await update(test.id, (t) => {
    if (t.status !== "building" || buildingNow(t)) return;
    t.status = "failed";
    t.error = "This stopped partway. Nothing is lost.";
  });
}

const SYSTEM =
  "You write practice questions for a school student in India, based on the ideas they got wrong on their own test papers. " +
  "Every question must be correct, have exactly one right option, and be answerable from its own words with no figure. " +
  "Use only facts that are taught at the student's class level. Do not use real people's names, except scientists and discoverers that the NCERT book itself names. " +
  "Write for a 13-year-old: short plain sentences, no praise or scolding.";

const WriteSchema = z.object({
  questions: z.array(
    z.object({
      concept: z.string(),
      level: z.number(),
      text: z.string(),
      options: z.array(z.object({ text: z.string(), right: z.boolean(), why: z.string(), trap: z.string() })),
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
  const job = Math.random().toString(36).slice(2, 12);
  const { doc: test, changed } = await updateDoc<SelfTest>("self_tests", id, (t) => {
    if (t.status !== "building" || buildingNow(t)) return false;
    t.job = job;
    t.startedAt = new Date().toISOString();
    return true;
  });
  if (!changed) return;
  try {
    try {
      const questions = test.mode === "mixed" || test.mode === "chapter" ? await writeTopicQuestions(test) : await writeQuestions(test);
      await update(id, (t) => {
        t.questions = questions;
        t.answers = {};
        t.flagged = [];
        t.status = "ready";
        delete t.error;
      });
    } catch (error) {
      const known = error instanceof StepError;
      if (!known) console.error(`[self-test ${id}] build failed`, error);
      await update(id, (t) => {
        t.status = "failed";
        t.error = known ? (error as Error).message : "Something went wrong on our side. Try again.";
      });
    }
  } finally {
    await update(id, (t) => {
      if (t.job === job) delete t.job;
    }).catch((error) => console.error(`[self-test ${id}] could not release the build lock`, error));
  }
}

async function writeQuestions(test: SelfTest): Promise<TestQuestion[]> {
  const wanted = new Set((test.recheck ?? []).map((n) => n.trim().toLowerCase()));
  const ideas = (test.recheck ? (await sources()).filter((s) => wanted.has(s.name.trim().toLowerCase())) : await sourcesFor(test.topics)).slice(0, 6);
  if (ideas.length === 0) throw new StepError("There is nothing to test on these topics any more.");
  const ideaKeys = new Set(ideas.map((s) => s.name.trim().toLowerCase()));
  // Questions he has already had on these ideas, so a new set or a recheck is never one he has seen.
  const seen = (await listSelfTests())
    .filter((t) => t.id !== test.id)
    .flatMap((t) => t.questions.filter((q) => !q.keep && ideaKeys.has(q.concept.trim().toLowerCase())).map((q) => q.text))
    .slice(0, 30);
  const traps = trapsOf((await listSelfTests()).flatMap((t) => t.questions.filter((q) => !q.keep && ideaKeys.has(q.concept.trim().toLowerCase()))));
  const target = test.recheck ? ideas.length : WANT;
  const has = (list: TestQuestion[], name: string) => list.some((k) => k.concept === name);
  const names = new Map(ideas.map((s) => [s.name.trim().toLowerCase(), s.name]));
  const onCost = async (usd: number) =>
    await update(test.id, (t) => {
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
  For each wrong option, why: one sentence starting "This is what you get if you" that names the mistake leading to it; and trap: that mistake as a short name of at most 6 plain words (for example "Thinks pressure is the same at every depth"). Use the same trap name whenever the same mistake applies. For the right option, why and trap are empty strings.
- explain: one or two sentences showing why the right option is right.

Check every fact and every piece of arithmetic. Maths in plain text (x^2, 3/4, 10^5).${trapHint(traps)}${
            done.length ? `\n\nThese are already written. Do not repeat them:\n${done.map((k) => `- ${k}`).join("\n")}` : ""
          }`,
        },
      ],
    });

    const drafted: TestQuestion[] = [];
    for (const q of out.questions) {
      const concept = names.get(q.concept.trim().toLowerCase());
      const options = q.options.map((o) => ({ text: o.text.trim(), right: o.right, ...(o.right ? {} : { why: o.why.trim(), trap: o.trap.trim() }) })).filter((o) => o.text);
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
    await appendUsage({ at: new Date().toISOString(), paperId: `selftest:${test.id}`, step: "recheck-built", wanted: ideas.length, used: kept.length, usd: 0 });
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
  await appendUsage({ at: new Date().toISOString(), paperId: `selftest:${test.id}`, step: "selftest-built", written: kept.length, used: chosen.length, kept: extra.length, usd: 0 });
  return [...chosen, ...extra].sort((a, b) => a.level - b.level);
}

// "Mixed" and "chapter" sets: new questions on whole chapters, not on ideas he got wrong. Each is checked by a
// second, blind solve like every other set; a question it disagrees with is dropped before he sees it.
async function writeTopicQuestions(test: SelfTest): Promise<TestQuestion[]> {
  const topics = test.topics.slice(0, 8);
  if (topics.length === 0) throw new StepError("There is nothing to practise here.");
  const key = (t: TopicPick) => `${t.subject}|${t.topic}`.toLowerCase();
  const wanted = new Set(topics.map(key));
  const papers = (await listPapers()).filter((p) => !p.excluded && stage(p) === "done");
  // Questions from his own papers on these chapters: for level and style only, and to catch near copies.
  const samples = new Map<string, string[]>();
  for (const p of papers) {
    for (const q of p.questions ?? []) {
      const k = key({ subject: q.subject || q.section || "Other", topic: q.topic || "" });
      if (!wanted.has(k) || q.hasFigure || q.type !== "mcq") continue;
      const list = samples.get(k) ?? [];
      if (list.length < 2) list.push(`${q.text}\n${q.options.map((o) => `(${o.label}) ${o.text}`).join("\n")}`);
      samples.set(k, list);
    }
  }
  const sampleTexts = [...samples.values()].flat();
  const seen = (await listSelfTests())
    .filter((t) => t.id !== test.id)
    .flatMap((t) => t.questions.filter((q) => q.topic && wanted.has(key(q.topic))).map((q) => q.text))
    .slice(0, 40);
  const names = new Map(topics.map((t) => [t.topic.trim().toLowerCase(), t]));
  const traps = trapsOf((await listSelfTests()).flatMap((t) => t.questions.filter((q) => q.topic && wanted.has(key(q.topic)))));
  const onCost = async (usd: number) =>
    await update(test.id, (t) => {
      t.cost.usd = Number((t.cost.usd + usd).toFixed(5));
      t.cost.calls += 1;
    });
  const level = test.mode === "mixed" && test.basis ? `the level of the student's paper "${test.basis}"` : CLASS_LEVEL;
  const chapterList = topics
    .map((t, i) => {
      const own = samples.get(key(t)) ?? [];
      return `Chapter ${i + 1}: ${t.topic} (${t.subject})${own.length ? `\nQuestions from the student's own papers on this chapter (for level and style only; do not reuse them or their numbers):\n${own.map((x) => `- ${x}`).join("\n")}` : ""}`;
    })
    .join("\n\n");

  const kept: TestQuestion[] = [];
  for (let round = 1; round <= 2 && kept.length < WANT; round++) {
    const need = round === 1 ? 12 : WANT - kept.length + 2;
    const done = [...kept.map((k) => k.text), ...seen];
    const out = await askJson({
      paperId: `selftest:${test.id}`,
      job: "lesson",
      step: `selftest-${test.mode}-write-${round}`,
      schema: WriteSchema,
      effort: "medium",
      system: SYSTEM,
      onCost,
      content: [
        {
          type: "text",
          text: `Write practice questions for a student in ${CLASS_LEVEL}, at ${level}.

${chapterList}

Write ${need} new multiple-choice questions${topics.length > 1 ? ", spread as evenly as you can across the chapters" : " on this chapter"}. Cover the main ideas a school test on ${topics.length > 1 ? "these chapters" : "this chapter"} would ask about, using only what the NCERT book for this class teaches.

For each question:
- concept: the chapter it is on, spelled exactly as the chapter name above (without the subject).
- level: 1, 2 or 3. Level 1 is a direct use of one idea. Level 2 is like a school test question. Level 3 is harder: two steps, or an idea in a new setting, still inside this class's syllabus. Write about the same number at each level.
- text: the question. It must be answerable from its own words, with no figure.
- options: four options, exactly one right. Wrong options must be ones a student could really fall for. Do not use "all of these", "none of these", or options that refer to other options.
  For each wrong option, why: one sentence starting "This is what you get if you" that names the mistake leading to it; and trap: that mistake as a short name of at most 6 plain words (for example "Thinks pressure is the same at every depth"). Use the same trap name whenever the same mistake applies. For the right option, why and trap are empty strings.
- explain: one or two sentences showing why the right option is right.

Check every fact and every piece of arithmetic. Maths in plain text (x^2, 3/4, 10^5).${trapHint(traps)}${done.length ? `\n\nThese are already written or already seen by the student. Do not repeat them:\n${done.map((k) => `- ${k}`).join("\n")}` : ""}`,
        },
      ],
    });

    const drafted: TestQuestion[] = [];
    for (const q of out.questions) {
      const topic = names.get(q.concept.trim().toLowerCase());
      const options = q.options.map((o) => ({ text: o.text.trim(), right: o.right, ...(o.right ? {} : { why: o.why.trim(), trap: o.trap.trim() }) })).filter((o) => o.text);
      if (!topic || !q.text.trim() || options.length !== 4 || options.filter((o) => o.right).length !== 1) continue;
      const copies = (other: string) => overlap(q.text, other) >= 0.7;
      if (sampleTexts.some(copies) || done.some(copies) || drafted.some((d) => copies(d.text))) continue;
      drafted.push({ concept: topic.topic, level: q.level <= 1 ? 1 : q.level >= 3 ? 3 : 2, text: q.text.trim(), options: shuffle(options), explain: q.explain.trim(), topic });
    }
    if (drafted.length === 0) continue;
    try {
      const check = await askJson({
        paperId: `selftest:${test.id}`,
        job: "verify",
        step: `selftest-${test.mode}-check-${round}`,
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
        if (pick !== undefined && d.options[pick - 1]?.right === true) kept.push(d);
      });
    } catch (error) {
      if (!(error instanceof RefusalError)) throw error;
      console.error(`[self-test ${test.id}] check declined (${error.category ?? "no category"})`);
    }
  }
  if (kept.length === 0) throw new StepError("We could not write questions that passed our own check. Try again.");

  const chosen: TestQuestion[] = [];
  const spare: TestQuestion[] = [];
  for (const lv of [1, 2, 3] as const) {
    const at = kept.filter((k) => k.level === lv);
    chosen.push(...at.slice(0, BY_LEVEL[lv]));
    spare.push(...at.slice(BY_LEVEL[lv]));
  }
  chosen.push(...spare.slice(0, Math.max(0, WANT - chosen.length)));
  await appendUsage({ at: new Date().toISOString(), paperId: `selftest:${test.id}`, step: `selftest-${test.mode}-built`, written: kept.length, used: chosen.length, usd: 0 });
  return chosen.sort((a, b) => a.level - b.level);
}

// Trap names already used on these questions, so the writer reuses them and the Report can count repeats.
function trapsOf(questions: TestQuestion[]): string[] {
  const out: string[] = [];
  for (const q of questions) for (const o of q.options) if (o.trap && !out.some((x) => x.toLowerCase() === o.trap!.toLowerCase())) out.push(o.trap);
  return out.slice(0, 20);
}

function trapHint(traps: string[]): string {
  return traps.length ? `\n\nTrap names already used for these ideas or chapters. When a wrong option comes from one of these mistakes, use its name exactly:\n${traps.map((t) => `- ${t}`).join("\n")}` : "";
}

// One question from each topic the student is already good at (up to two), so the set also shows whether
// a strong topic has slipped. These are extra: if they cannot be written or checked, the set goes ahead without them.
async function keepQuestions(test: SelfTest, taken: string[], onCost: (usd: number) => void): Promise<TestQuestion[]> {
  const topics = (test.keep ?? []).slice(0, 2);
  if (topics.length === 0) return [];
  const papers = (await listPapers()).filter((p) => !p.excluded && stage(p) === "done");
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
  For each wrong option, why: one sentence starting "This is what you get if you" that names the mistake leading to it; and trap: that mistake as a short name of at most 6 plain words (for example "Thinks pressure is the same at every depth"). Use the same trap name whenever the same mistake applies. For the right option, why and trap are empty strings.
- explain: one or two sentences showing why the right option is right.

Check every fact and every piece of arithmetic. Maths in plain text (x^2, 3/4, 10^5).`,
        },
      ],
    });
    const drafted: TestQuestion[] = [];
    for (const q of out.questions) {
      const s = usable.find((u) => u.topic.topic.trim().toLowerCase() === q.concept.trim().toLowerCase());
      const options = q.options.map((o) => ({ text: o.text.trim(), right: o.right, ...(o.right ? {} : { why: o.why.trim(), trap: o.trap.trim() }) })).filter((o) => o.text);
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
  | { type: "exclude"; excluded: boolean }
  | { type: "time"; index: number; ms: number };

export async function actSelfTest(id: string, a: TestAct): Promise<SelfTest> {
  return await update(id, (t) => {
    if (a.type === "exclude") {
      if (a.excluded) t.excluded = true;
      else delete t.excluded;
      return;
    }
    if (t.status !== "ready") return;
    if (a.type === "time") {
      // Time is added only while the set is open, and capped per question so a phone left on the table does not count.
      if (t.submittedAt || !t.questions[a.index] || !(a.ms > 0)) return;
      t.times ??= {};
      const k = String(a.index);
      t.times[k] = Math.min(MAX_QUESTION_MS, (t.times[k] ?? 0) + Math.min(a.ms, MAX_QUESTION_MS));
      return;
    }
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
  mode: "mistakes" | "mixed" | "chapter";
  basis: string | null;
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
    ms: number | null; // time on this question, once handed in (null if not timed)
    why: string | null; // for a wrong pick: what mistake usually leads to that option
  }[];
  // Once handed in, and only if the set was timed.
  timing: {
    totalMs: number;
    paceMs: number; // PACE_MS for each question
    usualMs: number; // his usual time per question, across every timed set so far
    split: { quickRight: number; slowRight: number; quickWrong: number; slowWrong: number };
  } | null;
  result: { right: number; counted: number; next: { name: string; href: string } | null } | null;
};

// His usual time per question: the middle value of every timed question he has handed in. Falls back to the pace.
async function usualTime(): Promise<number> {
  const all: number[] = [];
  for (const t of await listSelfTests()) {
    if (!t.submittedAt || t.excluded || !t.times) continue;
    t.questions.forEach((_, i) => {
      const ms = t.times?.[String(i)];
      if (ms && !t.flagged.includes(i)) all.push(ms);
    });
  }
  if (all.length < 3) return PACE_MS;
  all.sort((a, b) => a - b);
  return all[Math.floor(all.length / 2)];
}

export async function selfTestView(t: SelfTest): Promise<SelfTestView> {
  const done = Boolean(t.submittedAt);
  const lessons = new Map((await sources()).map((s) => [s.name.trim().toLowerCase(), s.href]));
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
      ms: done && t.times?.[String(i)] ? t.times[String(i)] : null,
      why: done && chosen !== undefined && !q.options[chosen]?.right ? q.options[chosen]?.why ?? null : null,
      lesson: done && !q.keep && !q.topic ? lessons.get(q.concept.trim().toLowerCase()) ?? null : null,
    };
  });
  let timing: SelfTestView["timing"] = null;
  if (done && t.times && Object.keys(t.times).length > 0) {
    const usualMs = await usualTime();
    const split = { quickRight: 0, slowRight: 0, quickWrong: 0, slowWrong: 0 };
    let totalMs = 0;
    t.questions.forEach((q, i) => {
      const ms = t.times?.[String(i)];
      if (!ms || t.flagged.includes(i)) return;
      totalMs += ms;
      const right = Boolean(q.options[t.answers[String(i)]]?.right);
      const quick = ms <= usualMs;
      if (right && quick) split.quickRight++;
      else if (right) split.slowRight++;
      else if (quick) split.quickWrong++;
      else split.slowWrong++;
    });
    timing = { totalMs, paceMs: PACE_MS * t.questions.length, usualMs, split };
  }
  let result: SelfTestView["result"] = null;
  if (done) {
    const missed = t.questions.find((q, i) => !q.keep && !q.topic && !t.flagged.includes(i) && !q.options[t.answers[String(i)]]?.right);
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
    mode: t.mode ?? "mistakes",
    basis: t.basis ?? null,
    submitted: done,
    excluded: Boolean(t.excluded),
    costUsd: t.cost.usd,
    questions: t.status === "ready" ? questions : [],
    result,
    timing,
  };
}

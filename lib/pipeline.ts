import fs from "node:fs";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { askJson, RefusalError, StepError } from "./claude";
import { norm } from "./grade";
import { pageOf } from "./pages";
import { filePath, listPapers, loadPaper, updatePaper, type Idea, type KeyEntry, type MistakeNote, type Paper, type Question, type StepName } from "./store";

type Content = Anthropic.Beta.BetaContentBlockParam[];

// ---------- one background job per paper, never two ----------

const g = globalThis as { __paperJobs?: Set<string> };
const jobs = (g.__paperJobs ??= new Set<string>());

export function isRunning(id: string) {
  return jobs.has(id);
}

export function nextStep(p: Paper): StepName | null {
  if (!p.questions) return "read";
  if (!p.key) return "solve";
  // Tagging runs just before the mistakes are grouped, so a paper nobody finishes costs nothing extra.
  if (p.answersSubmitted && !p.analysed) return p.tagged ? "analyse" : "tag";
  return null;
}

const LABELS: Record<StepName, string> = {
  read: "Reading your paper and finding the questions",
  solve: "Working out the answers",
  tag: "Sorting the questions by subject and topic",
  analyse: "Grouping your mistakes by idea",
};

// Does whatever the paper needs next, one step at a time, and records a clear error if a step fails.
// Safe to call any number of times: a second call while one is running does nothing.
export async function advance(id: string): Promise<void> {
  if (jobs.has(id)) return;
  jobs.add(id);
  try {
    updatePaper(id, (p) => {
      delete p.error;
    });
    for (;;) {
      const paper = loadPaper(id);
      if (!paper) return;
      const step = nextStep(paper);
      if (!step) break;
      updatePaper(id, (p) => {
        p.running = { step, startedAt: new Date().toISOString(), label: LABELS[step] };
      });
      try {
        if (step === "read") await readPaper(paper);
        else if (step === "solve") await solvePaper(paper);
        else if (step === "tag") await tagPaper(paper);
        else await analysePaper(paper);
      } catch (error) {
        const known = error instanceof StepError;
        if (!known) console.error(`[paper ${id}] step ${step} failed`, error);
        updatePaper(id, (p) => {
          delete p.running;
          p.error = {
            step,
            at: new Date().toISOString(),
            message: known
              ? (error as Error).message
              : "Something went wrong on our side. Your paper is saved. Continue to try again.",
          };
        });
        return;
      }
    }
    updatePaper(id, (p) => {
      delete p.running;
    });
  } finally {
    jobs.delete(id);
  }
  // Answers may have been submitted in the instant between the last check and the job ending.
  const after = loadPaper(id);
  if (after && !after.error && nextStep(after)) return advance(id);
}

// A paper that needs work but has no job (the app was restarted mid-way) is marked as stopped,
// so the screen shows "Continue" instead of a spinner that never ends. Viewing never starts work.
export function markIfStalled(paper: Paper): Paper {
  if (paper.error || !nextStep(paper) || isRunning(paper.id)) return paper;
  const since = Date.parse(paper.running?.startedAt ?? paper.createdAt);
  if (Date.now() - since < 20_000) return paper;
  return updatePaper(paper.id, (p) => {
    const step = nextStep(p) ?? "read";
    delete p.running;
    p.error = { step, at: new Date().toISOString(), message: "This stopped partway. Your paper and answers are saved." };
  });
}

// ---------- the paper itself, sent the same way every time so it is cached ----------

// cache: true marks the paper for reuse by later calls of the same kind. It costs a little more on the
// first call, so it is only switched on where several calls follow each other (the solving step).
function paperBlocks(paper: Paper, cache = false): Content {
  const blocks: Content = paper.files.map((f) => {
    const data = fs.readFileSync(filePath(paper.id, f.stored)).toString("base64");
    if (f.mime === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    return {
      type: "image",
      source: { type: "base64", media_type: f.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data },
    };
  });
  const last = blocks[blocks.length - 1];
  if (cache && last && (last.type === "document" || last.type === "image")) last.cache_control = { type: "ephemeral" };
  return blocks;
}

// ---------- step 1: read ----------

const ReadSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      n: z.number(),
      section: z.string(),
      type: z.enum(["mcq", "written"]),
      text: z.string(),
      options: z.array(z.object({ label: z.string(), text: z.string() })),
      has_figure: z.boolean(),
      page: z.number(),
      marked_answer: z.string().nullable(),
      cut_off: z.boolean(),
    })
  ),
  printed_key: z.array(z.object({ n: z.number(), answer: z.string() })),
  page_problems: z.array(z.object({ page: z.number(), problem: z.string() })),
});

const READ_PROMPT = `This is a test paper a student uploaded (a PDF, or photos of the pages in order).

List every question on it, in order.

For each question:
- n: the question number printed on the paper.
- section: the subject or section heading it sits under (for example "Physics"). Use "" if there is none.
- type: "mcq" if it has options to choose from, otherwise "written".
- text: the full question, word for word. Write maths in plain text (x^2, 3/4, 10^-5, sqrt(2)). If a figure, table or graph is part of the question, do not describe it; just set has_figure.
- options: each option's label exactly as printed, without brackets or dots ("1", "2" or "A", "B"), and its text. If an option is a picture, use the text "(picture)". Empty list for written questions.
- has_figure: true if the question or any option depends on a figure, diagram, table or graph.
- page: the page (or photo) number it is on, counting from 1.
- marked_answer: the option label the student has marked on the paper for this question (a tick, a circle, a filled bubble, a handwritten letter or number next to it, or highlighter pen over one option). null if nothing is marked or you are not sure. A smear of highlighter that runs across several options or several questions is not an answer. Do not guess.
- cut_off: true if part of the question or its options is cut off, covered or too blurry to read fully.

printed_key: only if the paper itself prints an answer key, list each question number with its answer label. Otherwise an empty list. Never work out answers yourself here.

page_problems: for any page that is cut off at an edge, blurry or badly lit so that something cannot be read, give the page number and one short plain sentence saying what is wrong. Otherwise an empty list.

title: a short name for this paper taken from its heading, at most 8 words (for example "Periodic Test 1, Maths, Class 8").`;

// "SECTION-A : PHYSICS" -> "Physics"
function tidySection(raw: string) {
  const name = raw.replace(/^\s*section\s*[-–]?\s*[a-z0-9]+\s*[:\-–]\s*/i, "").trim();
  if (name && name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return name;
}

async function readPaper(paper: Paper) {
  const out = await askJson({
    paperId: paper.id,
    job: "read",
    step: "read",
    schema: ReadSchema,
    effort: "medium",
    content: [...paperBlocks(paper), { type: "text", text: READ_PROMPT }],
  });

  const seen = new Set<number>();
  const questions: Question[] = [];
  for (const q of [...out.questions].sort((a, b) => a.n - b.n)) {
    if (seen.has(q.n)) continue;
    seen.add(q.n);
    const options = q.options.map((o) => ({ label: norm(o.label), text: o.text.trim() })).filter((o) => o.label);
    const type = q.type === "mcq" && options.length >= 2 ? "mcq" : "written";
    const marked = norm(q.marked_answer);
    questions.push({
      n: q.n,
      section: tidySection(q.section),
      type,
      text: q.text.trim(),
      options: type === "mcq" ? options : [],
      hasFigure: q.has_figure,
      page: q.page,
      markedAnswer: type === "mcq" && options.some((o) => o.label === marked) ? marked : null,
      cutOff: q.cut_off,
    });
  }
  if (questions.length === 0) {
    throw new StepError("We could not find any questions in this file. Check that it is a test paper and that the pages are clear, then upload it again.");
  }

  const printedKey: Record<string, string> = {};
  for (const k of out.printed_key) {
    const q = questions.find((x) => x.n === k.n);
    const label = norm(k.answer);
    if (q && q.options.some((o) => o.label === label)) printedKey[String(k.n)] = label;
  }

  updatePaper(paper.id, (p) => {
    p.title = out.title.trim() || p.title;
    p.questions = questions;
    p.printedKey = printedKey;
    p.pageProblems = out.page_problems;
    // Answers found on the paper are filled in for the student to check.
    for (const q of questions) {
      if (q.markedAnswer && !p.answers[String(q.n)]) p.answers[String(q.n)] = q.markedAnswer;
    }
  });

  // The same marked paper has come back with no marks at all (14 Nov 2026: 10, 11, 11, then 0 on four reads of
  // one file). So a read that finds none is followed by one look that does nothing but find the marks.
  if (!questions.some((q) => q.markedAnswer) && questions.some((q) => q.type === "mcq")) {
    try {
      await lookForMarks(paper.id);
    } catch (error) {
      // The paper is read; a failed second look only means the student taps the answers in.
      console.error(`[paper ${paper.id}] second look for marks failed`, error);
    }
  }
}

const MarksSchema = z.object({ marks: z.array(z.object({ n: z.number(), answer: z.string() })) });

// Looks at the paper only for the student's own marks, and fills in the ones found where no answer is chosen yet.
// Returns how many it found. Never solves a question.
export async function lookForMarks(id: string): Promise<number> {
  const paper = loadPaper(id);
  if (!paper?.questions) throw new StepError("This paper is still being read.");
  if (paper.answersSubmitted) return 0;
  updatePaper(id, (p) => {
    p.marksLooks = (p.marksLooks ?? 0) + 1;
  });
  const mcq = paper.questions.filter((q) => q.type === "mcq");
  const out = await askJson({
    paperId: id,
    job: "read",
    step: "read-marks",
    schema: MarksSchema,
    effort: "medium",
    content: [
      ...paperBlocks(paper),
      {
        type: "text",
        text: `This is a test paper a student may have marked their answers on: a tick, a circle, a filled bubble, a handwritten letter or number, or highlighter pen over one option.

Go through questions ${mcq[0].n} to ${mcq[mcq.length - 1].n}, page by page. For each question where exactly one option is clearly marked by the student, give:
- n: the question number.
- answer: the label of the marked option exactly as printed, without brackets ("1", "2" or "A", "B").

Leave out every question with no mark, with more than one option marked, or where you are not sure. A smear of highlighter that runs across several options or several questions is not an answer. A highlighted or circled question number alone is not an answer. The printed answer key, if the paper has one, is not the student's marks. Do not solve any question.`,
      },
    ],
  });
  let found = 0;
  updatePaper(id, (p) => {
    for (const m of out.marks) {
      const q = p.questions?.find((x) => x.n === m.n);
      const label = norm(m.answer);
      if (!q || q.type !== "mcq" || !q.options.some((o) => o.label === label)) continue;
      q.markedAnswer = label;
      found++;
      if (!p.answersSubmitted && !p.answers[String(q.n)]) p.answers[String(q.n)] = label;
    }
  });
  return found;
}

// ---------- step 2: answer key (printed if the paper has one, otherwise solved twice) ----------

const SolveSchema = z.object({
  answers: z.array(z.object({ n: z.number(), answer: z.string().nullable() })),
});

// Two different ways in, so that two matching answers mean something.
const SOLVE_A = "Work out your own answer to each one first, then find the option that matches it.";
const SOLVE_B = "For each one, test every option against the question and rule out the ones that cannot be right.";

function solvePrompt(qs: Question[], approach: string) {
  return `Using the paper above, work out the correct option for these questions: ${qs.map((q) => q.n).join(", ")}.

${approach}
Read any figure from the page itself.
The pages may carry a student's own ticks, circles or highlighter. Those are the student's answers and may be wrong. Take no account of them.

For each question give:
- n: the question number.
- answer: the label of the correct option exactly as printed, without brackets ("1", "2" or "A", "B"). Use null if the question cannot be answered from the page (unreadable, cut off, no correct option, or more than one correct option).

Give only the question numbers and answers.`;
}

async function solvePaper(paper: Paper) {
  const questions = paper.questions ?? [];
  const mcq = questions.filter((q) => q.type === "mcq");
  const printed = paper.printedKey ?? {};
  const toSolve = mcq.filter((q) => !printed[String(q.n)]);

  const key: Record<string, KeyEntry> = {};
  for (const q of mcq) {
    if (printed[String(q.n)]) key[String(q.n)] = { answer: printed[String(q.n)], source: "printed" };
  }

  if (toSolve.length > 0) {
    const chunks: Question[][] = [];
    for (let i = 0; i < toSolve.length; i += 20) chunks.push(toSolve.slice(i, i + 20));
    const blocks = paperBlocks(paper, true);
    const tasks = chunks.flatMap((qs, i) => [
      { qs, pass: "a" as const, name: `solve-a-${i + 1}`, approach: SOLVE_A },
      { qs, pass: "b" as const, name: `solve-b-${i + 1}`, approach: SOLVE_B },
    ]);
    // Parts finished on an earlier attempt are kept; only the missing ones are run.
    const parts: Record<string, Record<string, string>> = { ...(paper.solveParts ?? {}) };
    const progress = () =>
      updatePaper(paper.id, (p) => {
        p.solveParts = parts;
        if (p.running) {
          p.running.label = `Solving each question twice to be sure (${Object.keys(parts).length} of ${tasks.length} parts done)`;
        }
      });
    const run = async (t: (typeof tasks)[number]) => {
      const got: Record<string, string> = {};
      try {
        const out = await askJson({
          paperId: paper.id,
          job: "solve",
          step: t.name,
          schema: SolveSchema,
          effort: "high",
          content: [...blocks, { type: "text", text: solvePrompt(t.qs, t.approach) }],
        });
        for (const a of out.answers) {
          const label = norm(a.answer);
          const q = t.qs.find((x) => x.n === a.n);
          if (q && q.options.some((o) => o.label === label)) got[String(a.n)] = label;
        }
      } catch (error) {
        // If the AI declines one part, those questions simply stay "not counted". Other failures stop the step.
        if (!(error instanceof RefusalError)) throw error;
        console.error(`[paper ${paper.id}] ${t.name} declined (${error.category ?? "no category"})`);
      }
      parts[t.name] = got;
      progress();
    };
    const queue = tasks.filter((t) => !parts[t.name]);
    // The first call goes alone so the paper is stored once; the rest then reuse it at a tenth of the price.
    const first = queue.shift();
    if (first) await run(first);
    const worker = async () => {
      for (let t = queue.shift(); t; t = queue.shift()) await run(t);
    };
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));

    const found = { a: new Map<number, string>(), b: new Map<number, string>() };
    for (const t of tasks) {
      for (const [n, label] of Object.entries(parts[t.name] ?? {})) found[t.pass].set(Number(n), label);
    }

    for (const q of toSolve) {
      const a = found.a.get(q.n);
      const b = found.b.get(q.n);
      key[String(q.n)] = a && a === b ? { answer: a, source: "solved" } : { answer: null, source: "unsure" };
    }
  }

  updatePaper(paper.id, (p) => {
    p.key = key;
  });
}

// ---------- step 3: subject and topic for every question ----------

export const SUBJECTS = ["Physics", "Chemistry", "Biology", "Maths", "Mental ability", "Other"] as const;

const TagSchema = z.object({
  tags: z.array(z.object({ n: z.number(), subject: z.enum(SUBJECTS), topic: z.string() })),
});

// Papers that count towards the student's record (not this one, not test runs).
function otherPapers(id: string): Paper[] {
  return listPapers().filter((p) => p.id !== id && !p.excluded);
}

// Works from the question text alone, so it does not pay to re-read the paper.
async function tagPaper(paper: Paper) {
  const mcq = (paper.questions ?? []).filter((q) => q.type === "mcq");
  const known = new Map<string, Map<string, string>>(); // subject -> lower-case topic -> topic as first written
  for (const other of otherPapers(paper.id)) {
    for (const q of other.questions ?? []) {
      if (!q.subject || !q.topic) continue;
      const topics = known.get(q.subject) ?? new Map<string, string>();
      if (!topics.has(q.topic.toLowerCase())) topics.set(q.topic.toLowerCase(), q.topic);
      known.set(q.subject, topics);
    }
  }
  const tags = new Map<number, { subject: string; topic: string }>();
  if (mcq.length > 0) {
    const knownList = [...known.entries()].map(([s, t]) => `${s}: ${[...t.values()].join("; ")}`).join("\n");
    const list = mcq.map((q) => `${q.n}. ${q.section ? `[${q.section}] ` : ""}${q.text.slice(0, 300)}`).join("\n");
    try {
      const out = await askJson({
        paperId: paper.id,
        job: "read",
        step: "tag",
        schema: TagSchema,
        effort: "low",
        content: [
          {
            type: "text",
            text: `These are questions from a school test paper. For each one give:
- n: the question number.
- subject: Physics, Chemistry, Biology, Maths, Mental ability (reasoning and puzzles), or Other.
- topic: the chapter it belongs to, named the way a school textbook names it, in at most 4 words (for example "Light", "Acids, Bases and Salts", "Linear Equations"). Name the chapter, not the detail asked.
${knownList ? `\nTopic names already used for this student. Use one of these, spelled exactly the same, whenever it is the same chapter:\n${knownList}\n` : ""}
Questions:
${list}`,
          },
        ],
      });
      for (const t of out.tags) {
        const topic = t.topic.trim().slice(0, 60);
        if (!topic) continue;
        tags.set(t.n, { subject: t.subject, topic: known.get(t.subject)?.get(topic.toLowerCase()) ?? topic });
      }
    } catch (error) {
      // If the AI declines, the paper carries on; its questions show under "Not sorted yet".
      if (!(error instanceof RefusalError)) throw error;
      console.error(`[paper ${paper.id}] tagging declined (${error.category ?? "no category"})`);
    }
  }
  updatePaper(paper.id, (p) => {
    for (const q of p.questions ?? []) {
      const t = tags.get(q.n);
      if (t) {
        q.subject = t.subject;
        q.topic = t.topic;
      }
    }
    p.tagged = true;
  });
}

// ---------- step 4: group the mistakes by idea ----------

const AnalyseSchema = z.object({
  mistakes: z.array(
    z.object({
      n: z.number(),
      why_key_right: z.string(),
      also_acceptable: z.boolean(),
      idea: z.string(),
      why_tempting: z.string(),
    })
  ),
  ideas: z.array(z.object({ name: z.string(), explain: z.string(), questions: z.array(z.number()) })),
});

// "Both (1) & (2)" or "All of the above": the labels of the options it stands for. null for an ordinary option.
function combinedParts(q: Question, label: string): string[] | null {
  const option = q.options.find((o) => o.label === label);
  if (!option) return null;
  const others = q.options.filter((o) => o.label !== label).map((o) => o.label);
  if (/\b(all|each)\s+of\s+(the\s+)?(above|these)\b/i.test(option.text)) return others;
  // Only "Both ..." counts. A bare "(1) and (2)" may be pointing at numbered statements, not at options.
  if (!/\bboth\b/i.test(option.text)) return null;
  const named = new Set<string>();
  for (const m of option.text.matchAll(/\(\s*([a-z0-9]{1,3})\s*\)|\b([a-d]|[1-9])\b/gi)) {
    const l = norm(m[1] ?? m[2]);
    if (others.includes(l)) named.add(l);
  }
  return named.size >= 2 ? [...named] : null;
}

const AlsoRightSchema = z.object({ accepted: z.boolean() });

// With no printed key, "we say (1), the student said Both (1) and (2)" is the case where our own answer is
// most likely to differ from the book's. Each extra part of the student's option is judged on its own, without
// the other options in view. If every part would be accepted in a school book, the question is not counted.
// Found on 14 Nov 2026: "reversible change" against "both reversible and physical", which a printed key accepts.
async function studentChoiceAlsoRight(paper: Paper, q: Question): Promise<boolean> {
  const entry = paper.key?.[String(q.n)];
  if (entry?.source !== "solved" || !entry.answer) return false;
  const parts = combinedParts(q, norm(paper.answers[String(q.n)]));
  const ours = norm(entry.answer);
  if (!parts || !parts.includes(ours)) return false;
  const page = await pageOf(paper, q);
  for (const label of parts.filter((l) => l !== ours)) {
    const option = q.options.find((o) => o.label === label);
    if (!option) return false;
    try {
      const out = await askJson({
        paperId: paper.id,
        job: "analyse",
        step: `also-right-${q.n}-${label}`,
        schema: AlsoRightSchema,
        effort: "medium",
        content: [
          ...page,
          {
            type: "text",
            text: `A school test question, and one proposed answer to it.

Question: ${q.text}${q.hasFigure ? "\n(The question's figure is on the page provided.)" : ""}
Proposed answer: ${option.text}

accepted: would school textbooks and coaching material at this class level accept the proposed answer as a correct answer to this question? Judge by how the topic is commonly taught at school, even if a stricter reading would add exceptions. true if it would be accepted, false if it is wrong or is not what is taught.`,
          },
        ],
      });
      if (!out.accepted) return false;
    } catch (error) {
      // If the check is declined we cannot be sure, and unsure means not counted.
      if (!(error instanceof RefusalError)) throw error;
      console.error(`[paper ${paper.id}] also-right check for question ${q.n} declined (${error.category ?? "no category"})`);
    }
  }
  return true;
}

// The AI's own answer to each question the student got wrong against a printed key, worked out in a call that is
// told neither the student's choice nor the key. If it differs from the printed key the question is not counted.
// Before 14 Nov 2026 this was asked inside the grouping call, which is told "the student chose X": on one run it
// gave the student's choice back for all three wrong questions, so every mistake on the paper was thrown out.
async function ownAnswers(paper: Paper, wrong: Question[]): Promise<Map<number, string>> {
  const own = new Map<number, string>();
  const printed = wrong.filter((q) => paper.key?.[String(q.n)]?.source === "printed");
  // Where the key is our own two agreeing solves, that is already the AI's answer.
  for (const q of wrong) {
    const entry = paper.key?.[String(q.n)];
    if (entry?.source === "solved" && entry.answer) own.set(q.n, norm(entry.answer));
  }
  for (let i = 0; i < printed.length; i += 20) {
    const qs = printed.slice(i, i + 20);
    try {
      const out = await askJson({
        paperId: paper.id,
        job: "solve",
        step: `own-answer-${i / 20 + 1}`,
        schema: SolveSchema,
        effort: "high",
        content: [...paperBlocks(paper), { type: "text", text: solvePrompt(qs, SOLVE_A) }],
      });
      for (const a of out.answers) {
        const label = norm(a.answer);
        const q = qs.find((x) => x.n === a.n);
        if (q && q.options.some((o) => o.label === label)) own.set(q.n, label);
      }
    } catch (error) {
      // If this check is declined the printed key stands on its own, as it does for a question the AI cannot answer.
      if (!(error instanceof RefusalError)) throw error;
      console.error(`[paper ${paper.id}] own-answer check declined (${error.category ?? "no category"})`);
    }
  }
  return own;
}

async function analysePaper(paper: Paper) {
  const questions = paper.questions ?? [];
  const allWrong = questions.filter((q) => {
    if (q.type !== "mcq") return false;
    const entry = paper.key?.[String(q.n)];
    const mine = norm(paper.answers[String(q.n)]);
    return Boolean(entry?.answer) && entry?.source !== "unsure" && mine !== "" && mine !== norm(entry?.answer);
  });

  // Questions where the student's own choice could also be the book's answer are set aside before grouping.
  const setAside: MistakeNote[] = [];
  const wrong: Question[] = [];
  for (const q of allWrong) {
    if (await studentChoiceAlsoRight(paper, q)) {
      setAside.push({ n: q.n, idea: "", whyTempting: "", aiAnswer: paper.key?.[String(q.n)]?.answer ?? null, disputed: true });
    } else wrong.push(q);
  }

  if (wrong.length === 0) {
    updatePaper(paper.id, (p) => {
      p.notes = setAside;
      p.ideas = [];
      p.analysed = true;
    });
    return;
  }

  // Idea names from earlier papers, so the same weak spot carries the same name every time it comes up.
  const earlier = [...new Set(otherPapers(paper.id).flatMap((o) => (o.ideas ?? []).map((i) => i.name)))]
    .filter((name) => name !== "Other mistakes")
    .slice(0, 60);

  const list = wrong
    .map((q) => `Question ${q.n}: the student chose ${paper.answers[String(q.n)]}; the answer key says ${paper.key?.[String(q.n)]?.answer}.`)
    .join("\n");

  const out = await askJson({
    paperId: paper.id,
    job: "analyse",
    step: "analyse",
    schema: AnalyseSchema,
    effort: "medium",
    content: [
      ...paperBlocks(paper),
      {
        type: "text",
        text: `A student took the paper above and got these questions wrong:

${list}

For each of these questions:
- n: the question number.
- why_key_right: one sentence on why the answer key's option is the right one, worked out from the question and its figure.
- also_acceptable: could the option the student chose be the answer printed in a school textbook or coaching answer key for this question, as it is worded? Judge by what books at this class level say, not by the strictest reading. true when the question is loosely worded so that the student's option can be defended as well as the key's, or when the student chose a combined option (such as "Both (1) and (2)") that includes the key's answer and whose other part is also commonly taught as true for this question. false if any part of the student's option is wrong for the question as asked. Most wrong answers are simply wrong; use true only when a teacher could fairly accept the student's option.
- idea: the one concept or skill the student needs to get this question right, as a short name of at most 6 plain words (for example "Measure angles from the normal"). It is the idea in why_key_right, the one that leads to the key's option, never the idea behind the option the student chose. Name the idea, not the topic: "Pressure grows with depth", not "Pressure".
- why_tempting: one sentence on why the option the student chose looks right. Say what it would mean if it were true. No scolding, no "you".

${earlier.length ? `Idea names already used on this student's earlier papers:\n${earlier.map((n) => `- ${n}`).join("\n")}\nIf a question went wrong for one of these same reasons, use that name, spelled exactly the same, instead of writing a new one. Write a new name only when none of them fits.\n\n` : ""}Then ideas: group the questions that went wrong for the same underlying reason, even across subjects. Use exactly the idea names you gave above. Do not force unrelated questions together; an idea with one question is fine. Every question in the list above must appear in exactly one idea.
- name: the idea name.
- explain: one plain sentence that states the correct idea, so that reading it would help with every question in the group.
- questions: the question numbers.`,
      },
    ],
  });

  const own = await ownAnswers(paper, wrong);

  const wrongSet = new Set(wrong.map((q) => q.n));
  const notes: MistakeNote[] = out.mistakes
    .filter((m) => wrongSet.has(m.n))
    .map((m) => ({
      n: m.n,
      idea: m.idea.trim(),
      whyTempting: m.why_tempting.trim(),
      aiAnswer: own.get(m.n) ?? null,
      // A printed key always decides. Only an answer we worked out ourselves can be put in doubt this way.
      ...(m.also_acceptable && paper.key?.[String(m.n)]?.source === "solved" ? { disputed: true } : {}),
    }));

  const placed = new Set<number>();
  const ideas: Idea[] = [];
  for (const idea of out.ideas) {
    const qs = idea.questions.filter((n) => wrongSet.has(n) && !placed.has(n));
    qs.forEach((n) => placed.add(n));
    if (qs.length) ideas.push({ name: idea.name.trim(), explain: idea.explain.trim(), questions: qs });
  }
  const left = wrong.map((q) => q.n).filter((n) => !placed.has(n));
  if (left.length) ideas.push({ name: "Other mistakes", explain: "These did not fit one clear idea.", questions: left });
  ideas.sort((a, b) => b.questions.length - a.questions.length);

  updatePaper(paper.id, (p) => {
    p.notes = [...notes, ...setAside];
    p.ideas = ideas;
    p.analysed = true;
  });
}

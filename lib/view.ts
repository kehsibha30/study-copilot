import { stage, summarize, verdict, type Stage, type Summary, type Verdict } from "./grade";
import { outcome, type Outcome } from "./fix";
import type { Paper } from "./store";

// What the browser is allowed to see. The answer key is never sent before the student submits.

export type QuestionView = {
  n: number;
  section: string;
  type: "mcq" | "written";
  text: string;
  options: { label: string; text: string }[];
  hasFigure: boolean;
  page: number;
  fileIndex: number;
  cutOff: boolean;
  markDoubt: boolean;
  // Only present once the paper is checked:
  verdict?: Verdict;
  correct?: string | null;
  keySource?: "printed" | "solved" | "best" | "unsure";
  fromBook?: boolean;
  whyTempting?: string;
  // Not counted because the student's own choice could also be right.
  disputed?: boolean;
};

export type PaperView = {
  id: string;
  title: string;
  createdAt: string;
  stage: Stage;
  label: string | null;
  startedAt: string | null;
  error: { message: string } | null;
  questions: QuestionView[];
  answers: Record<string, string>;
  markedCount: number;
  marksLooks: number; // extra looks made only to find the student's marks
  pageProblems: { page: number; problem: string }[];
  qualityHold: boolean;
  hasPrintedKey: boolean;
  fileCount: number;
  isPdf: boolean;
  summary: Summary | null;
  ideas: IdeaView[];
  costUsd: number;
  excluded: boolean;
};

// state: where the student is with fixing this idea.
export type IdeaView = {
  id: string;
  name: string;
  explain: string;
  questions: number[];
  state: "new" | "started" | Outcome;
};

export type PaperRow = {
  id: string;
  title: string;
  createdAt: string;
  stage: Stage;
  line: string;
};

export function paperView(paper: Paper): PaperView {
  const st = stage(paper);
  const done = st === "done";
  const isPdf = paper.files[0]?.mime === "application/pdf";
  const questions: QuestionView[] = (paper.questions ?? []).map((q) => {
    const base: QuestionView = {
      n: q.n,
      section: q.section,
      type: q.type,
      text: q.text,
      options: q.options,
      hasFigure: q.hasFigure,
      page: q.page,
      // Photos: one file per page. PDF: one file, opened at the page.
      fileIndex: isPdf ? 0 : Math.min(Math.max(q.page - 1, 0), paper.files.length - 1),
      cutOff: q.cutOff,
      markDoubt: Boolean(q.markDoubt),
    };
    if (!done) return base;
    const entry = paper.key?.[String(q.n)];
    const note = paper.notes?.find((x) => x.n === q.n);
    const v = verdict(paper, q);
    return {
      ...base,
      verdict: v,
      correct: v === "unsure" ? null : entry?.answer ?? null,
      keySource: entry?.source,
      fromBook: Boolean(entry?.book),
      whyTempting: note?.whyTempting,
      disputed: v === "unsure" && (entry?.source === "solved" || entry?.source === "best") && Boolean(note?.disputed),
    };
  });

  // Ideas only list questions that still count as wrong (not reported, not in doubt).
  const stillWrong = new Set(questions.filter((q) => q.verdict === "wrong").map((q) => q.n));
  const ideas = done
    ? (paper.ideas ?? [])
        .map((i, index): IdeaView => {
          const fix = paper.fixes?.[String(index)];
          const result = fix ? outcome(fix) : null;
          return {
            id: String(index),
            name: i.name,
            explain: i.explain,
            questions: i.questions.filter((n) => stillWrong.has(n)),
            state: result ?? (fix ? "started" : "new"),
          };
        })
        .filter((i) => i.questions.length > 0)
        .sort((a, b) => b.questions.length - a.questions.length)
    : [];

  return {
    id: paper.id,
    title: paper.title,
    createdAt: paper.createdAt,
    stage: st,
    label: paper.running?.label ?? null,
    startedAt: paper.running?.startedAt ?? null,
    error: paper.error ? { message: paper.error.message } : null,
    questions,
    answers: paper.answers,
    markedCount: (paper.questions ?? []).filter((q) => q.markedAnswer).length,
    marksLooks: paper.marksLooks ?? 0,
    pageProblems: paper.pageProblems ?? [],
    qualityHold: paper.qualityHold === "waiting",
    hasPrintedKey: Object.keys(paper.printedKey ?? {}).length > 0,
    fileCount: paper.files.length,
    isPdf,
    summary: done ? summarize(paper) : null,
    ideas,
    costUsd: paper.cost.usd,
    excluded: Boolean(paper.excluded),
  };
}

export function paperRow(paper: Paper): PaperRow {
  const st = stage(paper);
  let line = "";
  if (st === "reading") line = "Reading your paper";
  else if (st === "answers") line = "Waiting for your answers";
  else if (st === "checking") line = "Checking your answers";
  else if (st === "stopped") line = "Stopped partway. Open to continue";
  else {
    const view = paperView(paper);
    const wrong = view.summary?.wrong ?? 0;
    line =
      wrong === 0
        ? `No mistakes in ${view.summary?.counted ?? 0} questions`
        : `${wrong} ${wrong === 1 ? "mistake" : "mistakes"} in ${view.ideas.length} ${view.ideas.length === 1 ? "idea" : "ideas"}`;
  }
  return { id: paper.id, title: paper.title, createdAt: paper.createdAt, stage: st, line };
}

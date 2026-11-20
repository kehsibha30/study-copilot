import type { Paper, Question } from "./store";

// Pure code, no AI: compares the student's answers with the answer key.

export function norm(label: string | null | undefined): string {
  if (!label) return "";
  return label.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export type Verdict = "correct" | "wrong" | "skipped" | "unsure" | "reported" | "written";

export function verdict(paper: Paper, q: Question): Verdict {
  if (q.type === "written") return "written";
  if (paper.reported.includes(q.n)) return "reported";
  const entry = paper.key?.[String(q.n)];
  if (!entry || entry.source === "unsure" || !entry.answer) return "unsure";
  // If the AI's own solution disagrees with the printed key, do not count the question.
  const note = paper.notes?.find((x) => x.n === q.n);
  if (entry.source === "printed" && !entry.keyPage && !entry.bank && note?.aiAnswer && norm(note.aiAnswer) !== norm(entry.answer)) {
    return "unsure";
  }
  // No printed key, and the student's choice could also be the book's answer: do not mark it wrong.
  if ((entry.source === "solved" || entry.source === "best") && note?.disputed) return "unsure";
  const mine = norm(paper.answers[String(q.n)]);
  if (!mine) return "skipped";
  return mine === norm(entry.answer) ? "correct" : "wrong";
}

export type Summary = {
  correct: number;
  wrong: number;
  skipped: number;
  unsure: number;
  reported: number;
  written: number;
  counted: number;
};

export function summarize(paper: Paper): Summary {
  const s: Summary = { correct: 0, wrong: 0, skipped: 0, unsure: 0, reported: 0, written: 0, counted: 0 };
  for (const q of paper.questions ?? []) s[verdict(paper, q)]++;
  s.counted = s.correct + s.wrong + s.skipped;
  return s;
}

// What the student sees for a paper, in plain words.
export type Stage = "reading" | "answers" | "checking" | "done" | "stopped";

export function stage(paper: Paper): Stage {
  if (paper.error) return "stopped";
  if (!paper.questions) return "reading";
  if (!paper.answersSubmitted) return "answers";
  if (!paper.analysed) return "checking";
  return "done";
}

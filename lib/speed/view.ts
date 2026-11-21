import { cardById, topicById } from "./cards";
import { answerWords, keyWords, type Mark, type RunResult, type SpeedRun } from "./stats";
import { setLine } from "./ladder";

export type SpeedView = {
  id: string;
  kind: SpeedRun["kind"];
  topic: string | null;
  topicLabel: string;
  cardTitle: string | null;
  questions: { q: string; opts?: string[] }[];
  // Adaptive sets only: how many questions the set has. The question list grows as he answers.
  setSize: number | null;
  submitted: boolean;
  result: RunResult | null;
  // After hand-in only: every question with what he typed and the answer. The answers are never sent before.
  review: { q: string; said: string; a: string; how: string; mark: Mark; ms: number; card: string; step: number }[] | null;
  // Adaptive sets, after the last answer: where he started, where he got to, and a plain line about it.
  set: { startStep: number; endStep: number; topStep: number; newTop: boolean; line: string } | null;
};

export function view(run: SpeedRun): SpeedView {
  const done = Boolean(run.submittedAt && run.result);
  return {
    id: run.id,
    kind: run.kind,
    topic: run.topic,
    topicLabel: run.kind === "daily" ? "Today's round" : (run.topic && topicById(run.topic)?.label) || "Speed",
    cardTitle: run.card ? (cardById(run.card)?.title ?? null) : null,
    questions: run.questions.map((q) => ({ q: q.q, ...(q.opts ? { opts: q.opts } : {}) })),
    setSize: run.kind === "adaptive" ? (run.adaptive?.size ?? null) : null,
    submitted: done,
    result: done ? run.result! : null,
    review: done
      ? run.questions.map((q, i) => ({ q: q.q, said: answerWords(q, run.answers?.[String(i)] ?? ""), a: keyWords(q), how: q.how, mark: run.result!.marks[i], ms: run.times?.[String(i)] ?? 0, card: q.bank ? "Question bank" : (cardById(q.card)?.title ?? ""), step: q.level }))
      : null,
    set:
      done && run.kind === "adaptive" && run.result!.startStep !== undefined
        ? {
            startStep: run.result!.startStep,
            endStep: run.result!.endStep ?? run.result!.startStep,
            topStep: run.result!.topStep ?? 0,
            newTop: run.result!.newBest,
            line: setLine(run.result!.startStep, run.result!.endStep ?? run.result!.startStep, run.result!.topStep ?? 0, run.result!.right, run.result!.total),
          }
        : null,
  };
}


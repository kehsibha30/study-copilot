// Speed: what a student's finished drills show. Pure functions, no storage, so the same numbers feed the Speed
// screen, "What to work on" and the Report. Nothing here calls an AI.

import { TOPICS, cardById, type Level, type TopicId } from "./cards";
import { stepOf } from "./ladder";

// A question made by a card (typed answer), or taken from the question bank (opts = the choices, a = the right letter).
export type SpeedQ = { card: string; topic: TopicId; level: Level; q: string; a: string; how: string; opts?: string[]; bank?: string };
// What a student typed or tapped, as words: a bank question stores a letter, which reads back as the option's text.
export const answerWords = (q: SpeedQ, said: string) => (q.opts ? (q.opts["abcdef".indexOf(said.toLowerCase())] ?? "") : said);
export const keyWords = (q: SpeedQ) => (q.opts ? (q.opts["abcdef".indexOf(q.a)] ?? q.a) : q.a);
export type Mark = "right" | "wrong" | "skipped";
export type RunResult = {
  right: number;
  wrong: number;
  skipped: number;
  score: number; // +4 right, -1 wrong, 0 skipped
  total: number;
  totalMs: number;
  avgMs: number; // total time over all questions in the run
  marks: Mark[];
  qualifying: boolean; // a full topic drill with at least 8 of 10 right: only these can be a personal best
  newBest: boolean;
  prevAvgMs: number | null; // the run before this one on the same topic
  prevBestMs: number | null;
  // Adaptive sets only:
  startStep?: number; // the step he began the set at (his step from the set before)
  endStep?: number; // his step after the last answer
  endAbility?: number; // the hidden number behind endStep; the next set starts from it
  topStep?: number; // the hardest step he answered right in this set
  prevTopStep?: number | null; // the hardest step reached in an earlier good set (7 or more right)
};
export type SpeedRun = {
  id: string;
  createdAt: string;
  kind: "topic" | "card" | "daily" | "adaptive";
  topic: TopicId | null;
  card?: string;
  // Adaptive sets: the next question is made after each answer, so these live with the run.
  adaptive?: { seed: number; ability: number; startAbility: number; size: number; used: string[] };
  questions: SpeedQ[];
  answers?: Record<string, string>;
  times?: Record<string, number>;
  submittedAt?: string;
  result?: RunResult;
};

export const LEVEL_NAMES = ["Warm-up", "Steady", "Quick", "Sharp"] as const;
export const RIGHT_POINTS = 4;
export const WRONG_POINTS = -1;
export const QUALIFY_RIGHT = 8;
export const DRILL_SIZE = 10;

export type CalcStatus = "new" | "steady" | "strong" | "weak";
export type CalcTopic = {
  id: TopicId;
  label: string;
  line: string;
  runs: number; // finished drills that included this topic
  answered: number;
  right: number;
  wrong: number;
  skipped: number;
  avgMs: number | null; // average time on an answered question
  bestMs: number | null; // fastest qualifying drill, per question
  firstMs: number | null; // first full topic drill, per question
  lastAvgMs: number | null;
  prevAvgMs: number | null;
  pips: number; // 0 to 4
  step: number | null; // his step now (adaptive sets), 1 to 8
  startStep: number | null; // the step of his first adaptive set
  topStep: number | null; // the hardest step he has answered right in a good set
  sets: number; // finished adaptive sets
  level: string | null;
  status: CalcStatus;
  lastAt: string | null;
};
export type CalcWrong = { topic: TopicId; label: string; card: string; cardTitle: string; q: string; said: string; a: string; how: string; at: string };
export type Calc = { runs: number; days: string[]; topics: CalcTopic[]; wrong: CalcWrong[] };

// His hidden ability on a topic, from the latest finished adaptive set. A new topic starts at 1.
export function abilityFor(runs: SpeedRun[], topic: TopicId): number {
  const done = runs.filter((r) => r.kind === "adaptive" && r.topic === topic && r.submittedAt && r.result?.endAbility !== undefined).sort((a, b) => b.submittedAt!.localeCompare(a.submittedAt!));
  if (done.length) return done[0].result!.endAbility!;
  // No adaptive set yet: a topic he already passed with the old fixed drill (8 of 10 right on levels 1 to 3) starts at Step 3, not Step 1.
  return runs.some((r) => r.kind === "topic" && r.topic === topic && r.result?.qualifying) ? 3 : 1;
}

export function pipsFor(bestMs: number | null, targetMs: number): number {
  if (bestMs === null) return 0;
  const x = bestMs / targetMs;
  return x <= 1 ? 4 : x <= 1.4 ? 3 : x <= 2 ? 2 : 1;
}

export function calcFrom(runs: SpeedRun[]): Calc {
  const done = runs.filter((r) => r.submittedAt && r.result && r.answers).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!));
  const wrong: CalcWrong[] = [];
  const topics: CalcTopic[] = TOPICS.map((t) => {
    let answered = 0;
    let right = 0;
    let bad = 0;
    let skipped = 0;
    let ms = 0;
    let timed = 0;
    let used = 0;
    let lastAt: string | null = null;
    const fulls: SpeedRun[] = [];
    for (const run of done) {
      let touched = false;
      run.questions.forEach((q, i) => {
        if (q.topic !== t.id) return;
        touched = true;
        const mark = run.result!.marks[i];
        if (mark === "skipped") skipped++;
        else {
          answered++;
          const m = run.times?.[String(i)];
          if (m) {
            ms += m;
            timed++;
          }
          if (mark === "right") right++;
          else {
            bad++;
            wrong.push({ topic: t.id, label: t.label, card: q.card, cardTitle: q.bank ? "Question bank" : (cardById(q.card)?.title ?? ""), q: q.q, said: answerWords(q, run.answers![String(i)] ?? ""), a: keyWords(q), how: q.how, at: run.submittedAt! });
          }
        }
      });
      if (touched) {
        used++;
        lastAt = run.submittedAt!;
      }
      if (run.kind === "topic" && run.topic === t.id) fulls.push(run);
    }
    const qualifying = fulls.filter((r) => r.result!.qualifying);
    const bestMs = qualifying.length ? Math.min(...qualifying.map((r) => r.result!.avgMs)) : null;
    const avgMs = timed ? Math.round(ms / timed) : null;
    const sets = done.filter((r) => r.kind === "adaptive" && r.topic === t.id);
    const lastSet = sets.length ? sets[sets.length - 1].result! : null;
    const step = lastSet?.endAbility !== undefined ? stepOf(lastSet.endAbility) : null;
    const tops = sets.map((r) => r.result!.topStep ?? 0).filter((x, i) => (sets[i].result!.right ?? 0) >= 7 && x > 0);
    // With adaptive sets the level follows his step (1-2 Warm-up, 3-4 Steady, 5-6 Quick, 7-8 Sharp); before that, his fastest drill.
    const pips = step !== null ? Math.max(1, Math.ceil(step / 2)) : pipsFor(bestMs, t.targetMs);
    const acc = answered ? right / answered : 0;
    let status: CalcStatus = "new";
    if (answered > 0) {
      status = "steady";
      if (pips >= 3 || (answered >= 10 && acc >= 0.9 && avgMs !== null && avgMs <= t.targetMs * 1.4)) status = "strong";
      else if (answered >= 5 && (acc < 0.7 || (avgMs !== null && avgMs > t.targetMs * 1.8))) status = "weak";
    }
    return {
      id: t.id,
      label: t.label,
      line: t.line,
      runs: used,
      answered,
      right,
      wrong: bad,
      skipped,
      avgMs,
      bestMs,
      firstMs: fulls.length ? fulls[0].result!.avgMs : null,
      lastAvgMs: fulls.length ? fulls[fulls.length - 1].result!.avgMs : null,
      prevAvgMs: fulls.length > 1 ? fulls[fulls.length - 2].result!.avgMs : null,
      pips,
      step,
      startStep: sets.length ? (sets[0].result!.startStep ?? null) : null,
      topStep: tops.length ? Math.max(...tops) : null,
      sets: sets.length,
      level: pips ? LEVEL_NAMES[pips - 1] : null,
      status,
      lastAt,
    };
  });
  return { runs: done.length, days: done.map((r) => r.submittedAt!), topics, wrong: wrong.sort((a, b) => b.at.localeCompare(a.at)) };
}

// Which topic to suggest first: the slowest one with enough answers, otherwise the first one not tried.
export function suggested(topics: CalcTopic[]): CalcTopic {
  const target = (t: CalcTopic) => TOPICS.find((x) => x.id === t.id)!.targetMs;
  const tried = topics.filter((t) => t.answered >= 3 && t.avgMs !== null);
  const slow = tried.filter((t) => t.status === "weak" || t.avgMs! > target(t) * 1.3).sort((a, b) => b.avgMs! / target(b) - a.avgMs! / target(a));
  if (slow.length) return slow[0];
  return topics.find((t) => t.answered === 0) ?? topics.sort((a, b) => (a.lastAt ?? "").localeCompare(b.lastAt ?? ""))[0];
}

// Consecutive days with a finished drill, counted back from today (or from yesterday, so one quiet day so far does not reset it).
export function streakDays(isoTimes: string[], now = new Date()): number {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const have = new Set(isoTimes.map((t) => key(new Date(t))));
  const d = new Date(now);
  if (!have.has(key(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (have.has(key(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

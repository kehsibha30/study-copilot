import { createHash } from "node:crypto";
import { insertDoc, listDocs, loadDoc, updateDoc } from "../db";
import { CARDS, TOPICS, cardById, cardsFor, parseAnswer, same, seeded, topicById, type Level, type TopicId } from "./cards";
import { DRILL_SIZE, QUALIFY_RIGHT, RIGHT_POINTS, WRONG_POINTS, abilityFor, calcFrom, type Mark, type RunResult, type SpeedQ, type SpeedRun } from "./stats";
import { SET_SIZE, afterAnswer, firstStep, stepOf } from "./ladder";
import { BANK_TEXT } from "./bank-data";
import { parseBank, usable, type BankQ } from "./bank";

// Speed drills are stored as documents in the same table as practice sets (ids start with "speed-"), so no
// database change is needed. listSelfTests() leaves them out; listRuns() here returns only them.

export const MAX_QUESTION_MS = 5 * 60_000;
const PREFIX = "speed-";
const ADAPTIVE_PREFIX = "speed-a-";

// Question bank: only approved questions are used (drafts can be switched on for local testing only).
const BANK = parseBank(BANK_TEXT);
if (BANK.problems.length) console.warn(`[speed] ${BANK.problems.length} bank question(s) skipped: ${BANK.problems.map((p) => `#${p.block} ${p.problem}`).join("; ")}`);
const bankFor = (topic: string): BankQ[] => usable(BANK.questions, process.env.SPEED_BANK_DRAFTS === "1" && process.env.NODE_ENV !== "production").filter((q) => q.topic === topic);

// Marks one answer. Bank questions store the right letter; the rest are typed numbers or fractions.
export function markOf(q: SpeedQ, said: string): Mark {
  if (!said) return "skipped";
  if (q.opts) return said.toLowerCase() === q.a ? "right" : "wrong";
  const typed = parseAnswer(said);
  const key = parseAnswer(q.a);
  return typed && key && same(typed, key) ? "right" : "wrong";
}

export async function listRuns(): Promise<SpeedRun[]> {
  const all = await listDocs<SpeedRun>("self_tests");
  return all.filter((r) => r.id?.startsWith(PREFIX)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function loadRun(id: string): Promise<SpeedRun | null> {
  if (!id.startsWith(PREFIX)) return null;
  return loadDoc<SpeedRun>("self_tests", id);
}

function questionsFor(topic: TopicId, levels: Level[], r: () => number, only?: string): SpeedQ[] {
  const cards = only ? [cardById(only)!] : cardsFor(topic);
  const order = [...cards].sort(() => r() - 0.5);
  const out: SpeedQ[] = [];
  const seen = new Set<string>();
  levels.forEach((level, i) => {
    for (let tries = 0; tries < 20; tries++) {
      const card = order[(i + tries) % order.length];
      const m = card.make(level, r);
      if (seen.has(m.q)) continue;
      seen.add(m.q);
      out.push({ card: card.id, topic: card.topic, level, q: m.q, a: m.a, how: m.how });
      return;
    }
  });
  return out;
}

const TOPIC_LEVELS: Level[] = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];

// Starting a drill twice in the same minute gives the same run (a double tap must not make two).
export async function startRun(kind: SpeedRun["kind"], topic: TopicId | null, card: string | undefined, weakFirst: TopicId[], stepOfTopic: Partial<Record<TopicId, number>> = {}): Promise<SpeedRun> {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  const id = PREFIX + createHash("sha1").update(`${kind}|${topic ?? ""}|${card ?? ""}|${minute}`).digest("hex").slice(0, 10);
  const existing = await loadRun(id);
  if (existing && !existing.submittedAt) return existing;
  const seed = (now.getTime() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const r = seeded(seed);
  let questions: SpeedQ[] = [];
  let useTopic = topic;
  if (kind === "topic" && topic) questions = questionsFor(topic, TOPIC_LEVELS, r);
  else if (kind === "card" && card) {
    const c = cardById(card);
    if (!c) throw new Error("Unknown shortcut");
    useTopic = c.topic;
    questions = questionsFor(c.topic, [1, 1, 2], r, card);
  } else {
    // Today's round: three topics, the ones he has done least or is slowest on first, two questions each.
    const order = [...weakFirst, ...TOPICS.map((t) => t.id).filter((t) => !weakFirst.includes(t))].slice(0, 3);
    // Two questions per topic at his step on that topic: one a step below, one at it.
    questions = order.flatMap((t) => {
      const st = Math.max(1, Math.min(8, stepOfTopic[t] ?? 2)) as Level;
      return questionsFor(t, [Math.max(1, st - 1) as Level, st], r);
    });
    useTopic = null;
  }
  const run: SpeedRun = { id: existing ? `${id}-${Math.floor(Math.random() * 1e6)}` : id, createdAt: now.toISOString(), kind, topic: useTopic, card, questions };
  if (!(await insertDoc("self_tests", run))) return (await loadRun(run.id)) ?? run;
  return run;
}

// ---------- adaptive sets ----------

const pickOf = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];

// Makes the next question of an adaptive set at a step. The seed and the question number decide the numbers, so the
// same set always makes the same questions. About one in three comes from the question bank when it has an unused
// approved one for this topic and step.
function nextQuestion(d: SpeedRun, step: number, n: number): SpeedQ {
  const ad = d.adaptive!;
  const topic = d.topic!;
  const r = seeded((ad.seed ^ Math.imul(n + 1, 2654435761)) >>> 0);
  const level = step as Level;
  const fresh = bankFor(topic).filter((b) => b.step === step && !ad.used.includes(b.id));
  if (fresh.length && r() < 0.34) {
    const b = pickOf(r, fresh);
    ad.used.push(b.id);
    return { card: "bank", topic, level, q: b.q, a: "abcdef"[b.answer], how: b.why, opts: b.options, bank: b.id };
  }
  const cards = cardsFor(topic);
  const last = d.questions[d.questions.length - 1]?.card;
  const pool = cards.length > 1 ? cards.filter((c) => c.id !== last) : cards;
  for (let tries = 0; tries < 30; tries++) {
    const card = pickOf(r, pool);
    const m = card.make(level, r);
    if (d.questions.some((x) => x.q === m.q)) continue;
    return { card: card.id, topic, level, q: m.q, a: m.a, how: m.how };
  }
  const card = pickOf(r, pool);
  const m = card.make(level, r);
  return { card: card.id, topic, level, q: m.q, a: m.a, how: m.how };
}

// Starts a set of 10 at the step his last set ended on (one below, so the first question is a win).
// Starting twice in the same minute gives the same set (a double tap must not make two).
export async function startAdaptive(topic: TopicId): Promise<SpeedRun> {
  const now = new Date();
  const minute = now.toISOString().slice(0, 16);
  const base = ADAPTIVE_PREFIX + createHash("sha1").update(`adaptive|${topic}|${minute}`).digest("hex").slice(0, 10);
  const existing = await loadRun(base);
  if (existing && !existing.submittedAt) return existing;
  const runs = await listRuns();
  const ability = abilityFor(runs, topic);
  const used = runs.flatMap((x) => (x.topic === topic ? x.questions.map((q) => q.bank).filter((b): b is string => Boolean(b)) : []));
  const seed = (now.getTime() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const run: SpeedRun = { id: existing ? `${base}-${Math.floor(Math.random() * 1e6)}` : base, createdAt: now.toISOString(), kind: "adaptive", topic, questions: [], adaptive: { seed, ability, startAbility: ability, size: SET_SIZE, used } };
  run.questions.push(nextQuestion(run, firstStep(ability), 0));
  if (!(await insertDoc("self_tests", run))) return (await loadRun(run.id)) ?? run;
  return run;
}

function finishSet(d: SpeedRun, others: SpeedRun[]) {
  const ad = d.adaptive!;
  const given = d.answers ?? {};
  const ms = d.times ?? {};
  const marks: Mark[] = d.questions.map((q, i) => markOf(q, given[String(i)] ?? ""));
  const right = marks.filter((m) => m === "right").length;
  const wrong = marks.filter((m) => m === "wrong").length;
  const totalMs = Object.values(ms).reduce((a, x) => a + x, 0);
  const sameTopic = others.filter((x) => x.kind === "adaptive" && x.topic === d.topic && x.submittedAt && x.result).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!));
  const good = sameTopic.filter((x) => (x.result!.right ?? 0) >= 7 && (x.result!.topStep ?? 0) > 0);
  const prevTop = good.length ? Math.max(...good.map((x) => x.result!.topStep!)) : null;
  const topStep = Math.max(0, ...d.questions.map((q, i) => (marks[i] === "right" ? q.level : 0)));
  const qualifying = right >= 7;
  const result: RunResult = {
    right,
    wrong,
    skipped: marks.length - right - wrong,
    score: right * RIGHT_POINTS + wrong * WRONG_POINTS,
    total: marks.length,
    totalMs,
    avgMs: Math.round(totalMs / marks.length),
    marks,
    qualifying,
    newBest: qualifying && topStep > (prevTop ?? 0),
    prevAvgMs: sameTopic.length ? sameTopic[sameTopic.length - 1].result!.avgMs : null,
    prevBestMs: null,
    startStep: stepOf(ad.startAbility),
    endStep: stepOf(ad.ability),
    endAbility: ad.ability,
    topStep,
    prevTopStep: prevTop,
  };
  d.result = result;
  d.submittedAt = new Date().toISOString();
}

// Takes one answer of a set. The server marks it, moves his step, and makes the next question; the answer is
// not told to the browser until the set ends. An answer sent twice (a double tap) counts once.
export async function answerAdaptive(id: string, index: number, answer: unknown, ms: unknown): Promise<SpeedRun | null> {
  const pre = await loadRun(id);
  if (!pre || pre.kind !== "adaptive" || !pre.adaptive) return null;
  const last = pre.adaptive.size - 1;
  const others = pre.questions.length === pre.adaptive.size && index === last ? (await listRuns()).filter((x) => x.id !== id) : [];
  const target = topicById(pre.topic!)?.targetMs ?? 30_000;
  const said = typeof answer === "string" ? answer.trim().slice(0, 40) : "";
  const { doc } = await updateDoc<SpeedRun>("self_tests", id, (d) => {
    const ad = d.adaptive;
    if (d.kind !== "adaptive" || d.submittedAt || !ad) return false;
    const given = (d.answers ??= {});
    const times = (d.times ??= {});
    if (index !== d.questions.length - 1 || given[String(index)] !== undefined) return false;
    const q = d.questions[index];
    given[String(index)] = said;
    times[String(index)] = cleanTime(ms);
    ad.ability = afterAnswer(ad.ability, markOf(q, said), times[String(index)], target, q.level);
    if (d.questions.length < ad.size) d.questions.push(nextQuestion(d, stepOf(ad.ability), d.questions.length));
    else finishSet(d, others);
  });
  return doc;
}

export function cleanTime(ms: unknown): number {
  const n = typeof ms === "number" && Number.isFinite(ms) ? Math.round(ms) : 0;
  return Math.max(0, Math.min(n, MAX_QUESTION_MS));
}

// Marks the answers, scores them (+4 right, -1 wrong, 0 left blank) and works out whether it is a new best.
// Handing in twice (a double tap) keeps the first result.
export async function submitRun(id: string, answers: Record<string, unknown>, times: Record<string, unknown>): Promise<SpeedRun | null> {
  const run = await loadRun(id);
  if (!run) return null;
  const others = (await listRuns()).filter((r) => r.id !== id && r.submittedAt && r.result);
  const { doc } = await updateDoc<SpeedRun>("self_tests", id, (d) => {
    if (d.submittedAt) return false;
    const given: Record<string, string> = {};
    const ms: Record<string, number> = {};
    const marks: Mark[] = d.questions.map((q, i) => {
      const said = typeof answers[String(i)] === "string" ? (answers[String(i)] as string).trim().slice(0, 40) : "";
      given[String(i)] = said;
      ms[String(i)] = cleanTime(times[String(i)]);
      return markOf(q, said);
    });
    const right = marks.filter((m) => m === "right").length;
    const wrong = marks.filter((m) => m === "wrong").length;
    const totalMs = Object.values(ms).reduce((s, x) => s + x, 0);
    const avgMs = Math.round(totalMs / d.questions.length);
    const qualifying = d.kind === "topic" && d.questions.length === DRILL_SIZE && right >= QUALIFY_RIGHT;
    const sameTopic = others.filter((r) => r.kind === "topic" && r.topic === d.topic).sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!));
    const bests = sameTopic.filter((r) => r.result!.qualifying).map((r) => r.result!.avgMs);
    const prevBestMs = bests.length ? Math.min(...bests) : null;
    const result: RunResult = {
      right,
      wrong,
      skipped: marks.length - right - wrong,
      score: right * RIGHT_POINTS + wrong * WRONG_POINTS,
      total: d.questions.length,
      totalMs,
      avgMs,
      marks,
      qualifying,
      newBest: qualifying && (prevBestMs === null || avgMs < prevBestMs),
      prevAvgMs: d.kind === "topic" && sameTopic.length ? sameTopic[sameTopic.length - 1].result!.avgMs : null,
      prevBestMs,
    };
    d.answers = given;
    d.times = ms;
    d.result = result;
    d.submittedAt = new Date().toISOString();
  });
  return doc;
}

export async function calc() {
  return calcFrom(await listRuns());
}

export { CARDS, topicById };

import { createHash } from "node:crypto";
import { insertDoc, listDocs, loadDoc, updateDoc } from "../db";
import { CARDS, TOPICS, cardById, cardsFor, parseAnswer, same, seeded, topicById, type Level, type TopicId } from "./cards";
import { DRILL_SIZE, QUALIFY_RIGHT, RIGHT_POINTS, WRONG_POINTS, calcFrom, type Mark, type RunResult, type SpeedQ, type SpeedRun } from "./stats";

// Speed drills are stored as documents in the same table as practice sets (ids start with "speed-"), so no
// database change is needed. listSelfTests() leaves them out; listRuns() here returns only them.

export const MAX_QUESTION_MS = 5 * 60_000;
const PREFIX = "speed-";

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
export async function startRun(kind: SpeedRun["kind"], topic: TopicId | null, card: string | undefined, weakFirst: TopicId[]): Promise<SpeedRun> {
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
    const lv: Level[][] = [[1, 2], [2, 2], [2, 3]];
    questions = order.flatMap((t, i) => questionsFor(t, lv[i], r));
    useTopic = null;
  }
  const run: SpeedRun = { id: existing ? `${id}-${Math.floor(Math.random() * 1e6)}` : id, createdAt: now.toISOString(), kind, topic: useTopic, card, questions };
  if (!(await insertDoc("self_tests", run))) return (await loadRun(run.id)) ?? run;
  return run;
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
      if (!said) return "skipped";
      const typed = parseAnswer(said);
      const key = parseAnswer(q.a);
      return typed && key && same(typed, key) ? "right" : "wrong";
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

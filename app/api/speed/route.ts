import { connection } from "next/server";
import { TOPICS, type TopicId } from "@/lib/speed/cards";
import { calcFrom, suggested } from "@/lib/speed/stats";
import { listRuns, startRun } from "@/lib/speed/run";

// The Speed home: one row per topic, worked out from his finished drills each time. Costs nothing (no AI).
export async function GET() {
  await connection();
  const calc = calcFrom(await listRuns());
  return Response.json({ calc, suggested: suggested([...calc.topics]).id });
}

// Starts a drill: one topic (10 questions), one shortcut (3 questions) or today's mixed round.
export async function POST(request: Request) {
  let body: { kind?: unknown; topic?: unknown; card?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const topic = TOPICS.find((t) => t.id === body.topic)?.id ?? null;
  const card = typeof body.card === "string" ? body.card : undefined;
  if (body.kind === "topic" && !topic) return Response.json({ error: "Pick a topic first." }, { status: 400 });
  if (body.kind !== "topic" && body.kind !== "card" && body.kind !== "daily") return Response.json({ error: "Pick a drill first." }, { status: 400 });
  try {
    // Today's round starts with the topics he has done least, then the slowest.
    const calc = calcFrom(await listRuns());
    const target = (id: TopicId) => TOPICS.find((t) => t.id === id)!.targetMs;
    const weakFirst = [...calc.topics]
      .sort((a, b) => (a.answered === 0 ? -9 : -(a.avgMs ?? 0) / target(a.id)) - (b.answered === 0 ? -9 : -(b.avgMs ?? 0) / target(b.id)))
      .map((t) => t.id);
    const run = await startRun(body.kind, topic, card, weakFirst);
    return Response.json({ id: run.id });
  } catch (error) {
    console.error("[speed] could not start a drill", error);
    return Response.json({ error: "We could not start that drill. Try again." }, { status: 500 });
  }
}

import { connection } from "next/server";
import { RefusalError, StepError } from "@/lib/claude";
import { flagTopicDoubt } from "@/lib/doubts";
import { askTopic, topicView } from "@/lib/topic";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

// Looking at a topic never starts (or pays for) anything.
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const view = await topicView(url.searchParams.get("s") ?? "", url.searchParams.get("t") ?? "");
  if (!view) return Response.json({ error: "We could not find that topic." }, { status: 404 });
  return Response.json({ topic: view });
}

// One question about the topic, or "this looks wrong" on an answer already given (no AI call).
export async function POST(request: Request) {
  let body: { subject?: unknown; topic?: unknown; question?: unknown; flag?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  if (typeof body.flag === "string") {
    const subject = String(body.subject ?? "");
    const topic = String(body.topic ?? "");
    if (!await flagTopicDoubt(subject, topic, body.flag)) return Response.json({ error: "We could not find that answer." }, { status: 404 });
    return Response.json({ topic: await topicView(subject, topic) });
  }
  try {
    const view = await askTopic(String(body.subject ?? ""), String(body.topic ?? ""), String(body.question ?? ""));
    return Response.json({ topic: view });
  } catch (error) {
    if (error instanceof RefusalError) {
      return Response.json({ error: "The AI could not answer that one. Try asking it another way." }, { status: 422 });
    }
    if (error instanceof StepError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[topic] question failed", error);
    return Response.json({ error: "Something went wrong on our side. Your question is still in the box; ask it again." }, { status: 500 });
  }
}

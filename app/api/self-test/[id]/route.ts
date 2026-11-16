import { after } from "next/server";
import { actSelfTest, buildSelfTest, loadSelfTest, markSelfTestIfStalled, restartSelfTest, selfTestView, type TestAct } from "@/lib/selftest";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

// Looking at a set never starts (or pays for) anything.
export async function GET(_request: Request, ctx: RouteContext<"/api/self-test/[id]">) {
  const { id } = await ctx.params;
  const test = await loadSelfTest(id);
  if (!test) return Response.json({ error: "We could not find that set." }, { status: 404 });
  return Response.json({ test: await selfTestView(await markSelfTestIfStalled(test)) });
}

// One move: choose an answer, hand the set in, flag a question, leave the set out, or try a failed build again.
export async function POST(request: Request, ctx: RouteContext<"/api/self-test/[id]">) {
  const { id } = await ctx.params;
  if (!await loadSelfTest(id)) return Response.json({ error: "We could not find that set." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  if (body.type === "retry") {
    const again = await restartSelfTest(id);
    if (again?.status === "building") after(() => buildSelfTest(id));
    return Response.json({ test: again ? await selfTestView(again) : null });
  }
  let move: TestAct | null = null;
  if (body.type === "answer" && typeof body.index === "number" && typeof body.choice === "number") move = { type: "answer", index: body.index, choice: body.choice };
  else if (body.type === "submit") move = { type: "submit" };
  else if (body.type === "flag" && typeof body.index === "number") move = { type: "flag", index: body.index };
  else if (body.type === "exclude") move = { type: "exclude", excluded: body.excluded !== false };
  else if (body.type === "time" && typeof body.index === "number" && typeof body.ms === "number") move = { type: "time", index: body.index, ms: body.ms };
  if (!move) return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  return Response.json({ test: await selfTestView(await actSelfTest(id, move)) });
}

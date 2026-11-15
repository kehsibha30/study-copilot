import { after } from "next/server";
import { actSelfTest, buildSelfTest, loadSelfTest, markSelfTestIfStalled, restartSelfTest, selfTestView, type TestAct } from "@/lib/selftest";

// Looking at a set never starts (or pays for) anything.
export async function GET(_request: Request, ctx: RouteContext<"/api/self-test/[id]">) {
  const { id } = await ctx.params;
  const test = loadSelfTest(id);
  if (!test) return Response.json({ error: "We could not find that set." }, { status: 404 });
  return Response.json({ test: selfTestView(markSelfTestIfStalled(test)) });
}

// One move: choose an answer, hand the set in, flag a question, leave the set out, or try a failed build again.
export async function POST(request: Request, ctx: RouteContext<"/api/self-test/[id]">) {
  const { id } = await ctx.params;
  if (!loadSelfTest(id)) return Response.json({ error: "We could not find that set." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  if (body.type === "retry") {
    const again = restartSelfTest(id);
    if (again?.status === "building") after(() => buildSelfTest(id));
    return Response.json({ test: again ? selfTestView(again) : null });
  }
  let move: TestAct | null = null;
  if (body.type === "answer" && typeof body.index === "number" && typeof body.choice === "number") move = { type: "answer", index: body.index, choice: body.choice };
  else if (body.type === "submit") move = { type: "submit" };
  else if (body.type === "flag" && typeof body.index === "number") move = { type: "flag", index: body.index };
  else if (body.type === "exclude") move = { type: "exclude", excluded: body.excluded !== false };
  if (!move) return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  return Response.json({ test: selfTestView(actSelfTest(id, move)) });
}

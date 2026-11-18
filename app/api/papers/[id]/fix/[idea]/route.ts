import { after } from "next/server";
import { buildFix, fixView, markFixIfStalled, startFix } from "@/lib/fix";
import { loadPaper } from "@/lib/store";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

// Looking at a walkthrough never starts (or pays for) anything.
export async function GET(_request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]">) {
  const { id, idea } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  const view = fixView(await markFixIfStalled(paper, idea), idea);
  return Response.json({ fix: view });
}

// Starts building the walkthrough for this idea. Safe to call twice: the second call changes nothing.
export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]">) {
  const { id, idea } = await ctx.params;
  // ?deep=1 is "Walk me through it": the long walkthrough, offered only after a missed new question.
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  if (!await startFix(id, idea, deep)) {
    return Response.json({ error: "There is nothing left to fix for this idea." }, { status: 400 });
  }
  after(() => buildFix(id, idea));
  const paper = await loadPaper(id);
  return Response.json({ fix: paper ? fixView(paper, idea) : null });
}

import { after } from "next/server";
import { buildFix, fixView, markFixIfStalled, startFix } from "@/lib/fix";
import { loadPaper } from "@/lib/store";

// Looking at a walkthrough never starts (or pays for) anything.
export async function GET(_request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]">) {
  const { id, idea } = await ctx.params;
  const paper = loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  const view = fixView(markFixIfStalled(paper, idea), idea);
  return Response.json({ fix: view });
}

// Starts building the walkthrough for this idea. Safe to call twice: the second call changes nothing.
export async function POST(_request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]">) {
  const { id, idea } = await ctx.params;
  if (!startFix(id, idea)) {
    return Response.json({ error: "There is nothing left to fix for this idea." }, { status: 400 });
  }
  after(() => buildFix(id, idea));
  const paper = loadPaper(id);
  return Response.json({ fix: paper ? fixView(paper, idea) : null });
}

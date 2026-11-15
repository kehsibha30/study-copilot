import { act, fixView, type Act } from "@/lib/fix";
import { loadPaper } from "@/lib/store";

// One move in the walkthrough: choose an option, ask for the hint, say "I don't know", go on, retry a question, or flag it.
export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]/act">) {
  const { id, idea } = await ctx.params;
  if (!loadPaper(id)?.fixes?.[idea]) return Response.json({ error: "We could not find that walkthrough." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  let move: Act | null = null;
  if (body.type === "choose" && typeof body.choice === "number") move = { type: "choose", choice: body.choice };
  else if (body.type === "retry" && typeof body.label === "string") move = { type: "retry", label: body.label };
  else if (body.type === "hint" || body.type === "next" || body.type === "flag" || body.type === "skip" || body.type === "jump") move = { type: body.type };
  else if (body.type === "flagDoubt" && typeof body.index === "number") move = { type: "flagDoubt", index: body.index };
  if (!move) return Response.json({ error: "We could not read that. Try again." }, { status: 400 });

  const paper = act(id, idea, move);
  return Response.json({ fix: fixView(paper, idea) });
}

import { RefusalError, StepError } from "@/lib/claude";
import { askDoubt, fixView } from "@/lib/fix";

export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/fix/[idea]/ask">) {
  const { id, idea } = await ctx.params;
  let body: { question?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  try {
    const paper = await askDoubt(id, idea, String(body.question ?? ""));
    return Response.json({ fix: fixView(paper, idea) });
  } catch (error) {
    if (error instanceof RefusalError) {
      return Response.json({ error: "The AI could not answer that one. Try asking it another way." }, { status: 422 });
    }
    if (error instanceof StepError) return Response.json({ error: error.message }, { status: 400 });
    console.error(`[paper ${id}] doubt failed`, error);
    return Response.json({ error: "Something went wrong on our side. Your doubt was not lost; ask it again." }, { status: 500 });
  }
}

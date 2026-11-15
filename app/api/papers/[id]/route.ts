import { markIfStalled } from "@/lib/pipeline";
import { loadPaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// Viewing a paper never starts work. It only reports where things stand.
export async function GET(_request: Request, ctx: RouteContext<"/api/papers/[id]">) {
  const { id } = await ctx.params;
  const paper = loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  return Response.json({ paper: paperView(markIfStalled(paper)) });
}

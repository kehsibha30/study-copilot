import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// "This looks wrong": the question stops counting until someone has looked at it. Can be undone.
export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/report">) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });

  let body: { n?: unknown; reported?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const n = Number(body.n);
  if (!paper.questions?.some((q) => q.n === n)) {
    return Response.json({ error: "We could not find that question." }, { status: 400 });
  }
  const saved = await updatePaper(id, (p) => {
    p.reported = p.reported.filter((x) => x !== n);
    if (body.reported !== false) p.reported.push(n);
  });
  return Response.json({ paper: paperView(saved) });
}

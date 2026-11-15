import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// Leaves a paper out of "what to work on" (a test run), or counts it again.
export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/exclude">) {
  const { id } = await ctx.params;
  if (!await loadPaper(id)) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  let body: { excluded?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const saved = await updatePaper(id, (p) => {
    if (body.excluded === false) delete p.excluded;
    else p.excluded = true;
  });
  return Response.json({ paper: paperView(saved) });
}

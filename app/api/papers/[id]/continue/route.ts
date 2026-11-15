import { after } from "next/server";
import { advance, isRunning, nextStep, queueNext } from "@/lib/pipeline";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// The host must not cut a step short (the longest seen is about 3 minutes).
export const maxDuration = 300;

// Picks up from the step that failed, or runs the next step when the previous one hands over.
// Nothing already done is repeated or thrown away.
export async function POST(_request: Request, ctx: RouteContext<"/api/papers/[id]/continue">) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (isRunning(paper) || !nextStep(paper)) return Response.json({ paper: paperView(paper) });

  const cleared = await updatePaper(id, (p) => {
    delete p.error;
    queueNext(p);
  });
  after(() => advance(id));
  return Response.json({ paper: paperView(cleared) });
}

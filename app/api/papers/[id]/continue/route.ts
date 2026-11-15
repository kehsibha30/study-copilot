import { after } from "next/server";
import { advance, isRunning, nextStep } from "@/lib/pipeline";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// Picks up from the step that failed. Nothing already done is repeated or thrown away.
export async function POST(_request: Request, ctx: RouteContext<"/api/papers/[id]/continue">) {
  const { id } = await ctx.params;
  const paper = loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (isRunning(id) || !nextStep(paper)) return Response.json({ paper: paperView(paper) });

  const cleared = updatePaper(id, (p) => {
    delete p.error;
    p.running = { step: nextStep(p) ?? "read", startedAt: new Date().toISOString(), label: "Picking up where it stopped" };
  });
  after(() => advance(id));
  return Response.json({ paper: paperView(cleared) });
}

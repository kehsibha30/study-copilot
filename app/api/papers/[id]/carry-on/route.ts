import { after } from "next/server";
import { advance, queueNext } from "@/lib/pipeline";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// The step that follows can run for minutes; the host must not cut it short.
export const maxDuration = 300;

// "Carry on with these pages": the student has seen the page-quality warning and wants the paper solved anyway.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (paper.qualityHold !== "waiting") return Response.json({ paper: paperView(paper) });
  const saved = await updatePaper(id, (p) => {
    p.qualityHold = "cleared";
    queueNext(p);
  });
  after(() => advance(id));
  return Response.json({ paper: paperView(saved) });
}

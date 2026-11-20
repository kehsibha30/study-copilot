import { after } from "next/server";
import { advance, queueNext } from "@/lib/pipeline";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// Grouping the mistakes again takes minutes and costs money, so it only runs when a parent asks.
export const maxDuration = 300;

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (!paper.analysed || !paper.regroupOffer) return Response.json({ paper: paperView(paper) });
  const saved = await updatePaper(id, (p) => {
    p.regroupOffer = false;
    p.analysed = false;
    // Ideas are numbered by position, so practice on the old groups cannot carry over to new ones.
    p.ideas = [];
    p.notes = [];
    p.fixes = {};
    queueNext(p);
  });
  after(() => advance(id));
  return Response.json({ paper: paperView(saved) });
}

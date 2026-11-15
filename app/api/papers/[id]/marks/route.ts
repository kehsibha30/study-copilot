import { RefusalError, StepError } from "@/lib/claude";
import { lookForMarks } from "@/lib/pipeline";
import { loadPaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// This route can wait on the AI; the host must not cut it short.
export const maxDuration = 300;

const g = globalThis as { __marksJobs?: Set<string> };
const busy = (g.__marksJobs ??= new Set<string>());

// Looks at the paper once more, only for the answers the student marked on it. One look at a time, three at most.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (!paper.questions) return Response.json({ error: "This paper is still being read." }, { status: 409 });
  if (paper.answersSubmitted || busy.has(id)) return Response.json({ paper: paperView(paper), found: 0 });
  if ((paper.marksLooks ?? 0) >= 3) {
    return Response.json({ error: "We have looked three times and cannot find your marks. Tap your answers in below." }, { status: 400 });
  }
  busy.add(id);
  try {
    const found = await lookForMarks(id);
    const after = await loadPaper(id);
    return Response.json({ paper: after ? paperView(after) : null, found });
  } catch (error) {
    if (error instanceof RefusalError) return Response.json({ error: "The AI could not look at this paper again. Tap your answers in below." }, { status: 422 });
    if (error instanceof StepError) return Response.json({ error: error.message }, { status: 400 });
    console.error(`[paper ${id}] looking for marks failed`, error);
    return Response.json({ error: "Something went wrong on our side. Your paper is safe; try again, or tap your answers in below." }, { status: 500 });
  } finally {
    busy.delete(id);
  }
}

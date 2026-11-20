import { after } from "next/server";
import { norm } from "@/lib/grade";
import { advance, queueNext } from "@/lib/pipeline";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// Checking the paper can take a few minutes; the host must not cut it short.
export const maxDuration = 300;

// Saves the student's answers. With submit: true it also starts the checking, once.
export async function POST(request: Request, ctx: RouteContext<"/api/papers/[id]/answers">) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper) return Response.json({ error: "We could not find that paper." }, { status: 404 });
  if (!paper.questions) return Response.json({ error: "This paper is still being read." }, { status: 409 });

  // A second tap on "Check my paper" changes nothing.
  if (paper.answersSubmitted) return Response.json({ paper: paperView(paper) });

  let body: { answers?: Record<string, unknown>; submit?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read those answers. Try again." }, { status: 400 });
  }

  const clean: Record<string, string> = {};
  for (const q of paper.questions) {
    if (q.type !== "mcq") continue;
    const label = norm(String(body.answers?.[String(q.n)] ?? ""));
    if (label && q.options.some((o) => o.label === label)) clean[String(q.n)] = label;
  }

  const saved = await updatePaper(id, (p) => {
    p.answers = clean;
    if (body.submit) {
      p.answersSubmitted = true;
      // Checking the paper means carrying on with the pages as they are.
      if (p.qualityHold === "waiting") p.qualityHold = "cleared";
      queueNext(p);
    }
  });
  if (body.submit) after(() => advance(id));
  return Response.json({ paper: paperView(saved) });
}

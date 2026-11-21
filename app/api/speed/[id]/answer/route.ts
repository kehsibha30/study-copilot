import { answerAdaptive } from "@/lib/speed/run";
import { view } from "@/lib/speed/view";

// One answer of an adaptive set. The server marks it, moves his step, and sends back the set as it now stands: the next
// question, or (after the last answer) the finished set with its marks. A single verdict is never sent mid-set.

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { index?: unknown; answer?: unknown; ms?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  if (typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0) return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  try {
    const run = await answerAdaptive(id, body.index, body.answer, body.ms);
    if (!run) return Response.json({ error: "We could not find that set." }, { status: 404 });
    return Response.json({ run: view(run) });
  } catch (error) {
    console.error(`[speed ${id}] could not save an answer`, error);
    return Response.json({ error: "Your answer did not save. Press Next again." }, { status: 500 });
  }
}

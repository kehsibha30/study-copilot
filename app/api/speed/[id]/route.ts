import { view } from "@/lib/speed/view";
export type { SpeedView } from "@/lib/speed/view";
import { loadRun, submitRun } from "@/lib/speed/run";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = await loadRun(id);
  if (!run) return Response.json({ error: "We could not find that drill." }, { status: 404 });
  return Response.json({ run: view(run) });
}

// Hands the drill in: all answers and the quiet time per question arrive together, and are marked here.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { answers?: Record<string, unknown>; times?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  try {
    const run = await submitRun(id, body.answers ?? {}, body.times ?? {});
    if (!run) return Response.json({ error: "We could not find that drill." }, { status: 404 });
    return Response.json({ run: view(run) });
  } catch (error) {
    console.error(`[speed ${id}] could not hand in`, error);
    return Response.json({ error: "Your answers did not save. Press Hand in again." }, { status: 500 });
  }
}

import { saveToBank } from "@/lib/bank";
import { norm } from "@/lib/grade";
import { loadPaper, updatePaper } from "@/lib/store";
import { paperView } from "@/lib/view";

// A parent checks an answer against the book and enters the book's answer. It outranks every other answer for
// that question (decision 20 Nov 2026): it replaces the key, clears any doubt, and stops counting as "reported".
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper?.questions) return Response.json({ error: "We could not find that paper." }, { status: 404 });

  let body: { n?: unknown; answer?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const n = Number(body.n);
  const label = norm(typeof body.answer === "string" ? body.answer : "");
  const q = paper.questions.find((x) => x.n === n);
  if (!q || q.type !== "mcq" || !q.options.some((o) => o.label === label)) {
    return Response.json({ error: "That answer is not one of the options. Pick one of the letters shown." }, { status: 400 });
  }
  const saved = await updatePaper(id, (p) => {
    p.key = { ...(p.key ?? {}), [String(n)]: { answer: label, source: "printed", book: true } };
    p.reported = p.reported.filter((x) => x !== n);
    const note = p.notes?.find((x) => x.n === n);
    if (note) {
      delete note.disputed;
      note.aiAnswer = null;
    }
  });
  try {
    await saveToBank(saved, { [String(n)]: label }, 3);
  } catch (error) {
    console.error(`[paper ${id}] could not save the book answer`, error);
  }
  return Response.json({ paper: paperView(saved) });
}

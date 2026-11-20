import { RefusalError, StepError } from "@/lib/claude";
import { applyKeyPage } from "@/lib/pipeline";
import { loadPaper, readUpload, updatePaper, uploadLink } from "@/lib/store";
import { checkKeyFiles, keyStoredName, type FileMeta } from "@/lib/uploads";
import { paperView } from "@/lib/view";

// Reading a key page waits on the AI; the host must not cut it short.
export const maxDuration = 300;

const g = globalThis as { __keyJobs?: Set<string> };
const busy = (g.__keyJobs ??= new Set<string>());

// Adding an answer key page to a paper that already exists (the parent section).
// Step 1 {action:"prepare", files}: one-time links to put the pages straight into storage.
// Step 2 {action:"apply", files}: the pages are in storage; read them and re-mark the paper.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const paper = await loadPaper(id);
  if (!paper?.questions) return Response.json({ error: "We could not find that paper." }, { status: 404 });

  let body: { action?: string; files?: FileMeta[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that. Try again." }, { status: 400 });
  }
  const files = Array.isArray(body.files) ? body.files : [];
  const problem = checkKeyFiles(files);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  if (body.action === "prepare") {
    const uploads = await Promise.all(
      files.map(async (f, i) => {
        const stored = keyStoredName(i, f.type);
        return { stored, url: (await uploadLink(id, stored)).url };
      })
    );
    return Response.json({ uploads });
  }

  if (busy.has(id)) return Response.json({ error: "We are already reading the key page. Give it a moment." }, { status: 409 });
  busy.add(id);
  try {
    const named = files.map((f, i) => ({ name: f.name, mime: f.type, stored: keyStoredName(i, f.type) }));
    try {
      await Promise.all(named.map((f) => readUpload(id, f.stored)));
    } catch {
      return Response.json({ error: "Some pages did not finish uploading. Try again." }, { status: 400 });
    }
    await updatePaper(id, (p) => {
      p.keyFiles = named;
    });
    const note = await applyKeyPage(id);
    const after = await loadPaper(id);
    return Response.json({ paper: after ? paperView(after) : null, note });
  } catch (error) {
    if (error instanceof RefusalError) return Response.json({ error: "The AI could not read that key page. Try a clearer photo." }, { status: 422 });
    if (error instanceof StepError) return Response.json({ error: error.message }, { status: 400 });
    console.error(`[paper ${id}] reading the key page failed`, error);
    return Response.json({ error: "Something went wrong on our side. Your paper is safe; try again." }, { status: 500 });
  } finally {
    busy.delete(id);
  }
}

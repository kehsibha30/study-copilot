import { loadPaper, readUpload } from "@/lib/store";

// The student's own uploaded page, so a question's figure can be looked at.
export async function GET(_request: Request, ctx: RouteContext<"/api/papers/[id]/file/[index]">) {
  const { id, index } = await ctx.params;
  const paper = await loadPaper(id);
  const file = paper?.files[Number(index)];
  if (!paper || !file) return new Response("Not found", { status: 404 });
  const bytes = await readUpload(id, file.stored);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": file.mime, "Content-Disposition": "inline", "Cache-Control": "private, max-age=3600" },
  });
}

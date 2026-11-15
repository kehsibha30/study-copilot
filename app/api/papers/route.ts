import crypto from "node:crypto";
import { after } from "next/server";
import { advance } from "@/lib/pipeline";
import { listPapers, newId, savePaper, saveUpload, type Paper } from "@/lib/store";
import { paperRow } from "@/lib/view";

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export async function GET() {
  return Response.json({ papers: listPapers().map(paperRow) });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "We could not read that upload. Try again." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return Response.json({ error: "Choose a PDF or photos of your paper first." }, { status: 400 });
  }
  const bad = files.find((f) => !ALLOWED[f.type]);
  if (bad) {
    return Response.json({ error: `"${bad.name}" is not a PDF or a photo. Use PDF, JPG or PNG.` }, { status: 400 });
  }
  const pdfs = files.filter((f) => f.type === "application/pdf");
  if (pdfs.length > 1 || (pdfs.length === 1 && files.length > 1)) {
    return Response.json({ error: "Upload one PDF, or photos of the pages, not both together." }, { status: 400 });
  }
  if (files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "That is over 20 MB. Upload fewer pages at a time." }, { status: 400 });
  }

  // Photos are read in file-name order so the pages stay in sequence.
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const hash = crypto.createHash("sha256");
  buffers.forEach((b) => hash.update(b));
  const fileHash = hash.digest("hex");

  // A double tap on the upload button must not create (and pay for) the same paper twice.
  const twin = listPapers().find((p) => p.fileHash === fileHash && Date.now() - Date.parse(p.createdAt) < 120_000);
  if (twin) return Response.json({ id: twin.id });

  const id = newId();
  const paper: Paper = {
    id,
    title: files[0].name.replace(/\.[^.]+$/, ""),
    createdAt: new Date().toISOString(),
    fileHash,
    files: files.map((f, i) => ({ name: f.name, mime: f.type, stored: `page-${i + 1}.${ALLOWED[f.type]}` })),
    answers: {},
    answersSubmitted: false,
    reported: [],
    cost: { usd: 0, calls: 0 },
  };
  buffers.forEach((b, i) => saveUpload(id, paper.files[i].stored, b));
  savePaper(paper);

  after(() => advance(id));
  return Response.json({ id });
}

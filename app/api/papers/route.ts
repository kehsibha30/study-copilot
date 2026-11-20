import { after } from "next/server";
import { advance, queueNext } from "@/lib/pipeline";
import { listPapers, loadPaper, readUpload, savePaper, validId, type Paper } from "@/lib/store";
import { checkFiles, checkKeyFiles, keyStoredName, storedName, type FileMeta } from "@/lib/uploads";
import { paperRow } from "@/lib/view";

// Reading a paper can take a while; the host must not cut the background step short.
export const maxDuration = 300;

export async function GET() {
  return Response.json({ papers: (await listPapers()).map(paperRow) });
}

// Step 2 of an upload: the pages are already in storage (see prepare). Record the paper and start reading it.
export async function POST(request: Request) {
  let body: { id?: string; files?: FileMeta[]; keyFiles?: FileMeta[]; hash?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that upload. Try again." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const files = Array.isArray(body.files) ? body.files : [];
  const problem = checkFiles(files);
  const keyFiles = Array.isArray(body.keyFiles) ? body.keyFiles : [];
  const keyProblem = keyFiles.length > 0 ? checkKeyFiles(keyFiles) : null;
  if (!validId(id) || problem || keyProblem) return Response.json({ error: problem ?? keyProblem ?? "That upload did not go through. Try again." }, { status: 400 });

  // A repeated tap returns the paper already made.
  if (await loadPaper(id)) return Response.json({ id });

  const keyNamed = keyFiles.map((f, i) => ({ name: f.name, mime: f.type, stored: keyStoredName(i, f.type) }));
  const named = files.map((f, i) => ({ name: f.name, mime: f.type, stored: storedName(i, f.type) }));
  try {
    // Every page must really be in storage before anything is charged for reading it.
    await Promise.all([...named, ...keyNamed].map((f) => readUpload(id, f.stored)));
  } catch (error) {
    console.error(`[paper ${id}] pages missing after upload`, error);
    return Response.json({ error: "Some pages did not finish uploading. Try again." }, { status: 400 });
  }

  const paper: Paper = {
    id,
    title: files[0].name.replace(/\.[^.]+$/, ""),
    createdAt: new Date().toISOString(),
    fileHash: typeof body.hash === "string" ? body.hash : "",
    files: named,
    ...(keyNamed.length > 0 ? { keyFiles: keyNamed } : {}),
    answers: {},
    answersSubmitted: false,
    reported: [],
    cost: { usd: 0, calls: 0 },
  };
  queueNext(paper);
  await savePaper(paper);

  after(() => advance(id));
  return Response.json({ id });
}

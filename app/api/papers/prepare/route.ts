import { listPapers, newId, uploadLink } from "@/lib/store";
import { checkFiles, checkKeyFiles, keyStoredName, storedName, type FileMeta } from "@/lib/uploads";

// Step 1 of an upload: check the files, then hand the browser one-time links to put each page
// straight into storage (Vercel refuses request bodies over 4.5 MB, so pages cannot pass through it).
export async function POST(request: Request) {
  let body: { files?: FileMeta[]; keyFiles?: FileMeta[]; hash?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "We could not read that upload. Try again." }, { status: 400 });
  }
  const files = Array.isArray(body.files) ? body.files : [];
  const problem = checkFiles(files);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  const keyFiles = Array.isArray(body.keyFiles) ? body.keyFiles : [];
  const keyProblem = keyFiles.length > 0 ? checkKeyFiles(keyFiles) : null;
  if (keyProblem) return Response.json({ error: keyProblem }, { status: 400 });

  // A double tap on the upload button must not create (and pay for) the same paper twice.
  const hash = typeof body.hash === "string" ? body.hash : "";
  if (hash) {
    const twin = (await listPapers()).find((p) => p.fileHash === hash && Date.now() - Date.parse(p.createdAt) < 120_000);
    if (twin) return Response.json({ id: twin.id, existing: true });
  }

  const id = newId();
  const uploads = await Promise.all(
    files.map(async (f, i) => {
      const stored = storedName(i, f.type);
      return { stored, url: (await uploadLink(id, stored)).url };
    })
  );
  const keyUploads = await Promise.all(
    keyFiles.map(async (f, i) => {
      const stored = keyStoredName(i, f.type);
      return { stored, url: (await uploadLink(id, stored)).url };
    })
  );
  return Response.json({ id, uploads, keyUploads });
}

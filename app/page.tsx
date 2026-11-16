"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { when } from "@/lib/format";
import type { PaperRow } from "@/lib/view";

export default function Home() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [papers, setPapers] = useState<PaperRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/papers")
      .then((r) => r.json())
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setError("We could not load your papers. Refresh the page to try again."));
  }, []);

  // A single PDF uploads straight away. Photos are shown first (in order, repeats skipped, shrunk to a size
  // the reader handles well) so the student can see the pages that will be read, then start the upload.
  async function choose(chosen: FileList | File[] | null) {
    if (busy || !chosen || chosen.length === 0) return;
    setError(null);
    setNote(null);
    const list = Array.from(chosen).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (list.length === 1 && list[0].type === "application/pdf" && staged.length === 0) {
      await upload([list[0]]);
      return;
    }
    setBusy(true);
    try {
      const have = new Set(staged.map((s) => s.hash));
      const added: Staged[] = [];
      let skipped = 0;
      for (const f of list) {
        const hash = await fileHash(f);
        if (have.has(hash)) {
          skipped++;
          continue;
        }
        have.add(hash);
        const file = await shrink(f);
        added.push({ key: hash, hash, file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "" });
      }
      if (skipped > 0) setNote(`${skipped} ${skipped === 1 ? "photo was" : "photos were"} the same as another, so ${skipped === 1 ? "it was" : "they were"} skipped.`);
      setStaged([...staged, ...added]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function move(i: number, by: number) {
    const to = i + by;
    if (to < 0 || to >= staged.length) return;
    const next = [...staged];
    [next[i], next[to]] = [next[to], next[i]];
    setStaged(next);
  }

  function remove(i: number) {
    if (staged[i].url) URL.revokeObjectURL(staged[i].url);
    setStaged(staged.filter((_, j) => j !== i));
    setNote(null);
  }

  // Pages go straight to storage (the host limits how much one request can carry), then the paper is created.
  async function upload(files: File[]) {
    if (busy || files.length === 0) return;
    setBusy(true);
    setError(null);
    const meta = files.map((f) => ({ name: f.name, type: f.type, size: f.size }));
    try {
      const hash = await fingerprint(files);
      const prep = await fetch("/api/papers/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: meta, hash }) });
      const ready = await prep.json();
      if (!prep.ok) throw new Error(ready.error ?? "The upload did not go through. Try again.");
      if (!ready.existing) {
        await Promise.all(
          (ready.uploads as { url: string }[]).map(async (u, i) => {
            const put = await fetch(u.url, { method: "PUT", headers: { "Content-Type": files[i].type, "x-upsert": "true" }, body: files[i] });
            if (!put.ok) throw new Error("A page did not finish uploading. Check your connection and try again.");
          })
        );
        const res = await fetch("/api/papers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ready.id, files: meta, hash }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "The upload did not go through. Try again.");
      }
      router.push(`/papers/${ready.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload did not go through. Try again.");
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div>
        <h1>Upload a test paper</h1>
        <p className="lede">A PDF, or photos of the pages. If your answers are marked on it, we will pick them up.</p>
      </div>

      <label
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          choose(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => choose(e.target.files)}
        />
        <span className="fake" aria-busy={busy}>{busy ? "Working on it…" : staged.length > 0 ? "Add more pages" : "Choose your paper"}</span>
        <span className="muted tiny">or drop it here. For photos, pick the pages together, or add them in rounds.</span>
      </label>

      {note && <p className="muted tiny">{note}</p>}

      {staged.length > 0 && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="thumbs">
            {staged.map((s, i) => (
              <div className="thumb" key={s.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.url ? <img src={s.url} alt={`Page ${i + 1}`} /> : <div className="muted tiny">{s.file.name}</div>}
                <div className="tiny">Page {i + 1}</div>
                <div className="row">
                  <button type="button" className="linkbtn" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Move page ${i + 1} earlier`}>←</button>
                  <button type="button" className="linkbtn" onClick={() => move(i, 1)} disabled={busy || i === staged.length - 1} aria-label={`Move page ${i + 1} later`}>→</button>
                  <button type="button" className="linkbtn" onClick={() => remove(i)} disabled={busy} aria-label={`Remove page ${i + 1}`}>Remove</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn wide" disabled={busy} onClick={() => upload(staged.map((s) => s.file))}>
            {busy ? "Uploading your paper…" : `Read my paper (${staged.length} ${staged.length === 1 ? "page" : "pages"})`}
          </button>
        </div>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      <div>
        <h2 style={{ marginBottom: 10 }}>Your papers</h2>
        {papers === null ? (
          <p className="muted">Loading your papers…</p>
        ) : papers.length === 0 ? (
          <p className="muted">No papers yet. Upload your first one above.</p>
        ) : (
          <div className="card list" style={{ padding: "4px 18px" }}>
            {papers.map((p) => (
              <Link key={p.id} href={`/papers/${p.id}`}>
                <div className="t">{p.title}</div>
                <div className="muted tiny">
                  {p.line} · {when(p.createdAt)} · #{p.id.slice(0, 4)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// The same files always give the same fingerprint, so a double tap does not make two papers.
async function fingerprint(files: File[]): Promise<string> {
  const parts = await Promise.all(files.map(async (f) => new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()))));
  const all = new Uint8Array(parts.length * 32);
  parts.forEach((p, i) => all.set(p, i * 32));
  const sum = new Uint8Array(await crypto.subtle.digest("SHA-256", all));
  return Array.from(sum, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Staged = { key: string; hash: string; file: File; url: string };

async function fileHash(f: File): Promise<string> {
  const sum = new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()));
  return Array.from(sum, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Phone photos are 3 to 5 MB each, which would fill the 20 MB limit after a few pages. Shrinking the long edge
// to 2200 px keeps printed text readable and brings a page to well under 1 MB. If anything fails, the original is used.
const MAX_EDGE = 2200;
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

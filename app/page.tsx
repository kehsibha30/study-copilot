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

  useEffect(() => {
    fetch("/api/papers")
      .then((r) => r.json())
      .then((d) => setPapers(d.papers ?? []))
      .catch(() => setError("We could not load your papers. Refresh the page to try again."));
  }, []);

  // Choosing the files is the whole action: the upload starts straight away.
  // Pages go straight to storage (the host limits how much one request can carry), then the paper is created.
  async function upload(chosen: FileList | File[] | null) {
    if (busy || !chosen || chosen.length === 0) return;
    setBusy(true);
    setError(null);
    // Photos are read in file-name order so the pages stay in sequence.
    const files = Array.from(chosen).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
          upload(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => upload(e.target.files)}
        />
        <span className="fake" aria-busy={busy}>{busy ? "Uploading your paper…" : "Choose your paper"}</span>
        <span className="muted tiny">or drop it here. For photos, pick all the pages together.</span>
      </label>

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

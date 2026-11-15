"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaperView } from "@/lib/view";
import AnswerGrid from "./AnswerGrid";
import Results from "./Results";

export default function PaperScreen() {
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<PaperView | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/papers/${id}`, { cache: "no-store" });
      if (res.status === 404) return setMissing(true);
      const data = await res.json();
      setOffline(false);
      setPaper(data.paper);
    } catch {
      setOffline(true);
    }
  }, [id]);

  // First look straight away; then, while work is going on in the background, look again every
  // two seconds. Looking never starts work.
  const waiting = paper?.stage === "reading" || paper?.stage === "checking";
  const first = !paper && !missing;
  useEffect(() => {
    if (!first && !waiting && !offline) return;
    timer.current = setTimeout(load, first && !offline ? 0 : 2000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [first, waiting, offline, paper, load]);

  // Tell the sidebar when this paper moves on, so its status line stays true.
  const stageNow = paper?.stage;
  const titleNow = paper?.title;
  useEffect(() => {
    if (stageNow) window.dispatchEvent(new Event("papers-changed"));
  }, [stageNow, titleNow]);

  async function carryOn() {
    if (continuing) return;
    setContinuing(true);
    try {
      const res = await fetch(`/api/papers/${id}/continue`, { method: "POST" });
      const data = await res.json();
      if (data.paper) setPaper(data.paper);
    } catch {
      setOffline(true);
    } finally {
      setContinuing(false);
    }
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that paper</h1>
        <p className="lede">It may have been removed from this computer.</p>
        <p><Link href="/" className="btn">Upload a paper</Link></p>
      </div>
    );
  }
  if (!paper) {
    return offline ? (
      <div className="error" role="alert">We cannot reach the app right now. Check that it is running, and this page will try again.</div>
    ) : (
      <p className="muted">Opening your paper…</p>
    );
  }

  if (paper.stage === "stopped") {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <h1>{paper.title}</h1>
        <div className="card stack">
          <p>{paper.error?.message}</p>
          <div>
            <button className="btn" onClick={carryOn} aria-busy={continuing}>
              {continuing ? "Continuing…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (waiting) return <Waiting paper={paper} />;
  if (paper.stage === "answers") return <AnswerGrid paper={paper} onChange={setPaper} />;
  return <Results paper={paper} onChange={setPaper} />;
}

function Waiting({ paper }: { paper: PaperView }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const started = Date.parse(paper.startedAt ?? paper.createdAt);
  const long = now - started > 60_000;
  const fallback = paper.stage === "reading" ? "Reading your paper and finding the questions" : "Checking your answers";

  return (
    <div className="wait" role="status" aria-live="polite">
      <div className="dots" aria-hidden="true"><span /><span /><span /></div>
      <h2>{paper.label ?? fallback}</h2>
      <p className="muted" style={{ marginTop: 10 }}>
        {long
          ? "Still working. A long paper can take a few minutes. You can leave this page and come back; nothing will be lost."
          : paper.stage === "reading"
            ? "This usually takes about a minute."
            : "Almost there."}
      </p>
    </div>
  );
}

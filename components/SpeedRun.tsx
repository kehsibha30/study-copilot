"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeedView } from "@/app/api/speed/[id]/route";

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;
const store = (id: string) => `speed-run-${id}`;

// One drill: one question at a time, no clock on screen. Time on each question is measured quietly (only while the
// app is in front) and handed in with the answers, which are marked on the server. The answers are never in the page
// until the drill is handed in.
export default function SpeedRun({ id }: { id: string }) {
  const router = useRouter();
  const [run, setRun] = useState<SpeedView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const times = useRef<Record<string, number>>({});
  const atRef = useRef(0);
  const since = useRef<number | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const answering = Boolean(run && !run.submitted);

  const save = useCallback(
    (next: { answers?: Record<string, string>; at?: number }) => {
      try {
        window.localStorage.setItem(store(id), JSON.stringify({ answers: next.answers, at: next.at, times: times.current }));
      } catch {
        // Not remembered if storage is blocked; the drill still works.
      }
    },
    [id]
  );

  const startClock = useCallback(() => {
    since.current = document.visibilityState === "visible" ? performance.now() : null;
  }, []);
  const stopClock = useCallback(() => {
    if (since.current === null) return;
    const ms = Math.round(performance.now() - since.current);
    since.current = null;
    if (ms < 100) return;
    const k = String(atRef.current);
    times.current[k] = (times.current[k] ?? 0) + ms;
  }, []);

  useEffect(() => {
    fetch(`/api/speed/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) return setMissing(true);
        const d = await res.json();
        setRun(d.run);
        if (!d.run.submitted) {
          try {
            const saved = JSON.parse(window.localStorage.getItem(store(id)) ?? "null");
            if (saved) {
              setAnswers(saved.answers ?? {});
              times.current = saved.times ?? {};
              const i = Math.min(saved.at ?? 0, d.run.questions.length - 1);
              atRef.current = i;
              setAt(i);
            }
          } catch {
            // Nothing saved, or storage blocked: start from question 1.
          }
          startClock();
        }
      })
      .catch(() => setError("We could not open this drill. Refresh the page to try again."));
  }, [id, startClock]);

  useEffect(() => {
    if (!answering) return;
    const onVis = () => (document.visibilityState === "visible" ? startClock() : stopClock());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", stopClock);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", stopClock);
    };
  }, [answering, startClock, stopClock]);

  useEffect(() => {
    if (answering) field.current?.focus();
  }, [at, answering]);

  function go(next: number) {
    stopClock();
    atRef.current = next;
    setAt(next);
    save({ answers, at: next });
    startClock();
  }

  async function handIn() {
    if (busy || !run) return;
    setBusy(true);
    setError(null);
    stopClock();
    try {
      const res = await fetch(`/api/speed/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, times: times.current }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Your answers did not save. Press Hand in again.");
      setRun(d.run);
      try {
        window.localStorage.removeItem(store(id));
      } catch {
        // Nothing to clean up.
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answers did not save. Press Hand in again.");
      startClock();
    }
    setBusy(false);
  }

  async function again(body: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "We could not start that drill. Try again.");
      router.push(`/speed/run/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start that drill. Try again.");
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that drill</h1>
        <p><Link href="/speed" className="btn">Back to Speed</Link></p>
      </div>
    );
  }
  if (!run) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Getting your questions ready…</p>;

  const total = run.questions.length;

  if (!run.submitted) {
    const last = at === total - 1;
    const q = run.questions[at].q;
    const text = /probability/i.test(q);
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <div className="muted tiny">{run.topicLabel}{run.cardTitle ? ` · ${run.cardTitle}` : ""}</div>
          <div className="sp-bar" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={at + 1} aria-label="Question progress">
            <span style={{ width: `${((at + 1) / total) * 100}%` }} />
          </div>
          <div className="muted tiny">Question {at + 1} of {total}</div>
        </div>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (last) void handIn();
            else go(at + 1);
          }}
        >
          <p className="sp-q">{q}</p>
          <input
            ref={field}
            className="sp-in"
            type="text"
            inputMode={text ? "text" : "decimal"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={text ? "Your answer, like 3/8" : "Your answer"}
            aria-label="Your answer"
            value={answers[String(at)] ?? ""}
            onChange={(e) => {
              const next = { ...answers, [String(at)]: e.target.value };
              setAnswers(next);
              save({ answers: next, at });
            }}
          />
          <p className="muted tiny" style={{ margin: 0 }}>Not sure? Leave it blank and move on. A blank costs nothing; a wrong answer costs 1 point.</p>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="row">
            {at > 0 && <button type="button" className="btn ghost" onClick={() => go(at - 1)}>Back</button>}
            <button type="submit" className="btn" disabled={busy} style={{ flex: 1 }}>{last ? (busy ? "Marking…" : "Hand in") : "Next"}</button>
          </div>
        </form>
      </div>
    );
  }

  // ---------- after hand-in ----------
  const r = run.result!;
  const review = run.review!;
  const best = r.newBest ? r.avgMs : r.prevBestMs;
  let line: string;
  if (run.kind === "daily") line = `${r.right} of ${total} right today. A new round is waiting tomorrow.`;
  else if (run.kind === "card") line = `${r.right} of ${total} right with this shortcut. Nice start.`;
  else if (r.newBest && r.prevBestMs !== null) line = `New best: ${secs(r.avgMs)} a question, ${secs(r.prevBestMs - r.avgMs)} quicker than your old best. Nice work.`;
  else if (r.newBest) line = `That is your first best: ${secs(r.avgMs)} a question. Now see if you can beat it.`;
  else if (r.prevAvgMs !== null && r.prevAvgMs - r.avgMs >= 1000) line = `${secs(r.prevAvgMs - r.avgMs)} quicker a question than your last go. Nice work.`;
  else if (r.qualifying) line = `${r.right} of ${total} right at ${secs(r.avgMs)} a question.${best ? ` Your best is ${secs(best)}.` : ""} One more go?`;
  else line = `${r.right} of ${total} right. Look at the shortcuts once more, then have another go. It gets quicker each time.`;
  const missed = review.filter((x) => x.mark !== "right");
  const beat = run.kind === "topic" && run.topic ? { kind: "topic", topic: run.topic } : null;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <div className="muted tiny">{run.topicLabel}{run.cardTitle ? ` · ${run.cardTitle}` : ""} · {total} questions</div>
        <div className="sp-big">{secs(r.avgMs)} a question</div>
      </div>
      <div className="sp-good" role="status">{line}</div>
      <div className="sp-two">
        <div className="sp-m"><span className="muted tiny">Right</span><b>{r.right} of {total}</b></div>
        <div className="sp-m"><span className="muted tiny">Score</span><b>{r.score} of {total * 4}</b></div>
      </div>
      <p className="muted tiny" style={{ margin: 0 }}>Scoring: 4 for a right answer, minus 1 for a wrong one, 0 for a blank.{r.skipped > 0 ? ` ${r.skipped} left blank.` : ""}{run.kind === "topic" && !r.qualifying ? " A personal best needs at least 8 right." : ""}</p>

      {missed.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2>{missed.length === 1 ? "One to look at" : "To look at again"}</h2>
          {missed.map((m) => (
            <div key={m.q} className="card weak">
              <span style={{ fontWeight: 500 }}>{m.q}</span>
              <span className="muted tiny">{m.mark === "skipped" ? "Left blank." : `You wrote ${m.said}.`} The answer is {m.a}.</span>
              <span className="tiny">{m.how}</span>
              {m.card && <span className="muted tiny">Shortcut: {m.card}</span>}
            </div>
          ))}
          <p className="muted tiny" style={{ margin: 0 }}>These are saved in your report, so they come back when you practise.</p>
        </section>
      )}

      {error && <div className="error" role="alert">{error}</div>}
      <div className="stack" style={{ gap: 10 }}>
        {beat ? (
          <button type="button" className="btn wide" disabled={busy} onClick={() => again(beat)}>{best ? `Beat ${secs(Math.min(best, r.avgMs))}` : "Go again"}</button>
        ) : run.topic ? (
          <button type="button" className="btn wide" disabled={busy} onClick={() => again({ kind: "topic", topic: run.topic! })}>Try the 10-question drill</button>
        ) : (
          <Link href="/speed" className="btn wide" style={{ textAlign: "center" }}>Back to Speed</Link>
        )}
        <Link href={run.topic ? `/speed/${run.topic}` : "/speed"} className="muted tiny" style={{ textAlign: "center" }}>{run.topic ? "See the shortcuts again" : "See all shortcuts"}</Link>
      </div>
    </div>
  );
}

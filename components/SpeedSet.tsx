"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeedView } from "@/app/api/speed/[id]/route";
import { useGo } from "./useGo";

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

// One adaptive set of 10. The next question is made on the server after each answer, so the step is never on screen
// while the set is going (it would give away which answers were right). Time on each question is measured quietly.
// Right and wrong appear when the set ends.
export default function SpeedSet({ id }: { id: string }) {
  const { go, navigating } = useGo();
  const [run, setRun] = useState<SpeedView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const since = useRef<number | null>(null);
  const spent = useRef(0);
  const field = useRef<HTMLInputElement>(null);
  const index = run ? run.questions.length - 1 : 0;
  const answering = Boolean(run && !run.submitted);

  const startClock = useCallback(() => {
    since.current = document.visibilityState === "visible" ? performance.now() : null;
  }, []);
  const stopClock = useCallback(() => {
    if (since.current === null) return;
    spent.current += Math.round(performance.now() - since.current);
    since.current = null;
  }, []);

  useEffect(() => {
    fetch(`/api/speed/${id}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) return setMissing(true);
        const d = await res.json();
        setRun(d.run);
        spent.current = 0;
        startClock();
      })
      .catch(() => setError("We could not open this set. Refresh the page to try again."));
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
  }, [index, answering]);

  async function submit() {
    if (busy || !run) return;
    setBusy(true);
    setError(null);
    stopClock();
    try {
      const res = await fetch(`/api/speed/${id}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index, answer: text, ms: spent.current }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Your answer did not save. Press Next again.");
      setRun(d.run);
      setText("");
      spent.current = 0;
      startClock();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answer did not save. Press Next again.");
      startClock();
    }
    setBusy(false);
  }

  async function keepGoing() {
    if (busy || navigating || !run?.topic) return;
    setBusy(true);
    try {
      const res = await fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "adaptive", topic: run.topic }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "We could not start the next ten. Try again.");
      go(`/speed/run/${d.id}`);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start the next ten. Try again.");
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that set</h1>
        <p><Link href="/speed" className="btn">Back to Speed</Link></p>
      </div>
    );
  }
  if (!run) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Getting your questions ready…</p>;

  const size = run.setSize ?? 10;

  if (!run.submitted) {
    const q = run.questions[index];
    const last = index === size - 1;
    const letters = "abcdef";
    const probability = /probability/i.test(q.q);
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <div className="muted tiny">{run.topicLabel}</div>
          <div className="sp-bar" role="progressbar" aria-valuemin={1} aria-valuemax={size} aria-valuenow={index + 1} aria-label="Question progress">
            <span style={{ width: `${((index + 1) / size) * 100}%` }} />
          </div>
          <div className="muted tiny">Question {index + 1} of {size}</div>
        </div>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="sp-q">{q.q}</p>
          {q.opts ? (
            <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Choose an answer">
              {q.opts.map((o, i) => (
                <button key={o} type="button" role="radio" aria-checked={text === letters[i]} className={`sp-opt${text === letters[i] ? " on" : ""}`} onClick={() => setText(text === letters[i] ? "" : letters[i])}>
                  <b>{letters[i]}</b>
                  <span>{o}</span>
                </button>
              ))}
            </div>
          ) : (
            <input
              ref={field}
              className="sp-in"
              type="text"
              inputMode={probability ? "text" : "decimal"}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={probability ? "Your answer, like 3/8" : "Your answer"}
              aria-label="Your answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <p className="muted tiny" style={{ margin: 0 }}>Not sure? Leave it blank and move on. A blank costs nothing; a wrong answer costs 1 point.</p>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="btn wide" disabled={busy}>{busy ? "Saving…" : last ? (text ? "Finish" : "Finish with this blank") : text ? "Next" : "Skip"}</button>
        </form>
      </div>
    );
  }

  // ---------- end of the set ----------
  const r = run.result!;
  const set = run.set!;
  const review = run.review!;
  const missed = review.filter((x) => x.mark !== "right");
  const total = run.questions.length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="muted tiny">{run.topicLabel} · {total} questions</div>
      <div className="sp-big" style={{ fontSize: 24 }}>{set.line}</div>
      <div className="sp-ladder" aria-label={`Started at Step ${set.startStep}, now at Step ${set.endStep}`}>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <span key={n} className={n === set.endStep ? "on" : n === set.startStep ? "from" : ""}>{n}</span>
        ))}
      </div>
      <p className="muted tiny" style={{ margin: 0 }}>
        {set.startStep === set.endStep ? `Step ${set.endStep}.` : `Started at ${set.startStep}, now at ${set.endStep}.`}
        {set.newTop && r.prevTopStep ? ` New high: you got a Step ${set.topStep} question right.` : ""}
      </p>
      <div className="sp-rows">
        <div><span>Right</span><b>{r.right} of {total}</b></div>
        <div><span>Score</span><b>{r.score} of {total * 4}</b></div>
        <div><span>Average time</span><b>{secs(r.avgMs)}</b></div>
      </div>
      <p className="muted tiny" style={{ margin: 0 }}>Scoring: 4 for a right answer, minus 1 for a wrong one, 0 for a blank.{r.skipped > 0 ? ` ${r.skipped} left blank.` : ""}</p>

      {missed.length > 0 && (
        <details className="sp-look">
          <summary>{missed.length === 1 ? "1 to look at" : `${missed.length} to look at`}</summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            {missed.map((m) => (
              <div key={m.q} className="card weak">
                <span style={{ fontWeight: 500 }}>{m.q}</span>
                <span className="muted tiny">{m.mark === "skipped" ? "Left blank." : `You wrote ${m.said}.`} The answer is {m.a}.</span>
                <span className="tiny">{m.how}</span>
                {m.card && <span className="muted tiny">{m.card} · Step {m.step}</span>}
              </div>
            ))}
            <p className="muted tiny" style={{ margin: 0 }}>These are saved in your report, so they come back when you practise.</p>
          </div>
        </details>
      )}

      {error && <div className="error" role="alert">{error}</div>}
      <div className="stack" style={{ gap: 10 }}>
        <button type="button" className="btn wide" disabled={busy || navigating} onClick={keepGoing}>{busy ? "Getting your next ten ready…" : `Keep going: 10 more at Step ${set.endStep}`}</button>
        <Link href={run.topic ? `/speed/${run.topic}` : "/speed"} className="muted tiny" style={{ textAlign: "center" }}>That&apos;s enough for now</Link>
      </div>
    </div>
  );
}

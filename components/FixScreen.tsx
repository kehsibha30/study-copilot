"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FixView } from "@/lib/fix";
import LessonPicture from "./LessonPicture";

export default function FixScreen() {
  const { id, idea } = useParams<{ id: string; idea: string }>();
  const base = `/api/papers/${id}/fix/${idea}`;
  const [fix, setFix] = useState<FixView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(base, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFix(data.fix);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    }
  }, [base]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // First visit to this idea: begin building its walkthrough. Later visits only look.
      if (!data.fix) await start();
      else setFix(data.fix);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We cannot reach the app right now.");
    } finally {
      setLoaded(true);
    }
  }, [base, start]);

  const building = fix?.status === "building";
  useEffect(() => {
    if (loaded && !building) return;
    timer.current = setTimeout(load, loaded ? 2000 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loaded, building, fix, load]);

  async function move(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/act`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFix(data.fix);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // "Walk me through it": the long walkthrough, only after the new question was missed.
  async function deepen() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}?deep=1`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFix(data.fix);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const back = <Link href={`/papers/${id}`}>Back to your paper</Link>;

  if (!fix) {
    return (
      <div className="stack">
        {error ? <div className="error" role="alert">{error}</div> : <p className="muted">Opening…</p>}
        <p>{back}</p>
      </div>
    );
  }

  const figure = (page: number, fileIndex: number, has: boolean) => {
    const href = `/api/papers/${fix.paperId}/file/${fileIndex}${fix.isPdf ? `#page=${page}` : ""}`;
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {has ? `See the figure on page ${page}` : `Page ${page}`}
      </a>
    );
  };

  if (fix.status === "building") {
    return (
      <div className="wait" role="status" aria-live="polite">
        <div className="dots" aria-hidden="true"><span /><span /><span /></div>
        <h2>{fix.deep ? `Breaking question ${fix.anchor.n} into small steps` : `Getting your lesson on question ${fix.anchor.n} ready`}</h2>
        <p className="muted" style={{ marginTop: 10 }}>It is checked before you see it. This takes about half a minute.</p>
      </div>
    );
  }

  if (fix.status === "failed") {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <p className="crumb">{back}</p>
        <h1>{fix.idea.name}</h1>
        <div className="card stack">
          <p>{fix.error}</p>
          <div><button className="btn" onClick={start}>Try again</button></div>
        </div>
      </div>
    );
  }

  const c = fix.cursor;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <p className="crumb">{back} · {fix.paperTitle}</p>
      <div>
        <h1>{fix.idea.name}</h1>
      </div>

      {c.kind === "connect" && fix.explainer && (
        <details className="card qfold">
          <summary>
            <span className="muted tiny">Your question {fix.anchor.n} · you chose {fix.anchor.mine}</span>
          </summary>
          <p className="yourq" style={{ marginTop: 8 }}>{fix.anchor.text}</p>
          <p className="muted" style={{ marginTop: 8 }}>
            You chose {fix.anchor.mine}. {fix.anchor.options.find((o) => o.label === fix.anchor.mine)?.text} · {figure(fix.anchor.page, fix.anchor.fileIndex, fix.anchor.hasFigure)}
          </p>
        </details>
      )}

      {c.kind !== "done" && c.kind !== "retry" && c.kind !== "twist" && !(c.kind === "connect" && fix.explainer) && (
        <div className="card">
          <span className="muted tiny">
            Your question {fix.anchor.n} · {figure(fix.anchor.page, fix.anchor.fileIndex, fix.anchor.hasFigure)}
          </span>
          <p className="yourq" style={{ marginTop: 6 }}>{fix.anchor.text}</p>
          <p className="muted" style={{ marginTop: 8 }}>
            You chose {fix.anchor.mine}. {fix.anchor.options.find((o) => o.label === fix.anchor.mine)?.text}
          </p>
        </div>
      )}

      <div className="card">
        {fix.trail.length > 0 && c.kind !== "done" && c.kind !== "retry" && c.kind !== "twist" && (
          <div className="trail" style={{ marginBottom: 16 }}>
            {fix.trail.map((t, i) => (
              <div key={i}>{t.ask} <b>{t.answer}</b></div>
            ))}
          </div>
        )}

        {c.kind === "step" && fix.step && (
          <>
            <div className="stepno">Step {c.index + 1} of {fix.totalSteps}</div>
            <p className="ask">{fix.step.ask}</p>
            {/* Tapping an option is the answer. A right one moves on by itself. */}
            {fix.step.options.map((o, i) => {
              const cls = o.right === true ? " good" : o.right === false ? " bad" : "";
              const locked = fix.step!.done || o.tried;
              return (
                <div key={i}>
                  <button
                    type="button"
                    className={`pick${cls}${locked && !cls ? " off" : ""}`}
                    onClick={() => !locked && move({ type: "choose", choice: i })}
                  >
                    {o.text}
                  </button>
                  {o.say && <p className="say">{o.say}</p>}
                </div>
              );
            })}
            {fix.step.hint && !fix.step.done && <div className="hint">Hint: {fix.step.hint}</div>}
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              {fix.step.done ? (
                <button className="btn" onClick={() => move({ type: "next" })} aria-busy={busy}>
                  {c.index + 1 < fix.totalSteps ? "Next step" : "Put it together"}
                </button>
              ) : (
                <span className="row" style={{ gap: 18 }}>
                  {!fix.step.hint && <button className="linkbtn" onClick={() => move({ type: "hint" })}>Show a hint</button>}
                  <button className="linkbtn" onClick={() => move({ type: "skip" })}>I don&apos;t know, show me</button>
                </span>
              )}
              {fix.hasTwist && (
                <button className="linkbtn" onClick={() => move({ type: "jump" })}>I know this, test me</button>
              )}
            </div>
          </>
        )}

        {c.kind === "connect" && fix.explainer && (
          <>
            <p className="why">{fix.explainer.why}</p>
            {fix.explainer.picture && <LessonPicture picture={fix.explainer.picture} />}
            <p className="rule">{fix.connect || fix.idea.explain}</p>
            <button className="btn" onClick={() => move({ type: "next" })} aria-busy={busy}>
              Try a new question
            </button>
          </>
        )}

        {c.kind === "connect" && !fix.explainer && (
          <>
            <div className="stepno">Put it together</div>
            <p className="ask" style={{ marginBottom: 16 }}>{fix.connect || fix.idea.explain}</p>
            <button className="btn" onClick={() => move({ type: "next" })} aria-busy={busy}>
              Try a new one
            </button>
          </>
        )}

        {c.kind === "twist" && fix.twist && (
          <>
            <div className="stepno">Your turn, no hints. Tap your answer.</div>
            <p className="yourq" style={{ margin: "6px 0 12px" }}>{fix.twist.text}</p>
            {fix.twist.options.map((o, i) => {
              const mine = fix.twist!.chosen === i;
              const cls = o.right === true ? " good" : mine && o.right === false ? " bad" : "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`pick${cls}${fix.twist!.done && !cls ? " off" : ""}`}
                  onClick={() => !fix.twist!.done && move({ type: "choose", choice: i })}
                >
                  {o.text}
                  {fix.twist!.done && mine && <span className="tag" style={{ float: "right", fontSize: 13 }}>You chose this</span>}
                </button>
              );
            })}
            {fix.twist.explain && <p className="say" style={{ paddingLeft: 0, marginTop: 12 }}>{fix.twist.explain}</p>}
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              {fix.twist.done ? (
                <span className="row" style={{ gap: 18 }}>
                  <button className="btn" onClick={() => move({ type: "next" })} aria-busy={busy}>Carry on</button>
                  {fix.canDeepen && <button className="linkbtn" onClick={deepen}>Walk me through it</button>}
                </span>
              ) : (
                <button className="linkbtn" onClick={() => move({ type: "skip" })}>I don&apos;t know</button>
              )}
            </div>
          </>
        )}

        {c.kind === "retry" && fix.retry && (
          <>
            <div className="stepno">
              Now try your question {fix.retry.question.n} again · {figure(fix.retry.question.page, fix.retry.question.fileIndex, fix.retry.question.hasFigure)}
            </div>
            <p className="yourq" style={{ margin: "6px 0 12px" }}>{fix.retry.question.text}</p>
            {fix.retry.question.options.map((o) => {
              const answered = fix.retry!.chosen !== null;
              const mine = fix.retry!.chosen === o.label;
              const right = answered && fix.retry!.correct === o.label;
              const cls = right ? " good" : mine && answered ? " bad" : "";
              return (
                <button
                  key={o.label}
                  type="button"
                  className={`pick${cls}${answered && !cls ? " off" : ""}`}
                  onClick={() => !answered && move({ type: "retry", label: o.label })}
                >
                  {o.label}. {o.text}
                </button>
              );
            })}
            <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
              {fix.retry.chosen !== null ? (
                <button className="btn" onClick={() => move({ type: "next" })} aria-busy={busy}>
                  {fix.retry.left > 1 ? "Next question" : "Finish"}
                </button>
              ) : (
                <button className="linkbtn" onClick={() => move({ type: "skip" })}>I don&apos;t know</button>
              )}
            </div>
          </>
        )}

        {c.kind === "done" && fix.done && (
          <>
            <h2>
              {fix.done.outcome === "solved_alone"
                ? "You solved a new one on your own."
                : fix.done.outcome === "needs_more"
                  ? "Not there yet. This idea needs another go."
                  : "You have been through the steps."}
            </h2>
            <p className="muted" style={{ margin: "8px 0 16px" }}>
              {fix.done.outcome === "walked_through" && "There was no new question this time, so we cannot say yet whether it has stuck. "}
              {fix.done.retriesTotal > 0 &&
                `On your second try you got ${fix.done.retriesRight} of ${fix.done.retriesTotal} of your other ${fix.done.retriesTotal === 1 ? "question" : "questions"} right.`}
            </p>
            {/* One next step: the next thing to practise, or a new paper once this one is finished. */}
            {fix.done.next ? (
              <Link className="btn" href={`/papers/${fix.paperId}/fix/${fix.done.next.id}`}>
                Next: practise &ldquo;{fix.done.next.name}&rdquo;
              </Link>
            ) : (
              <div className="row">
                <Link className="btn" href="/">Upload another paper</Link>
                <Link className="btn ghost" href={`/papers/${fix.paperId}`}>Back to your paper</Link>
              </div>
            )}
          </>
        )}

        {error && <div className="error" role="alert" style={{ marginTop: 14 }}>{error}</div>}

        {c.kind !== "done" && <Doubts fix={fix} base={base} onChange={setFix} />}

        {c.kind !== "done" && c.kind !== "retry" && (
          <p style={{ marginTop: 14 }}>
            {fix.flagged ? (
              <span className="muted tiny">Thanks. This is marked to be looked at.</span>
            ) : (
              <button className="linkbtn" onClick={() => move({ type: "flag" })}>This looks wrong</button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Doubts({ fix, base, onChange }: { fix: FixView; base: string; onChange: (f: FixView) => void }) {
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "This looks wrong" on one answer, and taking it back. Nothing is asked of the AI.
  async function flag(index: number) {
    setError(null);
    try {
      const res = await fetch(`${base}/act`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "flagDoubt", index }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.fix);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That did not go through. Try again.");
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (asking) return;
    if (!text.trim()) return setError("Type your doubt first.");
    setAsking(true);
    setError(null);
    try {
      const res = await fetch(`${base}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.fix);
      setText("");
    } catch (err) {
      // The typed doubt stays in the box so it can be sent again.
      setError(err instanceof Error && err.message ? err.message : "That did not go through. Ask again.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="doubts">
      {fix.doubts.map((d, i) => (
        <div key={i}>
          <div className="doubt-q">You asked: {d.q}</div>
          <div className={d.flagged ? "doubt-a off" : "doubt-a"}>{d.a}</div>
          <p className="doubt-note">
            {d.flagged ? (
              <>You said this looks wrong. Do not rely on it; ask your teacher. <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => flag(i)}>Undo</button></>
            ) : (
              <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => flag(i)}>This looks wrong</button>
            )}
          </p>
        </div>
      ))}
      {asking && <p className="muted" role="status" style={{ marginBottom: 10 }}>Thinking about your doubt…</p>}
      <form className="askrow" onSubmit={ask}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          placeholder="Stuck? Ask a doubt about this"
          aria-label="Ask a doubt"
        />
        <button className="btn ghost" type="submit" aria-busy={asking}>Ask</button>
      </form>
      {error && <div className="error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

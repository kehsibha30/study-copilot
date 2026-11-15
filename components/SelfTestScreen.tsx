"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SelfTestView } from "@/lib/selftest";

export default function SelfTestScreen() {
  const { id } = useParams<{ id: string }>();
  const base = `/api/self-test/${id}`;
  const [test, setTest] = useState<SelfTestView | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.status === 404) return setMissing(true);
      const data = await res.json();
      setTest(data.test);
      setNow(Date.now());
    } catch {
      setError("We cannot reach the app right now. This page will try again.");
    }
  }, [base]);

  // First look straight away; while the questions are being written, look again every two seconds.
  const building = test?.status === "building";
  useEffect(() => {
    if (test && !building) return;
    if (missing) return;
    timer.current = setTimeout(load, test ? 2000 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [test, building, missing, load]);

  async function move(body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.test) setTest(data.test);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    }
  }

  async function handIn() {
    if (busy) return;
    setBusy(true);
    await move({ type: "submit" });
    setBusy(false);
    window.scrollTo({ top: 0 });
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that set</h1>
        <p><Link href="/self-test" className="btn">Test yourself</Link></p>
      </div>
    );
  }
  if (!test) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Opening your questions…</p>;

  const about = test.topics.map((t) => t.topic).join(", ");

  if (test.status === "building") {
    const long = now - Date.parse(test.createdAt) > 60_000;
    return (
      <div className="wait" role="status" aria-live="polite">
        <div className="dots" aria-hidden="true"><span /><span /><span /></div>
        <h2>{test.recheck ? "Writing your check questions" : `Writing new questions on ${about}`}</h2>
        <p className="muted" style={{ marginTop: 10 }}>
          {long
            ? "Still working. You can leave this page and come back; nothing will be lost."
            : "Each question is solved a second time to check it before you see it. This takes about a minute."}
        </p>
      </div>
    );
  }

  if (test.status === "failed") {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <h1>{test.recheck ? "Check again" : "Test yourself"}</h1>
        <div className="card stack">
          <p>{test.error}</p>
          <div><button className="btn" onClick={() => move({ type: "retry" })}>Try again</button></div>
        </div>
      </div>
    );
  }

  const unanswered = test.questions.filter((q) => q.chosen === null).length;
  const r = test.result;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <p className="muted tiny">{about}</p>
        {r ? (
          <>
            <h1>You got {r.right} of {r.counted} right.</h1>
            <div className="row" style={{ marginTop: 16 }}>
              {/* One next step: the lesson for the first idea missed, or back to the list when nothing was missed. */}
              {r.next ? (
                <Link href={r.next.href} className="btn">Next: practise &ldquo;{r.next.name}&rdquo;</Link>
              ) : (
                <Link href="/work-on" className="btn">See what to work on</Link>
              )}
            </div>
          </>
        ) : (
          <>
            <h1>{test.recheck ? "Check again" : "Test yourself"}</h1>
            <p className="lede">
              {test.recheck
                ? `${test.questions.length === 1 ? "1 new question" : `${test.questions.length} new questions`} on things you practised a few days ago. No hints.`
                : `${test.questions.length} new questions. Tap your answer for each one; you can change it until you check.`}
            </p>
          </>
        )}
      </div>

      {test.questions.map((q, i) => (
        <div className="card" key={i}>
          <div className="stepno">Question {i + 1}{test.recheck ? "" : ` · ${q.level}`}</div>
          <p className="yourq" style={{ margin: "6px 0 10px" }}>{q.text}</p>
          {q.options.map((o, j) => {
            const mine = q.chosen === j;
            const cls = test.submitted ? (o.right ? " good" : mine ? " bad" : " off") : mine ? " sel" : "";
            return (
              <button
                key={j}
                type="button"
                className={`pick${cls}`}
                aria-pressed={mine}
                onClick={() => {
                  if (test.submitted) return;
                  // Shown at once; saved in the background so a refresh keeps it.
                  setTest({ ...test, questions: test.questions.map((x, k) => (k === i ? { ...x, chosen: j } : x)) });
                  move({ type: "answer", index: i, choice: j });
                }}
              >
                {o.text}
                {test.submitted && mine && <span className="tag" style={{ float: "right", fontSize: 13 }}>You chose this</span>}
              </button>
            );
          })}
          {test.submitted && (
            <>
              {q.chosen === null && <p className="say" style={{ paddingLeft: 0, marginTop: 10 }}>Not answered.</p>}
              {q.explain && <p className="say" style={{ paddingLeft: 0, marginTop: 10 }}>{q.explain}</p>}
              <p className="muted tiny" style={{ marginTop: 10 }}>
                {q.concept && (q.lesson ? <Link href={q.lesson}>{q.concept}</Link> : q.concept)}
                {" · "}
                {q.flagged ? (
                  <>
                    Left out of your marks. <button className="linkbtn" onClick={() => move({ type: "flag", index: i })}>Count it again</button>
                  </>
                ) : (
                  <button className="linkbtn" onClick={() => move({ type: "flag", index: i })}>This looks wrong</button>
                )}
              </p>
            </>
          )}
        </div>
      ))}

      {error && <div className="error" role="alert">{error}</div>}

      {!test.submitted && (
        <div className="row">
          <button className="btn" onClick={handIn} aria-busy={busy}>Check my answers</button>
          {unanswered > 0 && <span className="muted tiny">{unanswered} not answered yet. They will count as wrong.</span>}
        </div>
      )}

      {test.submitted && (
        <div>
          <details className="quiet">
            <summary>How these questions were made</summary>
            <div className="inner stack muted">
              <p>
                The AI wrote these from what you got wrong on your papers, then solved each one a second time without seeing the answer. A question
                was used only if both agreed. The AI can still be wrong. If a question looks wrong to you, say so and it is left out of your marks.
              </p>
              <p>AI cost for this set: ${test.costUsd.toFixed(2)}</p>
            </div>
          </details>
          <details className="quiet">
            <summary>{test.excluded ? "This set is left out of what to work on" : "Was this a test run?"}</summary>
            <div className="inner stack muted">
              <div>
                <button className="linkbtn" onClick={() => move({ type: "exclude", excluded: !test.excluded })}>
                  {test.excluded ? "Count this set again" : "Leave this set out"}
                </button>
              </div>
            </div>
          </details>
          {!test.recheck && <p style={{ marginTop: 12 }}><Link href="/self-test">Test yourself again</Link></p>}
        </div>
      )}
    </div>
  );
}

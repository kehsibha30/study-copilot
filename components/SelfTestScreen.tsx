"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clock } from "@/lib/format";
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

  // ---------- quiet timing: active time on the question on screen, paused while the app is not in front ----------
  const [at, setAt] = useState(0);
  const atRef = useRef(0);
  const since = useRef<number | null>(null);
  const answering = test?.status === "ready" && !test.submitted;

  const startClock = useCallback(() => {
    since.current = document.visibilityState === "visible" ? performance.now() : null;
  }, []);
  const stopClock = useCallback(async () => {
    if (since.current === null) return;
    const ms = Math.round(performance.now() - since.current);
    since.current = null;
    if (ms < 300) return;
    try {
      // keepalive: still sent if the page is closing.
      await fetch(base, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "time", index: atRef.current, ms }) });
    } catch {
      // A lost time slice is not worth an error on the child's screen.
    }
  }, [base]);

  // Start on the first unanswered question (a refresh or a return carries on where he was), and keep the clock honest.
  const started = useRef(false);
  useEffect(() => {
    if (!answering || started.current || !test) return;
    started.current = true;
    const first = Math.max(0, test.questions.findIndex((q) => q.chosen === null));
    atRef.current = first;
    setAt(first);
    startClock();
  }, [answering, test, startClock]);
  useEffect(() => {
    if (!answering) return;
    const onVis = () => (document.visibilityState === "visible" ? startClock() : void stopClock());
    const onHide = () => void stopClock();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, [answering, startClock, stopClock]);

  function go(next: number) {
    void stopClock();
    atRef.current = next;
    setAt(next);
    startClock();
    window.scrollTo({ top: 0 });
  }

  async function handIn() {
    if (busy) return;
    setBusy(true);
    // The last question's time is saved before the set is closed; after hand-in no time is taken.
    await stopClock();
    await move({ type: "submit" });
    setBusy(false);
    window.scrollTo({ top: 0 });
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that set</h1>
        <p><Link href="/self-test" className="btn">Practice</Link></p>
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
        <h1>{test.recheck ? "Check again" : "Practice"}</h1>
        <div className="card stack">
          <p>{test.error}</p>
          <div><button className="btn" onClick={() => move({ type: "retry" })}>Try again</button></div>
        </div>
      </div>
    );
  }

  const unanswered = test.questions.filter((q) => q.chosen === null).length;
  const r = test.result;

  // Answering: one question at a time, timed quietly (no clock on screen; decision 16 Nov 2026, option A).
  if (!test.submitted) {
    const q = test.questions[at] ?? test.questions[0];
    const i = test.questions[at] ? at : 0;
    const last = i === test.questions.length - 1;
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="muted tiny" style={{ margin: 0 }}>{test.recheck ? "Check again" : about}</p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted tiny">Question {i + 1} of {test.questions.length}</span>
            {!test.recheck && <span className="pill">{q.level}</span>}
          </div>
          <div className="bar-track" role="progressbar" aria-valuenow={i + 1} aria-valuemin={1} aria-valuemax={test.questions.length} aria-label={`Question ${i + 1} of ${test.questions.length}`}>
            <div style={{ width: `${((i + 1) / test.questions.length) * 100}%` }} />
          </div>
        </div>
        <p className="yourq" style={{ margin: 0, fontSize: 21 }}>{q.text}</p>
        <div role="radiogroup" aria-label="Options">
          {q.options.map((o, j) => {
            const mine = q.chosen === j;
            return (
              <button
                key={j}
                type="button"
                role="radio"
                aria-checked={mine}
                className={`pick${mine ? " sel" : ""}`}
                onClick={() => {
                  // Shown at once; saved in the background so a refresh keeps it.
                  setTest({ ...test, questions: test.questions.map((x, k) => (k === i ? { ...x, chosen: j } : x)) });
                  move({ type: "answer", index: i, choice: j });
                }}
              >
                {o.text}
              </button>
            );
          })}
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row" style={{ flexWrap: "nowrap" }}>
          {i > 0 && <button type="button" className="btn ghost" onClick={() => go(i - 1)}>Back</button>}
          {last ? (
            <button type="button" className="btn" style={{ flexGrow: 1 }} onClick={handIn} aria-busy={busy} disabled={busy}>
              {busy ? "Checking…" : "Check my answers"}
            </button>
          ) : (
            <button type="button" className="btn" style={{ flexGrow: 1 }} onClick={() => go(i + 1)}>Next</button>
          )}
        </div>
        {last && unanswered > 0 && <p className="muted tiny" style={{ margin: 0 }}>{unanswered} not answered yet. They will count as wrong.</p>}
        <p className="muted tiny" style={{ margin: 0, textAlign: "center" }}>No clock. Take the time you need; you will see your time when you hand in.</p>
      </div>
    );
  }

  const tm = test.timing;
  const longest = Math.max(1, ...test.questions.map((x) => x.ms ?? 0));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <p className="muted tiny">{about}</p>
        {r && (
          <>
            <h1>You got {r.right} of {r.counted} right.</h1>
            <div className="row" style={{ marginTop: 16 }}>
              {/* One next step: the lesson for the first idea missed. Chapter and mixed sets go back to Practice, where the
                  chapter now shows this score (What to work on is built from papers and can be empty). Found 16 Nov 2026:
                  a chapter set with no paper behind it led to "Upload a paper". */}
              {r.next ? (
                <Link href={r.next.href} className="btn">Next: practise &ldquo;{r.next.name}&rdquo;</Link>
              ) : test.mode === "mistakes" && !test.recheck ? (
                <Link href="/work-on" className="btn">See what to work on</Link>
              ) : (
                <>
                  <Link href="/self-test" className="btn">Back to Practice</Link>
                  <Link href="/report" className="muted tiny">See your report</Link>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {tm && (
        <>
          <div className="stats">
            <div className="stat"><div className="l">Right</div><div className="n">{r ? `${r.right} of ${r.counted}` : "–"}</div></div>
            <div className="stat"><div className="l">Time</div><div className="n">{clock(tm.totalMs)}</div><div className="muted tiny">Pace for {test.questions.length}: about {clock(tm.paceMs)}</div></div>
          </div>
          <section className="card stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 17, fontFamily: "inherit", fontWeight: 600 }}>How the time went</h2>
            <div className="split">
              <div className="good"><b>{tm.split.quickRight}</b> quick and right</div>
              <div className="warn"><b>{tm.split.slowRight}</b> right, but slow</div>
              <div className="bad"><b>{tm.split.quickWrong}</b> wrong, and quick</div>
              <div className="plain"><b>{tm.split.slowWrong}</b> wrong after a long time</div>
            </div>
            <p className="muted tiny" style={{ margin: 0 }}>
              Quick means at or under your usual {clock(tm.usualMs)} a question. A wrong answer given quickly is often a trap, not a gap: slow down on those.
            </p>
          </section>
          <section>
            <h2 style={{ marginBottom: 8 }}>Each question</h2>
            {test.questions.map((x, k) => {
              const right = x.chosen !== null && x.options[x.chosen]?.right === true;
              const slow = (x.ms ?? 0) > tm.usualMs;
              const label = x.flagged ? "Left out" : right ? (slow ? "Right, slow" : "Right") : x.chosen === null ? "Not answered" : slow ? "Wrong" : "Wrong, quick";
              const tone = x.flagged ? "plain" : right ? (slow ? "warn" : "good") : "bad";
              return (
                <a key={k} href={`#q${k + 1}`} className="qtime">
                  <span>{k + 1}</span>
                  <span className="qbar"><span className={tone} style={{ width: `${Math.max(4, ((x.ms ?? 0) / longest) * 100)}%` }} /><span className={`t ${tone}`}>{label}</span></span>
                  <span className="num">{x.ms ? clock(x.ms) : "–"}</span>
                </a>
              );
            })}
          </section>
        </>
      )}

      {test.questions.map((q, i) => (
        <div className="card" key={i} id={`q${i + 1}`}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="stepno">Question {i + 1}{test.recheck ? "" : ` · ${q.level}`}</div>
            {q.ms && <span className="muted tiny num">{clock(q.ms)}</span>}
          </div>
          <p className="yourq" style={{ margin: "6px 0 10px" }}>{q.text}</p>
          {q.options.map((o, j) => {
            const mine = q.chosen === j;
            const cls = o.right ? " good" : mine ? " bad" : " off";
            return (
              <div key={j} className={`pick${cls}`}>
                {o.text}
                {mine && <span className="tag" style={{ float: "right", fontSize: 13 }}>You chose this</span>}
              </div>
            );
          })}
          {q.chosen === null && <p className="say" style={{ paddingLeft: 0, marginTop: 10 }}>Not answered.</p>}
          {q.why && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ fontWeight: 600 }}>Why that option tempts</div>
              <p className="say" style={{ paddingLeft: 0, margin: "2px 0 0" }}>{q.why}</p>
            </div>
          )}
          {q.explain && (
            <div style={{ marginTop: 10 }}>
              {q.why && <div className="tiny" style={{ fontWeight: 600 }}>Why the right answer is right</div>}
              <p className="say" style={{ paddingLeft: 0, margin: "2px 0 0" }}>{q.explain}</p>
            </div>
          )}
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
        </div>
      ))}

      {error && <div className="error" role="alert">{error}</div>}

      {test.submitted && (
        <div>
          <details className="quiet">
            <summary>How these questions were made</summary>
            <div className="inner stack muted">
              <p>
                {test.mode === "chapter"
                  ? `The AI wrote these on ${test.basis ?? "this chapter"}, from the NCERT Class 8 syllabus`
                  : test.mode === "mixed"
                    ? `The AI wrote these on the chapters of ${test.basis ?? "your last paper"}, at its level`
                    : "The AI wrote these from what you got wrong on your papers"}
                , then solved each one a second time without seeing the answer. A question was used only if both agreed. The AI can still be wrong. If a
                question looks wrong to you, say so and it is left out of your marks.
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
          {!test.recheck && <p style={{ marginTop: 12 }}><Link href="/self-test">Practise again</Link></p>}
        </div>
      )}
    </div>
  );
}

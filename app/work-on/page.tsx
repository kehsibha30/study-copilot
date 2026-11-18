"use client";

import CalcSection from "@/components/CalcSection";
import Link from "next/link";
import { useGo } from "@/components/useGo";
import { useEffect, useState } from "react";
import { day } from "@/lib/format";
import type { ConceptRow, WorkOn } from "@/lib/workon";

export default function WorkOnPage() {
  const [report, setReport] = useState<WorkOn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const { go, navigating } = useGo();

  // Starts the check questions. A second tap gets the same set back, so nothing is written twice.
  async function startCheck() {
    if (busy || navigating) return;
    setBusy(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/self-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recheck: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      go(`/self-test/${data.id}`);
      setBusy(false);
    } catch (e) {
      setCheckError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/work-on", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  if (error) return <div className="error" role="alert">{error}</div>;
  if (!report) return <p className="muted">Looking through your papers…</p>;

  // No paper yet. Chapter practice still counts: show it, and point to Practice rather than a dead end.
  if (report.papers === 0) {
    const weak = report.practice.filter((p) => p.total > 0 && p.right / p.total < 0.6);
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1>What to work on</h1>
          <p className="lede">
            {report.practice.length === 0
              ? "Practise a chapter, or upload a test paper. What to work on builds up from both."
              : weak.length > 0
                ? `From your chapter practice: ${weak.map((p) => p.topic).join(", ")} ${weak.length === 1 ? "needs" : "need"} more work.`
                : "From your chapter practice so far. A test paper adds the ideas behind your mistakes."}
          </p>
        </div>
        {report.practice.length > 0 && (
          <div className="card" style={{ padding: "6px 22px" }}>
            {report.practice.map((p) => (
              <div className="trow" key={`${p.subject}|${p.topic}`}>
                <div>
                  <div>{p.topic}</div>
                  <div className="sub">{p.subject}</div>
                </div>
                <span className={p.right / p.total < 0.6 ? "pill bad" : "pill"}>{p.right} of {p.total} right</span>
              </div>
            ))}
          </div>
        )}
        <CalcSection calc={report.calc} />
        <div className="row">
          <Link href={weak[0] ? `/self-test?topic=${encodeURIComponent(`${weak[0].subject}|${weak[0].topic}`)}` : "/self-test"} className="btn">
            {weak[0] ? `Practise ${weak[0].topic} again` : "Practise a chapter"}
          </Link>
          <Link href="/" className="muted tiny">or upload a test paper</Link>
        </div>
      </div>
    );
  }

  const from = `From your ${report.papers === 1 ? "paper" : `${report.papers} papers`}.`;
  const checks = report.due.length;
  const checkLine = checks === 1 ? "1 new question" : `${checks} new questions`;
  const practiseCls = checks > 0 || report.recheckWaiting ? "btn ghost" : "btn";
  const headline =
    report.open === 0
      ? checks > 0 || report.recheckWaiting
        ? "Time to check what you practised"
        : "Nothing to work on right now."
      : report.open > 3
        ? "3 things to work on first"
        : `${report.open} ${report.open === 1 ? "thing" : "things"} to work on`;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1>{headline}</h1>
        <p className="lede">
          {from}
          {report.open > 3 && ` ${report.open} in all; the rest are under each subject below.`}
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          {/* One main step. A check that is due comes first: it is short, and waiting makes it less useful. */}
          {report.recheckWaiting ? (
            <Link href={`/self-test/${report.recheckWaiting}`} className="btn">Carry on: your check questions</Link>
          ) : checks > 0 ? (
            <button className="btn" onClick={startCheck} aria-busy={busy || navigating} disabled={navigating}>{busy || navigating ? "Starting…" : `Check again: ${checkLine}`}</button>
          ) : null}
          {report.next ? (
            <>
              <Link href={report.next.href} className={practiseCls}>
                {report.next.started ? "Carry on" : "Next: practise"} &ldquo;{report.next.name}&rdquo;
              </Link>
              {practiseCls === "btn" && <span className="muted tiny">A few short steps, then one new question.</span>}
            </>
          ) : (
            <Link href="/" className={practiseCls}>Upload another paper</Link>
          )}
        </div>
        {(checks > 0 || report.recheckWaiting) && (
          <p className="muted tiny" style={{ marginTop: 10 }}>You got these right a few days ago. This checks they have stayed. No hints.</p>
        )}
        {checkError && <div className="error" role="alert" style={{ marginTop: 12 }}>{checkError}</div>}
      </div>

      {report.focus.length > 0 && (
        <div className="card" style={{ padding: "6px 22px" }}>
          {report.focus.map((c, i) => (
            <div className="trow" key={c.name}>
              <div>
                <Link href={c.href}>{i + 1}. {c.name}</Link>
                <div className="sub">{c.subject} · {c.topic}</div>
              </div>
              <State c={c} />
            </div>
          ))}
        </div>
      )}

      {report.open > 0 && (
        <div><Link href="/self-test" className="btn ghost">Practise on new questions</Link></div>
      )}

      {report.checking.length + report.held.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 10 }}>Practised</h2>
          <div className="card" style={{ padding: "6px 22px" }}>
            {[...report.checking, ...report.held].map((c) => (
              <div className="trow" key={c.name}>
                <div>
                  <div>{c.name}</div>
                  <div className="sub">{c.subject} · {c.topic}</div>
                </div>
                {c.status === "held" ? (
                  <span className="pill">Right again on {day(c.since)}</span>
                ) : (
                  <span className="side-note">Check again on {c.checkOn ? day(c.checkOn) : "a later day"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.subjects.map((s) => (
        <details className="idea" key={s.name}>
          <summary>
            <div>
              <h3>{s.name}</h3>
              <p className="muted" style={{ marginTop: 4 }}>{s.counted === 0 ? "None answered yet" : `${s.right} of ${s.counted} right`}</p>
            </div>
            <span className={`pill${s.toWork > 0 ? " warn" : ""}`}>
              {s.toWork === 0 ? "Nothing to work on" : `${s.toWork} ${s.toWork === 1 ? "topic" : "topics"} to work on`}
            </span>
          </summary>
          <div className="body">
            {s.topics.map((t) => (
              <div className="trow" key={t.name}>
                <div>
                  <div><Link href={`/topic?s=${encodeURIComponent(s.name)}&t=${encodeURIComponent(t.name)}`}>{t.name}</Link></div>
                  {t.concepts.map((c) => (
                    <div className="sub" key={c.name}><Link href={c.href}>{c.name}</Link></div>
                  ))}
                  {t.slippedAt && <div className="sub">Missed on a new question on {day(t.slippedAt)}</div>}
                </div>
                <div className="side-note">
                  {/* Too few questions is said plainly, not drawn as a score. */}
                  {t.counted >= 3 && <span className="meter" aria-hidden="true"><i style={{ width: `${Math.round((t.right / t.counted) * 100)}%` }} /></span>}
                  {t.counted === 0 ? "Not answered" : `${t.right} of ${t.counted} right`}
                  {t.counted > 0 && t.counted < 3 && <div>Too few to tell</div>}
                </div>
              </div>
            ))}
          </div>
        </details>
      ))}

      <CalcSection calc={report.calc} />

      {report.leftOut > 0 && (
        <p className="muted tiny">
          {report.leftOut} {report.leftOut === 1 ? "paper is" : "papers are"} left out as test runs.
        </p>
      )}
    </div>
  );
}

function State({ c }: { c: ConceptRow }) {
  const seen = `Wrong in ${c.papers} ${c.papers === 1 ? "paper" : "papers"}`;
  if (c.status === "slipped") return <span className="pill warn">Wrong again on {day(c.since)}</span>;
  if (c.test === "missed") return <span className="pill warn">Missed on new questions</span>;
  if (c.state === "needs_more") return <span className="pill warn">Come back to this</span>;
  if (c.state === "walked_through") return <span className="side-note">Walked through</span>;
  return c.papers > 1 ? <span className="pill warn">{seen}</span> : <span className="side-note">{seen}</span>;
}

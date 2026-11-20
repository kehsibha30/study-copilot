"use client";

import Link from "next/link";
import { useState } from "react";
import type { PaperView, QuestionView } from "@/lib/view";

export default function Results({ paper, onChange }: { paper: PaperView; onChange: (p: PaperView) => void }) {
  const [error, setError] = useState<string | null>(null);
  const s = paper.summary!;
  const byN = new Map(paper.questions.map((q) => [q.n, q]));
  const top = paper.ideas[0];
  const nextIdea = paper.ideas.find((i) => i.state === "new" || i.state === "started");
  const nextUp = nextIdea?.id;
  const of = (v: QuestionView["verdict"]) => paper.questions.filter((q) => q.verdict === v);
  const unsure = of("unsure");
  const reported = of("reported");
  const skipped = of("skipped");
  const written = of("written");

  async function report(n: number, on: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paper.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, reported: on }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.paper);
    } catch {
      setError("That did not go through. Try again.");
    }
  }

  async function leaveOut(on: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paper.id}/exclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: on }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.paper);
    } catch {
      setError("That did not go through. Try again.");
    }
  }

  let headline: string;
  if (s.wrong === 0) headline = s.counted > 0 ? "No mistakes. Every answer we could check is right." : "We could not check any answers on this paper.";
  else if (top && top.questions.length > 1 && paper.ideas.length > 1)
    headline = `${s.wrong} mistakes. ${top.questions.length} of them come from one idea.`;
  else if (top && top.questions.length > 1) headline = `${s.wrong} mistakes, all from one idea.`;
  else headline = s.wrong === 1 ? "1 mistake." : `${s.wrong} mistakes, each from a different idea.`;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <p className="muted tiny">{paper.title}</p>
        <h1>{headline}</h1>
        <p className="lede">
          You got {s.correct} of {s.counted} right
          {s.skipped > 0 && `, and skipped ${s.skipped}`}.
          {s.unsure > 0 && ` ${s.unsure} ${s.unsure === 1 ? "question was" : "questions were"} not counted because we could not be sure of the answer.`}
        </p>
        {/* The one next step on this screen: the next thing to practise, or a new paper when nothing is left. */}
        <div className="row" style={{ marginTop: 16 }}>
          {nextIdea ? (
            <>
              <Link href={`/papers/${paper.id}/fix/${nextIdea.id}`} className="btn">
                {nextIdea.state === "started" ? "Carry on" : "Next: practise"} &ldquo;{nextIdea.name}&rdquo;
              </Link>
              <span className="muted tiny">A few short steps, then one new question.</span>
            </>
          ) : (
            <Link href="/" className="btn">Upload another paper</Link>
          )}
        </div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {paper.ideas.map((idea, i) => (
        <details className="idea" key={idea.id} open={nextUp ? idea.id === nextUp : i === 0}>
          <summary>
            <div>
              <h3>{idea.name}</h3>
              <p className="muted" style={{ marginTop: 4 }}>{idea.explain}</p>
            </div>
            <span className={`pill${idea.state === "needs_more" ? " warn" : ""}`}>
              {idea.state === "solved_alone"
                ? "Solved a new one alone"
                : idea.state === "needs_more"
                  ? "Come back to this"
                  : idea.state === "walked_through"
                    ? "Walked through"
                    : `${idea.questions.length} ${idea.questions.length === 1 ? "question" : "questions"}`}
            </span>
          </summary>
          <div className="body">
            <p style={{ padding: "12px 0 4px" }}>
              {/* Quiet: the one main button is at the top of the screen. */}
              <Link href={`/papers/${paper.id}/fix/${idea.id}`} className="btn ghost">
                {idea.state === "new" ? "Practise this" : idea.state === "started" ? "Carry on" : "See how it went"}
              </Link>
            </p>
            {idea.questions.map((n) => {
              const q = byN.get(n);
              return q ? <Mistake key={n} q={q} paper={paper} onReport={() => report(n, true)} /> : null;
            })}
          </div>
        </details>
      ))}

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Your paper at a glance</h3>
        <div className="strip">
          {paper.questions
            .filter((q) => q.type === "mcq")
            .map((q) => (
              <span key={q.n} className={`sq ${q.verdict === "correct" || q.verdict === "wrong" ? q.verdict : ""}`} title={label(q.verdict)}>
                {q.n}
              </span>
            ))}
        </div>
        <div className="legend">
          <span><i className="correct" />Right</span>
          <span><i className="wrong" />Wrong</span>
          <span><i />Skipped or not counted</span>
        </div>
      </div>

      <div>
        {unsure.length > 0 && (
          <details className="quiet">
            <summary>Not counted ({unsure.length})</summary>
            <div className="inner stack">
              <p className="muted">We could not be sure of the right answer to these, so they do not count for or against you. Ask your teacher.</p>
              {unsure.map((q) => (
                <Line
                  key={q.n}
                  q={q}
                  paper={paper}
                  note={q.disputed ? `You chose ${paper.answers[String(q.n)]}. That can also be argued as right, so it is not marked wrong. Ask your teacher which answer your book takes.` : undefined}
                />
              ))}
            </div>
          </details>
        )}
        {reported.length > 0 && (
          <details className="quiet">
            <summary>You said these look wrong ({reported.length})</summary>
            <div className="inner stack">
              <p className="muted">These are left out until someone has checked them.</p>
              {reported.map((q) => (
                <div key={q.n}>
                  <Line q={q} paper={paper} />
                  <button className="linkbtn" onClick={() => report(q.n, false)}>Count it again</button>
                </div>
              ))}
            </div>
          </details>
        )}
        {skipped.length > 0 && (
          <details className="quiet">
            <summary>Skipped ({skipped.length})</summary>
            <div className="inner stack">{skipped.map((q) => <Line key={q.n} q={q} paper={paper} />)}</div>
          </details>
        )}
        {written.length > 0 && (
          <details className="quiet">
            <summary>Written questions ({written.length})</summary>
            <div className="inner stack">
              <p className="muted">Questions without options are not checked yet in this version.</p>
              {written.map((q) => <Line key={q.n} q={q} paper={paper} />)}
            </div>
          </details>
        )}
        <details className="quiet">
          <summary>How this was checked</summary>
          <div className="inner stack muted">
            <p>
              {paper.hasPrintedKey
                ? "Your answers were compared with the answer key printed on the paper."
                : "This paper has no answer key, so the AI solved every question twice, in two different ways. A question counts only when both solutions agree. Where your answer and ours differ, a stronger AI looks again, and any answer it gives is marked Our best answer."}{" "}
              The AI can still be wrong. If an answer looks wrong to you, say so and it will be left out.
            </p>
            <p>AI cost for this paper: ${paper.costUsd.toFixed(2)}</p>
          </div>
        </details>
        <details className="quiet">
          <summary>{paper.excluded ? "This paper is left out of what to work on" : "Was this a test run?"}</summary>
          <div className="inner stack muted">
            <p>
              {paper.excluded
                ? "Its mistakes do not show in what to work on."
                : "If this paper was only a try-out, leave it out so its mistakes do not show in what to work on."}
            </p>
            <div>
              <button className="linkbtn" onClick={() => leaveOut(!paper.excluded)}>
                {paper.excluded ? "Count this paper again" : "Leave this paper out"}
              </button>
            </div>
          </div>
        </details>
      </div>

      <p><Link href="/work-on">See what to work on across all your papers</Link></p>

      {nextIdea && <p><Link href="/">Upload another paper</Link></p>}
    </div>
  );
}

function label(v: QuestionView["verdict"]) {
  if (v === "correct") return "Right";
  if (v === "wrong") return "Wrong";
  if (v === "skipped") return "Skipped";
  return "Not counted";
}

function pageHref(paper: PaperView, q: QuestionView) {
  const base = `/api/papers/${paper.id}/file/${q.fileIndex}`;
  return paper.isPdf ? `${base}#page=${q.page}` : base;
}

function Meta({ q, paper }: { q: QuestionView; paper: PaperView }) {
  return (
    <span className="muted tiny">
      Question {q.n}
      {q.section && ` · ${q.section}`} ·{" "}
      <a href={pageHref(paper, q)} target="_blank" rel="noreferrer">
        {q.hasFigure ? `See the figure on page ${q.page}` : `Page ${q.page}`}
      </a>
    </span>
  );
}

function Line({ q, paper, note }: { q: QuestionView; paper: PaperView; note?: string }) {
  return (
    <div>
      <Meta q={q} paper={paper} />
      <div>{q.text}</div>
      {note && <div className="muted tiny" style={{ marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function Mistake({ q, paper, onReport }: { q: QuestionView; paper: PaperView; onReport: () => void }) {
  const mine = paper.answers[String(q.n)];
  return (
    <div className="mistake">
      <Meta q={q} paper={paper} />
      <div className="qtext">{q.text}</div>
      {q.options.map((o) => {
        const isMine = o.label === mine;
        const isRight = o.label === q.correct;
        return (
          <div key={o.label} className={`choice${isMine ? " mine" : ""}${isRight ? " right" : ""}`}>
            <span>{o.label}.</span>
            <span>{o.text}</span>
            {isMine && <span className="tag">You chose this</span>}
            {isRight && <span className="tag">{q.keySource === "best" ? "Our best answer" : "Right answer"}</span>}
          </div>
        );
      })}
      {q.keySource === "best" && <p className="muted tiny" style={{ marginTop: 6 }}>Our best answer, worked out by the AI, not taken from your book. If your book says something else, tap &ldquo;This looks wrong&rdquo;.</p>}
      {q.whyTempting && <p className="why">Why {mine} looks right: {q.whyTempting}</p>}
      <p style={{ marginTop: 8 }}>
        <button className="linkbtn" onClick={onReport}>This looks wrong</button>
      </p>
    </div>
  );
}

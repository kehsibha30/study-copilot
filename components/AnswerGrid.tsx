"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PaperView, QuestionView } from "@/lib/view";

export default function AnswerGrid({ paper, onChange }: { paper: PaperView; onChange: (p: PaperView) => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(paper.answers);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookNote, setLookNote] = useState<string | null>(null);
  const dirty = useRef(false);

  // Looks at the paper once more for answers marked on it. Answers already tapped in are kept.
  async function lookAgain() {
    if (looking) return;
    setLooking(true);
    setLookNote(null);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paper.id}/marks`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.paper) {
        setAnswers((a) => ({ ...data.paper.answers, ...a }));
        onChange(data.paper);
      }
      setLookNote(data.found > 0 ? null : "Still none found. Tap what you chose for each question.");
    } catch (e) {
      setLookNote(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally {
      setLooking(false);
    }
  }

  const mcq = paper.questions.filter((q) => q.type === "mcq");
  const written = paper.questions.filter((q) => q.type === "written");
  const answered = mcq.filter((q) => answers[String(q.n)]).length;
  const cutOff = paper.questions.filter((q) => q.cutOff).map((q) => q.n);

  // Every change is saved a moment later, so leaving the page and coming back loses nothing.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      fetch(`/api/papers/${paper.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).catch(() => setError("Your last change is not saved yet. Check the connection."));
    }, 600);
    return () => clearTimeout(t);
  }, [answers, paper.id]);

  function pick(q: QuestionView, label: string) {
    dirty.current = true;
    setError(null);
    setAnswers((a) => {
      const next = { ...a };
      if (next[String(q.n)] === label) delete next[String(q.n)];
      else next[String(q.n)] = label;
      return next;
    });
  }

  async function submit() {
    if (sending) return;
    if (answered === 0) return setError("Mark at least one answer first.");
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paper.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, submit: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.paper);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Your answers are still here; try again.");
      setSending(false);
    }
  }

  const sections: { name: string; items: QuestionView[] }[] = [];
  for (const q of mcq) {
    const last = sections[sections.length - 1];
    if (last && last.name === q.section) last.items.push(q);
    else sections.push({ name: q.section, items: [q] });
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <p className="muted tiny">{paper.title}</p>
        <h1>Mark your answers</h1>
        <p className="lede">
          {paper.markedCount > 0
            ? `We found ${paper.markedCount} ${paper.markedCount === 1 ? "answer" : "answers"} already marked on your paper. Check and fill in the rest.`
            : "Tap what you chose for each question. Leave it blank if you skipped it."}
        </p>
        {paper.markedCount === 0 && mcq.length > 0 && (
          <p className="muted tiny" style={{ marginTop: 10 }}>
            {looking ? (
              <span role="status">Looking at your paper again for your marks. This takes about half a minute…</span>
            ) : (
              <>
                {lookNote ?? (paper.marksLooks > 0 ? "We looked twice and did not find answers marked on this paper." : "We did not find answers marked on this paper.")}{" "}
                {paper.marksLooks < 3 && <>Marked them on the paper? <button className="linkbtn" style={{ fontSize: 13 }} onClick={lookAgain}>Look again</button></>}
              </>
            )}
          </p>
        )}
      </div>

      {(paper.pageProblems.length > 0 || cutOff.length > 0) && (
        <div className="notice">
          {paper.pageProblems.map((p, i) => (
            <div key={i}>Page {p.page}: {p.problem}</div>
          ))}
          {cutOff.length > 0 && (
            <div>
              {cutOff.length === 1 ? `Question ${cutOff[0]} is` : `Questions ${cutOff.join(", ")} are`} hard to read, so we may not be able to check {cutOff.length === 1 ? "it" : "them"}.
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            For a better result, <Link href="/">upload clearer photos</Link>. Or carry on with what we have.
          </div>
        </div>
      )}

      {mcq.length === 0 ? (
        <div className="card stack">
          <p>This paper has no multiple-choice questions. Written questions are not checked yet in this version.</p>
          <p><Link href="/">Upload another paper</Link></p>
        </div>
      ) : (
        <div className="card">
          {sections.map((s, i) => (
            <div key={i}>
              {s.name && <div className="section-h" style={i === 0 ? { marginTop: 0 } : undefined}>{s.name}</div>}
              {s.items.map((q) => (
                <div className="q" key={q.n}>
                  <span className="num">{q.n}</span>
                  <span className="txt" title={q.text}>{q.text}</span>
                  <span className="opts" role="group" aria-label={`Question ${q.n}`}>
                    {q.options.map((o) => (
                      <button
                        key={o.label}
                        type="button"
                        className={`opt${answers[String(q.n)] === o.label ? " on" : ""}`}
                        aria-pressed={answers[String(q.n)] === o.label}
                        title={o.text}
                        onClick={() => pick(q, o.label)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}

          <div className="bar">
            {error && <div className="error" role="alert" style={{ width: "100%" }}>{error}</div>}
            <span className="muted">
              {answered} of {mcq.length} answered
              {written.length > 0 && ` · ${written.length} written ${written.length === 1 ? "question is" : "questions are"} not checked yet`}
            </span>
            <button className="btn" onClick={submit} aria-busy={sending}>
              {sending ? "Sending…" : "Check my paper"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { day } from "@/lib/format";
import type { ConceptRow, TopicRow, WorkOn } from "@/lib/workon";

// The report a parent reads. Counts and dates only, worked out from the papers and sets each time it is opened.
export default function ReportPage() {
  const [r, setR] = useState<WorkOn | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/work-on", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => setR(d.report))
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  if (error) return <div className="error" role="alert">{error}</div>;
  if (!r) return <p className="muted">Looking through the papers…</p>;

  if (r.papers === 0) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1>Report</h1>
          <p className="lede">Nothing to report yet. It starts with the first paper and builds up with every paper after that.</p>
        </div>
        <div><Link href="/" className="btn">Upload a paper</Link></div>
      </div>
    );
  }

  const right = r.paperRows.reduce((s, p) => s + p.right, 0);
  const counted = r.paperRows.reduce((s, p) => s + p.counted, 0);
  const practised = r.ideas.filter((c) => c.status === "practised");
  const nextCheck = practised.map((c) => c.checkOn).filter((x): x is string => Boolean(x)).sort()[0];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1>Report</h1>
        <p className="lede">
          {r.papers === 1 ? "1 paper" : `${r.papers} papers`}
          {r.firstAt && ` since ${day(r.firstAt)}`}: {right} of {counted} answered right. {r.ideas.length === 0 ? "No repeated mistakes found." : `${r.ideas.length} ${r.ideas.length === 1 ? "idea" : "ideas"} behind the mistakes.`}
        </p>
      </div>

      <div className="stats">
        <div className="stat"><div className="l">Days used, last 7</div><div className="n">{r.daysActive} of 7</div></div>
        <div className="stat"><div className="l">Fixed and held</div><div className="n">{r.held.length}</div></div>
        <div className="stat"><div className="l">Check to come</div><div className="n">{practised.length}</div></div>
        <div className="stat"><div className="l">Still to work on</div><div className="n">{r.open}</div></div>
      </div>

      {r.held.length === 0 && r.ideas.length > 0 && (
        <p className="notice">
          Nothing counts as fixed yet. An idea is fixed only when a new question on it is answered right at least 5 days after it was practised.
          {nextCheck ? ` The first check is due on ${day(nextCheck)}.` : " No idea has been practised yet."}
        </p>
      )}

      {r.ideas.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 10 }}>Ideas</h2>
          <div className="card" style={{ padding: "6px 22px" }}>
            {r.ideas.map((c) => (
              <div className="trow" key={c.name}>
                <div>
                  <div>{c.name}</div>
                  <div className="sub">{c.subject} · {c.topic}</div>
                </div>
                <Chip c={c} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ marginBottom: 10 }}>Subjects and topics</h2>
        <div className="stack">
          {r.subjects.map((s) => (
            <div className="card" key={s.name} style={{ padding: "14px 22px 6px" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3>{s.name}</h3>
                <span className="muted tiny">{s.counted === 0 ? "None answered" : `${s.right} of ${s.counted} answered right`}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {s.topics.filter((t) => t.status !== "too_few").map((t) => <Topic key={t.name} subject={s.name} t={t} />)}
              </div>
              {/* Topics with nothing sure to say are kept to one quiet line, not a wall of rows. */}
              <Few topics={s.topics.filter((t) => t.status === "too_few")} />
            </div>
          ))}
        </div>
        <p className="muted tiny" style={{ marginTop: 10 }}>
          Strong means at least 5 questions over 2 or more papers with 9 in 10 right. Fewer than 3 questions is too few to tell.
        </p>
      </div>

      <div>
        <h2 style={{ marginBottom: 10 }}>Papers</h2>
        <div className="card list" style={{ padding: "4px 18px" }}>
          {r.paperRows.map((p) => (
            <Link key={p.id} href={`/papers/${p.id}`}>
              <div className="t">{p.title}</div>
              <div className="muted tiny">
                {p.right} of {p.counted} answered right{p.skipped > 0 && ` · ${p.skipped} not answered`}{p.notCounted > 0 && ` · ${p.notCounted} not counted`} · {day(p.at)}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <details className="quiet">
        <summary>How far to trust this</summary>
        <div className="inner stack muted">
          <p>
            {r.notCounted} {r.notCounted === 1 ? "question was" : "questions were"} not counted because the app was unsure of the answer.{" "}
            {r.reported} {r.reported === 1 ? "was" : "were"} reported as looking wrong and left out.
          </p>
          <p>
            Where a paper has no printed answer key, an answer is marked only when two separate AI solves agree. That is not proof: on one test paper
            about 1 answer in 70 was wrong and not caught.
          </p>
          <p>
            &ldquo;Fixed and held&rdquo; rests on the app&rsquo;s own new questions, not on a school or coaching test. The paper-by-paper counts under each topic are
            from real papers.
          </p>
          <p>
            The AI has answered {r.answersGiven} of his own {r.answersGiven === 1 ? "question" : "questions"}. He reported {r.answersReported} of those answers as
            looking wrong. These answers are not checked a second time, so a wrong one is caught only if he reports it.
          </p>
          <p>&ldquo;Days used&rdquo; counts days with a paper, a lesson, a question asked or a set. It does not measure time spent.</p>
          {r.leftOut > 0 && <p>{r.leftOut} {r.leftOut === 1 ? "paper is" : "papers are"} left out as test runs.</p>}
        </div>
      </details>
    </div>
  );
}

function Chip({ c }: { c: ConceptRow }) {
  if (c.status === "slipped") return <span className="pill bad">Wrong again on {day(c.since)}</span>;
  if (c.status === "held") return <span className="pill">{c.checks > 1 ? "Held, checked twice" : `Held since ${day(c.since)}`}</span>;
  if (c.status === "practised") return <span className="pill warn">{c.due ? "Check due now" : `Check due ${c.checkOn ? day(c.checkOn) : "later"}`}</span>;
  return <span className="pill bad">{c.papers > 1 ? `Wrong in ${c.papers} papers` : "Needs work"}</span>;
}

const TOPIC: Record<TopicRow["status"], { label: string; cls: string }> = {
  needs_work: { label: "Needs work", cls: "pill bad" },
  checking: { label: "Check to come", cls: "pill warn" },
  strong: { label: "Strong", cls: "pill" },
  fine: { label: "Nothing open", cls: "pill plain" },
  too_few: { label: "Too few to tell", cls: "pill plain" },
};

function Few({ topics }: { topics: TopicRow[] }) {
  if (topics.length === 0) return null;
  return (
    <details className="quiet" style={{ padding: "10px 0" }}>
      <summary style={{ fontSize: 14 }}>
        {topics.length} {topics.length === 1 ? "topic" : "topics"} with too few answers to tell
      </summary>
      <div className="inner muted" style={{ fontSize: 14 }}>
        {topics.map((t) => `${t.name} (${t.counted === 0 ? "none answered" : `${t.right} of ${t.counted}`})`).join(" · ")}
      </div>
    </details>
  );
}

function Topic({ subject, t }: { subject: string; t: TopicRow }) {
  const chip = TOPIC[t.status];
  return (
    <details className="topic">
      <summary>
        <span>{t.name}</span>
        <span className={chip.cls}>{chip.label}</span>
      </summary>
      <div className="inner">
        <div>
          {t.counted === 0 ? "None answered" : `${t.right} of ${t.counted} answered right${t.papers > 1 ? ` across ${t.papers} papers` : ""}`}
          {t.skipped > 0 && `, ${t.skipped} not answered`}.
          {t.papers > 1 && <> By paper: {t.byPaper.filter((p) => p.counted > 0).map((p) => `${day(p.at)}: ${p.right} of ${p.counted}`).join(" · ")}.</>}
        </div>
        {t.slippedAt && <div>Missed on a new question on {day(t.slippedAt)}.</div>}
        {[...t.concepts, ...t.tracked].map((c) => (
          <div key={c.name} className="row" style={{ justifyContent: "space-between" }}>
            <Link href={c.href}>{c.name}</Link>
            <Chip c={c} />
          </div>
        ))}
        {t.asked.length > 0 && (
          <div>
            Asked about this topic: {t.asked.slice(0, 5).map((a) => `"${a.q}" (${day(a.at)}${a.flagged ? ", answer reported as wrong" : ""})`).join(" · ")}
            {t.asked.length > 5 && ` and ${t.asked.length - 5} more`}. <Link href={`/topic?s=${encodeURIComponent(subject)}&t=${encodeURIComponent(t.name)}`}>See the answers</Link>
          </div>
        )}
        {t.canTest ? (
          <div><Link href={`/self-test?topic=${encodeURIComponent(`${subject}|${t.name}`)}`} className="btn ghost">Test this topic now</Link></div>
        ) : (
          t.status === "strong" && <div>New sets carry a question from this topic, to check it has stayed.</div>
        )}
      </div>
    </details>
  );
}

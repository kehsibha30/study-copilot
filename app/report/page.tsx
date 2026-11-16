"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clock, day } from "@/lib/format";
import { story, type Reader, type Weak } from "@/lib/story";
import type { ConceptRow, TopicRow, WorkOn } from "@/lib/workon";

const READER_KEY = "report-reader";

const WEAK: Record<Weak["status"], { label: string; cls: string }> = {
  to_fix: { label: "To fix", cls: "pill bad" },
  check_due: { label: "Check due", cls: "pill warn" },
  check_later: { label: "Check to come", cls: "pill warn" },
  practice: { label: "Missed in practice", cls: "pill bad" },
};

// One page for the student and the parent: a short summary, strengths, weak spots and a 2-week plan, all worked
// out from his papers and practice each time it is opened (lib/story.ts). The parent view adds the detail behind it.
export default function ReportPage() {
  const [r, setR] = useState<WorkOn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reader, setReader] = useState<Reader>("parent");
  const [now, setNow] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(READER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this device's last choice, not derivable at render time
      if (saved === "student" || saved === "parent") setReader(saved);
    } catch {
      // Storage blocked: the default view is fine.
    }
    fetch("/api/work-on", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        setNow(Date.now());
        setR(d.report);
      })
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  function choose(next: Reader) {
    setReader(next);
    try {
      window.localStorage.setItem(READER_KEY, next);
    } catch {
      // Not remembered on this device; nothing else changes.
    }
  }

  if (error) return <div className="error" role="alert">{error}</div>;
  if (!r) return <p className="muted">Putting the report together…</p>;

  // Before any work: the real layout, each section saying in one line what will appear (decision 16 Nov 2026).
  if (r.papers === 0 && r.setsDone === 0) {
    const parts: [string, string][] = [
      ["Strengths", "Chapters answered right again and again. Needs a few answers per chapter."],
      ["Weak spots", "The ideas behind wrong answers, and whether each one is fixed yet."],
      ["Speed", "Where time goes: slow chapters, and chapters answered too fast. Every practice question is timed."],
      ["Traps that keep coming back", "The kind of wrong option picked again and again."],
      ["Next 2 weeks", "A short plan of lessons, practice and checks, with dates. Redone each time this page opens."],
    ];
    return (
      <div className="stack" style={{ gap: 22 }}>
        <h1>Report</h1>
        <section className="card stack" style={{ gap: 12 }}>
          <p className="story">This page fills in as the work comes in. One practice set of 10 questions is enough to start it.</p>
          <Link href="/self-test" className="btn wide">Practise a chapter</Link>
          <Link href="/" className="muted tiny" style={{ textAlign: "center" }}>or upload a test paper</Link>
        </section>
        {parts.map(([h, line]) => (
          <section key={h} className="stack" style={{ gap: 4 }}>
            <h2 className="muted">{h}</h2>
            <p className="muted tiny" style={{ margin: 0 }}>{line}</p>
          </section>
        ))}
      </div>
    );
  }

  const st = story(r, reader, r.setsDone, now);
  const you = reader === "student";

  return (
    <div className="stack" style={{ gap: 26 }}>
      <div className="stack" style={{ gap: 10 }}>
        <h1>Report</h1>
        <div className="seg" role="group" aria-label="Who is reading">
          <button type="button" aria-pressed={you} className={you ? "on" : ""} onClick={() => choose("student")}>For the student</button>
          <button type="button" aria-pressed={!you} className={!you ? "on" : ""} onClick={() => choose("parent")}>For the parent</button>
        </div>
        <p className="muted tiny" style={{ margin: 0 }}>{st.scope}{st.early && " Too early for firm trends."}</p>
      </div>

      <section className="card">
        <p className="story">{st.summary}</p>
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2>Strengths</h2>
        {st.strengths.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            None to name yet. A chapter counts as a strength once it has at least 3 answers with 9 in 10 right, or 4 practice questions with 8 in 10 right.
          </p>
        ) : (
          st.strengths.map((s) => (
            <div key={`${s.subject}|${s.topic}`} className="dotline">
              <span className="dot" aria-hidden="true" />
              <span><span style={{ fontWeight: 500 }}>{s.topic}</span> <span className="muted tiny">{s.subject}</span><br /><span className="muted tiny">{s.line}</span></span>
            </div>
          ))
        )}
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2>Weak spots</h2>
        {st.weak.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {r.held.length > 0
              ? "Nothing open right now. Every idea found so far has been fixed and held on a later check."
              : r.papers === 0
                ? "None found yet. A weak spot shows here when a chapter has at least 3 practice answers with fewer than 6 in 10 right, or when a paper shows the idea behind a mistake."
                : "None found yet."}
          </p>
        ) : (
          st.weak.map((w) => (
            <div key={`${w.status}|${w.name}`} className="card weak">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
                <span style={{ fontWeight: 500 }}>{w.href ? <Link href={w.href}>{w.name}</Link> : w.name}</span>
                <span className={WEAK[w.status].cls}>{WEAK[w.status].label}</span>
              </div>
              <span className="muted tiny">{w.status === "practice" ? w.subject : `${w.subject} · ${w.topic}`}. {w.line}</span>
            </div>
          ))
        )}
      </section>

      {st.speed && (
        <section className="stack" style={{ gap: 10 }}>
          <h2>Speed</h2>
          <p className="muted tiny" style={{ margin: 0 }}>
            From {st.speed.timed} timed questions. {you ? "Your" : "His"} usual time: {clock(st.speed.usualMs)} a question (NEET pace is about 1:00).
          </p>
          <div className="card" style={{ padding: "4px 16px" }}>
            {st.speed.rows.map((x) => (
              <div key={`${x.subject}|${x.topic}`} className="speedrow">
                <span>{x.topic}</span>
                <span className="num">{clock(x.avgMs)}</span>
                <span className={x.label === "Slow" ? "pill warn" : x.label === "Rushed" ? "pill bad" : "pill"}>{x.label}</span>
              </div>
            ))}
          </div>
          {st.speed.lines.map((l) => <p key={l} style={{ margin: 0 }}>{l}</p>)}
        </section>
      )}

      {st.traps.length > 0 && (
        <section className="stack" style={{ gap: 10 }}>
          <h2>Traps that keep coming back</h2>
          {st.traps.map((t) => (
            <div key={`${t.subject}|${t.topic}|${t.trap}`} className="card weak">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
                <span style={{ fontWeight: 500 }}>{t.trap}</span>
                <span className="pill bad">{t.count} times</span>
              </div>
              <span className="muted tiny">{t.subject} · {t.topic}</span>
            </div>
          ))}
          <p className="muted tiny" style={{ margin: 0 }}>Counted when {you ? "you pick" : "he picks"} an option whose usual mistake is the same. It shows what the option usually means, not what {you ? "you were" : "he was"} thinking.</p>
        </section>
      )}

      <section className="stack" style={{ gap: 6 }}>
        <h2>Next 2 weeks</h2>
        <ol className="plan">
          {st.plan.map((p, i) => (
            <li key={i}>
              <span className="muted tiny">{p.when}</span>
              <span>
                {p.on && <span style={{ fontWeight: 500 }}>{p.label}: </span>}
                {p.href ? <Link href={p.href}>{p.text}</Link> : p.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="muted tiny" style={{ margin: 0 }}>The plan is redone each time this page opens, from what {you ? "you have" : "he has"} done.</p>
      </section>

      {!you && <Behind r={r} />}
    </div>
  );
}

// The detail behind the story, for the parent: use, ideas, chapters, papers, and how far to trust it.
function Behind({ r }: { r: WorkOn }) {
  return (
    <div className="stack" style={{ gap: 24, borderTop: "1px solid var(--line)", paddingTop: 22 }}>
      <h2>Behind the numbers</h2>
      <div className="stats">
        <div className="stat"><div className="l">Days used, last 7</div><div className="n">{r.daysActive} of 7</div></div>
        <div className="stat"><div className="l">Fixed and held</div><div className="n">{r.held.length}</div></div>
        <div className="stat"><div className="l">Check to come</div><div className="n">{r.ideas.filter((c) => c.status === "practised").length}</div></div>
        <div className="stat"><div className="l">Still to work on</div><div className="n">{r.open}</div></div>
      </div>

      {r.ideas.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Every idea</h3>
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

      {r.subjects.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Subjects and chapters</h3>
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
                <Few topics={s.topics.filter((t) => t.status === "too_few")} />
              </div>
            ))}
          </div>
          <p className="muted tiny" style={{ marginTop: 10 }}>
            Strong means at least 5 questions over 2 or more papers with 9 in 10 right. Fewer than 3 questions is too few to tell.
          </p>
        </div>
      )}

      {r.practice.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Chapter practice</h3>
          <div className="card" style={{ padding: "6px 22px" }}>
            {r.practice.map((p) => (
              <div className="trow" key={`${p.subject}|${p.topic}`}>
                <div>
                  <div>{p.topic}</div>
                  <div className="sub">{p.subject} · last on {day(p.last)}</div>
                </div>
                <span className="muted tiny">{p.right} of {p.total} right</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {r.paperRows.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 10 }}>Papers</h3>
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
      )}

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
            Practice questions are written by the AI and kept only when a second, separate solve agrees with the answer. Strengths and weak spots from
            practice rest on those questions, not on a school or coaching test.
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
          <div><Link href={`/self-test?topic=${encodeURIComponent(`${subject}|${t.name}`)}`} className="btn ghost">Practise this chapter now</Link></div>
        ) : (
          t.status === "strong" && <div>New sets carry a question from this topic, to check it has stayed.</div>
        )}
      </div>
    </details>
  );
}

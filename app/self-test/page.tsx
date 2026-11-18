"use client";

import Link from "next/link";
import { useGo } from "@/components/useGo";
import { useEffect, useState } from "react";
import { day, when } from "@/lib/format";

type Chapter = { topic: string; status: "to_fix" | "getting_there" | "strong" | "tried" | "not_tried"; line: string };
type Data = {
  suggestion: { ideas: { name: string; subject: string; topic: string; paper: string }[]; topics: { subject: string; topic: string }[] } | null;
  mix: { title: string; chapters: number } | null;
  check: { due: number; waiting: string | null; next: string | null };
  subjects: { name: string; chapters: Chapter[] }[];
  sets: { id: string; createdAt: string; status: string; submitted: boolean; recheck: boolean; mode: string; basis: string | null; excluded: boolean; topics: string[]; total: number; right: number; counted: number }[];
};

const PILL: Record<Chapter["status"], { cls: string; label: string }> = {
  to_fix: { cls: "pill bad", label: "To fix" },
  getting_there: { cls: "pill warn", label: "Getting there" },
  strong: { cls: "pill", label: "Strong" },
  tried: { cls: "pill plain", label: "Tried" },
  not_tried: { cls: "pill plain", label: "Not tried" },
};

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function Practice() {
  const { go, navigating } = useGo();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/self-test", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Data) => {
        setData(d);
        // Coming from the report with one chapter chosen (?topic=Subject|Chapter): open the picker on it.
        const asked = new URLSearchParams(window.location.search).get("topic");
        const [s, t] = asked ? asked.split("|") : [];
        // Open on the subject practised last, so the chapter just done is in view with its new score.
        const lastBasis = d.sets.find((x) => x.mode === "chapter" && x.basis)?.basis ?? "";
        const lastSubject = d.subjects.find((x) => lastBasis.startsWith(`${x.name}: `))?.name;
        const first = lastSubject ?? d.subjects[0]?.name ?? null;
        setSubject(s && d.subjects.some((x) => x.name === s) ? s : first);
        if (s && t) {
          setChapter(t);
          setPicking(true);
        }
        // Nothing to suggest and no paper yet: the chapter picker is the way in, so it starts open.
        if (!d.suggestion && !d.mix) setPicking(true);
      })
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  async function start(kind: string, body: Record<string, unknown>) {
    if (busy || navigating) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/self-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      go(`/self-test/${out.id}`);
      setBusy(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
      setBusy(null);
    }
  }

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Getting your practice ready…</p>;

  const waiting = data.sets.find((s) => s.status === "ready" && !s.submitted && !s.recheck);
  const chapters = data.subjects.find((s) => s.name === subject)?.chapters ?? [];
  const n = data.suggestion?.ideas.length ?? 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Practice</h1>

      {/* One suggested next step. */}
      {waiting ? (
        <section className="card stack suggest">
          <span className="tiny" style={{ fontWeight: 600, color: "var(--good-ink)" }}>You started this</span>
          <h2 style={{ fontSize: 22 }}>{waiting.total} questions waiting</h2>
          <p className="muted tiny" style={{ margin: 0 }}>{waiting.basis ?? waiting.topics.join(", ")}</p>
          <Link href={`/self-test/${waiting.id}`} className="btn wide">Carry on</Link>
        </section>
      ) : data.suggestion ? (
        <section className="card stack suggest">
          <span className="tiny" style={{ fontWeight: 600, color: "var(--good-ink)" }}>Suggested for today</span>
          <h2 style={{ fontSize: 22 }}>10 new questions on your {n === 1 ? "weak idea" : `${n} weak ideas`}</h2>
          <ul className="ideas">
            {data.suggestion.ideas.map((i) => (
              <li key={i.name}>
                {i.name}
                <span className="muted tiny" style={{ display: "block" }}>{i.subject} · {i.topic} · wrong on {i.paper}</span>
              </li>
            ))}
          </ul>
          <p className="muted tiny" style={{ margin: 0 }}>About 10 minutes. Easy first, then harder. No hints.</p>
          <button className="btn wide" onClick={() => start("suggest", { mode: "mistakes", topics: data.suggestion!.topics })} aria-busy={busy === "suggest"} disabled={Boolean(busy) || navigating}>
            {busy === "suggest" ? "Starting…" : "Start"}
          </button>
        </section>
      ) : data.mix ? (
        <section className="card stack suggest">
          <span className="tiny" style={{ fontWeight: 600, color: "var(--good-ink)" }}>Suggested for today</span>
          <h2 style={{ fontSize: 22 }}>10 mixed questions, like {data.mix.title}</h2>
          <p className="muted tiny" style={{ margin: 0 }}>Nothing is waiting to be fixed, so this keeps every chapter of your last paper fresh.</p>
          <button className="btn wide" onClick={() => start("mix", { mode: "mixed" })} aria-busy={busy === "mix"} disabled={Boolean(busy) || navigating}>
            {busy === "mix" ? "Starting…" : "Start"}
          </button>
        </section>
      ) : (
        <p className="lede" style={{ marginTop: -8 }}>Pick a chapter to practise. Once you upload a test paper, practice is built from your own mistakes.</p>
      )}

      {error && <div className="error" role="alert">{error}</div>}

      {/* Everything else, quieter. */}
      <section>
        <h2 className="tiny muted" style={{ fontFamily: "inherit", fontWeight: 600, marginBottom: 6 }}>{waiting || data.suggestion || data.mix ? "Or choose something else" : "Choose a chapter"}</h2>
        <div className="choices">
          {data.mix && (data.suggestion || waiting) && (
            <button type="button" onClick={() => start("mix", { mode: "mixed" })} disabled={Boolean(busy) || navigating} aria-busy={busy === "mix"}>
              <span><span className="t">{busy === "mix" ? "Starting…" : "Mixed, like my last paper"}</span><span className="muted tiny">All {data.mix.chapters} chapters of {data.mix.title}</span></span>
              <Chevron />
            </button>
          )}
          <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking}>
            <span><span className="t">Pick a subject and chapter</span><span className="muted tiny">Any chapter, even one not tested yet</span></span>
            <span style={{ transform: picking ? "rotate(90deg)" : "none", display: "inline-flex" }}><Chevron /></span>
          </button>
          {picking && (
            <div className="picker stack">
              <div className="row" role="group" aria-label="Subject">
                {data.subjects.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className={`chip${s.name === subject ? " on" : ""}`}
                    aria-pressed={s.name === subject}
                    onClick={() => {
                      setSubject(s.name);
                      setChapter(null);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <div role="radiogroup" aria-label="Chapter">
                {chapters.map((c) => (
                  <label key={c.topic} className={`chapter${chapter === c.topic ? " on" : ""}`}>
                    <input type="radio" name="chapter" checked={chapter === c.topic} onChange={() => setChapter(c.topic)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {c.topic}
                      <span className="muted tiny" style={{ display: "block" }}>{c.line}</span>
                    </span>
                    <span className={PILL[c.status].cls}>{PILL[c.status].label}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn wide"
                disabled={!chapter || Boolean(busy) || navigating}
                aria-busy={busy === "chapter"}
                onClick={() => start("chapter", { mode: "chapter", subject, topic: chapter })}
              >
                {busy === "chapter" ? "Starting…" : chapter ? `Start 10 questions on ${chapter}` : "Pick a chapter"}
              </button>
              <p className="muted tiny" style={{ margin: 0 }}>Chapters from the NCERT Class 8 books, plus any from your papers. Every question is checked by a second solve before you see it.</p>
            </div>
          )}
          {data.check.waiting ? (
            <Link href={`/self-test/${data.check.waiting}`} className="choice-link">
              <span><span className="t">Check what you fixed</span><span className="muted tiny">Your check questions are ready</span></span>
              <Chevron />
            </Link>
          ) : data.check.due > 0 ? (
            <button type="button" onClick={() => start("check", { recheck: true })} disabled={Boolean(busy) || navigating} aria-busy={busy === "check"}>
              <span><span className="t">{busy === "check" ? "Starting…" : "Check what you fixed"}</span><span className="muted tiny">{data.check.due} {data.check.due === 1 ? "idea is" : "ideas are"} due for a check</span></span>
              <Chevron />
            </button>
          ) : data.check.next ? (
            <div className="choice-note">
              <span><span className="t">Check what you fixed</span><span className="muted tiny">Next check on {day(data.check.next)}</span></span>
            </div>
          ) : null}
        </div>
      </section>

      {data.sets.length > 0 && (
        <section>
          <h2 style={{ marginBottom: 10 }}>Your earlier sets</h2>
          <div className="card list" style={{ padding: "4px 18px" }}>
            {data.sets.map((s) => (
              <Link key={s.id} href={`/self-test/${s.id}`}>
                <div className="t">
                  {s.recheck ? "Check: " : s.mode === "mixed" ? "Mixed: " : s.mode === "chapter" ? "Chapter: " : ""}
                  {s.mode === "mixed" ? s.basis : s.topics.join(", ")}
                </div>
                <div className="muted tiny">
                  {s.status === "building"
                    ? "Being written"
                    : s.status === "failed"
                      ? "Stopped partway. Open to try again"
                      : s.submitted
                        ? `${s.right} of ${s.counted} right`
                        : `Not finished: ${s.total} questions waiting`}
                  {s.excluded && " · left out as a test run"} · {when(s.createdAt)} · #{s.id.slice(0, 4)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

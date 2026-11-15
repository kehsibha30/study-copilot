"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { when } from "@/lib/format";

type Topic = { subject: string; topic: string; ideas: string[]; open: boolean };
type SetRow = { id: string; createdAt: string; status: string; submitted: boolean; recheck: boolean; excluded: boolean; topics: string[]; total: number; right: number; counted: number };

const key = (t: { subject: string; topic: string }) => `${t.subject}|${t.topic}`;

export default function SelfTestHome() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/self-test", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { topics: Topic[]; sets: SetRow[] }) => {
        setTopics(d.topics ?? []);
        setSets(d.sets ?? []);
        // The likely choice is already ticked: the topics that still need work (up to three).
        const likely = (d.topics ?? []).filter((t) => t.open).slice(0, 3);
        // Coming from the report with one topic chosen: that topic is ticked instead.
        const asked = new URLSearchParams(window.location.search).get("topic");
        const wanted = asked ? (d.topics ?? []).filter((t) => key(t) === asked) : [];
        setPicked(new Set((wanted.length ? wanted : likely.length ? likely : (d.topics ?? []).slice(0, 1)).map(key)));
      })
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  async function start() {
    if (busy) return;
    if (picked.size === 0) return setError("Pick at least one topic.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/self-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: (topics ?? []).filter((t) => picked.has(key(t))).map((t) => ({ subject: t.subject, topic: t.topic })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/self-test/${data.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
      setBusy(false);
    }
  }

  if (!topics) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Looking through your papers…</p>;

  if (topics.length === 0) {
    return (
      <div className="stack" style={{ gap: 18 }}>
        <div>
          <h1>Test yourself</h1>
          <p className="lede">Nothing to test yet. Upload a paper and mark your answers; new questions are made from what you get wrong.</p>
        </div>
        <div><Link href="/" className="btn">Upload a paper</Link></div>
      </div>
    );
  }

  // A set that was started and not handed in comes first, so it is not lost behind a new one.
  const waiting = sets.find((s) => s.status === "ready" && !s.submitted && !s.recheck);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1>Test yourself</h1>
        <p className="lede">10 new questions on what you got wrong, from easy to harder. No hints, so you can see what has stuck.</p>
        {waiting && (
          <div className="row" style={{ marginTop: 16 }}>
            <Link href={`/self-test/${waiting.id}`} className="btn">Carry on: {waiting.total} questions waiting</Link>
            <span className="muted tiny">{waiting.topics.join(", ")}</span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: "6px 22px" }}>
        {topics.map((t) => (
          <label className="trow" key={key(t)} style={{ cursor: "pointer", justifyContent: "flex-start", alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={picked.has(key(t))}
              style={{ marginTop: 5, width: 18, height: 18, accentColor: "var(--accent)" }}
              onChange={(e) => {
                const next = new Set(picked);
                if (e.target.checked) next.add(key(t));
                else next.delete(key(t));
                setPicked(next);
              }}
            />
            <span>
              {t.subject} · {t.topic}
              <span className="sub" style={{ display: "block" }}>{t.ideas.join(" · ")}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <div className="error" role="alert">{error}</div>}
      <div><button className={waiting ? "btn ghost" : "btn"} onClick={start} aria-busy={busy}>{busy ? "Starting…" : waiting ? "Start a new set instead" : "Start: 10 new questions"}</button></div>

      {sets.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 10 }}>Your earlier sets</h2>
          <div className="card list" style={{ padding: "4px 18px" }}>
            {sets.map((s) => (
              <Link key={s.id} href={`/self-test/${s.id}`}>
                <div className="t">{s.recheck ? "Check again: " : ""}{s.topics.join(", ")}</div>
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
        </div>
      )}
    </div>
  );
}

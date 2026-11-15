"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TopicView } from "@/lib/topic";

export default function TopicPage() {
  const [topic, setTopic] = useState<TopicView | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    fetch(`/api/topic?s=${encodeURIComponent(q.get("s") ?? "")}&t=${encodeURIComponent(q.get("t") ?? "")}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) return setMissing(true);
        setTopic((await r.json()).topic);
      })
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  // "This looks wrong" on one answer, and taking it back. Nothing is asked of the AI.
  async function flag(at: string) {
    if (!topic) return;
    setError(null);
    try {
      const res = await fetch("/api/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: topic.subject, topic: topic.topic, flag: at }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(data.topic);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That did not go through. Try again.");
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (asking || !topic) return;
    if (!text.trim()) return setError("Type your question first.");
    setAsking(true);
    setError(null);
    try {
      const res = await fetch("/api/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: topic.subject, topic: topic.topic, question: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTopic(data.topic);
      setText("");
    } catch (err) {
      // The typed question stays in the box so it can be sent again.
      setError(err instanceof Error && err.message ? err.message : "That did not go through. Ask again.");
    } finally {
      setAsking(false);
    }
  }

  if (missing) {
    return (
      <div className="stack">
        <h1>We could not find that topic</h1>
        <p><Link href="/work-on" className="btn">What to work on</Link></p>
      </div>
    );
  }
  if (!topic) return error ? <div className="error" role="alert">{error}</div> : <p className="muted">Opening this topic…</p>;

  const open = topic.ideas.find((i) => i.open);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <p className="crumb"><Link href="/work-on">What to work on</Link> · {topic.subject}</p>
        <h1 style={{ marginTop: 6 }}>{topic.topic}</h1>
        <p className="lede">{topic.counted === 0 ? "No answered questions on this topic yet." : `${topic.right} of ${topic.counted} right on your papers.`}</p>
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        {topic.remembers.map((r, i) => <p key={i}>{r}</p>)}
        {(open || topic.canTest) && (
          <div className="row" style={{ marginTop: 6 }}>
            {open && <Link href={open.href} className="btn ghost">Practise &ldquo;{open.name}&rdquo;</Link>}
            {topic.canTest && (
              <Link href={`/self-test?topic=${encodeURIComponent(`${topic.subject}|${topic.topic}`)}`} className="btn ghost">Test this topic</Link>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ marginBottom: 10 }}>Ask about this topic</h2>
        {topic.doubts.map((d, i) => (
          <div key={i}>
            <div className="doubt-q">You asked: {d.q}</div>
            <div className={d.flagged ? "doubt-a off" : "doubt-a"}>{d.a}</div>
            <p className="doubt-note">
              {d.flagged ? (
                <>You said this looks wrong. Do not rely on it; ask your teacher. <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => flag(d.at)}>Undo</button></>
              ) : (
                <button className="linkbtn" style={{ fontSize: 13 }} onClick={() => flag(d.at)}>This looks wrong</button>
              )}
            </p>
          </div>
        ))}
        {asking && <p className="muted" role="status" style={{ marginBottom: 10 }}>Thinking about your question…</p>}
        {topic.waiting ? (
          <div className="notice">
            You have questions waiting, to be done without help. <Link href={topic.waiting.href}>Finish them first</Link>, then ask here.
          </div>
        ) : (
          <form className="askrow" onSubmit={ask}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Type your question about this topic" aria-label="Ask about this topic" />
            <button className="btn" type="submit" aria-busy={asking}>Ask</button>
          </form>
        )}
        {error && <div className="error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
        <p className="muted tiny" style={{ marginTop: 10 }}>This is an AI. It can be wrong, and it should say when it is not sure.</p>
      </div>
    </div>
  );
}

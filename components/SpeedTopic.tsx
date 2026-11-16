"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cardsFor, exampleFor, topicById, type TopicId } from "@/lib/speed/cards";
import type { Calc } from "@/lib/speed/stats";

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

export default function SpeedTopic({ topic }: { topic: string }) {
  const info = topicById(topic as TopicId);
  if (!info) notFound();
  const router = useRouter();
  const [calc, setCalc] = useState<Calc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/speed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCalc(d.calc))
      .catch(() => {});
  }, []);

  async function start(body: Record<string, string>, key: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "We could not start that drill. Try again.");
      router.push(`/speed/run/${j.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start that drill. Try again.");
      setBusy(null);
    }
  }

  const mine = calc?.topics.find((t) => t.id === info.id);
  const cards = cardsFor(info.id);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <Link href="/speed" className="muted tiny">← Speed</Link>
        <h1 style={{ marginTop: 6 }}>{info.label}</h1>
        <p className="lede">{info.line}</p>
        {mine && mine.bestMs !== null && <p className="muted tiny" style={{ margin: "8px 0 0" }}>Your best: {secs(mine.bestMs)} a question{mine.level ? ` · ${mine.level}` : ""}.</p>}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <button type="button" className="btn wide" disabled={busy !== null} onClick={() => start({ kind: "topic", topic: info.id }, "topic")}>
          {busy === "topic" ? "Getting your questions ready…" : "Start the 10-question drill"}
        </button>
        <span className="muted tiny" style={{ textAlign: "center" }}>Read a shortcut below first, or jump straight in.</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}

      {cards.map((c) => {
        const ex = exampleFor(c);
        return (
          <section key={c.id} className="card stack" style={{ gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>{c.title}</h2>
              <p className="muted tiny" style={{ margin: "4px 0 0" }}>Use it when: {c.when}</p>
            </div>
            <ol className="sp-steps">
              {c.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <div className="sp-ex">
              <b>Example: {ex.q}</b>
              <br />
              {ex.how}
            </div>
            <button type="button" className="btn ghost" disabled={busy !== null} onClick={() => start({ kind: "card", card: c.id }, c.id)}>
              {busy === c.id ? "Getting 3 questions ready…" : "Try this shortcut · 3 questions"}
            </button>
          </section>
        );
      })}
    </div>
  );
}

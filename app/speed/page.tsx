"use client";

import Link from "next/link";
import { useGo } from "@/components/useGo";
import { useEffect, useState } from "react";
import { TOPICS } from "@/lib/speed/cards";
import { LEVEL_NAMES, streakDays, type Calc, type CalcStatus } from "@/lib/speed/stats";

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;
const TAG: Record<CalcStatus, { cls: string; label: string }> = {
  new: { cls: "pill plain", label: "Ready when you are" },
  steady: { cls: "pill plain", label: "On the way" },
  strong: { cls: "pill", label: "Strong" },
  weak: { cls: "pill warn", label: "Worth a shortcut" },
};

export default function SpeedHome() {
  const { go, navigating } = useGo();
  const [d, setD] = useState<{ calc: Calc; suggested: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/speed", { cache: "no-store" })
      .then((r) => r.json())
      .then(setD)
      .catch(() => setError("We could not load this. Refresh the page to try again."));
  }, []);

  async function daily() {
    if (busy || navigating) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "daily" }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "We could not start that. Try again.");
      go(`/speed/run/${j.id}`);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not start that. Try again.");
      setBusy(false);
    }
  }

  if (error && !d) return <div className="error" role="alert">{error}</div>;
  if (!d) return <p className="muted">Opening Speed…</p>;

  const streak = streakDays(d.calc.days);
  const pick = d.calc.topics.find((t) => t.id === d.suggested)!;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1>Speed</h1>
        <p className="lede">Quick ways to calculate faster in maths and physics. Learn a shortcut, answer ten, then keep going. The questions get harder as you get them right.</p>
        <p className="muted tiny" style={{ margin: "8px 0 0" }}>
          {streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} in a row. Keep it rolling.` : "Do a drill today and your days in a row start counting."}
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <Link href={`/speed/${pick.id}`} className="btn wide" style={{ textAlign: "center" }}>
          Start with {pick.label}
        </Link>
        <button type="button" className="btn ghost wide" disabled={busy || navigating} onClick={daily}>{busy || navigating ? "Getting your round ready…" : "Today's round · 6 questions"}</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}

      {(["Maths", "Physics"] as const).map((subject) => (
        <section key={subject} className="stack" style={{ gap: 4 }}>
          <h2>{subject}</h2>
          <div className="card list" style={{ padding: "4px 18px" }}>
            {d.calc.topics.filter((t) => TOPICS.find((x) => x.id === t.id)!.subject === subject).map((t) => (
              <Link key={t.id} href={`/speed/${t.id}`}>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <span>
                    <span className="t">{t.label}</span>
                    <br />
                    <span className="muted tiny">
                      {t.step !== null
                        ? `Step ${t.step} of 8 · ${t.right} of ${t.answered} right so far${t.avgMs ? ` · ${secs(t.avgMs)} a question` : ""}`
                        : t.bestMs !== null
                          ? `Best ${secs(t.bestMs)} a question${t.firstMs !== null && t.firstMs - t.bestMs >= 1000 ? `, ${secs(t.firstMs - t.bestMs)} quicker than the first go` : ""}`
                          : t.answered > 0
                            ? `${t.right} of ${t.answered} right so far${t.avgMs ? ` · ${secs(t.avgMs)} a question` : ""}`
                            : TOPICS.find((x) => x.id === t.id)!.line}
                    </span>
                  </span>
                  <span className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
                    <span className={TAG[t.status].cls}>{TAG[t.status].label}</span>
                    <span className="sp-pips" title={t.level ?? "No level yet"} aria-label={t.level ? `Level: ${t.level}` : "No level yet"}>
                      {LEVEL_NAMES.map((n, i) => <i key={n} className={i < t.pips ? "on" : ""} />)}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <p className="muted tiny" style={{ margin: 0 }}>Steps run from 1 to 8 and move after every answer. Levels follow your step: Warm-up (1 to 2), Steady (3 to 4), Quick (5 to 6), Sharp (7 to 8).</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/speed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "daily" }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "We could not start that. Try again.");
      router.push(`/speed/run/${j.id}`);
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
        <p className="lede">Quick ways to calculate faster. Learn a shortcut, run a drill, then beat your own time.</p>
        <p className="muted tiny" style={{ margin: "8px 0 0" }}>
          {streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} in a row. Keep it rolling.` : "Do a drill today and your days in a row start counting."}
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <Link href={`/speed/${pick.id}`} className="btn wide" style={{ textAlign: "center" }}>
          Start with {pick.label}
        </Link>
        <button type="button" className="btn ghost wide" disabled={busy} onClick={daily}>{busy ? "Getting your round ready…" : "Today's round · 6 questions"}</button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}

      <section className="stack" style={{ gap: 4 }}>
        <h2>Your topics</h2>
        <div className="card list" style={{ padding: "4px 18px" }}>
          {d.calc.topics.map((t) => (
            <Link key={t.id} href={`/speed/${t.id}`}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span>
                  <span className="t">{t.label}</span>
                  <br />
                  <span className="muted tiny">
                    {t.bestMs !== null
                      ? `Best ${secs(t.bestMs)} a question${t.firstMs !== null && t.firstMs - t.bestMs >= 1000 ? `, ${secs(t.firstMs - t.bestMs)} quicker than the first go` : ""}`
                      : t.answered > 0
                        ? `${t.right} of ${t.answered} right so far${t.avgMs ? ` · ${secs(t.avgMs)} a question` : ""}`
                        : TOPICS.find((x) => x.id === t.id)!.line}
                  </span>
                </span>
                <span className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
                  <span className={TAG[t.status].cls}>{TAG[t.status].label}</span>
                  <span className="sp-pips" title={t.level ?? "No best yet"} aria-label={t.level ? `Level: ${t.level}` : "No level yet"}>
                    {LEVEL_NAMES.map((n, i) => <i key={n} className={i < t.pips ? "on" : ""} />)}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="muted tiny" style={{ margin: 0 }}>Levels: Warm-up, Steady, Quick, Sharp. A level comes from your fastest drill with at least 8 of 10 right.</p>
      </section>
    </div>
  );
}

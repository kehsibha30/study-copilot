import Link from "next/link";
import type { Calc } from "@/lib/speed/stats";

// Speed drills in his memory: how each topic stands, and the wrong answers saved from drills.
export default function CalcSection({ calc }: { calc: Calc }) {
  if (calc.runs === 0) return null;
  const rows = calc.topics.filter((t) => t.answered > 0);
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2>Speed drills</h2>
      <div className="card" style={{ padding: "6px 22px" }}>
        {rows.map((t) => (
          <div className="trow" key={t.id}>
            <div>
              <div><Link href={`/speed/${t.id}`}>{t.label}</Link></div>
              <div className="sub">{t.right} of {t.answered} right{t.avgMs ? ` · ${Math.round(t.avgMs / 1000)} s a question` : ""}</div>
            </div>
            <span className={t.status === "weak" ? "pill warn" : t.status === "strong" ? "pill" : "pill plain"}>{t.status === "weak" ? "Worth a shortcut" : t.level ?? "On the way"}</span>
          </div>
        ))}
      </div>
      {calc.wrong.length > 0 && (
        <>
          <h3 className="muted">Wrong answers saved</h3>
          {calc.wrong.slice(0, 5).map((w) => (
            <div key={`${w.at}|${w.q}`} className="card weak">
              <span style={{ fontWeight: 500 }}>{w.q}</span>
              <span className="muted tiny">{w.label}. Wrote {w.said || "nothing"}; the answer is {w.a}.</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// Fails if any shortcut card ever gives an answer that differs from the ordinary method.
// Run: npm run check:speed
import { CARDS, TOPICS, exampleFor, fmt, parseAnswer, same, seeded, type Level } from "../lib/speed/cards.ts";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 25) console.error("FAIL", msg);
};
const RUNS = 4000;
const rows: string[] = [];

for (const card of CARDS) {
  let checked = 0;
  for (const level of [1, 2, 3] as Level[]) {
    const seen = new Set<string>();
    for (let i = 0; i < RUNS; i++) {
      const r = seeded(i * 7919 + level * 104729 + card.id.length);
      const m = card.make(level, r);
      checked++;
      seen.add(m.q);
      if (!same(m.direct, m.short)) fail(`${card.id} L${level} "${m.q}": ordinary ${fmt(m.direct)} vs shortcut ${fmt(m.short)}`);
      const typed = parseAnswer(m.a);
      if (!typed || !same(typed, m.direct)) fail(`${card.id} L${level} "${m.q}": printed answer ${m.a} does not read back as ${fmt(m.direct)}`);
      if (!m.q || !m.how || /NaN|undefined|Infinity/.test(m.q + m.how + m.a)) fail(`${card.id} L${level}: bad text in "${m.q}" / "${m.how}" / "${m.a}"`);
      if (!card.topic) fail(`${card.id}: no topic`);
      if (m.direct[0] < 0 && card.topic !== "profit-loss") fail(`${card.id} L${level} "${m.q}": negative answer ${m.a}`);
      if (Math.abs(m.direct[0] / m.direct[1]) > 1e7) fail(`${card.id} L${level} "${m.q}": answer too large ${m.a}`);
      if (m.a.includes(".") && m.a.split(".")[1].length > 4) fail(`${card.id} L${level} "${m.q}": too many decimals ${m.a}`);
      const again = card.make(level, seeded(i * 7919 + level * 104729 + card.id.length));
      if (again.q !== m.q || again.a !== m.a) fail(`${card.id} L${level}: same seed gave a different question`);
    }
    if (seen.size < 8) fail(`${card.id} L${level}: only ${seen.size} different questions in ${RUNS} tries`);
  }
  const ex = exampleFor(card);
  if (!same(ex.direct, ex.short)) fail(`${card.id}: worked example disagrees`);
  rows.push(`${card.id.padEnd(14)} ${card.topic.padEnd(15)} checked ${checked}`);
}

const per = TOPICS.map((t) => `${t.label}: ${CARDS.filter((c) => c.topic === t.id).length}`);
console.log(rows.join("\n"));
console.log(`\n${CARDS.length} cards, ${per.join(", ")}`);
if (failures) {
  console.error(`\n${failures} problems`);
  process.exit(1);
}
console.log("All shortcuts agree with the ordinary method.");

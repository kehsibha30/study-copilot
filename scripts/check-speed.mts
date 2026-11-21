// Fails if any shortcut card ever gives an answer that differs from the ordinary method.
// Run: npm run check:speed
import { CARDS, PHYS_STATS, TOPICS, exampleFor, fmt, parseAnswer, same, seeded, type Level } from "../lib/speed/cards.ts";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 25) console.error("FAIL", msg);
};
const RUNS = 2000;
const STEPS: Level[] = [1, 2, 3, 4, 5, 6, 7, 8];
// A rough difficulty measure: how many digits the question and its working carry. It must rise from step to step.
const weight = (q: string, how: string) => (q.match(/\d/g)?.length ?? 0) + (how.match(/\d/g)?.length ?? 0) / 2;
const byTopicStep = new Map<string, number[]>();
const rows: string[] = [];

for (const card of CARDS) {
  let checked = 0;
  for (const level of STEPS) {
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
      if (m.direct[0] <= 0 && card.topic !== "profit-loss") fail(`${card.id} L${level} "${m.q}": negative answer ${m.a}`);
      const key = `${card.topic}|${level}`;
      if (i < 400) byTopicStep.set(key, [...(byTopicStep.get(key) ?? []), weight(m.q, m.how)]);
      if (Math.abs(m.direct[0] / m.direct[1]) > 1e10) fail(`${card.id} L${level} "${m.q}": answer too large ${m.a}`);
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

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const t of TOPICS) {
  const m = STEPS.map((l) => mean(byTopicStep.get(`${t.id}|${l}`) ?? [0]));
  const rises = m[3] > m[0] && m[7] > m[3];
  console.log(`${t.id.padEnd(15)} difficulty by step: ${m.map((x) => x.toFixed(1)).join("  ")}${rises ? "" : "   <-- does not rise"}`);
  if (!rises) fail(`${t.id}: questions do not get harder from step 1 to 4 to 8`);
}
if (PHYS_STATS.fallbacks > 0) fail(`${PHYS_STATS.fallbacks} physics questions fell back to the plain default (numbers never fit)`);

const per = TOPICS.map((t) => `${t.label}: ${CARDS.filter((c) => c.topic === t.id).length}`);
console.log(rows.join("\n"));
console.log(`\n${CARDS.length} cards, ${per.join(", ")}`);
if (failures) {
  console.error(`\n${failures} problems`);
  process.exit(1);
}
console.log("All shortcuts agree with the ordinary method.");

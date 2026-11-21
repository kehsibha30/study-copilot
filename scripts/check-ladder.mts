// Checks the step ladder with pretend students, and the question bank rules. No database, no AI.
// Run: npm run check:ladder
import { MAX_STEP, MIN_STEP, SET_SIZE, afterAnswer, firstStep, setLine, stepOf, timeLimitMs, type Mark } from "../lib/speed/ladder.ts";
import { BANK_TOPICS, hashId, parseBank, usable } from "../lib/speed/bank.ts";
import { BANK_TEXT } from "../lib/speed/bank-data.ts";

let failures = 0;
const fail = (m: string) => {
  failures++;
  console.error("FAIL", m);
};
const ok = (m: string) => console.log("ok  ", m);
const TARGET = 30_000;

// A pretend student answers n questions across sets of 10. `answer(step)` says what he does at a step.
function simulate(n: number, answer: (step: number, i: number) => { mark: Mark; ms: number }, seedStart = 1) {
  let ability = seedStart;
  const steps: number[] = [];
  const marks: Mark[] = [];
  for (let i = 0; i < n; i++) {
    const inSet = i % SET_SIZE;
    const step = inSet === 0 ? firstStep(ability) : stepOf(ability);
    const a = answer(step, i);
    ability = afterAnswer(ability, a.mark, a.ms, TARGET, step);
    steps.push(step);
    marks.push(a.mark);
  }
  return { steps, marks, ability };
}

// 1. Always right and quick: reaches the top within 25 questions and stays in range.
{
  const s = simulate(60, () => ({ mark: "right", ms: 8000 }));
  const firstTop = s.steps.findIndex((x) => x === MAX_STEP);
  if (firstTop < 0 || firstTop >= 25) fail(`always-right student reached Step ${MAX_STEP} at question ${firstTop + 1} (needs to be within 25)`);
  else ok(`always right and quick: reaches Step ${MAX_STEP} at question ${firstTop + 1}`);
  if (s.steps.some((x) => x < MIN_STEP || x > MAX_STEP)) fail("a step went out of the 1 to 8 range");
}
// 2. Always wrong: stays at the bottom.
{
  const s = simulate(60, () => ({ mark: "wrong", ms: 9000 }), 4);
  const lowEnd = s.steps.slice(-20);
  if (!lowEnd.every((x) => x === MIN_STEP)) fail(`always-wrong student is not at Step 1 by the end: ${lowEnd.join(",")}`);
  else ok("always wrong: falls to Step 1 and stays there");
}
// 3. Blank every time: also stays low, never rises.
{
  const s = simulate(40, () => ({ mark: "skipped", ms: 0 }), 3);
  if (s.steps.slice(-10).some((x) => x > 2)) fail("a student who leaves everything blank should not climb");
  else ok("all blanks: no climbing");
}
// 4. Right slowly every time: rises, but slower than the quick student.
{
  const quick = simulate(30, () => ({ mark: "right", ms: 8000 }));
  const slow = simulate(30, () => ({ mark: "right", ms: 300_000 }));
  const q = quick.steps.reduce((a, b) => a + b, 0);
  const sl = slow.steps.reduce((a, b) => a + b, 0);
  if (!(sl < q) || !(slow.steps[29] >= 4)) fail(`slow-but-right student: total steps ${sl} vs quick ${q}, final step ${slow.steps[29]}`);
  else ok("always right but slow: still climbs, more slowly than the quick student");
}
// 5. A student with a real skill level settles near it. Many runs, a fixed random sequence.
for (const skill of [2.5, 4.5, 6.5]) {
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const means: number[] = [];
  const rights: number[] = [];
  for (let run = 0; run < 300; run++) {
    const s = simulate(120, (step) => ({ mark: rnd() < 1 / (1 + Math.exp(1.1 * (step - skill))) ? "right" : "wrong", ms: 12000 }));
    const tail = s.steps.slice(60);
    means.push(tail.reduce((a, b) => a + b, 0) / tail.length);
    rights.push(s.marks.slice(60).filter((m) => m === "right").length / 60);
  }
  const m = means.reduce((a, b) => a + b, 0) / means.length;
  const rr = rights.reduce((a, b) => a + b, 0) / rights.length;
  if (Math.abs(m - skill) > 1.2) fail(`skill ${skill}: settles at step ${m.toFixed(2)}, too far from it`);
  else ok(`skill ${skill}: settles at step ${m.toFixed(2)}, right ${(rr * 100).toFixed(0)}% of the time`);
  if (rr < 0.4 || rr > 0.75) fail(`skill ${skill}: right ${(rr * 100).toFixed(0)}% of the time, outside 40 to 75%`);
}
// 6. The in-time limit grows with the step and the words never promise what did not happen.
if (!(timeLimitMs(TARGET, 8) > timeLimitMs(TARGET, 1))) fail("time limit does not grow with step");
else ok("time limit grows with the step");
{
  const lines = [setLine(2, 4, 4, 8, 10), setLine(4, 3, 3, 4, 10), setLine(3, 3, 3, 8, 10), setLine(3, 3, 3, 5, 10), setLine(1, 1, 0, 0, 10)];
  if (!/climbed/.test(lines[0]) || /climbed|reached/.test(lines[1] + lines[2] + lines[3])) fail("set line wording does not match what happened");
  else if (/(great|amazing|brilliant)/i.test(lines.join(" "))) fail("set line praises without a number");
  else ok("set lines match what happened: " + JSON.stringify(lines));
}

// ---------- question bank ----------
const parsed = parseBank(BANK_TEXT);
if (parsed.problems.length) fail(`the bank text has problems: ${JSON.stringify(parsed.problems)}`);
else ok(`bank: ${parsed.questions.length} questions read with no problems`);
for (const q of parsed.questions) {
  if (!BANK_TOPICS.includes(q.topic)) fail(`bank "${q.q}": unknown topic`);
  if (q.answer < 0 || q.answer >= q.options.length) fail(`bank "${q.q}": answer not in options`);
}
const approved = parsed.questions.filter((q) => q.approved).length;
if (usable(parsed.questions).length !== approved) fail("usable() let an unapproved question through");
else ok(`bank: only approved questions are used (${approved} approved, ${parsed.questions.length - approved} waiting for approval)`);
if (usable(parsed.questions, true).length !== parsed.questions.length) fail("draft switch (local testing) does not include drafts");

const good = `topic: sound\nstep: 2\nq: Test?\na) one\nb) two\nanswer: b\nwhy: because\nsource: me\napproved: yes`;
const cases: [string, string][] = [
  ["no key", good.replace("answer: b\n", "")],
  ["key not an option", good.replace("answer: b", "answer: d")],
  ["no why", good.replace("why: because\n", "")],
  ["no source", good.replace("source: me\n", "")],
  ["bad step", good.replace("step: 2", "step: 9")],
  ["bad topic", good.replace("topic: sound", "topic: cooking")],
  ["same options", good.replace("b) two", "b) One")],
  ["one option", good.replace("b) two\n", "")],
  ["out of order labels", good.replace("a) one", "b) one").replace("b) two", "c) two")],
];
for (const [name, text] of cases) {
  const r = parseBank(text);
  if (r.questions.length !== 0 || r.problems.length !== 1) fail(`bank rule "${name}" was not rejected`);
}
ok(`bank: ${cases.length} kinds of broken question are rejected`);
if (parseBank(good).questions.length !== 1) fail("a good question was rejected");
if (parseBank(good + "\n---\n" + good).problems.length !== 1) fail("a duplicate question was not caught");
if (hashId("Same  text") !== hashId("same text")) fail("question ids should ignore case and spacing");
ok("bank: duplicates caught, ids ignore case and spacing");

if (failures) {
  console.error(`\n${failures} problems`);
  process.exit(1);
}
console.log("\nThe ladder and the bank behave as the spec says.");

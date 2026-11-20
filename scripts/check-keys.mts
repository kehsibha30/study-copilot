// Checks the answer key page matching, saved-answer matching and the "both" rule. No database, no AI.
// Run: npm run check:keys
import { bankable, bothSplit, fingerprintText, labelForText, matchKeyPage, mayFeedBank, textOfLabel, type KQuestion } from "../lib/keycore.ts";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) {
    failures++;
    console.error("FAIL", name, detail);
  } else console.log("ok  ", name);
};

const opts = (...t: string[]) => t.map((text, i) => ({ label: String.fromCharCode(65 + i), text }));
const q = (n: number, text: string, options: { label: string; text: string }[], hasFigure = false): KQuestion => ({ n, type: "mcq", text, options, hasFigure });

// ---- 1. answer key page ----
const paper = [q(1, "Which gas do plants take in for photosynthesis?", opts("Oxygen", "Carbon dioxide", "Nitrogen", "Helium")), q(2, "What is the SI unit of force?", opts("Joule", "Watt", "Newton", "Pascal")), q(3, "Name the powerhouse of the cell here", opts("Nucleus", "Mitochondria", "Ribosome", "Vacuole"))];
const m = matchKeyPage(paper, [{ n: 1, answer: "(b)" }, { n: 2, answer: "C" }, { n: 3, answer: "Z" }, { n: 9, answer: "A" }, { n: 1, answer: "D" }]);
check("key page: matched answers", m.labels["1"] === "B" && m.labels["2"] === "C", JSON.stringify(m));
check("key page: label that is not an option is dropped", !("3" in m.labels) && m.dropped.includes(3));
check("key page: question not on the paper is dropped", m.dropped.includes(9));
check("key page: first answer for a question wins", m.labels["1"] === "B");
check("key page: counts matched of total", m.matched === 2 && m.total === 3);
check("key page: unreadable (no rows) matches nothing", matchKeyPage(paper, []).matched === 0);

// ---- 2. saved answers ----
const a = q(5, "Which gas do plants take in for photosynthesis during the day?", opts("Oxygen", "Carbon dioxide", "Nitrogen", "Helium"));
const shuffled = q(17, "Which gas do plants take in for photosynthesis during the day?", [{ label: "A", text: "Helium" }, { label: "B", text: "Nitrogen" }, { label: "C", text: "Oxygen" }, { label: "D", text: "Carbon dioxide" }]);
const fa = fingerprintText(a);
check("saved: same question with shuffled options matches", fa !== null && fa === fingerprintText(shuffled));
const saved = textOfLabel(a, "B");
check("saved: answer is stored as text", saved === "carbon dioxide", String(saved));
check("saved: label found by text on the shuffled paper", labelForText(shuffled, saved!) === "D");
check("saved: no match when no option reads the same", labelForText(shuffled, "argon") === null);
const fig = q(6, "Which of the options shows the figure drawn above correctly?", opts("(picture)", "(picture)", "(picture)", "(picture)"), true);
check("saved: figure question is never saved", !bankable(fig) && fingerprintText(fig) === null);
const pic = q(7, "Select the correct water image of the given combination of letters", opts("(picture)", "(picture)", "(picture)", "(picture)"));
check("saved: picture-option question is never saved", fingerprintText(pic) === null);
const other = q(8, "Which gas do plants take in for photosynthesis during the night?", opts("Oxygen", "Carbon dioxide", "Nitrogen", "Helium"));
check("saved: a different question does not match", fingerprintText(other) !== fa);
check("saved: test run never feeds saved answers", !mayFeedBank({ title: "TEST RUN", excluded: true }));
check("saved: Allen paper never feeds saved answers", !mayFeedBank({ title: "Allen Chemistry paper" }));
check("saved: ordinary paper may feed saved answers", mayFeedBank({ title: "MTP 2 Science" }));

// ---- 3. "Both" rule ----
const both = q(9, "An electric heater is used by us to convert electrical energy to", opts("Heat energy", "Light energy", "Chemical energy", "Both A and B."));
check("both: X against 'Both X and Y' is a split", bothSplit(both, "A", "D") && bothSplit(both, "D", "B"));
check("both: two ordinary options are not", !bothSplit(both, "A", "C"));
check("both: the same answer is not a split", !bothSplit(both, "A", "A"));
const all = q(10, "Which of these is a metal in the list below here?", opts("Iron", "Copper", "Zinc", "All of the above"));
check("both: 'All of the above' counts", bothSplit(all, "B", "D"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll key checks passed");

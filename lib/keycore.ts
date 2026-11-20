// Pure helpers for answer keys and saved answers. No database, no AI, no imports, so scripts/check-keys.mts can run them directly.

export type KOption = { label: string; text: string };
export type KQuestion = { n: number; type: "mcq" | "written"; text: string; options: KOption[]; hasFigure: boolean };

export function norm(label: string | null | undefined): string {
  return label ? label.replace(/[^a-z0-9]/gi, "").toUpperCase() : "";
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Questions that can be told apart by their words. A figure or a picture option is not in the words, so those are never saved or matched.
export function bankable(q: KQuestion): boolean {
  if (q.type !== "mcq" || q.hasFigure || q.options.length < 2) return false;
  if (words(q.text).length < 12) return false;
  return !q.options.some((o) => /^\(?picture\)?$/i.test(o.text.trim()) || words(o.text) === "");
}

// The question as words plus its options as words, in any order. Same question with shuffled options gives the same string.
export function fingerprintText(q: KQuestion): string | null {
  if (!bankable(q)) return null;
  return words(q.text) + " || " + q.options.map((o) => words(o.text)).sort().join(" | ");
}

export function textOfLabel(q: KQuestion, label: string): string | null {
  const o = q.options.find((x) => x.label === norm(label));
  return o ? words(o.text) : null;
}

// The label this paper gives to a saved answer's text, or null when no option reads the same.
export function labelForText(q: KQuestion, answerText: string): string | null {
  const hits = q.options.filter((o) => words(o.text) === answerText);
  return hits.length === 1 ? hits[0].label : null;
}

// An answer key page, read as number and letter pairs, laid onto this paper's questions.
export function matchKeyPage(questions: KQuestion[], rows: { n: number; answer: string }[]) {
  const labels: Record<string, string> = {};
  const dropped: number[] = [];
  const mcq = questions.filter((q) => q.type === "mcq");
  for (const r of rows) {
    const q = mcq.find((x) => x.n === r.n);
    const label = norm(r.answer);
    if (!q || !q.options.some((o) => o.label === label)) {
      dropped.push(r.n);
      continue;
    }
    if (!(String(q.n) in labels)) labels[String(q.n)] = label;
  }
  return { labels, matched: Object.keys(labels).length, total: mcq.length, dropped };
}

// "Both (1) & (2)" or "All of the above": the labels of the options it stands for. null for an ordinary option.
export function combinedParts(q: KQuestion, label: string): string[] | null {
  const option = q.options.find((o) => o.label === label);
  if (!option) return null;
  const others = q.options.filter((o) => o.label !== label).map((o) => o.label);
  if (/\b(all|each)\s+of\s+(the\s+)?(above|these)\b/i.test(option.text)) return others;
  // Only "Both ..." counts. A bare "(1) and (2)" may be pointing at numbered statements, not at options.
  if (!/\bboth\b/i.test(option.text)) return null;
  const named = new Set<string>();
  for (const m of option.text.matchAll(/\(\s*([a-z0-9]{1,3})\s*\)|\b([a-d]|[1-9])\b/gi)) {
    const l = norm(m[1] ?? m[2]);
    if (others.includes(l)) named.add(l);
  }
  return named.size >= 2 ? [...named] : null;
}

// Two solves that split between an option and a "Both ..." option that includes it are both defensible.
export function bothSplit(q: KQuestion, a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y || x === y) return false;
  return Boolean(combinedParts(q, x)?.includes(y) || combinedParts(q, y)?.includes(x));
}

// Test runs, papers left out of the record, and the Allen paper (private use only) never feed saved answers.
export function mayFeedBank(paper: { excluded?: boolean; title: string }): boolean {
  return !paper.excluded && !/allen/i.test(paper.title);
}

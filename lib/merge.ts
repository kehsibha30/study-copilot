// When the same page is photographed twice (or two photos overlap), the reader lists a question once per
// photo it appears on. This keeps one copy per question number: the clearest one.

export type ReadQ = {
  n: number;
  text: string;
  options: { label: string; text: string }[];
  has_figure: boolean;
  page: number;
  marked_answer: string | null;
  cut_off: boolean;
};

const clean = (s: string | null | undefined) => (s ? s.replace(/[^a-z0-9]/gi, "").toUpperCase() : "");

export function mergeSameQuestion<T extends ReadQ>(all: T[]): T[] {
  const groups = new Map<number, T[]>();
  for (const q of all) groups.set(q.n, [...(groups.get(q.n) ?? []), q]);

  const out: T[] = [];
  for (const group of groups.values()) {
    // Clearest copy first: not cut off, most options read, most text read, earliest photo.
    const ranked = [...group].sort(
      (a, b) =>
        Number(a.cut_off) - Number(b.cut_off) ||
        b.options.length - a.options.length ||
        b.text.length - a.text.length ||
        a.page - b.page
    );
    const best = ranked[0];
    if (group.length === 1) {
      out.push(best);
      continue;
    }
    // A mark seen on any copy counts, but two copies that show different marks cancel out: the student
    // taps the answer in rather than being graded on a guess.
    const marks = new Set(group.map((q) => clean(q.marked_answer)).filter(Boolean));
    const marked = marks.size === 1 ? group.find((q) => clean(q.marked_answer))!.marked_answer : null;
    out.push({ ...best, marked_answer: marked, has_figure: group.some((q) => q.has_figure) });
  }
  return out.sort((a, b) => a.n - b.n);
}

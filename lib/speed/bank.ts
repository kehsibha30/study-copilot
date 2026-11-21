// The question bank: written multiple-choice questions (Olympiad style and anything Abhishek adds).
// Pure code, no imports. The questions themselves live in bank-data.ts as plain text.
//
// A question is only ever shown if it has a key we can trust. "approved: yes" means Abhishek (or a printed key he
// named) vouches for the answer. Anything else is held back, never shown.

export type BankQ = {
  id: string;
  topic: string;
  step: number;
  q: string;
  options: string[];
  answer: number; // index into options
  why: string;
  source: string;
  approved: boolean;
  isPrivate: boolean; // copied from an organiser's paper: this family only, never shared
};

export const BANK_TOPICS = ["percentages", "ratio", "multiplication", "division", "profit-loss", "probability", "motion", "pressure", "sound", "light", "electricity"];

export function hashId(text: string): string {
  let h = 5381;
  for (const ch of text.toLowerCase().replace(/\s+/g, " ").trim()) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return "b" + h.toString(16);
}

export type BankProblem = { block: number; q: string; problem: string };

export function parseBank(text: string): { questions: BankQ[]; problems: BankProblem[] } {
  const questions: BankQ[] = [];
  const problems: BankProblem[] = [];
  const blocks = text.split(/^\s*---\s*$/m).map((b) => b.trim()).filter(Boolean);
  const seen = new Set<string>();
  blocks.forEach((b, n) => {
    const f: Record<string, string> = {};
    const options: string[] = [];
    const labels: string[] = [];
    for (const raw of b.split("\n")) {
      const line = raw.trim();
      const opt = line.match(/^([a-f])\)\s*(.+)$/i);
      if (opt) {
        labels.push(opt[1].toLowerCase());
        options.push(opt[2].trim());
        continue;
      }
      const kv = line.match(/^(topic|step|q|answer|why|source|approved|private):\s*(.*)$/i);
      if (kv) f[kv[1].toLowerCase()] = kv[2].trim();
    }
    const bad = (problem: string) => problems.push({ block: n + 1, q: (f.q ?? b.slice(0, 40)).slice(0, 60), problem });
    const step = Number(f.step);
    if (!f.q) return bad("no question text");
    if (!BANK_TOPICS.includes(f.topic ?? "")) return bad(`unknown topic "${f.topic ?? ""}"`);
    if (!Number.isInteger(step) || step < 1 || step > 8) return bad("step must be a whole number from 1 to 8");
    if (options.length < 2 || options.length > 6) return bad("needs 2 to 6 options a), b), c)...");
    if (labels.some((l, i) => l !== "abcdef"[i])) return bad("options must be labelled a), b), c) in order");
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return bad("two options are the same");
    const ans = (f.answer ?? "").toLowerCase().replace(/[^a-f]/g, "");
    const idx = ans ? "abcdef".indexOf(ans) : -1;
    if (idx < 0 || idx >= options.length) return bad("the answer is missing or is not one of the options");
    if (!f.why) return bad("no 'why' line (the explanation shown after the set)");
    if (!f.source) return bad("no 'source' line");
    const id = hashId(f.q + "|" + options.join("|"));
    if (seen.has(id)) return bad("duplicate of an earlier question");
    seen.add(id);
    questions.push({ id, topic: f.topic, step, q: f.q, options, answer: idx, why: f.why, source: f.source, approved: /^(yes|y|true)$/i.test(f.approved ?? ""), isPrivate: /^(yes|y|true)$/i.test(f.private ?? "") });
  });
  return { questions, problems };
}

// Only approved questions are used. Drafts can be switched on for local testing only.
export function usable(qs: BankQ[], allowDrafts = false): BankQ[] {
  return qs.filter((q) => q.approved || allowDrafts);
}

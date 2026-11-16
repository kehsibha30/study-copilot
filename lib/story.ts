import type { ConceptRow, WorkOn } from "./workon";

// The Report's story: summary, strengths, weak spots and a 2-week plan, worked out from the data with fixed
// sentences. No AI call (decision 16 Nov 2026), so it costs nothing and cannot claim more than the data shows.

export type Reader = "student" | "parent";

export type Strength = { subject: string; topic: string; line: string };
export type Weak = { name: string; subject: string; topic: string; line: string; status: "to_fix" | "check_due" | "check_later" | "practice"; href: string | null };
export type PlanItem = { on: string | null; when: string; label: string; text: string; href: string | null };

export type Story = {
  scope: string;
  early: boolean;
  summary: string;
  strengths: Strength[];
  weak: Weak[];
  plan: PlanItem[];
};

const SCIENCE = ["Physics", "Chemistry", "Biology"];

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function addDays(base: number, days: number): string {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function story(r: WorkOn, reader: Reader, sets: number, now = Date.now()): Story {
  const you = reader === "student";
  const right = r.paperRows.reduce((s, p) => s + p.right, 0);
  const counted = r.paperRows.reduce((s, p) => s + p.counted, 0);

  // Strengths: chapters with enough answers and almost all right, on papers or in chapter practice.
  const strengths: Strength[] = [];
  for (const s of r.subjects) {
    for (const t of s.topics) {
      if (t.name === "Not sorted yet" || t.concepts.length > 0) continue;
      const sure = t.status === "strong" || (t.counted >= 3 && t.right / t.counted >= 0.9);
      if (sure) strengths.push({ subject: s.name, topic: t.name, line: `${t.right} of ${t.counted} right${t.papers > 1 ? ` across ${t.papers} papers` : " on papers"}${t.status === "strong" ? ", and again on new questions" : ""}.` });
    }
  }
  for (const p of r.practice) {
    if (p.total >= 4 && p.right / p.total >= 0.8 && !strengths.some((x) => x.subject === p.subject && x.topic === p.topic)) {
      strengths.push({ subject: p.subject, topic: p.topic, line: `${p.right} of ${p.total} right in chapter practice.` });
    }
  }

  // Weak spots: ideas still open, ideas fixed and waiting for their check, and chapters missed in practice.
  const weak: Weak[] = [];
  const open = r.ideas.filter((c) => c.status === "needs_work" || c.status === "slipped");
  const waiting = r.ideas.filter((c) => c.status === "practised");
  const lessonLine = (c: ConceptRow) =>
    c.state === "new" ? "Lesson not started." : c.state === "started" ? "Lesson started, not finished." : c.state === "needs_more" ? "Lesson done; the new question was still missed." : "Lesson done.";
  for (const c of open) {
    weak.push({
      name: c.name,
      subject: c.subject,
      topic: c.topic,
      status: "to_fix",
      href: c.href,
      line: `${c.status === "slipped" ? "Was fixed, then wrong again." : c.papers > 1 ? `Wrong on ${c.papers} papers.` : "Wrong on a paper."} ${lessonLine(c)}`,
    });
  }
  for (const c of waiting) {
    weak.push({
      name: c.name,
      subject: c.subject,
      topic: c.topic,
      status: c.due ? "check_due" : "check_later",
      href: c.due ? "/self-test" : null,
      line: c.due ? "Fixed; the check that shows whether it stayed is due now." : `Fixed; a check on ${c.checkOn ? new Date(c.checkOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "a later day"} shows whether it stayed.`,
    });
  }
  for (const p of r.practice) {
    if (p.total >= 3 && p.right / p.total < 0.6) {
      weak.push({ name: p.topic, subject: p.subject, topic: p.topic, status: "practice", href: `/self-test?topic=${encodeURIComponent(`${p.subject}|${p.topic}`)}`, line: `${p.right} of ${p.total} right in chapter practice.` });
    }
  }

  // The plan: lessons first (one a day), then a practice set, checks on their own dates, then what is missing.
  const plan: PlanItem[] = [];
  let d = 0;
  for (const c of open.filter((c) => c.state !== "solved_alone" && c.state !== "walked_through").slice(0, 3)) {
    plan.push({ when: "", on: addDays(now, d++), label: "Lesson", text: lower(c.name), href: c.href });
  }
  if (open.length > 0) {
    const chapters = [...new Set(open.map((c) => c.topic))].slice(0, 3);
    plan.push({ when: "", on: addDays(now, d + 1), label: "Practice", text: `10 new questions on ${list(chapters)}`, href: "/self-test" });
    d += 2;
  }
  for (const c of waiting) {
    const on = c.due || !c.checkOn ? addDays(now, 0) : c.checkOn;
    if (Date.parse(on) <= Date.parse(addDays(now, 14))) plan.push({ when: "", on, label: "Check", text: lower(c.name), href: c.due ? "/self-test" : null });
  }
  const untried = SCIENCE.filter((s) => !r.subjects.some((x) => x.name === s && x.counted > 0) && !r.practice.some((p) => p.subject === s));
  if (untried.length > 0) {
    plan.push({ when: "", on: addDays(now, Math.max(d, 3)), label: "Practice", text: `a ${untried[0]} chapter (no ${list(untried)} answers yet, and ${untried.length === 1 ? "it counts" : "they count"} for NEET)`, href: "/self-test" });
  }
  plan.push({ when: "", on: null, label: "Next week", text: `Upload ${you ? "your" : "the"} next school test, so the plan follows what the class is doing`, href: "/" });
  plan.sort((a, b) => (a.on ?? "9").localeCompare(b.on ?? "9"));
  const endOfToday = Date.parse(addDays(now, 1));
  for (const p of plan) p.when = !p.on ? p.label : Date.parse(p.on) < endOfToday ? "Today" : new Date(p.on).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  // The summary: two or three plain sentences.
  const parts: string[] = [];
  const topStrengths = strengths.slice(0, 2).map((s) => s.topic);
  if (topStrengths.length) parts.push(`${you ? "You are steady on" : "Steady on"} ${list(topStrengths)}.`);
  else if (counted > 0) parts.push(`${right} of ${counted} answered right so far; not enough yet to call any chapter a strength.`);
  if (open.length === 1) parts.push(`One idea still slips: ${lower(open[0].name)}.`);
  else if (open.length === 2) parts.push(`2 ideas still slip: ${list(open.map((c) => lower(c.name)))}.`);
  else if (open.length > 2) parts.push(`${open.length} ideas still slip, including ${list(open.slice(0, 2).map((c) => lower(c.name)))}.`);
  else if (counted > 0) parts.push("No idea is waiting to be fixed.");
  if (waiting.length) parts.push(`${waiting.length === 1 ? "One is" : `${waiting.length} are`} fixed and waiting for a check.`);
  if (parts.length === 0) parts.push(you ? "Nothing to go on yet. Upload a test paper or practise a chapter." : "Nothing to go on yet.");

  const span = r.firstAt ? `${new Date(r.firstAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to today` : "";
  const what = [r.papers ? `${r.papers} ${r.papers === 1 ? "paper" : "papers"}` : "", sets ? `${sets} practice ${sets === 1 ? "set" : "sets"}` : ""].filter(Boolean).join(" and ");
  return {
    scope: what ? `Based on ${what}${span ? `, ${span}` : ""}.` : "Nothing done yet.",
    early: r.papers < 3,
    summary: parts.join(" "),
    strengths,
    weak,
    plan,
  };
}

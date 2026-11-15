import { listTopicDoubts } from "./doubts";
import { outcome } from "./fix";
import { stage, verdict } from "./grade";
import { SUBJECTS } from "./pipeline";
import { listSelfTests, type TopicPick } from "./selftest";
import { listPapers } from "./store";

// "What to work on" and the report: everything the student's finished papers, lessons and sets show,
// grouped subject > topic > idea. Nothing is stored for this. It is worked out from the papers and sets
// each time, so removing a paper, leaving one out as a test run, or reporting a question changes it straight away.

export type ConceptState = "new" | "started" | "solved_alone" | "needs_more" | "walked_through";

// Where an idea stands over time (v1.8 D20).
// needs_work: wrong on a paper, not yet right on a new question without help.
// practised:  right on a new question, but only on or near the same day. Waiting for a check some days later.
// held:       right again on a new question at least FIRST_CHECK_DAYS later.
// slipped:    was practised or held, then went wrong again (on a set or on a newer paper).
export type Status = "needs_work" | "practised" | "held" | "slipped";

export const FIRST_CHECK_DAYS = 5;
export const SECOND_CHECK_DAYS = 21;

export type ConceptRow = {
  name: string;
  subject: string;
  topic: string;
  papers: number; // how many papers it went wrong in
  questions: number;
  state: ConceptState; // where the student is with the lesson on the latest paper it came up in
  // The latest set taken after that paper: all its questions on this idea right, or not.
  test: "passed" | "missed" | null;
  status: Status;
  since: string; // when it moved to this status
  checks: number; // later checks passed: 0, 1 or 2
  checkOn: string | null; // the day the next check becomes due (start of that day), if one is waiting
  due: boolean; // that day has come
  href: string;
};

// strong: enough questions over at least two papers, nearly all right, nothing open (v1.8 D23).
export type TopicStatus = "needs_work" | "checking" | "strong" | "fine" | "too_few";

export type TopicRow = {
  name: string;
  right: number;
  counted: number; // answered questions only. A question left blank says nothing sure about the topic.
  skipped: number;
  papers: number;
  status: TopicStatus;
  slippedAt: string | null; // a strong topic missed on a new question, and when
  byPaper: { title: string; at: string; right: number; counted: number; skipped: number }[];
  concepts: ConceptRow[]; // open: needs work or slipped
  tracked: ConceptRow[]; // practised or held
  canTest: boolean; // "Test yourself" has something to build questions from
  asked: { q: string; at: string; flagged: boolean }[]; // what the student asked about this topic, newest first
};
export type SubjectRow = { name: string; right: number; counted: number; toWork: number; topics: TopicRow[] };

export type WorkOn = {
  papers: number;
  leftOut: number;
  open: number; // ideas that need work or have slipped
  next: { name: string; href: string; started: boolean } | null;
  focus: ConceptRow[];
  due: ConceptRow[]; // checks that can be taken now
  recheckWaiting: string | null; // a recheck set already written and not handed in
  checking: ConceptRow[]; // practised, check not due yet
  held: ConceptRow[];
  ideas: ConceptRow[]; // every idea, the ones needing attention first
  subjects: SubjectRow[];
  keep: TopicPick[]; // up to two strong topics for the next set to carry a question from
  paperRows: { id: string; title: string; at: string; right: number; counted: number; skipped: number; notCounted: number }[];
  daysActive: number; // of the last 7 days, how many had any work in the app
  notCounted: number; // questions the app would not mark because it was unsure
  reported: number; // questions the student said looked wrong
  answersReported: number; // answers to his own questions (in lessons and on topic pages) that he said looked wrong
  answersGiven: number;
  firstAt: string | null;
};

const NOT_SORTED = "Not sorted yet";

function dayStart(iso: string, plusDays = 0): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays);
}

type Event = { at: string; kind: "wrong" | "lesson_pass" | "lesson_miss" | "set_pass" | "set_miss" };

export function workOn(now = Date.now()): WorkOn {
  const all = listPapers().filter((p) => stage(p) === "done");
  const papers = all.filter((p) => !p.excluded).reverse(); // oldest first, so the latest paper has the last word

  type TopicAcc = { right: number; counted: number; skipped: number; paperIds: Set<string>; byPaper: TopicRow["byPaper"] };
  const subjects = new Map<string, Map<string, TopicAcc>>();
  type Row = ConceptRow & { paperIds: Set<string>; events: Event[] };
  const concepts = new Map<string, Row>();
  const activity: string[] = [];
  const paperRows: WorkOn["paperRows"] = [];
  let notCounted = 0;
  let reported = 0;
  let answersReported = 0;
  let answersGiven = 0;

  for (const paper of papers) {
    activity.push(paper.createdAt);
    const byN = new Map((paper.questions ?? []).map((q) => [q.n, q]));
    const mine = { id: paper.id, title: paper.title, at: paper.createdAt, right: 0, counted: 0, skipped: 0, notCounted: 0 };
    for (const q of paper.questions ?? []) {
      const v = verdict(paper, q);
      if (v === "unsure") mine.notCounted++;
      if (v === "reported") reported++;
      if (v !== "correct" && v !== "wrong" && v !== "skipped") continue;
      if (v === "skipped") mine.skipped++;
      else mine.counted++;
      if (v === "correct") mine.right++;
      const subject = q.subject || q.section || "Other";
      const topics = subjects.get(subject) ?? new Map<string, TopicAcc>();
      const topic = topics.get(q.topic || NOT_SORTED) ?? { right: 0, counted: 0, skipped: 0, paperIds: new Set<string>(), byPaper: [] };
      if (!topic.paperIds.has(paper.id)) {
        topic.paperIds.add(paper.id);
        topic.byPaper.push({ title: paper.title, at: paper.createdAt, right: 0, counted: 0, skipped: 0 });
      }
      const line = topic.byPaper[topic.byPaper.length - 1];
      if (v === "skipped") {
        topic.skipped++;
        line.skipped++;
      } else {
        topic.counted++;
        line.counted++;
      }
      if (v === "correct") {
        topic.right++;
        line.right++;
      }
      topics.set(q.topic || NOT_SORTED, topic);
      subjects.set(subject, topics);
    }
    notCounted += mine.notCounted;
    paperRows.push(mine);

    for (const fix of Object.values(paper.fixes ?? {})) {
      activity.push(fix.startedAt);
      for (const d of fix.doubts ?? []) {
        activity.push(d.at);
        answersGiven++;
        if (d.flagged) answersReported++;
      }
    }

    (paper.ideas ?? []).forEach((idea, index) => {
      if (idea.name === "Other mistakes") return;
      const wrong = idea.questions.filter((n) => {
        const q = byN.get(n);
        return q ? verdict(paper, q) === "wrong" : false;
      });
      if (wrong.length === 0) return;
      const first = byN.get(wrong[0]);
      const fix = paper.fixes?.[String(index)];
      const key = idea.name.trim().toLowerCase();
      const row: Row =
        concepts.get(key) ??
        { name: idea.name, subject: "", topic: "", papers: 0, questions: 0, state: "new", test: null, status: "needs_work", since: paper.createdAt, checks: 0, checkOn: null, due: false, href: "", paperIds: new Set<string>(), events: [] };
      row.paperIds.add(paper.id);
      row.papers = row.paperIds.size;
      row.questions += wrong.length;
      row.subject = first?.subject || first?.section || "Other";
      row.topic = first?.topic || NOT_SORTED;
      const result = fix ? outcome(fix) : null;
      row.state = result ?? (fix ? "started" : "new");
      row.href = `/papers/${paper.id}/fix/${index}`;
      row.events.push({ at: paper.createdAt, kind: "wrong" });
      // The lesson's own new question is done without hints. The lesson has no finish time, so its start is used.
      if (fix && result === "solved_alone") row.events.push({ at: fix.startedAt, kind: "lesson_pass" });
      if (fix && result === "needs_more") row.events.push({ at: fix.startedAt, kind: "lesson_miss" });
      concepts.set(key, row);
    });
  }

  // New questions answered without help, on sets and rechecks.
  const sets = listSelfTests().filter((t) => !t.excluded);
  const keepLast = new Map<string, { at: string; right: boolean }>();
  for (const t of sets) {
    activity.push(t.createdAt);
    if (!t.submittedAt) continue;
    activity.push(t.submittedAt);
    const tally = new Map<string, { right: number; total: number }>();
    t.questions.forEach((q, i) => {
      if (t.flagged.includes(i)) return;
      const right = Boolean(q.options[t.answers[String(i)]]?.right);
      if (q.keep) {
        const k = `${q.keep.subject}|${q.keep.topic}`;
        const last = keepLast.get(k);
        // The latest answer on a strong topic decides; within one set, a miss outweighs a right answer.
        if (!last || t.submittedAt! > last.at || (t.submittedAt === last.at && !right)) keepLast.set(k, { at: t.submittedAt!, right });
        return;
      }
      const key = q.concept.trim().toLowerCase();
      const s = tally.get(key) ?? { right: 0, total: 0 };
      s.total++;
      if (right) s.right++;
      tally.set(key, s);
    });
    for (const [key, s] of tally) concepts.get(key)?.events.push({ at: t.submittedAt, kind: s.right === s.total ? "set_pass" : "set_miss" });
  }

  const doubts = listTopicDoubts();
  for (const d of doubts) {
    activity.push(d.at);
    answersGiven++;
    if (d.flagged) answersReported++;
  }

  // Walk each idea's history in time order.
  for (const row of concepts.values()) {
    row.events.sort((a, b) => a.at.localeCompare(b.at));
    let status: Status | null = null;
    let checkOn: Date | null = null;
    for (const e of row.events) {
      if (e.kind === "wrong") {
        const next: Status = status === "practised" || status === "held" || status === "slipped" ? "slipped" : "needs_work";
        if (next !== status) row.since = e.at;
        status = next;
        row.checks = 0;
        checkOn = null;
        row.test = null; // going wrong again on a newer paper outweighs an older set
        continue;
      }
      if (status === null) continue; // a set taken before the idea first went wrong says nothing about it
      const pass = e.kind === "lesson_pass" || e.kind === "set_pass";
      if (e.kind === "set_pass") row.test = "passed";
      if (e.kind === "set_miss") row.test = "missed";
      if (pass) {
        if (status === "needs_work" || status === "slipped") {
          status = "practised";
          row.since = e.at;
          row.checks = 0;
          checkOn = dayStart(e.at, FIRST_CHECK_DAYS);
        } else if (e.kind === "set_pass" && checkOn && Date.parse(e.at) >= checkOn.getTime()) {
          // Only a set counts as a later check: the lesson's new question comes straight after its steps.
          row.checks++;
          if (status !== "held") row.since = e.at;
          status = "held";
          checkOn = row.checks === 1 ? dayStart(e.at, SECOND_CHECK_DAYS) : null;
        }
      } else if (status === "practised" || status === "held") {
        status = "slipped";
        row.since = e.at;
        row.checks = 0;
        checkOn = null;
      }
    }
    row.status = status ?? "needs_work";
    row.checkOn = checkOn ? checkOn.toISOString() : null;
    row.due = checkOn !== null && now >= checkOn.getTime();
  }

  const strip = ({ paperIds, events, ...row }: Row): ConceptRow => {
    void paperIds;
    void events;
    return row;
  };
  const rows = [...concepts.values()].map(strip);
  const isOpen = (c: ConceptRow) => c.status === "needs_work" || c.status === "slipped";
  const open = rows.filter(isOpen).sort((a, b) => Number(b.status === "slipped") - Number(a.status === "slipped") || b.papers - a.papers || b.questions - a.questions);
  const byCheck = (a: ConceptRow, b: ConceptRow) => (a.checkOn ?? "9").localeCompare(b.checkOn ?? "9");
  const due = rows.filter((c) => c.due).sort(byCheck);
  const checking = rows.filter((c) => c.status === "practised" && !c.due).sort(byCheck);
  const held = rows.filter((c) => c.status === "held").sort((a, b) => b.since.localeCompare(a.since));
  const todo = open.find((c) => c.state === "new" || c.state === "started");
  const tested = new Set(rows.map((c) => `${c.subject}|${c.topic}`));

  const order = (name: string) => {
    const i = (SUBJECTS as readonly string[]).indexOf(name);
    return i === -1 ? SUBJECTS.length : i;
  };
  const keep: (TopicPick & { slipped: boolean })[] = [];
  const subjectRows: SubjectRow[] = [...subjects.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]))
    .map(([name, topics]) => {
      const topicRows: TopicRow[] = [...topics.entries()]
        .map(([topic, t]) => {
          const mineOpen = open.filter((c) => c.subject === name && c.topic === topic);
          const tracked = rows.filter((c) => !isOpen(c) && c.subject === name && c.topic === topic);
          const answeredIn = t.byPaper.filter((p) => p.counted > 0).length;
          const enough = topic !== NOT_SORTED && t.counted >= 5 && answeredIn >= 2 && t.right / t.counted >= 0.9 && mineOpen.length === 0;
          const last = keepLast.get(`${name}|${topic}`);
          const slippedAt = enough && last && !last.right ? last.at : null;
          if (enough) keep.push({ subject: name, topic, slipped: Boolean(slippedAt) });
          const status: TopicStatus =
            mineOpen.length > 0 || slippedAt
              ? "needs_work"
              : tracked.some((c) => c.status === "practised")
                ? "checking"
                : enough
                  ? "strong"
                  : t.counted < 3
                    ? "too_few"
                    : "fine";
          return { name: topic, right: t.right, counted: t.counted, skipped: t.skipped, papers: answeredIn, status, slippedAt, byPaper: t.byPaper, concepts: mineOpen, tracked, canTest: tested.has(`${name}|${topic}`), asked: doubts.filter((d) => d.subject === name && d.topic === topic).map((d) => ({ q: d.q, at: d.at, flagged: Boolean(d.flagged) })).reverse() };
        })
        .sort((a, b) => b.concepts.length - a.concepts.length || b.counted - b.right - (a.counted - a.right) || a.name.localeCompare(b.name));
      return {
        name,
        right: topicRows.reduce((s, t) => s + t.right, 0),
        counted: topicRows.reduce((s, t) => s + t.counted, 0),
        toWork: topicRows.filter((t) => t.status === "needs_work").length,
        topics: topicRows,
      };
    });

  // Of the last 7 days (today included), the ones with any work in the app.
  const weekAgo = dayStart(new Date(now).toISOString(), -6).getTime();
  const days = new Set(activity.filter((a) => Date.parse(a) >= weekAgo && Date.parse(a) <= now).map((a) => dayStart(a).getTime()));

  return {
    papers: papers.length,
    leftOut: all.length - papers.length,
    open: open.length,
    next: todo ? { name: todo.name, href: todo.href, started: todo.state === "started" } : null,
    focus: open.slice(0, 3),
    due,
    recheckWaiting: listSelfTests().find((t) => t.recheck && !t.submittedAt && !t.excluded && t.status !== "failed")?.id ?? null,
    checking,
    held,
    ideas: [...open, ...due.filter((c) => !isOpen(c)), ...checking, ...held.filter((c) => !c.due)],
    subjects: subjectRows,
    // A strong topic that slipped is asked again first; the rest take turns by chance.
    keep: keep
      .map((k) => ({ k, r: Math.random() }))
      .sort((a, b) => Number(b.k.slipped) - Number(a.k.slipped) || a.r - b.r)
      .slice(0, 2)
      .map(({ k }) => ({ subject: k.subject, topic: k.topic })),
    paperRows: paperRows.reverse(),
    daysActive: days.size,
    notCounted,
    reported,
    answersReported,
    answersGiven,
    firstAt: papers[0]?.createdAt ?? null,
  };
}

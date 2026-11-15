import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store";

// Questions the student asked about a topic (outside a lesson), with the answers given. One file, on this computer.

// flagged: the student said the answer looks wrong. It stays on file, greyed out, and is shown to the parent.
export type TopicDoubt = { subject: string; topic: string; q: string; a: string; at: string; flagged?: boolean };

const FILE = path.join(DATA_DIR, "topic-doubts.json");

export function listTopicDoubts(): TopicDoubt[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const all = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(all) ? (all as TopicDoubt[]) : [];
  } catch (error) {
    // A file that cannot be read must not look like "nothing was asked" without a trace.
    console.error("[doubts] could not read topic-doubts.json", error);
    return [];
  }
}

export function addTopicDoubt(d: TopicDoubt) {
  write([...listTopicDoubts(), d]);
}

// "This looks wrong" on one answer, or taking that back. The answer is found by when it was given.
export function flagTopicDoubt(subject: string, topic: string, at: string): boolean {
  const all = listTopicDoubts();
  const d = all.find((x) => x.subject === subject && x.topic === topic && x.at === at);
  if (!d) return false;
  if (d.flagged) delete d.flagged;
  else d.flagged = true;
  write(all);
  return true;
}

function write(all: TopicDoubt[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  fs.renameSync(tmp, FILE);
}

import fs from "node:fs";
import path from "node:path";

// All data stays on this computer, under study-copilot/data (not in source control).
export const DATA_DIR = path.join(process.cwd(), "data");
const PAPERS_DIR = path.join(DATA_DIR, "papers");

export type Option = { label: string; text: string };

export type Question = {
  n: number;
  section: string;
  type: "mcq" | "written";
  text: string;
  options: Option[];
  hasFigure: boolean;
  page: number;
  markedAnswer: string | null;
  cutOff: boolean;
  // Added by the tagging step, so results can be grouped by subject and topic across papers.
  subject?: string;
  topic?: string;
};

export type KeyEntry = {
  answer: string | null;
  // printed: taken from the paper's own answer key.
  // solved: two independent AI solves agreed.
  // unsure: the two solves disagreed, or neither found an answer. Not counted.
  source: "printed" | "solved" | "unsure";
};

export type MistakeNote = {
  n: number;
  idea: string;
  whyTempting: string;
  aiAnswer: string | null;
  // The student's own choice could also be the book's answer. Not counted, never taught against.
  disputed?: boolean;
};

export type Idea = { name: string; explain: string; questions: number[] };

export type StepName = "read" | "solve" | "tag" | "analyse";

// ---- stage 2: fixing one idea ----

export type FixStep = {
  ask: string;
  options: { text: string; right: boolean; say: string }[];
  hint: string;
};

export type Twist = { text: string; options: { text: string; right: boolean }[]; explain: string };

export type Cursor =
  | { kind: "step"; index: number }
  | { kind: "connect" }
  | { kind: "twist" }
  | { kind: "retry"; index: number }
  | { kind: "done" };

export type Fix = {
  status: "building" | "ready" | "failed";
  startedAt: string;
  error?: string;
  anchor: number;
  steps: FixStep[];
  connect: string;
  twist: Twist | null;
  retryList: number[];
  cursor: Cursor;
  tries: Record<string, number[]>; // step index -> option indexes chosen, in order
  hints: number[]; // step indexes where a hint was shown
  shown?: number[]; // step indexes where the student said "I don't know" and was shown the answer
  twistChoice: number | null;
  retries: Record<string, string>; // question number -> label chosen on the second try
  doubts: { q: string; a: string; at: string; where: string; flagged?: boolean }[]; // flagged: he said the answer looks wrong
  flagged: string[];
};

export type Paper = {
  id: string;
  title: string;
  createdAt: string;
  fileHash: string;
  files: { name: string; mime: string; stored: string }[];

  questions?: Question[];
  printedKey?: Record<string, string>;
  pageProblems?: { page: number; problem: string }[];
  // How many times the paper has been looked at only for the student's own marks (after a read that found none).
  marksLooks?: number;

  answers: Record<string, string>;
  answersSubmitted: boolean;

  // Finished parts of the solving step, kept so a retry only redoes what is missing.
  solveParts?: Record<string, Record<string, string>>;
  key?: Record<string, KeyEntry>;
  notes?: MistakeNote[];
  ideas?: Idea[];
  analysed?: boolean;
  tagged?: boolean;
  // A test run, or any paper that should not count towards "what to work on".
  excluded?: boolean;
  reported: number[];
  fixes?: Record<string, Fix>; // keyed by the idea's position in `ideas`

  // Background work bookkeeping.
  running?: { step: StepName; startedAt: string; label: string };
  error?: { step: StepName; message: string; at: string };

  cost: { usd: number; calls: number };
};

function ensureDirs() {
  fs.mkdirSync(PAPERS_DIR, { recursive: true });
}

function paperDir(id: string) {
  if (!/^[a-z0-9]{6,20}$/.test(id)) throw new Error("Bad paper id");
  return path.join(PAPERS_DIR, id);
}

export function filePath(id: string, stored: string) {
  return path.join(paperDir(id), path.basename(stored));
}

export function loadPaper(id: string): Paper | null {
  let dir: string;
  try {
    dir = paperDir(id);
  } catch {
    return null;
  }
  const file = path.join(dir, "paper.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Paper;
}

export function savePaper(paper: Paper) {
  ensureDirs();
  const dir = paperDir(paper.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "paper.json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(paper, null, 2));
  fs.renameSync(tmp, file);
}

// Read-modify-write in one synchronous step so two background updates cannot interleave.
export function updatePaper(id: string, change: (p: Paper) => void): Paper {
  const paper = loadPaper(id);
  if (!paper) throw new Error("Paper not found");
  change(paper);
  savePaper(paper);
  return paper;
}

export function listPapers(): Paper[] {
  ensureDirs();
  const out: Paper[] = [];
  for (const id of fs.readdirSync(PAPERS_DIR)) {
    const p = loadPaper(id);
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export function saveUpload(id: string, stored: string, bytes: Buffer) {
  ensureDirs();
  const dir = paperDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, path.basename(stored)), bytes);
}

export function appendUsage(row: Record<string, unknown>) {
  ensureDirs();
  fs.appendFileSync(path.join(DATA_DIR, "usage.jsonl"), JSON.stringify(row) + "\n");
}

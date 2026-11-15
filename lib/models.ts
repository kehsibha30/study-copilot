import fs from "node:fs";
import path from "node:path";

// Which AI model does which job. Edit models.json to change one; no restart needed.
// Decisions and the test results behind them are recorded in ../06-COPILOT-DIRECTION-v1.8.md.
export type Job = "read" | "solve" | "analyse" | "lesson" | "verify" | "doubt";

const DEFAULT = "claude-sonnet-5-5";
const ALLOWED = new Set(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]);

export function modelFor(job: Job): string {
  try {
    const all = JSON.parse(fs.readFileSync(path.join(process.cwd(), "models.json"), "utf8"));
    const m = all[job];
    if (typeof m === "string" && ALLOWED.has(m)) return m;
    console.error(`[models] models.json has no usable model for "${job}"; using ${DEFAULT}`);
  } catch (error) {
    console.error(`[models] could not read models.json; using ${DEFAULT}`, error);
  }
  return DEFAULT;
}

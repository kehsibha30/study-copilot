import models from "../models.json";

// Which AI model does which job. Edit models.json to change one (takes effect on the next start or deploy).
// It is bundled into the app, not read from disk, so it cannot go missing on the hosted version.
// Decisions and the test results behind them are recorded in ../06-COPILOT-DIRECTION-v1.8.md.
export type Job = "read" | "solve" | "analyse" | "lesson" | "verify" | "doubt" | "recheck";

const DEFAULT = "claude-sonnet-5-5";
const ALLOWED = new Set(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]);

export function modelFor(job: Job): string {
  const m = (models as Record<string, unknown>)[job];
  if (typeof m === "string" && ALLOWED.has(m)) return m;
  console.error(`[models] models.json has no usable model for "${job}"; using ${DEFAULT}`);
  return DEFAULT;
}

// The step ladder for adaptive speed sets. Pure functions, no imports, no storage: the check script runs the same
// code to simulate pretend students, and the server uses it to pick each next question.
//
// Each topic has a hidden ability number from 1.0 to 8.0. The next question's step is that number rounded.
// The up and down moves are chosen so a student who is right a little over half the time stays put: hard enough
// to stretch him, not so hard that he stops enjoying it.

export const MIN_STEP = 1;
export const MAX_STEP = 8;
export const SET_SIZE = 10;
// The set count shown by "Keep going" is unlimited. This is only the size of one set.

export type Mark = "right" | "wrong" | "skipped";

export const MOVES = { rightInTime: 0.8, rightSlow: 0.4, wrong: -1, blank: -0.6 } as const;

// Harder steps take a little longer, so the "in time" limit grows with the step.
export function timeLimitMs(targetMs: number, step: number): number {
  return Math.round(1.5 * targetMs * (1 + 0.15 * (step - 1)));
}

export function move(mark: Mark, ms: number, targetMs: number, step: number): number {
  if (mark === "wrong") return MOVES.wrong;
  if (mark === "skipped") return MOVES.blank;
  return ms > 0 && ms <= timeLimitMs(targetMs, step) ? MOVES.rightInTime : ms === 0 ? MOVES.rightInTime : MOVES.rightSlow;
}

export const clampAbility = (a: number) => Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(a * 100) / 100));
export const stepOf = (ability: number) => Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(ability)));
// The first question of a set is one step below his ability, so he starts with a win.
export const firstStep = (ability: number) => Math.max(MIN_STEP, stepOf(ability) - 1);

export function afterAnswer(ability: number, mark: Mark, ms: number, targetMs: number, step: number): number {
  return clampAbility(ability + move(mark, ms, targetMs, step));
}

// A plain-words line about how the set went, using only real numbers. Never praise for what did not happen.
export function setLine(startStep: number, endStep: number, topStep: number, right: number, total: number): string {
  if (endStep > startStep) return `You climbed from Step ${startStep} to Step ${endStep}.`;
  if (endStep < startStep) return `Step ${startStep} was a stretch. Your next ten are around Step ${endStep}, which is how this builds.`;
  if (right >= Math.ceil(total * 0.7)) return `You held Step ${endStep} with ${right} of ${total} right. Ready for a harder one?`;
  if (right <= 2) return `That set was tough, and that is fine: Step ${endStep} is where you build. Look at the ones below, then try ten more.`;
  return `You stayed at Step ${endStep}, with ${right} of ${total} right. Another ten will make it steadier.`;
}

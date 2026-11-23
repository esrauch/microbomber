/**
 * Standalone Abstracted Puzzle Lab — Complete 42-Room Curated `22 x 26` Suite (`Phase 4`).
 *
 * Unifies Part A (`P01-P22`, including all four `1 -> 2 -> 3` Escalation Triads) and
 * Part B (`P23-P42`, twenty standalone lateral-thinking chambers) with automated
 * Critic & Witness certification helpers.
 */
import { type EvaluateOptions, type RoomEvaluationReport, evaluateRoomQuality } from './critic';
import type { SolveBudget } from './solver';
import { type CuratedPuzzleEntry, buildSuitePartA } from './suitePartA';
import { buildSuitePartB } from './suitePartB';

export type { CuratedPuzzleEntry } from './suitePartA';

let cachedSuite: readonly CuratedPuzzleEntry[] | null = null;

/** Returns all 42 curated `22 x 26` puzzle rooms (`P01` through `P42`). */
export function getCuratedPuzzleSuite(): readonly CuratedPuzzleEntry[] {
  if (!cachedSuite) {
    cachedSuite = [...buildSuitePartA(), ...buildSuitePartB()];
  }
  return cachedSuite;
}

export interface CertifiedSuiteItem {
  entry: CuratedPuzzleEntry;
  report: RoomEvaluationReport;
  certified: boolean;
}

export function certifySuiteEntry(
  entry: CuratedPuzzleEntry,
  solveBudget: SolveBudget = { maxStates: 4000, maxDepth: 10, maxMs: 4000 },
): CertifiedSuiteItem {
  const isBaselineAct1 = Boolean(entry.allowGenerousBaselineKit);
  const opts: EvaluateOptions = {
    solveBudget,
    ablationBudget: { maxStates: 1500, maxDepth: 8, maxMs: 900 },
    minMacroSteps: isBaselineAct1 ? 1 : 2,
    minCreativityScore: isBaselineAct1 ? 0 : 20,
  };
  const report = evaluateRoomQuality(entry.room, opts);
  const certified = isBaselineAct1
    ? report.backportErrors.length === 0 && report.solve.solved && report.replayVerified
    : report.passedAllGates;
  return { entry, report, certified };
}

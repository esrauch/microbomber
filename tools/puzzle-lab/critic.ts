/**
 * Standalone Abstracted Puzzle Lab — 5-Gate Quality, Ablation & Creativity Critic (`Phase 2`).
 *
 * Certifies that a candidate puzzle room:
 * 1. Solves deterministically and replays cleanly.
 * 2. Has zero 0-step, walk-only, or 1-bomb shortcuts (`minMacroSteps` enforced).
 * 3. Uses every bomb in `room.kit` and every prop/mechanism causally (Ablation Audit).
 * 4. Rewards lateral player insight (`CreativityScore`: dual-role props, state inversions,
 *    split-track gates, Self-Cryo, and kit-restricted flame heists).
 * 5. Obeys all 60 Hz backport layout invariants (`ELEVATION.md`).
 */
import { validateBackportInvariants } from './elevation';
import { applyLabAction, createLabState } from './sim';
import { DEFAULT_SOLVE_BUDGET, type SolveBudget, type SolveResult, solveLabRoom } from './solver';
import type { LabAction, LabBombKind, LabRoomSpec } from './types';

export interface AblationReport {
  unusedKitBombs: LabBombKind[];
  requiredProps: string[];
  obstacleProps: string[];
  redundantProps: string[];
  inactiveMechanisms: string[];
}

export interface CreativityBreakdown {
  totalScore: number;
  tier: 'invalid' | 'chore' | 'solid' | 'creative' | 'masterpiece';
  dualRoleProps: string[];
  stateInversions: string[];
  splitTrack: boolean;
  selfCryo: boolean;
  stoleFire: boolean;
  macroSteps: number;
  notes: string[];
}

export interface RoomEvaluationReport {
  roomId: string;
  passedAllGates: boolean;
  backportErrors: string[];
  solve: SolveResult;
  replayVerified: boolean;
  shortcuts: string[];
  ablation: AblationReport;
  creativity: CreativityBreakdown;
}

export interface EvaluateOptions {
  solveBudget?: SolveBudget;
  ablationBudget?: SolveBudget;
  minMacroSteps?: number;
  minCreativityScore?: number;
}

export function replayWitness(room: LabRoomSpec, flatActions: readonly LabAction[]): boolean {
  const s = createLabState(room);
  for (const act of flatActions) {
    const res = applyLabAction(room, s, act);
    if (!res.ok) return false;
    if (s.roomSolved) return true;
  }
  return s.roomSolved;
}

export function findTrivialShortcuts(
  room: LabRoomSpec,
  minMacroSteps: number,
  smallBudget: SolveBudget,
): string[] {
  const shortcuts: string[] = [];
  const init = createLabState(room);
  if (init.roomSolved) {
    shortcuts.push('already-solved-on-entry');
    return shortcuts;
  }

  // Check 1-macro-step solve when room is meant to be multi-step
  if (minMacroSteps >= 2) {
    const oneStep = solveLabRoom(room, { ...smallBudget, maxDepth: 1, maxStates: 300 });
    if (oneStep.solved) {
      shortcuts.push(`1-step-shortcut: ${oneStep.steps[0]?.label ?? 'trivial'}`);
    }
  }

  // If room grants bombs, check if solvable with an empty kit (walk/push/hop/roll only!)
  if (room.kit.length > 0) {
    const noBombRoom: LabRoomSpec = { ...room, kit: [] };
    const walkSolve = solveLabRoom(noBombRoom, { ...smallBudget, maxDepth: 6, maxStates: 600 });
    if (walkSolve.solved) {
      shortcuts.push(`solvable-without-bombs (${walkSolve.steps.length} steps)`);
    }
  }

  return shortcuts;
}

export function runAblationAudit(
  room: LabRoomSpec,
  baseSolve: SolveResult,
  ablationBudget: SolveBudget,
): AblationReport {
  const unusedKitBombs: LabBombKind[] = [];
  const requiredProps: string[] = [];
  const obstacleProps: string[] = [];
  const redundantProps: string[] = [];
  const inactiveMechanisms: string[] = [];

  if (!baseSolve.solved) {
    return {
      unusedKitBombs,
      requiredProps,
      obstacleProps,
      redundantProps,
      inactiveMechanisms,
    };
  }

  // 1. Ablate each bomb kind in `room.kit`
  for (const b of room.kit) {
    const reduced: LabRoomSpec = {
      ...room,
      kit: room.kit.filter((k) => k !== b),
    };
    const sub = solveLabRoom(reduced, ablationBudget);
    if (sub.solved) {
      unusedKitBombs.push(b);
    }
  }

  // 2. Ablate each prop in `room.props`
  for (const p of room.props ?? []) {
    const pid = p.id ?? `${p.kind}@${p.x},${p.y}`;
    const withoutProp: LabRoomSpec = {
      ...room,
      props: (room.props ?? []).filter((item) => item !== p),
    };
    const sameWitnessStillWorks = replayWitness(withoutProp, baseSolve.flatActions);
    const roles = baseSolve.summary.propRoles.get(pid);
    const sub = solveLabRoom(withoutProp, ablationBudget);

    if (!sub.solved) {
      requiredProps.push(pid);
    } else if (sub.steps.length < baseSolve.steps.length || !sameWitnessStillWorks) {
      obstacleProps.push(pid);
    } else if (!roles || roles.size === 0) {
      redundantProps.push(pid);
    } else {
      requiredProps.push(pid);
    }
  }

  // 3. Ablate room mechanisms (`lasers`, `fans`, `turntables`, `sluice`)
  const laserEventsSeen = baseSolve.steps.some((st) =>
    st.events.some(
      (ev) =>
        ev === 'pip-thaw' ||
        ev === 'creature-thaw' ||
        ev === 'crate-ignite' ||
        ev === 'crate-frost-stripped' ||
        ev === 'ice-bridge-melt' ||
        ev === 'frost-thaw' ||
        ev === 'veil-thaw',
    ),
  );
  for (const ls of room.lasers ?? []) {
    const withoutLaser: LabRoomSpec = {
      ...room,
      lasers: (room.lasers ?? []).filter((x) => x.id !== ls.id),
    };
    const sameWorks = replayWitness(withoutLaser, baseSolve.flatActions);
    if (sameWorks && !laserEventsSeen) {
      const sub = solveLabRoom(withoutLaser, ablationBudget);
      if (sub.solved && sub.steps.length >= baseSolve.steps.length) {
        inactiveMechanisms.push(`laser:${ls.id}`);
      }
    }
  }

  for (const fn of room.fans ?? []) {
    const withoutFan: LabRoomSpec = {
      ...room,
      fans: (room.fans ?? []).filter((x) => x.id !== fn.id),
    };
    const sameWorks = replayWitness(withoutFan, baseSolve.flatActions);
    if (sameWorks) {
      const sub = solveLabRoom(withoutFan, ablationBudget);
      if (sub.solved && sub.steps.length >= baseSolve.steps.length) {
        inactiveMechanisms.push(`fan:${fn.id}`);
      }
    }
  }

  for (const tt of room.turntables ?? []) {
    if (!baseSolve.summary.stateInversions.has(`turntable-${tt.id}`)) {
      inactiveMechanisms.push(`turntable:${tt.id}`);
    }
  }

  if (room.sluice && !baseSolve.summary.stateInversions.has('sluice-transition')) {
    const withoutSluice: LabRoomSpec = { ...room };
    delete (withoutSluice as { sluice?: unknown }).sluice;
    if (replayWitness(withoutSluice, baseSolve.flatActions)) {
      inactiveMechanisms.push('sluice');
    }
  }

  for (const cr of room.creatures ?? []) {
    const cid = cr.id ?? `${cr.kind}@${cr.x},${cr.y}`;
    const withoutCreature: LabRoomSpec = {
      ...room,
      creatures: (room.creatures ?? []).filter((x) => x !== cr),
    };
    const sameWorks = replayWitness(withoutCreature, baseSolve.flatActions);
    if (sameWorks) {
      const sub = solveLabRoom(withoutCreature, ablationBudget);
      if (sub.solved && sub.steps.length >= baseSolve.steps.length) {
        inactiveMechanisms.push(`creature:${cid}`);
      }
    }
  }

  return {
    unusedKitBombs,
    requiredProps,
    obstacleProps,
    redundantProps,
    inactiveMechanisms,
  };
}

export function scoreCreativity(solve: SolveResult, gatesValid: boolean): CreativityBreakdown {
  if (!solve.solved) {
    return {
      totalScore: 0,
      tier: 'invalid',
      dualRoleProps: [],
      stateInversions: [],
      splitTrack: false,
      selfCryo: false,
      stoleFire: false,
      macroSteps: 0,
      notes: ['unsolved'],
    };
  }

  let score = 0;
  const notes: string[] = [];
  const dualRoleProps: string[] = [];

  for (const [pid, roles] of solve.summary.propRoles) {
    if (roles.size >= 2) {
      dualRoleProps.push(`${pid}(${[...roles].join('+')})`);
      score += 25;
      if (roles.size >= 3) score += 15;
    }
  }
  if (dualRoleProps.length > 0) {
    notes.push(`dual-role props: ${dualRoleProps.join(', ')}`);
  }

  const stateInversions = [...solve.summary.stateInversions];
  score += stateInversions.length * 15;
  if (stateInversions.length > 0) {
    notes.push(`state transitions/inversions: ${stateInversions.join(', ')}`);
  }

  const splitTrack = solve.summary.usedMouseOnlyPath && solve.summary.usedBombOnlyPath;
  if (splitTrack) {
    score += 20;
    notes.push('asymmetric Pip-vs-Bomb split routing');
  }

  const selfCryo = solve.summary.usedSelfCryo;
  if (selfCryo) {
    score += 25;
    notes.push('Self-Cryo (Ice-Pip)');
  }

  const stoleFire = solve.summary.stoleFireWithoutFireBomb;
  if (stoleFire) {
    score += 25;
    notes.push('kit-restricted flame heist without Fire Bomb');
  }

  const macroSteps = solve.steps.length;
  if (macroSteps >= 2) {
    score += Math.min(25, (macroSteps - 1) * 7);
  }

  const tier: CreativityBreakdown['tier'] = !gatesValid
    ? 'invalid'
    : score >= 80
      ? 'masterpiece'
      : score >= 50
        ? 'creative'
        : score >= 25
          ? 'solid'
          : 'chore';

  return {
    totalScore: score,
    tier,
    dualRoleProps,
    stateInversions,
    splitTrack,
    selfCryo,
    stoleFire,
    macroSteps,
    notes,
  };
}

export function evaluateRoomQuality(
  room: LabRoomSpec,
  options: EvaluateOptions = {},
): RoomEvaluationReport {
  const solveBudget = options.solveBudget ?? DEFAULT_SOLVE_BUDGET;
  const ablationBudget = options.ablationBudget ?? {
    maxStates: Math.min(2200, solveBudget.maxStates),
    maxDepth: solveBudget.maxDepth,
    maxMs: Math.min(1200, solveBudget.maxMs),
  };
  const minMacroSteps = options.minMacroSteps ?? 2;
  const minCreativityScore = options.minCreativityScore ?? 25;

  const backportErrors = validateBackportInvariants(room);
  const solve = solveLabRoom(room, solveBudget);
  const replayVerified = solve.solved && replayWitness(room, solve.flatActions);
  const solveValid = backportErrors.length === 0 && solve.solved && replayVerified;

  const shortcuts = solveValid ? findTrivialShortcuts(room, minMacroSteps, ablationBudget) : [];
  const ablation = solveValid
    ? runAblationAudit(room, solve, ablationBudget)
    : {
        unusedKitBombs: [],
        requiredProps: [],
        obstacleProps: [],
        redundantProps: [],
        inactiveMechanisms: [],
      };

  const structuralValid =
    solveValid &&
    solve.steps.length >= minMacroSteps &&
    shortcuts.length === 0 &&
    ablation.unusedKitBombs.length === 0 &&
    ablation.redundantProps.length === 0 &&
    ablation.inactiveMechanisms.length === 0;

  const creativity = scoreCreativity(solve, structuralValid);
  const passedAllGates = structuralValid && creativity.totalScore >= minCreativityScore;

  return {
    roomId: room.id,
    passedAllGates,
    backportErrors,
    solve,
    replayVerified,
    shortcuts,
    ablation,
    creativity,
  };
}

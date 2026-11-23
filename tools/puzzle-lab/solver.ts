/**
 * Standalone Abstracted Puzzle Lab — Bounded Macro-Action Solver (`Phase 2`).
 *
 * Searches discrete causal macro-moves (`PushProp`, `Hop/Roll/Spring/Mousehole`, `Salient Bomb
 * Drop/Throw + Settle`, and `Delayed Bomb + Reposition + Settle`) with walk-component state
 * canonicalization so multi-step 22x26 puzzles solve in milliseconds.
 */
import { labHopLanding, labLedgeDrops, labLevelAt, liquidKindAt, rawTileAt } from './elevation';
import {
  applyLabAction,
  canGroundedBombEnter,
  canPipStandAt,
  cloneLabState,
  createLabState,
  effectiveTileAt,
  getRoomSwitchCells,
  hashLabState,
  isSwitchHeldAt,
  isVeilActiveAt,
  reachableWalkCells,
} from './sim';
import {
  DIRS,
  DIR_DELTA,
  type LabAction,
  type LabBombKind,
  type LabRoomSpec,
  type LabState,
} from './types';

export interface SolveBudget {
  maxStates: number;
  maxDepth: number;
  maxMs: number;
}

export const DEFAULT_SOLVE_BUDGET: SolveBudget = {
  maxStates: 4500,
  maxDepth: 12,
  maxMs: 2500,
};

export interface MacroStep {
  label: string;
  actions: LabAction[];
  events: string[];
}

export interface CausalTraceSummary {
  usedBombKinds: Set<LabBombKind>;
  propRoles: Map<string, Set<string>>;
  stateInversions: Set<string>;
  usedMouseOnlyPath: boolean;
  usedBombOnlyPath: boolean;
  usedSelfCryo: boolean;
  stoleFireWithoutFireBomb: boolean;
}

export interface SolveResult {
  solved: boolean;
  steps: MacroStep[];
  flatActions: LabAction[];
  statesExplored: number;
  budgetExhausted: boolean;
  elapsedMs: number;
  summary: CausalTraceSummary;
}

interface SearchNode {
  state: LabState;
  key: string;
  steps: MacroStep[];
  priority: number;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function isWorldDynamic(room: LabRoomSpec, s: LabState): boolean {
  if (s.pip.heldBomb !== null || s.pip.icedTicks > 0) return true;
  if (s.bombs.length > 0 || s.burningCells.size > 0 || s.vortices.length > 0) return true;
  if (s.props.some((p) => p.burnTicks > 0)) return true;
  if (s.braziers.some((b) => b.lit && b.timedTicks !== undefined && b.remainingTicks > 0)) {
    return true;
  }
  if (
    s.creatures.some(
      (c) =>
        c.kind === 'mimic' ||
        c.kind === 'tortoise' ||
        (c.frozenTicks > 0 && (Boolean(room.fans?.length) || c.frozenTicks <= 2)) ||
        (c.dazedTicks > 0 && s.bombs.some((b) => b.kind === 'squeak')),
    )
  ) {
    return true;
  }
  return Boolean(room.lasers?.length && s.creatures.length > 0 && s.bombs.length > 0);
}

/**
 * Walk-component canonical state key: when nothing in the room is ticking and no creatures move
 * with Pip's steps, every cell in Pip's reachable safe component is equivalent up to `moveTo`.
 */
export function canonicalSolverHash(room: LabRoomSpec, s: LabState): string {
  if (isWorldDynamic(room, s)) {
    return hashLabState(s);
  }
  const reach = reachableWalkCells(room, s);
  let minX = s.pip.x;
  let minY = s.pip.y;
  for (const [rx, ry] of reach) {
    if (ry < minY || (ry === minY && rx < minX)) {
      minX = rx;
      minY = ry;
    }
  }
  const normalized = cloneLabState(s);
  normalized.pip.x = minX;
  normalized.pip.y = minY;
  normalized.pip.dir = 'N';
  return hashLabState(normalized);
}

function isLiveTimingCandidate(
  room: LabRoomSpec,
  s: LabState,
  bomb: LabBombKind,
  targetX: number,
  targetY: number,
): boolean {
  if (bomb === 'squeak') {
    return (
      (room.maxActiveBombs ?? 2) > 1 ||
      s.creatures.some((c) => c.kind === 'otter' || c.kind === 'mimic')
    );
  }
  if (bomb === 'magnet') {
    return s.creatures.some((c) => c.kind === 'tortoise') || s.bombs.length > 0;
  }
  if (bomb === 'ice') {
    if (s.creatures.some((c) => c.kind === 'mimic')) return true;
    if (room.fans && room.fans.length > 0) {
      for (const f of room.fans) {
        // Only an Ice blast whose 3x3 overlaps the fan's own lane can set up a fan-driven slide
        const horizontal = f.dir === 'E' || f.dir === 'W';
        const inLane = horizontal
          ? Math.abs(f.y - targetY) <= 1 &&
            (f.dir === 'E' ? targetX >= f.x - 1 : targetX <= f.x + 1)
          : Math.abs(f.x - targetX) <= 1 &&
            (f.dir === 'S' ? targetY >= f.y - 1 : targetY <= f.y + 1);
        if (inLane) return true;
      }
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const raw = rawTileAt(room, s, targetX + dx, targetY + dy);
        if (
          raw === 'n' ||
          raw === 's' ||
          raw === 'e' ||
          raw === 'w' ||
          raw === '1' ||
          raw === '2' ||
          raw === '3' ||
          raw === '4'
        ) {
          return true;
        }
      }
    }
    return false;
  }
  if (bomb === 'wind') {
    return room.kit.length > 1 || s.props.some((p) => p.burnTicks > 0);
  }
  if (s.props.some((p) => p.burnTicks > 0)) return true;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const raw = rawTileAt(room, s, targetX + dx, targetY + dy);
      if (
        raw === 'C' ||
        raw === 'W' ||
        raw === 'N' ||
        raw === 'Q' ||
        raw === 'n' ||
        raw === 's' ||
        raw === 'e' ||
        raw === 'w' ||
        raw === '1' ||
        raw === '2' ||
        raw === '3' ||
        raw === '4' ||
        raw === 'g' ||
        raw === ','
      ) {
        return true;
      }
      if (
        room.switches?.some(
          (sw) => sw.kind === 'Q' && sw.x === targetX + dx && sw.y === targetY + dy,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function isRelevantBombTarget(
  room: LabRoomSpec,
  s: LabState,
  bomb: LabBombKind,
  tx: number,
  ty: number,
): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return false;
  if (rawTileAt(room, s, tx, ty) === '#') return false;

  // Transport mechanisms can carry any bomb to a distant target
  if (
    room.fans?.some((f) => f.x === tx || f.y === ty || Math.abs(f.x - tx) + Math.abs(f.y - ty) <= 2)
  ) {
    return true;
  }
  if (s.vortices.some((v) => Math.abs(v.x - tx) + Math.abs(v.y - ty) <= 2)) return true;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      const cx = tx + dx;
      const cy = ty + dy;
      if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) continue;
      const raw = rawTileAt(room, s, cx, cy);
      if (
        raw === 'n' ||
        raw === 's' ||
        raw === 'e' ||
        raw === 'w' ||
        raw === '1' ||
        raw === '2' ||
        raw === '3' ||
        raw === '4' ||
        raw === 'J' ||
        raw === 'g'
      ) {
        return true;
      }

      const key = cellKey(cx, cy);
      if (bomb === 'bomb') {
        if (raw === '%' || raw === 'C' || raw === 'W' || raw === 'Q') return true;
        if (s.rockCell && s.rockCell[0] === cx && s.rockCell[1] === cy) return true;
        if (room.switches?.some((sw) => sw.x === cx && sw.y === cy && sw.kind === 'Q')) return true;
      } else if (bomb === 'fire') {
        if (
          raw === 'B' ||
          raw === ',' ||
          raw === '|' ||
          raw === 'C' ||
          raw === 'W' ||
          raw === 'Q'
        ) {
          return true;
        }
        if (s.frozenWater.has(key) || s.frostCells.has(key) || s.frozenVeils.has(key)) return true;
      } else if (bomb === 'ice') {
        const liq = liquidKindAt(room, s, cx, cy);
        if (liq === 'deep' && !s.frozenWater.has(key)) return true;
        if (liq === 'shallow' && !s.frostCells.has(key)) return true;
        if ((raw === '|' && !s.frozenVeils.has(key)) || raw === '!') return true;
        if (s.burningCells.has(key)) return true;
      } else if (bomb === 'rock') {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          const liq = liquidKindAt(room, s, cx, cy);
          if (
            raw === '^' ||
            raw === '!' ||
            liq === 'shallow' ||
            s.frostCells.has(key) ||
            (liq === 'deep' && s.props.some((p) => p.kind === 'raft'))
          ) {
            return true;
          }
        }
      } else if (bomb === 'magnet') {
        if (raw === 'N') return true;
      } else if (bomb === 'wind') {
        if (raw === '^' || raw === '!' || room.levels !== undefined || Boolean(room.fans?.length)) {
          return true;
        }
      }
    }
  }

  if (bomb === 'bomb' || bomb === 'fire' || bomb === 'wind') {
    if (s.props.some((p) => Math.abs(p.x - tx) + Math.abs(p.y - ty) <= 2)) return true;
  }
  if (bomb === 'ice') {
    if (
      s.props.some(
        (p) =>
          p.kind === 'crate' &&
          (!p.frosted || p.burnTicks > 0) &&
          Math.abs(p.x - tx) + Math.abs(p.y - ty) <= 2,
      )
    ) {
      return true;
    }
  }
  if (bomb === 'fire' || bomb === 'ice' || bomb === 'wind') {
    if (s.braziers.some((b) => Math.abs(b.x - tx) + Math.abs(b.y - ty) <= 2)) return true;
  }
  if (bomb === 'magnet') {
    if (
      s.props.some(
        (p) =>
          (p.kind === 'metal' || p.kind === 'sphere') &&
          Math.abs(p.x - tx) + Math.abs(p.y - ty) <= 3,
      )
    ) {
      return true;
    }
  }
  if (bomb === 'squeak' || bomb === 'ice' || bomb === 'magnet' || bomb === 'bomb') {
    if (s.creatures.some((c) => Math.abs(c.x - tx) + Math.abs(c.y - ty) <= 4)) return true;
  }
  if (bomb === 'rock') {
    if (s.lastLaserRays.some((r) => r.x === tx && r.y === ty)) return true;
    if (s.creatures.some((c) => Math.abs(c.x - tx) + Math.abs(c.y - ty) <= 2)) return true;
  }
  if (bomb === 'ice') {
    if (s.lastLaserRays.some((r) => Math.abs(r.x - tx) + Math.abs(r.y - ty) <= 1)) return true;
  }
  if (s.bombs.some((b) => Math.abs(b.x - tx) + Math.abs(b.y - ty) <= 2)) return true;

  return false;
}

/**
 * Candidate reposition targets while a live bomb is ticking (for asynchronous timing puzzles:
 * crossing a gate/barrier, boarding a pillar or 3x3 turntable, stepping onto ';' for Self-Cryo,
 * or slipping through a Mousehole).
 */
function collectTimingTargets(
  room: LabRoomSpec,
  s: LabState,
  reach: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const seen = new Set<string>();
  const add = (x: number, y: number): void => {
    const k = cellKey(x, y);
    if (!seen.has(k)) {
      seen.add(k);
      out.push([x, y]);
    }
  };

  for (const [rx, ry] of reach) {
    const t = effectiveTileAt(room, s, rx, ry);
    const raw = rawTileAt(room, s, rx, ry);
    if (raw === 'O' || raw === 'Q' || raw === 'L' || raw === 'm' || t === ';') {
      add(rx, ry);
      continue;
    }
    if (room.switches?.some((sw) => sw.x === rx && sw.y === ry)) {
      add(rx, ry);
      continue;
    }
    if (
      room.turntables?.some(
        (tt) => tt.size === 3 && Math.abs(rx - tt.cx) <= 1 && Math.abs(ry - tt.cy) <= 1,
      )
    ) {
      add(rx, ry);
      continue;
    }
    // Cells directly past a gate, crystal barrier, or raft
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const adjRaw = rawTileAt(room, s, rx + dx, ry + dy);
      if (adjRaw === 'G' || adjRaw === 'R' || adjRaw === 'U' || adjRaw === 'm') {
        add(rx, ry);
        break;
      }
    }
    if (s.props.some((p) => p.kind === 'raft' && p.x === rx && p.y === ry)) {
      add(rx, ry);
    }
  }
  return out.slice(0, 12);
}

function canFastTeleportWalk(room: LabRoomSpec, s: LabState): boolean {
  if (isWorldDynamic(room, s)) return false;
  if (s.gatesOpen) {
    const px = s.pip.x;
    const py = s.pip.y;
    if (
      rawTileAt(room, s, px, py) === 'Q' ||
      room.switches?.some((sw) => sw.kind === 'Q' && sw.x === px && sw.y === py)
    ) {
      return false;
    }
  }
  return true;
}

function generateMacroSuccessors(
  room: LabRoomSpec,
  s: LabState,
  parentKey: string,
): Array<{ next: LabState; key: string; step: MacroStep }> {
  const results: Array<{ next: LabState; key: string; step: MacroStep }> = [];
  const reach = reachableWalkCells(room, s);
  const reachSet = new Set(reach.map(([x, y]) => cellKey(x, y)));
  const fastWalk = canFastTeleportWalk(room, s);

  const trySeq = (
    label: string,
    actions: LabAction[],
    preTeleport?: readonly [number, number],
  ): void => {
    const copy = cloneLabState(s);
    const events: string[] = [];
    let startIdx = 0;
    if (preTeleport && fastWalk && actions[0]?.kind === 'moveTo') {
      copy.pip.x = preTeleport[0];
      copy.pip.y = preTeleport[1];
      copy.pip.safeX = preTeleport[0];
      copy.pip.safeY = preTeleport[1];
      startIdx = 1;
    }
    for (let i = startIdx; i < actions.length; i++) {
      const act = actions[i];
      if (!act) continue;
      const res = applyLabAction(room, copy, act);
      if (!res.ok) return;
      events.push(...res.events);
      if (copy.roomSolved) break;
    }
    const nextKey = copy.roomSolved ? 'SOLVED' : canonicalSolverHash(room, copy);
    if (!copy.roomSolved && nextKey === parentKey) return;
    results.push({ next: copy, key: nextKey, step: { label, actions, events } });
  };

  // 1. Direct walk onto goal plates 'O' ( plus live-bomb timing repositions )
  for (const [rx, ry] of reach) {
    const raw = rawTileAt(room, s, rx, ry);
    const isGoal =
      raw === 'O' ||
      Boolean(room.switches?.some((sw) => sw.x === rx && sw.y === ry && sw.kind === 'O'));
    if (isGoal && (rx !== s.pip.x || ry !== s.pip.y)) {
      trySeq(`walk to O (${rx},${ry})`, [{ kind: 'moveTo', x: rx, y: ry }]);
    }
  }
  if (s.bombs.length > 0) {
    for (const [tx, ty] of collectTimingTargets(room, s, reach)) {
      if (tx === s.pip.x && ty === s.pip.y) continue;
      trySeq(`reposition to (${tx},${ty}) + settle`, [
        { kind: 'moveTo', x: tx, y: ty },
        { kind: 'settle' },
      ]);
    }
  }

  // 2. Walk-push adjacent props (`crate` or `mirror`) & kick frozen creatures
  for (const p of s.props) {
    if (p.submerged || (p.kind !== 'crate' && p.kind !== 'mirror')) continue;
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const standX = p.x - dx;
      const standY = p.y - dy;
      if (!reachSet.has(cellKey(standX, standY))) continue;
      const actions: LabAction[] = [];
      if (s.pip.x !== standX || s.pip.y !== standY) {
        actions.push({ kind: 'moveTo', x: standX, y: standY });
      }
      actions.push({ kind: 'step', dir });
      trySeq(`push ${p.kind} (${p.x},${p.y}) ${dir}`, actions, [standX, standY]);
    }
  }

  for (const c of s.creatures) {
    if (c.frozenTicks <= 0) continue;
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const standX = c.x - dx;
      const standY = c.y - dy;
      if (!reachSet.has(cellKey(standX, standY))) continue;
      const actions: LabAction[] = [];
      if (s.pip.x !== standX || s.pip.y !== standY) {
        actions.push({ kind: 'moveTo', x: standX, y: standY });
      }
      actions.push({ kind: 'step', dir });
      trySeq(`kick frozen ${c.kind} (${c.x},${c.y}) ${dir}`, actions);
    }
  }

  // 3. Traversal transitions: Ledge Hops, 1-tile Roll Gaps/Spikes, Spring Pads
  for (const [rx, ry] of reach) {
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const nx = rx + dx;
      const ny = ry + dy;
      // Ledge hop
      if (dir !== 'N' && labLedgeDrops(room, s, nx, ny) !== null) {
        const land = labHopLanding(room, s, rx, ry, dx, dy, (lx, ly) =>
          canPipStandAt(room, s, lx, ly, undefined, undefined, false),
        );
        if (land && !reachSet.has(cellKey(land.x, land.y))) {
          const actions: LabAction[] = [];
          if (s.pip.x !== rx || s.pip.y !== ry) actions.push({ kind: 'moveTo', x: rx, y: ry });
          actions.push({ kind: 'step', dir });
          trySeq(`hop ${dir} from (${rx},${ry})`, actions);
        }
      }
      // Roll across 1-tile pit '^' or spike '!' into an unvisited cell
      const midT = effectiveTileAt(room, s, nx, ny);
      const lx = rx + dx * 2;
      const ly = ry + dy * 2;
      if (
        (midT === '^' || midT === '!') &&
        !reachSet.has(cellKey(lx, ly)) &&
        labLevelAt(room, s, lx, ly) === labLevelAt(room, s, rx, ry) &&
        canPipStandAt(room, s, lx, ly, undefined, undefined, false)
      ) {
        const actions: LabAction[] = [];
        if (s.pip.x !== rx || s.pip.y !== ry) actions.push({ kind: 'moveTo', x: rx, y: ry });
        actions.push({ kind: 'roll', dir });
        trySeq(`roll ${dir} over ${midT} from (${rx},${ry})`, actions);
      }
      // Step onto Spring Pad 'J'
      if (effectiveTileAt(room, s, nx, ny) === 'J') {
        const actions: LabAction[] = [];
        if (s.pip.x !== rx || s.pip.y !== ry) actions.push({ kind: 'moveTo', x: rx, y: ry });
        actions.push({ kind: 'step', dir });
        trySeq(`spring from (${nx},${ny})`, actions);
      }
    }
  }

  // 4. Mimic step-walking: when a Mimic is present, single steps move the Mimic relative to walls!
  if (s.creatures.some((c) => c.kind === 'mimic' && c.frozenTicks === 0)) {
    for (const dir of DIRS) {
      trySeq(`mimic-step ${dir}`, [{ kind: 'step', dir }]);
    }
  }

  // 5. Wait/Settle if world is currently dynamic (burning crate/grass or active bomb)
  if (s.bombs.length > 0 || s.burningCells.size > 0 || s.props.some((p) => p.burnTicks > 0)) {
    trySeq('settle active chain', [{ kind: 'settle' }]);
  }

  // 6. Salient Bomb Actions (`drop` / `throw`) from reachable postures
  const cap = room.maxActiveBombs ?? 2;
  if (room.kit.length > 0 && s.bombs.length < cap) {
    const settledBombKeys = new Set<string>();
    const has3x3Dial = Boolean(room.turntables?.some((tt) => tt.size === 3));

    for (const [rx, ry] of reach) {
      const pipOnRaft = s.props.some((p) => p.kind === 'raft' && p.x === rx && p.y === ry);
      const pipOnDial =
        has3x3Dial &&
        Boolean(
          room.turntables?.some(
            (tt) => tt.size === 3 && Math.abs(rx - tt.cx) <= 1 && Math.abs(ry - tt.cy) <= 1,
          ),
        );

      for (const bomb of room.kit) {
        for (const how of ['drop', 'throw'] as const) {
          for (const dir of DIRS) {
            const [dx, dy] = DIR_DELTA[dir];
            const midX = rx + dx;
            const midY = ry + dy;
            const midRaw = rawTileAt(room, s, midX, midY);
            const midHasFanOrSlope =
              midRaw === 'n' ||
              midRaw === 's' ||
              midRaw === 'e' ||
              midRaw === 'w' ||
              Boolean(
                room.fans?.some((f) => f.x === rx || f.y === ry || f.x === midX || f.y === midY),
              );
            // Skip throwing over a walkable cell when stepping forward + dropping reaches the same tile
            if (
              how === 'throw' &&
              bomb !== 'wind' &&
              reachSet.has(cellKey(midX, midY)) &&
              !midHasFanOrSlope
            ) {
              continue;
            }

            if (
              how === 'drop' &&
              !canGroundedBombEnter(room, s, rx, ry, midX, midY) &&
              reach.length > 1
            ) {
              continue;
            }

            const targetX = how === 'drop' ? midX : rx + dx * 2;
            const targetY = how === 'drop' ? midY : ry + dy * 2;
            if (!isRelevantBombTarget(room, s, bomb, targetX, targetY)) {
              continue;
            }
            if (s.bombs.length > 0) {
              const first = s.bombs[0];
              const nearFirst =
                first !== undefined &&
                Math.abs(first.x - targetX) + Math.abs(first.y - targetY) <= 2;
              if (!nearFirst) continue;
            }

            const baseActions: LabAction[] = [];
            if (s.pip.x !== rx || s.pip.y !== ry) {
              baseActions.push({ kind: 'moveTo', x: rx, y: ry });
            }
            baseActions.push({ kind: 'actBomb', bomb, how, dir });

            // Option A: Place/throw bomb and settle to detonation (deduplicating identical static targets)
            const rxRaw = rawTileAt(room, s, rx, ry);
            const selfCryoMatters =
              bomb === 'ice' &&
              Math.abs(rx - targetX) <= 1 &&
              Math.abs(ry - targetY) <= 1 &&
              (rxRaw === 'n' ||
                rxRaw === 's' ||
                rxRaw === 'e' ||
                rxRaw === 'w' ||
                Boolean(room.fans?.some((f) => f.x === rx || f.y === ry)));
            const windSelfOverlap =
              bomb === 'wind' && Math.abs(rx - targetX) <= 1 && Math.abs(ry - targetY) <= 1;
            const frostRoll = s.frostCells.has(cellKey(targetX, targetY));

            let dedupeKey: string | null = null;
            if (
              s.bombs.length === 0 &&
              !pipOnRaft &&
              !pipOnDial &&
              !selfCryoMatters &&
              !windSelfOverlap &&
              !frostRoll &&
              bomb !== 'wind'
            ) {
              if (bomb === 'rock') {
                const t0 = effectiveTileAt(room, s, targetX, targetY);
                const l0 = liquidKindAt(room, s, targetX, targetY);
                const t1 = effectiveTileAt(room, s, targetX + dx, targetY + dy);
                const l1 = liquidKindAt(room, s, targetX + dx, targetY + dy);
                if (t0 === '^' || t0 === '!' || l0 === 'shallow') {
                  dedupeKey = `rock-fill@${targetX},${targetY}`;
                } else if (t1 === '^' || t1 === '!' || l1 === 'shallow') {
                  dedupeKey = `rock-fill@${targetX + dx},${targetY + dy}`;
                } else {
                  dedupeKey = `rock-spawn@${targetX},${targetY}`;
                }
              } else {
                dedupeKey = `${bomb}@${targetX},${targetY}`;
              }
            }
            if (!dedupeKey || !settledBombKeys.has(dedupeKey)) {
              if (dedupeKey) settledBombKeys.add(dedupeKey);
              trySeq(
                `${how} ${bomb} @ (${rx},${ry}) ${dir} + settle`,
                [...baseActions, { kind: 'settle' }],
                [rx, ry],
              );
            }

            // Option B: Leave the bomb ticking live only when timing/repositioning can matter!
            if (s.bombs.length === 0 && isLiveTimingCandidate(room, s, bomb, targetX, targetY)) {
              trySeq(`${how} ${bomb} @ (${rx},${ry}) ${dir} (live)`, baseActions, [rx, ry]);
            }
          }
        }
      }
    }
  }

  return results;
}

/** Per-tile pull of the nearest crate toward an empty goal plate in the best-first priority. */
const CRATE_PLATE_WEIGHT = 4;

function heuristicPriority(room: LabRoomSpec, s: LabState, depth: number): number {
  let h = depth * 6;
  for (const b of s.braziers) {
    if (!b.lit) h += 18;
  }
  for (const sn of room.sensors ?? []) {
    if (!s.activeSensors.has(sn.id)) h += 18;
  }
  const { oPlates, qSwitches } = getRoomSwitchCells(room, s);
  const unheldPlates: Array<readonly [number, number]> = [];
  for (const [ox, oy] of oPlates) {
    if (!isSwitchHeldAt(room, s, ox, oy, false)) {
      h += 18;
      unheldPlates.push([ox, oy]);
    }
  }
  for (const [qx, qy] of qSwitches) {
    if (!isSwitchHeldAt(room, s, qx, qy, false)) {
      h += 18;
      unheldPlates.push([qx, qy]);
    }
  }
  // Mild pull of pushable crates toward the nearest empty plate (Pip covers one plate himself).
  if (unheldPlates.length > 1) {
    let best = Infinity;
    for (const p of s.props) {
      if (p.kind !== 'crate' || p.submerged) continue;
      for (const [px, py] of unheldPlates) {
        best = Math.min(best, Math.abs(p.x - px) + Math.abs(p.y - py));
      }
    }
    if (Number.isFinite(best)) h += Math.min(best, 8) * CRATE_PLATE_WEIGHT;
  }
  if (s.rockCell) h -= 3;
  if (s.props.some((p) => p.frosted)) h -= 4;
  h -= Math.min(8, s.brokenWalls.size * 3 + s.meltedBlocks.size * 3 + s.turntableTurns.size * 4);
  return h;
}

export function summarizeTrace(
  room: LabRoomSpec,
  flatActions: readonly LabAction[],
): CausalTraceSummary {
  const s = createLabState(room);
  const usedBombKinds = new Set<LabBombKind>();
  const propRoles = new Map<string, Set<string>>();
  const stateInversions = new Set<string>();
  let usedMouseOnlyPath = false;
  let usedBombOnlyPath = false;
  let usedSelfCryo = false;
  let stoleFireWithoutFireBomb = false;

  const addRole = (propId: string, role: string): void => {
    let set = propRoles.get(propId);
    if (!set) {
      set = new Set();
      propRoles.set(propId, set);
    }
    set.add(role);
  };

  let sawGatesTrue = s.gatesOpen;
  let sawGatesFalse = !s.gatesOpen;
  let sawWater0 = s.waterLevel === 0;
  let sawWater1 = s.waterLevel === 1;
  const initialCrystal = s.crystalColor;
  let crystalFlips = 0;

  for (const act of flatActions) {
    if (act.kind === 'pull' || act.kind === 'actBomb') {
      usedBombKinds.add(act.bomb);
    }
    const prevProps = new Map(s.props.map((p) => [p.id, { ...p }]));
    const res = applyLabAction(room, s, act);

    if (rawTileAt(room, s, s.pip.x, s.pip.y) === 'm' || isVeilActiveAt(room, s, s.pip.x, s.pip.y)) {
      usedMouseOnlyPath = true;
    }
    if (act.kind === 'throw' || (act.kind === 'actBomb' && act.how === 'throw')) {
      usedBombOnlyPath = true;
    }
    if (
      res.events.includes('bomb-grate-pass') ||
      s.bombs.some((b) => rawTileAt(room, s, b.x, b.y) === 'g')
    ) {
      usedBombOnlyPath = true;
    }

    for (const ev of res.events) {
      if (ev === 'pip-cryo' || ev === 'pip-thaw') usedSelfCryo = true;
      if (ev === 'crystal-flip') {
        crystalFlips++;
        if (crystalFlips >= 2 || s.crystalColor !== initialCrystal) {
          stateInversions.add('crystal');
        }
      }
      if (ev === 'sluice-high') sawWater1 = true;
      if (ev === 'sluice-low') sawWater0 = true;
      if (ev.startsWith('turntable-')) stateInversions.add(ev);
      if (ev === 'pillar-rise' || ev === 'rock-spawn' || ev === 'vortex-catapult') {
        stateInversions.add(ev);
      }
      if (ev === 'ice-bridge-melt' || ev === 'frost-thaw' || ev === 'veil-thaw') {
        stateInversions.add('freeze-then-melt');
      }
      if (ev === 'crate-doused') stateInversions.add('ignite-then-douse');
      if (ev === 'torch-lit' && !usedBombKinds.has('fire')) {
        stoleFireWithoutFireBomb = true;
      }
    }

    if (s.gatesOpen) sawGatesTrue = true;
    else sawGatesFalse = true;
    if (sawGatesTrue && sawGatesFalse && res.events.includes('gate-close')) {
      stateInversions.add('gate-inversion');
    }
    if (sawWater0 && sawWater1) {
      stateInversions.add('sluice-transition');
    }

    // Track distinct physical roles played by each prop!
    for (const p of s.props) {
      const prev = prevProps.get(p.id);
      if (prev && (prev.x !== p.x || prev.y !== p.y)) {
        addRole(p.id, 'moved');
      }
      if (p.frosted) addRole(p.id, 'frost-armored');
      if (p.burnTicks > 0) addRole(p.id, 'burning-fuel');
      if (prev && prev.burnTicks > 0 && p.burnTicks === 0) addRole(p.id, 'doused');
      if (p.submerged) addRole(p.id, 'sunk-weight');
      if (
        p.kind === 'crate' &&
        liquidKindAt(room, s, p.x, p.y) === 'deep' &&
        !s.frozenWater.has(cellKey(p.x, p.y))
      ) {
        addRole(p.id, 'floating-bridge');
      }
      const raw = rawTileAt(room, s, p.x, p.y);
      const onSw =
        raw === 'O' ||
        raw === 'Q' ||
        Boolean(room.switches?.some((sw) => sw.x === p.x && sw.y === p.y));
      if (onSw) addRole(p.id, 'switch-weight');
      if (s.lastLaserRays.some((r) => Math.abs(r.x - p.x) + Math.abs(r.y - p.y) <= 1)) {
        addRole(p.id, p.kind === 'mirror' ? 'laser-optics' : 'laser-blocker');
      }
    }
    for (const [id, prev] of prevProps) {
      if (!s.props.some((p) => p.id === id) && prev.burnTicks > 0) {
        addRole(id, 'burned-away-shutter');
      }
    }
  }

  return {
    usedBombKinds,
    propRoles,
    stateInversions,
    usedMouseOnlyPath,
    usedBombOnlyPath,
    usedSelfCryo,
    stoleFireWithoutFireBomb,
  };
}

export function solveLabRoom(
  room: LabRoomSpec,
  budget: SolveBudget = DEFAULT_SOLVE_BUDGET,
): SolveResult {
  const t0 = performance.now();
  const initial = createLabState(room);

  if (initial.roomSolved) {
    return {
      solved: true,
      steps: [],
      flatActions: [],
      statesExplored: 1,
      budgetExhausted: false,
      elapsedMs: performance.now() - t0,
      summary: summarizeTrace(room, []),
    };
  }

  const initKey = canonicalSolverHash(room, initial);
  const visited = new Map<string, number>();
  visited.set(initKey, 0);

  const frontier: SearchNode[] = [{ state: initial, key: initKey, steps: [], priority: 0 }];
  let explored = 0;
  let budgetExhausted = false;

  for (let guard = 0; guard < budget.maxStates && frontier.length > 0; guard++) {
    if (performance.now() - t0 > budget.maxMs) {
      budgetExhausted = true;
      break;
    }

    // Pop lowest-priority node (lightweight array min-pick keeps queue simple & deterministic)
    let bestIdx = 0;
    let bestPrio = frontier[0]?.priority ?? Infinity;
    for (let i = 1; i < frontier.length; i++) {
      const p = frontier[i]?.priority ?? Infinity;
      if (p < bestPrio) {
        bestPrio = p;
        bestIdx = i;
      }
    }
    const [node] = frontier.splice(bestIdx, 1);
    if (!node) break;
    explored++;

    if (node.steps.length >= budget.maxDepth) continue;

    const successors = generateMacroSuccessors(room, node.state, node.key);
    for (const { next, key, step } of successors) {
      const nextSteps = [...node.steps, step];
      if (next.roomSolved) {
        const flatActions = nextSteps.flatMap((st) => st.actions);
        return {
          solved: true,
          steps: nextSteps,
          flatActions,
          statesExplored: explored,
          budgetExhausted: false,
          elapsedMs: performance.now() - t0,
          summary: summarizeTrace(room, flatActions),
        };
      }

      const prevDepth = visited.get(key);
      if (prevDepth !== undefined && prevDepth <= nextSteps.length) continue;
      visited.set(key, nextSteps.length);

      frontier.push({
        state: next,
        key,
        steps: nextSteps,
        priority: heuristicPriority(room, next, nextSteps.length),
      });
    }

    if (guard === budget.maxStates - 1 && frontier.length > 0) {
      budgetExhausted = true;
    }
  }

  return {
    solved: false,
    steps: [],
    flatActions: [],
    statesExplored: explored,
    budgetExhausted,
    elapsedMs: performance.now() - t0,
    summary: summarizeTrace(room, []),
  };
}

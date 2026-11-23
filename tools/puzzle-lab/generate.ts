/**
 * Standalone Abstracted Puzzle Lab — Entangled `22 x 26` Room Composer &
 * Counterexample-Guided (`CEGAR`) `1 -> 2 -> 3` Escalation Triad Generator (`Phase 3`).
 *
 * All generated rooms target the full `22 x 26` (`BIG_ROOM_W x BIG_ROOM_H`) Shrine scale with the
 * canonical 4-tile outer wall frame (`interior x in 4..17, y in 4..21`) and are certified by the
 * 5-Gate Ablation & Creativity Critic.
 */
import {
  type EvaluateOptions,
  type RoomEvaluationReport,
  evaluateRoomQuality,
  replayWitness,
} from './critic';
import { validateBackportInvariants } from './elevation';
import { applyLabAction, createLabState } from './sim';
import type { SolveBudget, SolveResult } from './solver';
import type {
  BeamSensorSpec,
  FanSpec,
  LabAction,
  LabRoomSpec,
  LabTile,
  LaserSpec,
  PropSpec,
  SwitchSpec,
  TurntableSpec,
} from './types';

export const LAB_BIG_W = 22;
export const LAB_BIG_H = 26;

/** Deterministic Mulberry32 PRNG for reproducible puzzle synthesis. */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[Math.floor(this.next() * items.length)];
  }
}

/** Mutable `22 x 26` Shrine canvas builder with 4-tile outer `#` walls (`x in 4..17, y in 4..21`). */
export class BigRoomCanvas {
  readonly width: number;
  readonly height: number;
  private readonly grid: LabTile[][];
  private levelGrid: Array<Array<'0' | '1' | '2'>> | null = null;

  constructor(width = LAB_BIG_W, height = LAB_BIG_H) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () =>
      Array.from({ length: width }, (): LabTile => '#'),
    );
  }

  enableLevels(fill: '0' | '1' | '2' = '0'): void {
    this.levelGrid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => fill),
    );
  }

  carveRect(x0: number, y0: number, x1: number, y1: number, tile: LabTile = '.'): void {
    const minX = Math.max(1, Math.min(x0, x1));
    const maxX = Math.min(this.width - 2, Math.max(x0, x1));
    const minY = Math.max(1, Math.min(y0, y1));
    const maxY = Math.min(this.height - 2, Math.max(y0, y1));
    for (let y = minY; y <= maxY; y++) {
      const row = this.grid[y];
      if (!row) continue;
      for (let x = minX; x <= maxX; x++) {
        row[x] = tile;
      }
    }
  }

  setLevelRect(x0: number, y0: number, x1: number, y1: number, level: '0' | '1' | '2'): void {
    if (!this.levelGrid) this.enableLevels('0');
    const grid = this.levelGrid;
    if (!grid) return;
    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(this.width - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(this.height - 1, Math.max(y0, y1));
    for (let y = minY; y <= maxY; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = minX; x <= maxX; x++) {
        row[x] = level;
      }
    }
  }

  set(x: number, y: number, tile: LabTile): void {
    const row = this.grid[y];
    if (row && x >= 0 && x < this.width) {
      row[x] = tile;
    }
  }

  get(x: number, y: number): LabTile {
    return this.grid[y]?.[x] ?? '#';
  }

  rows(): string[] {
    return this.grid.map((r) => r.join(''));
  }

  levels(): string[] | undefined {
    return this.levelGrid ? this.levelGrid.map((r) => r.join('')) : undefined;
  }
}

// ============================================================================
// Part 1: Entangled `22 x 26` Multi-Trick Composer
// ============================================================================

export type EntanglementFamily =
  | 'scarce-frost-laser'
  | 'split-turntable-unpin'
  | 'cryo-rock-inverter'
  | 'douse-ember-heist'
  | 'sluice-buoyancy-bridge';

export interface GeneratedPuzzle {
  family: EntanglementFamily;
  seed: number;
  room: LabRoomSpec;
  report: RoomEvaluationReport;
}

export interface ComposeOptions {
  families?: readonly EntanglementFamily[];
  maxAttempts?: number;
  solveBudget?: SolveBudget;
  minMacroSteps?: number;
  minCreativityScore?: number;
}

function buildScarceFrostLaserRoom(rng: SeededRng, idx: number): LabRoomSpec {
  const c = new BigRoomCanvas();
  const midX = rng.int(9, 12);
  const laserY = rng.int(10, 12);
  const fenceY = laserY + 1;
  const goalY = laserY + 2;

  // Upper staging court + lower switch chamber separated by `=` fence & mousehole `m`
  c.carveRect(6, laserY - 2, 14, laserY, '.');
  c.carveRect(6, fenceY, 14, fenceY, '=');
  c.carveRect(6, goalY, 14, goalY + 1, '.');

  // Shallow frost lane down `midX` from crate staging across Laser & fence grate `'g'` onto lower switch
  c.carveRect(midX - 1, laserY - 1, midX + 1, laserY - 1, ';');
  c.set(midX, laserY, ';');
  c.set(midX, fenceY, 'g');
  c.set(midX, goalY, ';');

  // Mousehole on either west or east flank (forces empty-handed split routing)
  const mouseOnWest = rng.int(0, 1) === 0;
  const mX = mouseOnWest ? 6 : 14;
  const pipGoalX = mouseOnWest ? 8 : 12;
  c.set(mX, fenceY, 'm');

  // Place emitter inward from the mousehole column shooting toward the far wall so `mX` stays ray-free!
  const emitterX = mouseOnWest ? 7 : 13;
  const sensorX = mouseOnWest ? 14 : 6;
  const laserDir = mouseOnWest ? 'E' : 'W';

  c.set(pipGoalX, goalY, 'O');

  const props: PropSpec[] = [{ id: 'crate', kind: 'crate', x: midX, y: laserY - 1 }];
  const switches: SwitchSpec[] = [{ x: midX, y: goalY, kind: 'O' }];
  const lasers: LaserSpec[] = [{ id: 'L1', x: emitterX, y: laserY, dir: laserDir, level: 0 }];
  const sensors: BeamSensorSpec[] = [{ id: 'S1', x: sensorX, y: laserY, level: 0 }];

  return {
    id: `gen-scarce-frost-${idx}`,
    name: `Generated Rime Crossing #${idx}`,
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['ice', 'rock'],
    entry: [midX - 1, laserY - 2],
    condition: 'buttons-and-sensors',
    rows: c.rows(),
    switches,
    props,
    lasers,
    sensors,
  };
}

function buildSplitTurntableUnpinRoom(rng: SeededRng, idx: number): LabRoomSpec {
  const c = new BigRoomCanvas();
  const dialCy = rng.int(11, 13);
  // West bomb-chute gallery (`x=6..8`) + East 3x3 turntable hall (`x=10..15`)
  c.carveRect(6, dialCy - 3, 8, dialCy + 3, '.');
  c.carveRect(10, dialCy - 2, 15, dialCy + 3, '.');

  // Connect West and East ONLY via a Mousehole `m` so Pip cannot carry a bomb across,
  // while Crystal `C` sits behind a Bomb Grate `g` + North chute `n` in the West gallery!
  c.set(9, dialCy + 2, 'm');
  c.set(7, dialCy - 3, 'C');
  c.set(7, dialCy - 2, 'n');
  c.set(7, dialCy - 1, 'g');
  c.set(7, dialCy, 'n');
  c.set(6, dialCy - 2, '#');
  c.set(8, dialCy - 2, '#');
  c.set(6, dialCy - 1, '#');
  c.set(8, dialCy - 1, '#');

  // 3x3 Floor Dial centered at `(12, dialCy)` with 3-wall dead-end pocket holding `crate`
  const dialCx = 12;
  c.set(dialCx, dialCy - 2, '#');
  c.set(dialCx - 1, dialCy - 1, '#');
  c.set(dialCx + 1, dialCy - 1, '#');

  const crateGoalY = dialCy + 2;
  const pipGoalX = rng.int(10, 11);
  c.set(dialCx + 2, crateGoalY, 'O');
  c.set(pipGoalX, crateGoalY, 'O');

  const props: PropSpec[] = [{ id: 'crate', kind: 'crate', x: dialCx, y: dialCy - 1 }];
  const turntables: TurntableSpec[] = [
    { id: 'dial', cx: dialCx, cy: dialCy, size: 3, trigger: 'crystal' },
  ];

  return {
    id: `gen-split-dial-${idx}`,
    name: `Generated Split-Track Dial #${idx}`,
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['bomb'],
    entry: [7, dialCy + 2],
    condition: 'hold-buttons',
    rows: c.rows(),
    props,
    turntables,
  };
}

function buildCryoRockInverterRoom(rng: SeededRng, idx: number): LabRoomSpec {
  const c = new BigRoomCanvas();
  const laneY = rng.int(11, 13);
  const goalOffset = rng.int(0, 1) === 0 ? -1 : 1;
  c.carveRect(6, laneY - 2, 9, laneY + 1, '.');
  c.carveRect(10, laneY, 13, laneY, '!');
  c.carveRect(14, laneY - 2, 16, laneY + 2, '.');

  c.set(9, laneY, ';');
  c.set(8, laneY, 'U');
  c.set(7, laneY - 2, 'C');
  c.set(15, laneY + goalOffset, 'O');

  const fans: FanSpec[] = [{ id: 'F1', x: 6, y: laneY, dir: 'E', level: 0 }];
  const lasers: LaserSpec[] = [{ id: 'L1', x: 14, y: laneY - 2, dir: 'S', level: 0 }];
  const sensors: BeamSensorSpec[] = [
    { id: 'S1', x: 14, y: laneY + 2, level: 0, inverted: true, latch: true },
  ];

  return {
    id: `gen-cryo-inverter-${idx}`,
    name: `Generated Cryo Gate #${idx}`,
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['bomb', 'ice'],
    initialCrystal: 'blue',
    entry: [7, laneY - 1],
    condition: 'buttons-and-sensors',
    rows: c.rows(),
    fans,
    lasers,
    sensors,
  };
}

function buildDouseEmberHeistRoom(rng: SeededRng, idx: number): LabRoomSpec {
  const c = new BigRoomCanvas();
  const rowY = rng.int(11, 13);
  const extraWest = rng.int(6, 7);
  c.carveRect(extraWest, rowY - 2, 13, rowY + 2, '.');

  // Pin `crate` at `(9, rowY)` on N/S so it MUST be pushed East across `'!'` `(10, rowY)` under Laser `L1`
  // (igniting it!), shoved into `(11, rowY)` where it lights Brazier `b1` `(11, rowY - 1)`, and Wind-gusted
  // onto `;` `Q` `(12, rowY)` to douse the fire and hold Gate `G` `(10, rowY + 1)` open for `S1`!
  c.set(9, rowY, 'Q');
  c.set(9, rowY - 1, '#');
  c.set(9, rowY + 1, '#');
  c.set(10, rowY, '!');
  c.set(10, rowY + 1, 'G');
  c.set(11, rowY + 1, '#');
  c.set(12, rowY - 1, '#');
  c.set(12, rowY + 1, '#');
  c.set(13, rowY, '#');
  c.set(12, rowY, ';');

  const switches: SwitchSpec[] = [{ x: 12, y: rowY, kind: 'Q' }];
  const props: PropSpec[] = [{ id: 'crate', kind: 'crate', x: 9, y: rowY }];
  const braziers = [{ id: 'b1', x: 11, y: rowY - 1 }];
  const lasers: LaserSpec[] = [{ id: 'L1', x: 10, y: rowY - 2, dir: 'S', level: 0 }];
  const sensors: BeamSensorSpec[] = [{ id: 'S1', x: 10, y: rowY + 2, level: 0 }];

  return {
    id: `gen-ember-douse-${idx}`,
    name: `Generated Ember Salvage #${idx}`,
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['wind'],
    entry: [8, rowY],
    condition: 'torches-and-sensors',
    rows: c.rows(),
    switches,
    props,
    braziers,
    lasers,
    sensors,
  };
}

function buildSluiceBuoyancyBridgeRoom(rng: SeededRng, idx: number): LabRoomSpec {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  const midY = rng.int(11, 13);
  const goalX = rng.int(12, 14);

  c.carveRect(7, midY - 1, 14, midY + 1, '.');
  c.setLevelRect(9, midY - 1, 10, midY + 1, '0');
  c.carveRect(9, midY - 1, 10, midY + 1, ';');
  c.set(8, midY, 'e');
  c.set(7, midY - 1, 'W');
  c.set(goalX, midY - 1, 'O');

  const props: PropSpec[] = [
    { id: 'b1', kind: 'crate', x: 10, y: midY - 1 },
    { id: 'b2', kind: 'crate', x: 9, y: midY },
  ];

  const lvls = c.levels();
  return {
    id: `gen-sluice-bridge-${idx}`,
    name: `Generated Sluice Canal #${idx}`,
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['bomb'],
    entry: [7, midY + 1],
    condition: 'hold-buttons',
    sluice: { initial: 0 },
    rows: c.rows(),
    ...(lvls ? { levels: lvls } : {}),
    props,
  };
}

/**
 * Synthesizes and Critic-verifies entangled `22 x 26` multi-step puzzle rooms.
 */
export function composeEntangledRooms(
  seed: number,
  targetCount: number,
  options: ComposeOptions = {},
): GeneratedPuzzle[] {
  const rng = new SeededRng(seed);
  const families: readonly EntanglementFamily[] = options.families ?? [
    'scarce-frost-laser',
    'split-turntable-unpin',
    'cryo-rock-inverter',
    'douse-ember-heist',
    'sluice-buoyancy-bridge',
  ];
  const maxAttempts = options.maxAttempts ?? Math.max(targetCount * 4, 12);
  const solveBudget: SolveBudget = options.solveBudget ?? {
    maxStates: 2500,
    maxDepth: 9,
    maxMs: 2200,
  };
  const evalOpts: EvaluateOptions = {
    solveBudget,
    ablationBudget: {
      maxStates: 1400,
      maxDepth: 8,
      maxMs: 700,
    },
    minMacroSteps: options.minMacroSteps ?? 3,
    minCreativityScore: options.minCreativityScore ?? 30,
  };

  const accepted: GeneratedPuzzle[] = [];
  const seenSignatures = new Set<string>();

  for (let attempt = 0; attempt < maxAttempts && accepted.length < targetCount; attempt++) {
    const family = families[attempt % families.length] ?? 'scarce-frost-laser';
    const subSeed = rng.int(1, 0x7fffffff);
    const subRng = new SeededRng(subSeed);

    let room: LabRoomSpec;
    switch (family) {
      case 'scarce-frost-laser':
        room = buildScarceFrostLaserRoom(subRng, attempt + 1);
        break;
      case 'split-turntable-unpin':
        room = buildSplitTurntableUnpinRoom(subRng, attempt + 1);
        break;
      case 'cryo-rock-inverter':
        room = buildCryoRockInverterRoom(subRng, attempt + 1);
        break;
      case 'douse-ember-heist':
        room = buildDouseEmberHeistRoom(subRng, attempt + 1);
        break;
      case 'sluice-buoyancy-bridge':
        room = buildSluiceBuoyancyBridgeRoom(subRng, attempt + 1);
        break;
    }

    const structKey = `${family}|${room.rows.join('')}|${room.kit.join(',')}`;
    if (seenSignatures.has(structKey)) continue;
    seenSignatures.add(structKey);

    const report = evaluateRoomQuality(room, evalOpts);
    if (report.passedAllGates) {
      accepted.push({ family, seed: subSeed, room, report });
    }
  }

  return accepted;
}

// ============================================================================
// Part 2: Counterexample-Guided (`CEGAR`) `1 -> 2 -> 3` Escalation Triad Engine
// ============================================================================

export interface EscalationStage {
  act: 1 | 2 | 3;
  mutationApplied: string;
  room: LabRoomSpec;
  solve: SolveResult;
  report: RoomEvaluationReport;
  blockedPreviousWitness: boolean;
}

export interface EscalationTriad {
  triadId: string;
  title: string;
  stages: readonly [EscalationStage, EscalationStage, EscalationStage];
}

export interface CandidateMutation {
  description: string;
  mutate: (prevRoom: LabRoomSpec, prevSolve: SolveResult) => LabRoomSpec[];
}

export function causalTraceSignature(solve: SolveResult): string {
  const bombs = [...solve.summary.usedBombKinds].sort().join(',');
  const roles = [...solve.summary.propRoles.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, set]) => `${id}:${[...set].sort().join('+')}`)
    .join(';');
  const inv = [...solve.summary.stateInversions].sort().join(',');
  return [
    `B(${bombs})`,
    `R(${roles})`,
    `I(${inv})`,
    `M(${solve.summary.usedMouseOnlyPath ? 1 : 0},${solve.summary.usedBombOnlyPath ? 1 : 0})`,
    `C(${solve.summary.usedSelfCryo ? 1 : 0})`,
    `F(${solve.summary.stoleFireWithoutFireBomb ? 1 : 0})`,
  ].join('|');
}

/** Collects interior walkable/bombed cells touched along a witness trace for automatic blocker injection. */
function collectWitnessFootprint(
  room: LabRoomSpec,
  flatActions: readonly LabAction[],
): {
  walkedCells: Array<[number, number]>;
  bombedCells: Array<[number, number]>;
} {
  const s = createLabState(room);
  const walked = new Map<string, [number, number]>();
  const bombed = new Map<string, [number, number]>();

  for (const act of flatActions) {
    if (act.kind === 'actBomb' || act.kind === 'drop' || act.kind === 'throw') {
      bombed.set(`${s.pip.x},${s.pip.y}`, [s.pip.x, s.pip.y]);
    }
    applyLabAction(room, s, act);
    if (s.pip.x !== room.entry[0] || s.pip.y !== room.entry[1]) {
      walked.set(`${s.pip.x},${s.pip.y}`, [s.pip.x, s.pip.y]);
    }
    for (const b of s.bombs) {
      bombed.set(`${b.x},${b.y}`, [b.x, b.y]);
    }
  }
  return {
    walkedCells: [...walked.values()],
    bombedCells: [...bombed.values()],
  };
}

function replaceTileInRoom(room: LabRoomSpec, x: number, y: number, tile: LabTile): LabRoomSpec {
  const nextRows = room.rows.map((r, ry) => {
    if (ry !== y) return r;
    const chars = [...r];
    chars[x] = tile;
    return chars.join('');
  });
  return { ...room, rows: nextRows };
}

/**
 * Generic Counterexample-Guided Escalation Mutator:
 * Given `(prevRoom, prevSolve)`, proposes automatic counterexample mutations that strictly
 * falsify `prevSolve` (`Kit-Strip` of used bombs + `Tile-Blocker` injections on `prevSolve`'s
 * spatial footprint + custom domain mutations) and selects the highest-creativity valid successor!
 */
export function synthesizeNextEscalationAct(
  prevRoom: LabRoomSpec,
  prevSolve: SolveResult,
  act: 2 | 3,
  extraMutations: readonly CandidateMutation[] = [],
  solveBudget: SolveBudget = { maxStates: 2500, maxDepth: 9, maxMs: 1400 },
): EscalationStage | null {
  const prevSig = causalTraceSignature(prevSolve);
  const footprint = collectWitnessFootprint(prevRoom, prevSolve.flatActions);

  const candidateSpecs: Array<{ mutation: string; room: LabRoomSpec }> = [];

  // 1. Domain/structural mutations supplied by triad family
  for (const m of extraMutations) {
    for (const mutated of m.mutate(prevRoom, prevSolve)) {
      candidateSpecs.push({ mutation: m.description, room: mutated });
    }
  }

  // 2. Automatic Kit-Strip Mutations: strip each bomb actually used by `prevSolve`!
  for (const usedBomb of prevSolve.summary.usedBombKinds) {
    if (prevRoom.kit.includes(usedBomb) && prevRoom.kit.length > 1) {
      candidateSpecs.push({
        mutation: `strip-kit:${usedBomb}`,
        room: {
          ...prevRoom,
          id: `${prevRoom.id}-act${act}-no-${usedBomb}`,
          name: `${prevRoom.name} (No ${usedBomb})`,
          kit: prevRoom.kit.filter((k) => k !== usedBomb),
        },
      });
    }
  }

  // 3. Automatic Footprint Tile-Blocker Mutations (`=`, `m`, `|`, `!`) on cells used in `prevSolve`
  const blockerTiles: readonly LabTile[] = ['=', 'm', '|', '!'];
  for (const [wx, wy] of footprint.walkedCells.slice(0, 3)) {
    if ((prevRoom.rows[wy]?.[wx] ?? '#') !== '.') continue;
    if (prevRoom.props?.some((p) => p.x === wx && p.y === wy)) continue;
    if (prevRoom.braziers?.some((b) => b.x === wx && b.y === wy)) continue;
    if (prevRoom.sensors?.some((sn) => sn.x === wx && sn.y === wy)) continue;
    for (const bt of blockerTiles) {
      const mutated = replaceTileInRoom(prevRoom, wx, wy, bt);
      candidateSpecs.push({
        mutation: `place-${bt}@(${wx},${wy})`,
        room: {
          ...mutated,
          id: `${prevRoom.id}-act${act}-blk-${wx}-${wy}`,
          name: `${prevRoom.name} + Blocker`,
        },
      });
    }
  }

  let best: EscalationStage | null = null;
  const maxCheck = Math.min(candidateSpecs.length, 8);

  for (let i = 0; i < maxCheck; i++) {
    const cand = candidateSpecs[i];
    if (!cand) continue;
    if (validateBackportInvariants(cand.room).length > 0) continue;

    // Counterexample condition 1: previous witness MUST fail on the mutated room!
    if (replayWitness(cand.room, prevSolve.flatActions)) continue;

    const report = evaluateRoomQuality(cand.room, {
      solveBudget,
      ablationBudget: { maxStates: 1400, maxDepth: 8, maxMs: 700 },
      minMacroSteps: 2,
      minCreativityScore: act === 2 ? 25 : 30,
    });
    if (!report.passedAllGates) continue;

    // Counterexample condition 2: new witness must have a genuinely distinct causal signature!
    const nextSig = causalTraceSignature(report.solve);
    if (nextSig === prevSig && report.solve.steps.length <= prevSolve.steps.length) {
      continue;
    }

    const stage: EscalationStage = {
      act,
      mutationApplied: cand.mutation,
      room: cand.room,
      solve: report.solve,
      report,
      blockedPreviousWitness: true,
    };

    if (!best || stage.report.creativity.totalScore > best.report.creativity.totalScore) {
      best = stage;
    }
    if (stage.report.creativity.totalScore >= 50) break;
  }

  return best;
}

// ============================================================================
// Four Signature `22 x 26` CEGAR Escalation Triads (`P01-P12` Foundations)
// ============================================================================

function buildStolenFlameSeed(): {
  act1: LabRoomSpec;
  act2Mutations: CandidateMutation[];
  act3Mutations: CandidateMutation[];
} {
  const c = new BigRoomCanvas();
  c.carveRect(7, 9, 13, 13, '.');
  c.carveRect(7, 14, 13, 14, '=');
  c.carveRect(10, 15, 12, 16, '.');
  c.set(11, 11, '%');

  // Act I: Generous kit (`bomb` + `fire`) lets Pip immediately throw `Fire` over `=` onto `b1`!
  // Act II is discovered AUTOMATICALLY by `strip-kit:fire` (`Bomb` blasts `%` + `Mirror` bends `Laser` -> `b1`!)
  const act1: LabRoomSpec = {
    id: 'triad-flame-1',
    name: 'Stolen Flame I: Bring Your Own Match',
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['bomb', 'fire'],
    entry: [8, 13],
    condition: 'all-torches',
    rows: c.rows(),
    props: [{ id: 'mirror', kind: 'mirror', x: 11, y: 12, facing: 'SW' }],
    braziers: [{ id: 'b1', x: 11, y: 15 }],
    lasers: [{ id: 'L1', x: 7, y: 10, dir: 'E', level: 0 }],
  };

  // Act III places a required Crate right in the reflected beam (`x=11, y=13`) + two `O` plates + Sensor `S1`,
  // so pushing the Mirror before evacuating the Crate burns the Crate & blocks `S1`!
  const act3Mutations: CandidateMutation[] = [
    {
      description: 'place-required-crate-in-reflected-laser-lane',
      mutate: (r2) => {
        const rows3 = r2.rows.map((row, y) => {
          const chars = [...row];
          if (y === 13) {
            chars[8] = 'O';
            chars[9] = 'O';
          }
          return chars.join('');
        });
        return [
          {
            ...r2,
            id: 'triad-flame-3',
            name: 'Stolen Flame III: Spare the Messenger',
            condition: 'buttons-and-sensors',
            rows: rows3,
            props: [...(r2.props ?? []), { id: 'crate', kind: 'crate', x: 11, y: 13 }],
            sensors: [{ id: 'S1', x: 11, y: 16, level: 0 }],
          },
        ];
      },
    },
  ];

  return { act1, act2Mutations: [], act3Mutations };
}

function buildDontBurnTheBoxSeed(): {
  act1: LabRoomSpec;
  act2Mutations: CandidateMutation[];
  act3Mutations: CandidateMutation[];
} {
  const c = new BigRoomCanvas();
  c.carveRect(6, 9, 14, 15, '.');
  c.carveRect(6, 12, 14, 12, '=');
  c.carveRect(9, 10, 11, 10, ';');
  c.set(10, 11, ';');
  c.set(10, 12, ';');
  c.set(10, 13, ';');
  c.set(6, 12, 'm');
  c.set(8, 13, 'O');
  // `#` backstop under the south `O` so a pushed / frost-sliding crate stops on it.
  const rowsWithBackstop = c.rows().map((row, y) => {
    if (y !== 14) return row;
    const chars = [...row];
    chars[10] = '#';
    return chars.join('');
  });

  // Act I (teaching): the only route for the crate to its `O` crosses Laser L1, which would
  // ignite it and also blocks Pip from following. A Rock dropped into the beam lane shields the
  // crossing so Pip can escort the crate down the column; the crate then plugs the column, so
  // the Mousehole is Pip's only way round to the second `O`.
  const act1: LabRoomSpec = {
    id: 'triad-box-1',
    name: "Don't Burn the Box I: Rock the Beam",
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['rock'],
    entry: [8, 10],
    condition: 'hold-buttons',
    // Tighter north yard than Acts II/III (east bay walled off) and dry floor (no `;` water until
    // Act II introduces `Ice`!) keeps the teaching room focused and prevents dousing on `(10,12)`.
    rows: rowsWithBackstop.map((row, y) => {
      const chars = [...row].map((ch) => (ch === ';' ? '.' : ch));
      if (y === 9 || y === 10) {
        for (let x = 12; x <= 14; x++) chars[x] = '#';
      }
      return chars.join('');
    }),
    switches: [{ x: 10, y: 13, kind: 'O' }],
    props: [{ id: 'crate', kind: 'crate', x: 10, y: 10 }],
    lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 0 }],
  };

  // Act II: Strip `Rock`, grant `Ice`, and require the beam to reach Sensor S1 (so it can't stay
  // blocked) -> frost-armor the crate so it hydroplanes unburned through the beam onto `O`!
  const act2Mutations: CandidateMutation[] = [
    {
      description: 'strip-rock-add-sensor-require-frost-armor',
      mutate: (r1) => [
        {
          ...r1,
          id: 'triad-box-2',
          name: "Don't Burn the Box II: One Box Too Few",
          kit: ['ice'],
          condition: 'buttons-and-sensors',
          rows: rowsWithBackstop.map((row, y) => {
            if (y !== 12) return row;
            const chars = [...row];
            chars[10] = 'g';
            return chars.join('');
          }),
          switches: [{ x: 10, y: 13, kind: 'O' }],
          props: [{ id: 'crate', kind: 'crate', x: 10, y: 10 }],
          sensors: [{ id: 'S1', x: 14, y: 11, level: 0 }],
        },
      ],
    },
  ];

  // Act III: Remove wall backstop at `(10, 14)` so frosted crate slides past `(10, 13)` against `#` `(10, 15)` unless `Rock` stopper is placed first!
  const act3Mutations: CandidateMutation[] = [
    {
      description: 'remove-backstop-require-rock-stopper',
      mutate: (r2) => {
        const rows3 = r2.rows.map((row, y) => {
          const chars = [...row];
          if (y === 14) {
            // Overshoot cell `(10,14)` is a dead-end pocket: an overshot crate is unrecoverable.
            chars[9] = '#';
            chars[10] = '.';
            chars[11] = '#';
          }
          if (y === 15) chars[10] = '#';
          return chars.join('');
        });
        return [
          {
            ...r2,
            id: 'triad-box-3',
            name: "Don't Burn the Box III: Coat of Rime",
            kit: ['ice', 'rock'],
            rows: rows3,
          },
        ];
      },
    },
  ];

  return { act1, act2Mutations, act3Mutations };
}

function buildColdFeetSeed(): {
  act1: LabRoomSpec;
  act2Mutations: CandidateMutation[];
  act3Mutations: CandidateMutation[];
} {
  const c = new BigRoomCanvas();
  c.carveRect(6, 11, 9, 13, '.');
  c.set(10, 12, '!');
  c.set(11, 12, '!');
  c.carveRect(12, 11, 15, 13, '.');
  c.set(14, 11, 'O');

  // Act I: 2-tile spike strip + `Wind` bomb -> Wind-jump across spikes, then step onto `O`!
  const act1: LabRoomSpec = {
    id: 'triad-cryo-1',
    name: 'Cold Feet I: Gale Vault',
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['wind'],
    entry: [8, 12],
    condition: 'hold-buttons',
    rows: c.rows(),
  };

  // Act II: Strip `Wind`, widen spikes to 4 tiles (`x=10..13`), add `;` + Fan (`Self-Cryo` spike slide)!
  const act2Mutations: CandidateMutation[] = [
    {
      description: 'strip-wind-widen-spikes-require-self-cryo',
      mutate: (r1) => {
        const c2 = new BigRoomCanvas();
        c2.carveRect(6, 10, 9, 13, '.');
        c2.set(9, 12, ';');
        c2.carveRect(10, 12, 13, 12, '!');
        c2.carveRect(14, 10, 16, 14, '.');
        c2.set(15, 11, 'O');
        return [
          {
            ...r1,
            id: 'triad-cryo-2',
            name: 'Cold Feet II: Too Wide to Roll',
            kit: ['ice'],
            entry: [8, 11],
            rows: c2.rows(),
            fans: [{ id: 'F1', x: 6, y: 12, dir: 'E', level: 0 }],
          },
        ];
      },
    },
  ];

  // Act III: Block the Fan gale with a `U` crystal barrier (`Bomb` + `C`) AND drop a Laser down a
  // shaft that crosses the spike strip at `x=11`: it would thaw Ice-Pip mid-strip (2 spikes still
  // ahead = too wide to Roll) and pop him back. A Rock dropped into the shaft from `(10,10)` shuts
  // the beam off, so the slide can go through.
  const act3Mutations: CandidateMutation[] = [
    {
      description: 'add-crystal-windblock-and-mid-strip-laser',
      mutate: (r2) => {
        const rows3 = r2.rows.map((row, y) => {
          const chars = [...row];
          if (y === 10) {
            chars[7] = 'C';
            chars[10] = '.';
            chars[11] = '.';
          }
          if (y === 11) chars[11] = '.';
          if (y === 12) chars[8] = 'U';
          if (y === 13) for (let x = 6; x <= 9; x++) chars[x] = '#';
          return chars.join('');
        });
        return [
          {
            ...r2,
            id: 'triad-cryo-3',
            name: 'Cold Feet III: Thaw at the Gate',
            kit: ['bomb', 'ice', 'rock'],
            maxActiveBombs: 1,
            initialCrystal: 'blue',
            condition: 'hold-buttons',
            rows: rows3,
            lasers: [{ id: 'L1', x: 11, y: 9, dir: 'S', level: 0 }],
          },
        ];
      },
    },
  ];

  return { act1, act2Mutations, act3Mutations };
}

function buildHighTideSeed(): {
  act1: LabRoomSpec;
  act2Mutations: CandidateMutation[];
  act3Mutations: CandidateMutation[];
} {
  const c = new BigRoomCanvas();
  c.enableLevels('1');
  c.carveRect(7, 11, 13, 13, '.');
  c.setLevelRect(9, 11, 10, 13, '0');
  c.carveRect(9, 11, 10, 13, ';');
  c.set(8, 12, 'e');
  c.set(7, 11, 'W');
  c.set(12, 11, 'O');

  // Act I: Both crates ALREADY aligned on `y=11` (`(9,11)` and `(10,11)`) -> bomb `W` `(7,11)` & walk across!
  const lvls = c.levels();
  const act1: LabRoomSpec = {
    id: 'triad-tide-1',
    name: 'High Tide I: Float the Gap',
    width: LAB_BIG_W,
    height: LAB_BIG_H,
    kit: ['bomb'],
    entry: [7, 13],
    condition: 'hold-buttons',
    sluice: { initial: 0 },
    rows: c.rows(),
    ...(lvls ? { levels: lvls } : {}),
    props: [
      { id: 'b1', kind: 'crate', x: 10, y: 11 },
      { id: 'b2', kind: 'crate', x: 9, y: 11 },
    ],
  };

  // Act II: Place `b2` ON the ramp `(9, 12)` so immediate flooding leaves a gap -> hop into dry trench,
  // push `b2` North onto `(9, 11)` (simultaneously uncovering ramp `(9, 12)` & completing the bridge!),
  // climb back out, bomb `W`, and cross!
  const act2Mutations: CandidateMutation[] = [
    {
      description: 'offset-crate-onto-trench-ramp',
      mutate: (r1) => [
        {
          ...r1,
          id: 'triad-tide-2',
          name: 'High Tide II: Dry Trench Blueprint',
          props: [
            { id: 'b1', kind: 'crate', x: 10, y: 11 },
            { id: 'b2', kind: 'crate', x: 9, y: 12 },
          ],
        },
      ],
    },
  ];

  // Act III: Sweep a `level 1` Laser East across `y=11` (`(7,11) -> S1(13,11)`, moving `W` to `(5,12)` with `(6..7,12)` open)
  // so `b1` at `(10,11)` sits under the beam when Low, and would block `S1` & burn if floated in place!
  // Pip must walk down the ramp into the `level 0` trench, walk UNDER the `level 1` Laser at `(9,11)` into the
  // north trench turnaround `(9..10,10)`, push `b1` South out of the beam to `(10,13)` alongside `b2` `(9,13)`,
  // climb the ramp back up to the West bank, bomb `W`, and cross the floating bridge on `y=13`!
  const act3Mutations: CandidateMutation[] = [
    {
      description: 'add-level1-laser-across-primary-bridge-axis',
      mutate: (r2) => {
        const rows3 = r2.rows.map((row, y) => {
          const chars = [...row];
          if (y === 10) {
            chars[9] = ';';
            chars[10] = ';';
          }
          if (y === 11) {
            chars[7] = '.';
            chars[12] = '.';
          }
          if (y === 12) {
            chars[5] = 'W';
            chars[6] = '.';
          }
          if (y === 13) chars[12] = 'O';
          return chars.join('');
        });
        const levels3 = (r2.levels ?? []).map((row, y) => {
          if (y !== 10) return row;
          const chars = [...row];
          chars[9] = '0';
          chars[10] = '0';
          return chars.join('');
        });
        return [
          {
            ...r2,
            id: 'triad-tide-3',
            name: 'High Tide III: Under the Beam, Over the Tide',
            maxActiveBombs: 1,
            condition: 'buttons-and-sensors',
            rows: rows3,
            ...(levels3.length > 0 ? { levels: levels3 } : {}),
            props: [
              { id: 'b1', kind: 'crate', x: 10, y: 11 },
              { id: 'b2', kind: 'crate', x: 9, y: 13 },
            ],
            lasers: [{ id: 'L1', x: 7, y: 11, dir: 'E', level: 1 }],
            sensors: [{ id: 'S1', x: 13, y: 11, level: 1 }],
          },
        ];
      },
    },
  ];

  return { act1, act2Mutations, act3Mutations };
}

/**
 * Generates and verifies the complete 4-triad (`12` room) `1 -> 2 -> 3` Escalation Suite (`22 x 26`).
 * Every stage proves:
 *  - `replayWitness(stage_k, witness_{k-1}) === false` (previous solution is genuinely blocked!),
 *  - `stage_k` passes all 5 Critic Gates (`0` unused kit bombs, `0` dead props), and
 *  - `causalTraceSignature` or causal depth escalates across Acts I -> II -> III.
 */
/**
 * Fast, zero-search materializer for the 4 proven `1 -> 2 -> 3` Escalation Triads (`P01-P12`)
 * so UI viewers (`puzzle-lab.html`) and suite loaders (`getCuratedPuzzleSuite`) start in `< 2 ms`,
 * while `generateEscalationTriadSuite()` runs full CEGAR + 5-Gate Critic synthesis in tests.
 */
export function buildProvenEscalationTriadRooms(): Array<{
  triadId: string;
  title: string;
  rooms: readonly [LabRoomSpec, LabRoomSpec, LabRoomSpec];
}> {
  const emptySolve: SolveResult = {
    solved: false,
    steps: [],
    flatActions: [],
    statesExplored: 0,
    budgetExhausted: false,
    elapsedMs: 0,
    summary: {
      usedBombKinds: new Set(),
      propRoles: new Map(),
      stateInversions: new Set(),
      usedMouseOnlyPath: false,
      usedBombOnlyPath: false,
      usedSelfCryo: false,
      stoleFireWithoutFireBomb: false,
    },
  };

  const sf = buildStolenFlameSeed();
  const sf2: LabRoomSpec = {
    ...sf.act1,
    id: 'triad-flame-2',
    name: `${sf.act1.name} (Act 2)`,
    kit: sf.act1.kit.filter((k) => k !== 'fire'),
  };
  const sf3 = sf.act3Mutations[0]?.mutate(sf2, emptySolve)[0] ?? sf2;

  const db = buildDontBurnTheBoxSeed();
  const db2 = db.act2Mutations[0]?.mutate(db.act1, emptySolve)[0] ?? db.act1;
  const db3 = db.act3Mutations[0]?.mutate(db2, emptySolve)[0] ?? db2;

  const cf = buildColdFeetSeed();
  const cf2 = cf.act2Mutations[0]?.mutate(cf.act1, emptySolve)[0] ?? cf.act1;
  const cf3 = cf.act3Mutations[0]?.mutate(cf2, emptySolve)[0] ?? cf2;

  const ht = buildHighTideSeed();
  const ht2 = ht.act2Mutations[0]?.mutate(ht.act1, emptySolve)[0] ?? ht.act1;
  const ht3 = ht.act3Mutations[0]?.mutate(ht2, emptySolve)[0] ?? ht2;

  return [
    { triadId: 'triad-stolen-flame', title: 'Stolen Flame', rooms: [sf.act1, sf2, sf3] },
    { triadId: 'triad-dont-burn-box', title: "Don't Burn the Box", rooms: [db.act1, db2, db3] },
    { triadId: 'triad-cold-feet', title: 'Cold Feet (Self-Cryo)', rooms: [cf.act1, cf2, cf3] },
    { triadId: 'triad-high-tide', title: 'High Tide, Heavy Feet', rooms: [ht.act1, ht2, ht3] },
  ];
}

export function generateEscalationTriadSuite(
  solveBudget: SolveBudget = { maxStates: 4000, maxDepth: 10, maxMs: 3000 },
): EscalationTriad[] {
  const seeds = [
    { id: 'triad-stolen-flame', title: 'Stolen Flame', build: buildStolenFlameSeed },
    { id: 'triad-dont-burn-box', title: "Don't Burn the Box", build: buildDontBurnTheBoxSeed },
    { id: 'triad-cold-feet', title: 'Cold Feet (Self-Cryo)', build: buildColdFeetSeed },
    { id: 'triad-high-tide', title: 'High Tide, Heavy Feet', build: buildHighTideSeed },
  ];

  const triads: EscalationTriad[] = [];

  for (const item of seeds) {
    const { act1, act2Mutations, act3Mutations } = item.build();
    const rep1 = evaluateRoomQuality(act1, {
      solveBudget,
      ablationBudget: { maxStates: 1400, maxDepth: 8, maxMs: 700 },
      minMacroSteps: 1,
      minCreativityScore: 0,
    });
    // Note: Act I is allowed to be generously kitted (e.g. `['bomb', 'fire']` where `fire` solves
    // trivially in Act I before CEGAR strips `fire` in Act II!); Acts II & III enforce strict 0-unused-kit!
    if (!rep1.solve.solved || !rep1.replayVerified || rep1.backportErrors.length > 0) {
      continue;
    }
    const stage1: EscalationStage = {
      act: 1,
      mutationApplied: 'baseline-full-kit',
      room: act1,
      solve: rep1.solve,
      report: rep1,
      blockedPreviousWitness: false,
    };

    const stage2 = synthesizeNextEscalationAct(act1, rep1.solve, 2, act2Mutations, solveBudget);
    if (!stage2) continue;

    const stage3 = synthesizeNextEscalationAct(
      stage2.room,
      stage2.solve,
      3,
      act3Mutations,
      solveBudget,
    );
    if (!stage3) continue;

    triads.push({
      triadId: item.id,
      title: item.title,
      stages: [stage1, stage2, stage3],
    });
  }

  return triads;
}

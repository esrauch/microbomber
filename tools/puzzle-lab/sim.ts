/**
 * Standalone Abstracted Puzzle Lab — Deterministic Discrete-Tick Simulation Engine.
 *
 * Pure TypeScript, zero floats, zero DOM/Canvas imports. Executes discrete player actions and
 * causal ticks at ~20k-50k states/sec for puzzle probing, composition, and ablation verification.
 */
import {
  hasFloatingDeckAt,
  isLabPillarTile,
  isLabRampTile,
  labHopLanding,
  labLedgeDrops,
  labLevelAt,
  liquidKindAt,
  rawTileAt,
} from './elevation';
import {
  type ActionResult,
  type BombState,
  type BrazierState,
  CRATE_BURN_TICKS,
  CREATURE_DAZE_TICKS,
  CREATURE_FREEZE_TICKS,
  type CreatureState,
  DIRS,
  DIR_DELTA,
  type Dir,
  GRASS_BURN_TICKS,
  LAB_BOMB_FUSE_TICKS,
  type LabAction,
  type LabRoomSpec,
  type LabState,
  type LabTile,
  type LaserRaySegment,
  type PropState,
  SELF_CRYO_TICKS,
  VORTEX_TICKS,
  dirFromDelta,
  oppositeDir,
  reflectLaserOnMirror,
  rotateDirCW,
  rotateMirrorCW,
} from './types';

const MAX_SETTLE_TICKS = 36;

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function slopeDir(t: LabTile): Dir | null {
  if (t === 'n') return 'N';
  if (t === 'e') return 'E';
  if (t === 's') return 'S';
  if (t === 'w') return 'W';
  return null;
}

function rotateSlopeTileCW(t: LabTile, quarterTurns = 1): LabTile {
  const d = slopeDir(t);
  if (!d) return t;
  const nd = rotateDirCW(d, quarterTurns);
  return nd.toLowerCase() as LabTile;
}

function currentDir(t: LabTile): Dir | null {
  if (t === '1') return 'N';
  if (t === '2') return 'S';
  if (t === '3') return 'E';
  if (t === '4') return 'W';
  return null;
}

export function createLabState(room: LabRoomSpec): LabState {
  const props: PropState[] = (room.props ?? []).map((p, idx) => ({
    id: p.id ?? `prop-${idx}`,
    kind: p.kind,
    x: p.x,
    y: p.y,
    ...(p.facing !== undefined ? { facing: p.facing } : {}),
    frosted: Boolean(p.frosted),
    submerged: false,
    burnTicks: 0,
    vx: 0,
    vy: 0,
  }));

  const braziers: BrazierState[] = (room.braziers ?? []).map((b, idx) => ({
    id: b.id ?? `brazier-${idx}`,
    x: b.x,
    y: b.y,
    lit: Boolean(b.lit),
    ...(b.order !== undefined ? { order: b.order } : {}),
    ...(b.timedTicks !== undefined ? { timedTicks: b.timedTicks } : {}),
    remainingTicks: b.lit && b.timedTicks !== undefined ? b.timedTicks : 0,
  }));

  const creatures: CreatureState[] = (room.creatures ?? []).map((c, idx) => ({
    id: c.id ?? `creature-${idx}`,
    kind: c.kind,
    x: c.x,
    y: c.y,
    dir: c.dir ?? 'E',
    frozenTicks: 0,
    dazedTicks: 0,
    vx: 0,
    vy: 0,
  }));

  const s: LabState = {
    tick: 0,
    pip: {
      x: room.entry[0],
      y: room.entry[1],
      safeX: room.entry[0],
      safeY: room.entry[1],
      dir: 'N',
      heldBomb: null,
      icedTicks: 0,
      vx: 0,
      vy: 0,
    },
    crystalColor: room.initialCrystal ?? 'blue',
    polarity: room.initialPolarity ?? 'north',
    waterLevel: room.sluice?.initial ?? 0,
    pillarsUp: false,
    gatesOpen: false,
    roomSolved: false,
    orderedStep: 0,
    nextBombId: 1,
    brokenWalls: new Set(),
    meltedBlocks: new Set(),
    puddleCells: new Set(),
    filledCells: new Set(),
    burnedGrass: new Set(),
    burningCells: new Map(),
    frozenWater: new Set(),
    frostCells: new Set(),
    frozenVeils: new Set(),
    rockCell: null,
    turntableTurns: new Map(),
    rotatedTiles: new Map(),
    latchedSensors: new Set(),
    activeSensors: new Set(),
    props,
    bombs: [],
    braziers,
    creatures,
    vortices: [],
    lastLaserRays: [],
    events: [],
  };

  settleBuoyancy(room, s);
  recomputeSwitchesAndGates(room, s);
  updateLasers(room, s);
  if (s.events.includes('ice-bridge-melt')) {
    settleBuoyancy(room, s);
    updateLasers(room, s);
  }
  recomputeSwitchesAndGates(room, s);
  checkSolveCondition(room, s);
  s.events = [];
  return s;
}

export function cloneLabState(s: LabState): LabState {
  const burningCells = new Map<string, { ticks: number; gen: number }>();
  for (const [k, v] of s.burningCells) {
    burningCells.set(k, { ticks: v.ticks, gen: v.gen });
  }
  return {
    tick: s.tick,
    pip: { ...s.pip },
    crystalColor: s.crystalColor,
    polarity: s.polarity,
    waterLevel: s.waterLevel,
    pillarsUp: s.pillarsUp,
    gatesOpen: s.gatesOpen,
    roomSolved: s.roomSolved,
    orderedStep: s.orderedStep,
    nextBombId: s.nextBombId,
    brokenWalls: new Set(s.brokenWalls),
    meltedBlocks: new Set(s.meltedBlocks),
    puddleCells: new Set(s.puddleCells),
    filledCells: new Set(s.filledCells),
    burnedGrass: new Set(s.burnedGrass),
    burningCells,
    frozenWater: new Set(s.frozenWater),
    frostCells: new Set(s.frostCells),
    frozenVeils: new Set(s.frozenVeils),
    rockCell: s.rockCell ? [s.rockCell[0], s.rockCell[1]] : null,
    turntableTurns: new Map(s.turntableTurns),
    rotatedTiles: new Map(s.rotatedTiles),
    latchedSensors: new Set(s.latchedSensors),
    activeSensors: new Set(s.activeSensors),
    props: s.props.map((p) => ({ ...p })),
    bombs: s.bombs.map((b) => ({ ...b })),
    braziers: s.braziers.map((b) => ({ ...b })),
    creatures: s.creatures.map((c) => ({ ...c })),
    vortices: s.vortices.map((v) => ({ ...v })),
    lastLaserRays: s.lastLaserRays.map((r) => ({ ...r })),
    events: [...s.events],
  };
}

export function hashLabState(s: LabState): string {
  const sorted = (set: Set<string>): string => [...set].sort().join(';');
  const mapEntries = [...s.burningCells.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.ticks},${v.gen}`)
    .join(';');
  const ttEntries = [...s.turntableTurns.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
  const propsStr = s.props
    .map(
      (p) =>
        `${p.id}:${p.kind}@${p.x},${p.y}:${p.facing ?? ''}:${p.frosted ? 1 : 0}:${p.submerged ? 1 : 0}:${p.burnTicks}`,
    )
    .join(';');
  const bombsStr = s.bombs
    .map(
      (b) =>
        `${b.kind}@${b.x},${b.y}:${b.vx},${b.vy}:f${b.fuse}:a${b.airborneSteps}:${b.carriedByOtterId ?? ''}`,
    )
    .join(';');
  const brazStr = s.braziers.map((b) => `${b.id}:${b.lit ? 1 : 0}:${b.remainingTicks}`).join(';');
  const creatStr = s.creatures
    .map((c) => `${c.id}@${c.x},${c.y}:${c.dir}:f${c.frozenTicks}:d${c.dazedTicks}`)
    .join(';');
  const vortStr = s.vortices.map((v) => `${v.x},${v.y}:${v.dir}:${v.remainingTicks}`).join(';');

  return [
    `P(${s.pip.x},${s.pip.y},${s.pip.dir},${s.pip.heldBomb ?? '-'},i${s.pip.icedTicks})`,
    `G(${s.crystalColor},${s.polarity},w${s.waterLevel},p${s.pillarsUp ? 1 : 0},g${s.gatesOpen ? 1 : 0},s${s.roomSolved ? 1 : 0},o${s.orderedStep})`,
    `R(${s.rockCell ? `${s.rockCell[0]},${s.rockCell[1]}` : '-'})`,
    `BW(${sorted(s.brokenWalls)})`,
    `MB(${sorted(s.meltedBlocks)})`,
    `FL(${sorted(s.filledCells)})`,
    `BG(${sorted(s.burnedGrass)})`,
    `BC(${mapEntries})`,
    `FW(${sorted(s.frozenWater)})`,
    `FS(${sorted(s.frostCells)})`,
    `FV(${sorted(s.frozenVeils)})`,
    `TT(${ttEntries})`,
    `LS(${sorted(s.latchedSensors)}|${sorted(s.activeSensors)})`,
    `PR(${propsStr})`,
    `BM(${bombsStr})`,
    `BR(${brazStr})`,
    `CR(${creatStr})`,
    `VX(${vortStr})`,
  ].join('|');
}

// ============================================================================
// Terrain & Entity Queries
// ============================================================================

export function isVeilActiveAt(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  if (rawTileAt(room, s, x, y) !== '|') return false;
  if (s.frozenVeils.has(cellKey(x, y))) return false;
  if (room.sluice?.drainsVeilsWhenLow && s.waterLevel === 0) return false;
  return true;
}

export function effectiveTileAt(room: LabRoomSpec, s: LabState, x: number, y: number): LabTile {
  const raw = rawTileAt(room, s, x, y);
  const key = cellKey(x, y);
  if (raw === '%' && s.brokenWalls.has(key)) return '.';
  if (raw === 'B' && s.meltedBlocks.has(key)) return ';';
  if (raw === ',' && s.burnedGrass.has(key)) return '.';
  if (raw === 'G' && s.gatesOpen) return '.';
  if (raw === 'X') return s.gatesOpen ? '.' : '!';
  if (raw === 'S' && s.roomSolved) return '.';
  if ((raw === '^' || raw === '!' || raw === ';') && s.filledCells.has(key)) return '.';
  if (raw === '|' && room.sluice?.drainsVeilsWhenLow && s.waterLevel === 0) return '.';
  return raw;
}

function hasRockBlockAt(s: LabState, x: number, y: number): boolean {
  return s.rockCell !== null && s.rockCell[0] === x && s.rockCell[1] === y;
}

function surfacePropsAt(s: LabState, x: number, y: number): PropState[] {
  return s.props.filter((p) => p.x === x && p.y === y && !p.submerged);
}

function cargoPropAt(s: LabState, x: number, y: number): PropState | undefined {
  return s.props.find((p) => p.x === x && p.y === y && !p.submerged && p.kind !== 'raft');
}

function raftAt(s: LabState, x: number, y: number): PropState | undefined {
  return s.props.find((p) => p.x === x && p.y === y && p.kind === 'raft');
}

function hasBrazierAt(s: LabState, x: number, y: number): boolean {
  return s.braziers.some((b) => b.x === x && b.y === y);
}

function isRaisedBarrier(t: LabTile, crystalColor: 'red' | 'blue'): boolean {
  return (t === 'R' && crystalColor === 'red') || (t === 'U' && crystalColor === 'blue');
}

function isOpaqueSolidTile(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  const t = effectiveTileAt(room, s, x, y);
  const key = cellKey(x, y);
  if (
    t === '#' ||
    t === '%' ||
    t === 'B' ||
    t === 'G' ||
    t === 'S' ||
    t === 'C' ||
    t === 'N' ||
    t === 'W' ||
    isRaisedBarrier(t, s.crystalColor)
  ) {
    return true;
  }
  if (t === '|' && s.frozenVeils.has(key)) return true;
  if (hasRockBlockAt(s, x, y)) return true;
  if (hasBrazierAt(s, x, y)) return true;
  if (room.lasers?.some((l) => l.x === x && l.y === y)) return true;
  if (room.fans?.some((f) => f.x === x && f.y === y)) return true;
  return false;
}

/** Entity effective vertical level (`0 | 1 | 2`), accounting for rafts and flooded water. */
function entityLevelAt(room: LabRoomSpec, s: LabState, x: number, y: number): 0 | 1 | 2 {
  return labLevelAt(room, s, x, y) ?? 0;
}

export function canPipStandAt(
  room: LabRoomSpec,
  s: LabState,
  x: number,
  y: number,
  fromX?: number,
  fromY?: number,
  ignoreHazards = false,
): boolean {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return false;
  if (isOpaqueSolidTile(room, s, x, y)) return false;
  const t = effectiveTileAt(room, s, x, y);
  if (t === '=' || t === 'g') return false;
  if (t === 'm' && (s.pip.heldBomb !== null || s.pip.icedTicks > 0)) return false;
  if (labLedgeDrops(room, s, x, y) !== null) return false;

  // Cargo props block Pip from standing on the same tile (rafts & floating crates are decks!)
  const cargo = cargoPropAt(s, x, y);
  if (cargo) {
    const isFloatingCrateBridge =
      cargo.kind === 'crate' &&
      liquidKindAt(room, s, x, y) === 'deep' &&
      !raftAt(s, x, y) &&
      !s.frozenWater.has(cellKey(x, y));
    if (!isFloatingCrateBridge) return false;
  }

  if (fromX !== undefined && fromY !== undefined && room.levels) {
    const curL = labLevelAt(room, s, fromX, fromY);
    const dstL = labLevelAt(room, s, x, y);
    if (
      curL !== null &&
      dstL !== null &&
      curL !== dstL &&
      !isLabRampTile(room, s, fromX, fromY) &&
      !isLabRampTile(room, s, x, y)
    ) {
      return false;
    }
  }

  if (!ignoreHazards) {
    if (t === '^') return false;
    if (t === '!' && s.pip.icedTicks <= 0) return false;
    if (liquidKindAt(room, s, x, y) === 'deep' && !hasFloatingDeckAt(room, s, x, y)) {
      return false;
    }
  }
  return true;
}

function canPropEnterCell(
  room: LabRoomSpec,
  s: LabState,
  prop: PropState,
  nx: number,
  ny: number,
): boolean {
  if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) return false;
  if (isOpaqueSolidTile(room, s, nx, ny)) return false;
  const t = effectiveTileAt(room, s, nx, ny);
  if (t === '=' || t === 'g' || t === 'm' || t === '^') return false;
  if (labLedgeDrops(room, s, nx, ny) !== null) return false;

  if (room.levels) {
    const curL = labLevelAt(room, s, prop.x, prop.y);
    const dstL = labLevelAt(room, s, nx, ny);
    const intoWaterBasin =
      curL !== null && dstL !== null && dstL < curL && liquidKindAt(room, s, nx, ny) === 'deep';
    if (
      curL !== null &&
      dstL !== null &&
      curL !== dstL &&
      !intoWaterBasin &&
      !isLabRampTile(room, s, prop.x, prop.y) &&
      !isLabRampTile(room, s, nx, ny)
    ) {
      return false;
    }
  }

  if (s.pip.x === nx && s.pip.y === ny) return false;
  if (s.creatures.some((c) => c.x === nx && c.y === ny)) return false;

  if (prop.kind === 'raft') {
    if (liquidKindAt(room, s, nx, ny) !== 'deep' || s.frozenWater.has(cellKey(nx, ny))) {
      return false;
    }
    return surfacePropsAt(s, nx, ny).length === 0;
  }

  // Non-raft cargo prop can step onto an empty cell OR onto an empty raft deck!
  const existingCargo = cargoPropAt(s, nx, ny);
  if (existingCargo && existingCargo.id !== prop.id) return false;
  return true;
}

export function canGroundedBombEnter(
  room: LabRoomSpec,
  s: LabState,
  fromX: number,
  fromY: number,
  nx: number,
  ny: number,
): boolean {
  if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) return false;
  if (isOpaqueSolidTile(room, s, nx, ny)) return false;
  const t = effectiveTileAt(room, s, nx, ny);
  // Note: 'g' (Bomb Grate) and '|' (Waterfall Veil) ALLOW grounded bombs to enter!
  if (t === '=' || t === 'm') return false;

  const cargo = cargoPropAt(s, nx, ny);
  if (cargo) {
    const isFloatingCrateBridge =
      cargo.kind === 'crate' &&
      liquidKindAt(room, s, nx, ny) === 'deep' &&
      !raftAt(s, nx, ny) &&
      !s.frozenWater.has(cellKey(nx, ny));
    if (!isFloatingCrateBridge) return false;
  }

  if (room.levels) {
    const curL = labLevelAt(room, s, fromX, fromY) ?? 0;
    const dstL = labLevelAt(room, s, nx, ny) ?? 0;
    const drops = labLedgeDrops(room, s, nx, ny);
    if (drops) {
      const d = dirFromDelta(nx - fromX, ny - fromY);
      const canDropOff = (d === 'S' && drops.s) || (d === 'E' && drops.e) || (d === 'W' && drops.w);
      return canDropOff;
    }
    if (dstL > curL && !isLabRampTile(room, s, fromX, fromY) && !isLabRampTile(room, s, nx, ny)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Buoyancy, Switches, Sluice, Turntables & Solve Checks
// ============================================================================

function settleBuoyancy(room: LabRoomSpec, s: LabState): void {
  for (const p of s.props) {
    const key = cellKey(p.x, p.y);
    const liq = liquidKindAt(room, s, p.x, p.y);
    const onOtherRaft = p.kind !== 'raft' && Boolean(raftAt(s, p.x, p.y));
    const pLevel = entityLevelAt(room, s, p.x, p.y);
    const inActiveLaser = s.lastLaserRays.some(
      (r) => r.x === p.x && r.y === p.y && r.level === pLevel,
    );

    if (
      p.burnTicks > 0 &&
      !s.frozenWater.has(key) &&
      (liq === 'deep' || (liq === 'shallow' && !inActiveLaser))
    ) {
      p.burnTicks = 0;
      s.events.push('crate-doused');
    }

    if (onOtherRaft || s.frozenWater.has(key)) {
      p.submerged = false;
    } else if (liq === 'deep') {
      if (p.kind === 'crate' || p.kind === 'raft') {
        p.submerged = false;
      } else {
        if (!p.submerged) s.events.push(`${p.kind}-sunk`);
        p.submerged = true;
      }
    } else {
      p.submerged = false;
    }
  }

  // Ground fires in flooded/shallow water fizzle immediately
  for (const key of [...s.burningCells.keys()]) {
    const [xs, ys] = key.split(',');
    const gx = Number(xs);
    const gy = Number(ys);
    if (liquidKindAt(room, s, gx, gy) !== 'none') {
      s.burningCells.delete(key);
    }
  }

  // If Pip ends up over unfrozen deep water without a floating deck, pop back to safe tile (or entry if safe tile also flooded)
  if (
    liquidKindAt(room, s, s.pip.x, s.pip.y) === 'deep' &&
    !hasFloatingDeckAt(room, s, s.pip.x, s.pip.y)
  ) {
    const safeFlooded =
      liquidKindAt(room, s, s.pip.safeX, s.pip.safeY) === 'deep' &&
      !hasFloatingDeckAt(room, s, s.pip.safeX, s.pip.safeY);
    if (safeFlooded) {
      s.pip.safeX = room.entry[0];
      s.pip.safeY = room.entry[1];
    }
    s.pip.x = s.pip.safeX;
    s.pip.y = s.pip.safeY;
    s.pip.vx = 0;
    s.pip.vy = 0;
    s.events.push('pip-water-reset');
  }
}

function isFloatingOffFloor(room: LabRoomSpec, s: LabState, p: PropState): boolean {
  if (p.submerged) return false;
  if (liquidKindAt(room, s, p.x, p.y) !== 'deep') return false;
  if (s.frozenWater.has(cellKey(p.x, p.y))) return false;
  return p.kind === 'crate' || p.kind === 'raft' || Boolean(raftAt(s, p.x, p.y));
}

export function isSwitchHeldAt(
  room: LabRoomSpec,
  s: LabState,
  bx: number,
  by: number,
  allowBombs: boolean,
): boolean {
  const pipFloating =
    liquidKindAt(room, s, bx, by) === 'deep' && !s.frozenWater.has(cellKey(bx, by));
  if (s.pip.x === bx && s.pip.y === by && !pipFloating) return true;

  for (const p of s.props) {
    if (p.x === bx && p.y === by && p.kind !== 'raft' && !isFloatingOffFloor(room, s, p)) {
      return true;
    }
  }
  for (const c of s.creatures) {
    if (c.x === bx && c.y === by) return true;
  }
  if (allowBombs) {
    for (const b of s.bombs) {
      if (b.x === bx && b.y === by && b.airborneSteps === 0 && !pipFloating) return true;
    }
  }
  return false;
}

interface CachedRoomSwitches {
  oPlates: ReadonlyArray<readonly [number, number]>;
  qSwitches: ReadonlyArray<readonly [number, number]>;
  hasRotatableSwitch: boolean;
}

const roomSwitchCache = new WeakMap<LabRoomSpec, CachedRoomSwitches>();

export function getRoomSwitchCells(room: LabRoomSpec, s: LabState): CachedRoomSwitches {
  let cached = roomSwitchCache.get(room);
  if (!cached) {
    const oPlates: Array<[number, number]> = [];
    const qSwitches: Array<[number, number]> = [];
    for (let y = 0; y < room.height; y++) {
      const row = room.rows[y] ?? '';
      for (let x = 0; x < room.width; x++) {
        const ch = row[x];
        if (ch === 'O') oPlates.push([x, y]);
        else if (ch === 'Q') qSwitches.push([x, y]);
      }
    }
    const dials = (room.turntables ?? []).filter((tt) => tt.size === 3);
    const inDial = (x: number, y: number): boolean =>
      dials.some((tt) => Math.abs(x - tt.cx) <= 1 && Math.abs(y - tt.cy) <= 1);
    const hasRotatableSwitch =
      dials.length > 0 &&
      (oPlates.some(([x, y]) => inDial(x, y)) || qSwitches.some(([x, y]) => inDial(x, y)));

    for (const sw of room.switches ?? []) {
      if (sw.kind === 'O') oPlates.push([sw.x, sw.y]);
      else qSwitches.push([sw.x, sw.y]);
    }
    cached = { oPlates, qSwitches, hasRotatableSwitch };
    roomSwitchCache.set(room, cached);
  }

  if (cached.hasRotatableSwitch && s.rotatedTiles.size > 0) {
    const oPlates: Array<[number, number]> = [];
    const qSwitches: Array<[number, number]> = [];
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const raw = rawTileAt(room, s, x, y);
        if (raw === 'O') oPlates.push([x, y]);
        else if (raw === 'Q') qSwitches.push([x, y]);
      }
    }
    for (const sw of room.switches ?? []) {
      if (sw.kind === 'O') oPlates.push([sw.x, sw.y]);
      else qSwitches.push([sw.x, sw.y]);
    }
    return { oPlates, qSwitches, hasRotatableSwitch: true };
  }

  return cached;
}

function recomputeSwitchesAndGates(room: LabRoomSpec, s: LabState): void {
  const { qSwitches } = getRoomSwitchCells(room, s);
  const nextGates =
    qSwitches.length > 0 && qSwitches.every(([qx, qy]) => isSwitchHeldAt(room, s, qx, qy, true));
  if (nextGates !== s.gatesOpen) {
    s.gatesOpen = nextGates;
    s.events.push(nextGates ? 'gate-open' : 'gate-close');
  }

  const pMode = room.pillars ?? 'switches';
  const nextPillars =
    pMode === 'switches'
      ? s.gatesOpen
      : pMode === 'red'
        ? s.crystalColor === 'red'
        : s.crystalColor === 'blue';
  if (nextPillars !== s.pillarsUp) {
    s.pillarsUp = nextPillars;
    s.events.push(nextPillars ? 'pillar-rise' : 'pillar-sink');
  }
}

export function rotateTurntableById(room: LabRoomSpec, s: LabState, ttId: string): void {
  const tt = room.turntables?.find((t) => t.id === ttId);
  if (!tt) return;
  const prev = s.turntableTurns.get(tt.id) ?? 0;
  s.turntableTurns.set(tt.id, (prev + 1) % 4);
  s.events.push(`turntable-${tt.id}`);

  if (tt.size === 1) {
    const curTile = rawTileAt(room, s, tt.cx, tt.cy);
    if (slopeDir(curTile) !== null) {
      s.rotatedTiles.set(cellKey(tt.cx, tt.cy), rotateSlopeTileCW(curTile, 1));
    }
    for (const p of s.props) {
      if (p.x === tt.cx && p.y === tt.cy && p.facing) {
        p.facing = rotateMirrorCW(p.facing, 1);
      }
    }
    return;
  }

  // 3x3 Floor Dial: rotate terrain tiles, Pip, props, bombs & creatures 90° CW around (cx, cy)
  const snapshot = new Map<string, LabTile>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = tt.cx + dx;
      const y = tt.cy + dy;
      snapshot.set(cellKey(x, y), rawTileAt(room, s, x, y));
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const oldTile = snapshot.get(cellKey(tt.cx + dx, tt.cy + dy)) ?? '.';
      const nx = tt.cx - dy;
      const ny = tt.cy + dx;
      s.rotatedTiles.set(cellKey(nx, ny), rotateSlopeTileCW(oldTile, 1));
    }
  }

  const rotCoord = (x: number, y: number): [number, number] | null => {
    const dx = x - tt.cx;
    const dy = y - tt.cy;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
      return [tt.cx - dy, tt.cy + dx];
    }
    return null;
  };

  const pipNext = rotCoord(s.pip.x, s.pip.y);
  if (pipNext) {
    s.pip.x = pipNext[0];
    s.pip.y = pipNext[1];
    s.pip.safeX = pipNext[0];
    s.pip.safeY = pipNext[1];
    s.pip.dir = rotateDirCW(s.pip.dir, 1);
  }
  for (const p of s.props) {
    const pn = rotCoord(p.x, p.y);
    if (pn) {
      p.x = pn[0];
      p.y = pn[1];
      if (p.facing) p.facing = rotateMirrorCW(p.facing, 1);
    }
  }
  for (const b of s.bombs) {
    const bn = rotCoord(b.x, b.y);
    if (bn) {
      b.x = bn[0];
      b.y = bn[1];
      const nv = [-b.vy, b.vx] as const;
      b.vx = nv[0];
      b.vy = nv[1];
    }
  }
  for (const c of s.creatures) {
    const cn = rotCoord(c.x, c.y);
    if (cn) {
      c.x = cn[0];
      c.y = cn[1];
      c.dir = rotateDirCW(c.dir, 1);
    }
  }
}

function toggleCrystal(room: LabRoomSpec, s: LabState): void {
  s.crystalColor = s.crystalColor === 'red' ? 'blue' : 'red';
  s.events.push('crystal-flip');
  for (const tt of room.turntables ?? []) {
    if (tt.trigger === 'crystal') rotateTurntableById(room, s, tt.id);
  }
}

function togglePolarity(room: LabRoomSpec, s: LabState): void {
  s.polarity = s.polarity === 'north' ? 'south' : 'north';
  s.events.push('polarity-flip');
  for (const tt of room.turntables ?? []) {
    if (tt.trigger === 'polarity') rotateTurntableById(room, s, tt.id);
  }
}

function toggleSluice(room: LabRoomSpec, s: LabState): void {
  if (!room.sluice) return;
  s.waterLevel = s.waterLevel === 0 ? 1 : 0;
  if (s.waterLevel === 0) {
    // Draining water collapses unsupported high-water ice sheets in the basin
    for (const key of [...s.frozenWater]) {
      const [xs, ys] = key.split(',');
      if (liquidKindAt(room, s, Number(xs), Number(ys)) !== 'deep') {
        s.frozenWater.delete(key);
      }
    }
  } else {
    // Rising water submerges shallow frost into deep water
    for (const key of [...s.frostCells]) {
      const [xs, ys] = key.split(',');
      if (liquidKindAt(room, s, Number(xs), Number(ys)) === 'deep') {
        s.frostCells.delete(key);
      }
    }
  }
  s.events.push(s.waterLevel === 1 ? 'sluice-high' : 'sluice-low');
  settleBuoyancy(room, s);
}

// ============================================================================
// Fire, Frost Sliding, Raft Propulsion, Fans & Unified Laser
// ============================================================================

function lightBrazierAt(room: LabRoomSpec, s: LabState, x: number, y: number): void {
  const br = s.braziers.find((b) => b.x === x && b.y === y);
  if (!br || br.lit) return;
  if (room.condition === 'ordered-torches' && br.order !== undefined) {
    if (br.order === s.orderedStep + 1) {
      br.lit = true;
      s.orderedStep++;
      s.events.push('torch-lit');
    } else {
      for (const other of s.braziers) {
        if (other.order !== undefined) other.lit = false;
      }
      s.orderedStep = 0;
      s.events.push('torch-fizzle');
    }
    return;
  }
  br.lit = true;
  br.remainingTicks = br.timedTicks ?? 0;
  s.events.push('torch-lit');
}

function applyHeatToCell(room: LabRoomSpec, s: LabState, x: number, y: number, gen = 0): void {
  const key = cellKey(x, y);
  const raw = rawTileAt(room, s, x, y);

  if (raw === 'B' && !s.meltedBlocks.has(key)) {
    s.meltedBlocks.add(key);
    s.puddleCells.add(key);
    s.events.push('ice-block-melt');
  }
  if (s.frozenWater.has(key)) {
    s.frozenWater.delete(key);
    s.events.push('ice-bridge-melt');
    settleBuoyancy(room, s);
  }
  if (s.frostCells.has(key)) {
    s.frostCells.delete(key);
    s.events.push('frost-thaw');
  }
  if (s.frozenVeils.has(key)) {
    s.frozenVeils.delete(key);
    s.events.push('veil-thaw');
  }

  if (
    raw === ',' &&
    !s.burnedGrass.has(key) &&
    !s.burningCells.has(key) &&
    liquidKindAt(room, s, x, y) === 'none'
  ) {
    s.burnedGrass.add(key);
    s.burningCells.set(key, { ticks: GRASS_BURN_TICKS, gen });
    s.events.push('grass-ignite');
  }

  lightBrazierAt(room, s, x, y);

  for (const p of surfacePropsAt(s, x, y)) {
    if (p.kind === 'crate') {
      if (p.frosted) {
        p.frosted = false;
        s.events.push('crate-frost-stripped');
      } else if (
        p.burnTicks === 0 &&
        (liquidKindAt(room, s, x, y) !== 'deep' || s.frozenWater.has(key))
      ) {
        p.burnTicks = CRATE_BURN_TICKS;
        s.events.push('crate-ignite');
      }
    }
  }

  for (const c of s.creatures) {
    if (c.x === x && c.y === y && c.frozenTicks > 0) {
      c.frozenTicks = 0;
      s.events.push('creature-thaw');
    }
  }

  if (s.pip.x === x && s.pip.y === y && s.pip.icedTicks > 0) {
    s.pip.icedTicks = 0;
    s.pip.vx = 0;
    s.pip.vy = 0;
    s.events.push('pip-thaw');
  }
}

function slidePropIfOnFrost(room: LabRoomSpec, s: LabState, prop: PropState, dir: Dir): void {
  const [dx, dy] = DIR_DELTA[dir];
  const maxSteps = Math.max(room.width, room.height);
  for (let step = 0; step < maxSteps; step++) {
    const key = cellKey(prop.x, prop.y);
    const slickHere =
      s.frostCells.has(key) ||
      (prop.frosted && liquidKindAt(room, s, prop.x, prop.y) === 'shallow');
    if (!slickHere) break;
    const nx = prop.x + dx;
    const ny = prop.y + dy;
    if (!canPropEnterCell(room, s, prop, nx, ny)) break;
    prop.x = nx;
    prop.y = ny;
    settleBuoyancy(room, s);
    const spring = findSpringAt(room, s, prop.x, prop.y);
    if (spring) {
      triggerSpringForProp(room, s, prop, spring);
      break;
    }
  }
}

function propelRaft(room: LabRoomSpec, s: LabState, raft: PropState, dir: Dir): boolean {
  if (
    liquidKindAt(room, s, raft.x, raft.y) !== 'deep' ||
    s.frozenWater.has(cellKey(raft.x, raft.y))
  ) {
    return false;
  }
  const [dx, dy] = DIR_DELTA[dir];
  const maxSteps = Math.max(room.width, room.height);
  let moved = false;
  for (let step = 0; step < maxSteps; step++) {
    const nx = raft.x + dx;
    const ny = raft.y + dy;
    if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) break;
    if (isOpaqueSolidTile(room, s, nx, ny)) break;
    if (liquidKindAt(room, s, nx, ny) !== 'deep' || s.frozenWater.has(cellKey(nx, ny))) break;
    if (surfacePropsAt(s, nx, ny).length > 0) break;

    const oldX = raft.x;
    const oldY = raft.y;
    const cargo = cargoPropAt(s, oldX, oldY);
    const pipRiding = s.pip.x === oldX && s.pip.y === oldY;
    const ridingBombs = s.bombs.filter(
      (b) => b.x === oldX && b.y === oldY && b.airborneSteps === 0,
    );

    raft.x = nx;
    raft.y = ny;
    if (cargo) {
      cargo.x = nx;
      cargo.y = ny;
    }
    if (pipRiding) {
      s.pip.x = nx;
      s.pip.y = ny;
      s.pip.safeX = nx;
      s.pip.safeY = ny;
    }
    for (const b of ridingBombs) {
      b.x = nx;
      b.y = ny;
    }
    moved = true;
  }
  if (moved) s.events.push('raft-sail');
  return moved;
}

function slideIcePip(room: LabRoomSpec, s: LabState, dir: Dir): void {
  if (s.pip.icedTicks <= 0) return;
  const [dx, dy] = DIR_DELTA[dir];
  const maxSteps = Math.max(room.width, room.height);
  for (let step = 0; step < maxSteps; step++) {
    const nx = s.pip.x + dx;
    const ny = s.pip.y + dy;
    if (!canPipStandAt(room, s, nx, ny, s.pip.x, s.pip.y, true)) break;
    const liq = liquidKindAt(room, s, nx, ny);
    const t = effectiveTileAt(room, s, nx, ny);
    if (t === '^' || (liq === 'deep' && !hasFloatingDeckAt(room, s, nx, ny))) break;

    s.pip.x = nx;
    s.pip.y = ny;
    if (t !== '!') {
      s.pip.safeX = nx;
      s.pip.safeY = ny;
    }

    // If Ice-Pip slides into a Laser cell, the Laser thaws Pip immediately and stops the slide!
    const pipLevel = entityLevelAt(room, s, nx, ny);
    if (s.lastLaserRays.some((r) => r.x === nx && r.y === ny && r.level === pipLevel)) {
      break;
    }
    if (!s.frostCells.has(cellKey(nx, ny)) && slopeDir(t) !== dir) {
      break;
    }
  }
}

function findSpringAt(
  room: LabRoomSpec,
  s: LabState,
  x: number,
  y: number,
  fallbackDir?: Dir,
): Dir | null {
  if (effectiveTileAt(room, s, x, y) !== 'J') return null;
  const spec = room.springs?.find((sp) => sp.x === x && sp.y === y);
  return spec?.dir ?? fallbackDir ?? 'N';
}

function triggerSpringForPip(room: LabRoomSpec, s: LabState, dir: Dir): void {
  const [dx, dy] = DIR_DELTA[dir];
  const srcL = entityLevelAt(room, s, s.pip.x, s.pip.y);
  for (const dist of [2, 1] as const) {
    const tx = s.pip.x + dx * dist;
    const ty = s.pip.y + dy * dist;
    if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
    const dstL = labLevelAt(room, s, tx, ty);
    if (dstL === null || dstL > srcL + 1) continue;
    if (!canPipStandAt(room, s, tx, ty, undefined, undefined, false)) continue;
    s.pip.x = tx;
    s.pip.y = ty;
    s.pip.safeX = tx;
    s.pip.safeY = ty;
    s.events.push('spring-vault');
    return;
  }
}

function triggerSpringForProp(room: LabRoomSpec, s: LabState, prop: PropState, dir: Dir): void {
  const [dx, dy] = DIR_DELTA[dir];
  const srcL = entityLevelAt(room, s, prop.x, prop.y);
  for (const dist of [2, 1] as const) {
    const tx = prop.x + dx * dist;
    const ty = prop.y + dy * dist;
    if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
    const dstL = labLevelAt(room, s, tx, ty);
    if (dstL === null || dstL > srcL + 1) continue;
    if (isOpaqueSolidTile(room, s, tx, ty)) continue;
    const t = effectiveTileAt(room, s, tx, ty);
    if (t === '=' || t === 'g' || t === 'm' || t === '^') continue;
    if (cargoPropAt(s, tx, ty)) continue;
    prop.x = tx;
    prop.y = ty;
    settleBuoyancy(room, s);
    s.events.push('prop-spring-vault');
    return;
  }
}

function activeFanCells(
  room: LabRoomSpec,
  s: LabState,
): Array<{ x: number; y: number; dir: Dir; level: 0 | 1 | 2 }> {
  const cells: Array<{ x: number; y: number; dir: Dir; level: 0 | 1 | 2 }> = [];
  for (const fan of room.fans ?? []) {
    const mode = fan.gateMode ?? 'always';
    if (mode === 'gates' && !s.gatesOpen) continue;
    if (mode === 'inverted-gates' && s.gatesOpen) continue;
    const turns = fan.turntableId ? (s.turntableTurns.get(fan.turntableId) ?? 0) : 0;
    const dir = rotateDirCW(fan.dir, turns);
    const [dx, dy] = DIR_DELTA[dir];
    const maxR = fan.range ?? Math.max(room.width, room.height);

    for (let r = 1; r <= maxR; r++) {
      const cx = fan.x + dx * r;
      const cy = fan.y + dy * r;
      if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) break;
      const floorL = labLevelAt(room, s, cx, cy);
      if (floorL === null || floorL > fan.level) break;
      if (isLabPillarTile(room, cx, cy) && s.pillarsUp && floorL >= fan.level) break;
      if (floorL === fan.level && isOpaqueSolidTile(room, s, cx, cy) && !hasBrazierAt(s, cx, cy)) {
        break;
      }

      cells.push({ x: cx, y: cy, dir, level: fan.level });
      if (floorL === fan.level && hasBrazierAt(s, cx, cy)) break;

      // An anchored dry-floor prop at fan.level casts a calm lee behind it
      if (floorL === fan.level) {
        const cargo = cargoPropAt(s, cx, cy);
        const onFrost = s.frostCells.has(cellKey(cx, cy));
        const onFloat =
          liquidKindAt(room, s, cx, cy) === 'deep' && !s.frozenWater.has(cellKey(cx, cy));
        if (cargo && !onFrost && !onFloat) break;
      }
    }
  }
  return cells;
}

/**
 * Casts all Unified Lasers (Fire + Signal):
 * - Reflects 90° off Mirrors; blocked by fireproof rear faces, Stone/Metal/Rock, risen Pillars,
 *   Wooden Crates (which ignite unless frosted/wet!), and Ice-Pip (who eclipses the ray for this
 *   tick while thawing unharmed!).
 */
function updateLasers(room: LabRoomSpec, s: LabState): void {
  const rays: LaserRaySegment[] = [];
  const hitSensors = new Set<string>();

  for (const laser of room.lasers ?? []) {
    const turns = laser.turntableId ? (s.turntableTurns.get(laser.turntableId) ?? 0) : 0;
    let dir = rotateDirCW(laser.dir, turns);
    let cx = laser.x;
    let cy = laser.y;
    const maxGuard = room.width * room.height * 4;

    for (let guard = 0; guard < maxGuard; guard++) {
      const [dx, dy] = DIR_DELTA[dir];
      cx += dx;
      cy += dy;
      if (cx < 0 || cy < 0 || cx >= room.width || cy >= room.height) break;

      const raw = rawTileAt(room, s, cx, cy);
      const key = cellKey(cx, cy);
      const floorL = labLevelAt(room, s, cx, cy);
      if (floorL === null) break;

      // Higher terrain or a risen pillar reaching laser.level blocks the beam
      if (floorL > laser.level) break;
      if (isLabPillarTile(room, cx, cy) && s.pillarsUp && floorL >= laser.level) break;

      if (floorL === laser.level) {
        // Indoor Ice Block 'B' melts and stops the beam this tick
        if (raw === 'B' && !s.meltedBlocks.has(key)) {
          applyHeatToCell(room, s, cx, cy);
          break;
        }
        if (tStopsLaser(room, s, cx, cy)) {
          if (raw === '|' && s.frozenVeils.has(key)) {
            applyHeatToCell(room, s, cx, cy);
          }
          break;
        }
      }

      // Check surface props at laser.level
      const entL = entityLevelAt(room, s, cx, cy);
      if (entL === laser.level) {
        const cargo = cargoPropAt(s, cx, cy);
        if (cargo) {
          if (cargo.kind === 'mirror' && cargo.facing) {
            const refl = reflectLaserOnMirror(dir, cargo.facing);
            if (refl === 'blocked') break;
            rays.push({ x: cx, y: cy, dir, level: laser.level });
            dir = refl;
            continue;
          }
          if (cargo.kind === 'crate') {
            rays.push({ x: cx, y: cy, dir, level: laser.level });
            applyHeatToCell(room, s, cx, cy);
          }
          break;
        }

        // Creatures at laser.level
        const creat = s.creatures.find((c) => c.x === cx && c.y === cy);
        if (creat) {
          if (creat.frozenTicks > 0) {
            creat.frozenTicks = 0;
            s.events.push('creature-thaw');
            break;
          }
          if (creat.kind === 'tortoise') break;
        }

        // Pip at laser.level: Ice-Pip eclipses the beam for 1 tick while thawing unharmed!
        if (s.pip.x === cx && s.pip.y === cy) {
          if (s.pip.icedTicks > 0) {
            s.pip.icedTicks = 0;
            s.pip.vx = 0;
            s.pip.vy = 0;
            s.events.push('pip-thaw');
            break;
          }
          s.pip.x = s.pip.safeX;
          s.pip.y = s.pip.safeY;
          s.events.push('pip-laser-reset');
        }
      }

      rays.push({ x: cx, y: cy, dir, level: laser.level });

      // Apply continuous thermal fire when beam runs at ground/surface height
      if (floorL === laser.level) {
        applyHeatToCell(room, s, cx, cy);
      }

      for (const sensor of room.sensors ?? []) {
        if (sensor.x === cx && sensor.y === cy && sensor.level === laser.level) {
          hitSensors.add(sensor.id);
        }
      }
    }
  }

  s.lastLaserRays = rays;

  // Evaluate Beam Sensors (including inverted & latching sensors + sluice/turntable sinks)
  const prevActive = new Set(s.activeSensors);
  s.activeSensors.clear();
  for (const sensor of room.sensors ?? []) {
    const rawHit = hitSensors.has(sensor.id);
    const satisfiedNow = sensor.inverted ? !rawHit : rawHit;
    if (satisfiedNow) {
      s.activeSensors.add(sensor.id);
      if (sensor.latch) s.latchedSensors.add(sensor.id);
      if (!prevActive.has(sensor.id)) {
        s.events.push(`sensor-${sensor.id}`);
        if (sensor.togglesSluice) toggleSluice(room, s);
        if (sensor.pulsesTurntableId) rotateTurntableById(room, s, sensor.pulsesTurntableId);
      }
    } else if (sensor.latch && s.latchedSensors.has(sensor.id)) {
      s.activeSensors.add(sensor.id);
    }
  }
}

function tStopsLaser(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  const t = effectiveTileAt(room, s, x, y);
  const key = cellKey(x, y);
  if (t === '#' || t === '%' || t === 'G' || t === 'S' || isRaisedBarrier(t, s.crystalColor)) {
    return true;
  }
  if (t === '|' && s.frozenVeils.has(key)) return true;
  if (hasRockBlockAt(s, x, y)) return true;
  return false;
}

// ============================================================================
// Bomb Detonation & Step Pipeline
// ============================================================================

function detonateBomb(room: LabRoomSpec, s: LabState, bomb: BombState): void {
  const { x: cx, y: cy, kind } = bomb;
  s.events.push(`boom-${kind}`);

  if (kind === 'squeak') {
    for (const c of s.creatures) {
      if (Math.abs(c.x - cx) <= 2 && Math.abs(c.y - cy) <= 2) {
        c.dazedTicks = CREATURE_DAZE_TICKS;
      }
    }
    return;
  }

  if (kind === 'rock') {
    const [dx, dy] = DIR_DELTA[s.pip.dir];
    const checkCells: Array<[number, number]> = [
      [cx, cy],
      [cx + dx, cy + dy],
    ];
    for (const [tx, ty] of checkCells) {
      if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
      const t = effectiveTileAt(room, s, tx, ty);
      if (t === '^' || t === '!' || liquidKindAt(room, s, tx, ty) === 'shallow') {
        s.filledCells.add(cellKey(tx, ty));
        s.events.push('rock-fill');
        return;
      }
    }
    s.rockCell = [cx, cy];
    s.events.push('rock-spawn');
    return;
  }

  if (kind === 'magnet') {
    // Flip polarity switches in 2-tile radius and pull aligned metal/sphere props
    for (let ty = Math.max(0, cy - 2); ty <= Math.min(room.height - 1, cy + 2); ty++) {
      for (let tx = Math.max(0, cx - 2); tx <= Math.min(room.width - 1, cx + 2); tx++) {
        if (rawTileAt(room, s, tx, ty) === 'N' && Math.hypot(tx - cx, ty - cy) <= 2.1) {
          togglePolarity(room, s);
        }
      }
    }
    pullMagneticTargets(room, s, cx, cy, 3);
    return;
  }

  if (kind === 'wind') {
    // Instant 3x3 push + Pip +1 tier blast-jump + lingering whirlwind vortex
    const pipOnRaft = Boolean(raftAt(s, s.pip.x, s.pip.y));
    if (!pipOnRaft && Math.abs(s.pip.x - cx) <= 1 && Math.abs(s.pip.y - cy) <= 1) {
      const jumpDir =
        s.pip.x === cx && s.pip.y === cy
          ? s.pip.dir
          : (dirFromDelta(Math.sign(s.pip.x - cx), Math.sign(s.pip.y - cy)) ?? s.pip.dir);
      const [dx, dy] = DIR_DELTA[jumpDir];
      const srcL = entityLevelAt(room, s, s.pip.x, s.pip.y);
      for (const dist of [2, 3, 1] as const) {
        const tx = s.pip.x + dx * dist;
        const ty = s.pip.y + dy * dist;
        if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
        const dstL = labLevelAt(room, s, tx, ty);
        if (dstL !== null && dstL <= srcL + 1 && canPipStandAt(room, s, tx, ty)) {
          s.pip.x = tx;
          s.pip.y = ty;
          s.pip.safeX = tx;
          s.pip.safeY = ty;
          s.events.push('wind-jump');
          break;
        }
      }
    }
    for (const p of s.props) {
      if (Math.abs(p.x - cx) <= 1 && Math.abs(p.y - cy) <= 1) {
        const pushDir = dirFromDelta(Math.sign(p.x - cx), Math.sign(p.y - cy)) ?? s.pip.dir;
        if (p.kind === 'raft') {
          propelRaft(room, s, p, pushDir);
        } else if (p.kind === 'crate' || s.frostCells.has(cellKey(p.x, p.y))) {
          const [pdx, pdy] = DIR_DELTA[pushDir];
          if (canPropEnterCell(room, s, p, p.x + pdx, p.y + pdy)) {
            p.x += pdx;
            p.y += pdy;
            settleBuoyancy(room, s);
            slidePropIfOnFrost(room, s, p, pushDir);
          }
        }
      }
    }
    s.vortices.push({ x: cx, y: cy, dir: s.pip.dir, remainingTicks: VORTEX_TICKS });
    return;
  }

  if (kind === 'ice') {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
        const raw = rawTileAt(room, s, tx, ty);
        if (raw === '#') continue;
        const key = cellKey(tx, ty);
        const liq = liquidKindAt(room, s, tx, ty);
        if (liq === 'deep') {
          s.frozenWater.add(key);
        } else if (liq === 'shallow') {
          s.frostCells.add(key);
        }
        if (raw === '|' && !(room.sluice?.drainsVeilsWhenLow && s.waterLevel === 0)) {
          s.frozenVeils.add(key);
        }
        // Snuff burning grass & unlatched braziers
        s.burningCells.delete(key);
        if (!s.roomSolved) {
          for (const br of s.braziers) {
            if (br.x === tx && br.y === ty) br.lit = false;
          }
        }
        // Frost-coat Wooden Crates (1-hit fire/laser armor + extinguishes burn)
        for (const p of surfacePropsAt(s, tx, ty)) {
          if (p.kind === 'crate') {
            p.frosted = true;
            p.burnTicks = 0;
          }
        }
        // Freeze Clockwork Creatures into sliding cubes
        for (const c of s.creatures) {
          if (c.x === tx && c.y === ty) {
            c.frozenTicks = CREATURE_FREEZE_TICKS;
          }
        }
        // Self-Cryo: freeze Pip (never bombs!)
        if (s.pip.x === tx && s.pip.y === ty) {
          s.pip.icedTicks = SELF_CRYO_TICKS;
          s.pip.heldBomb = null;
          s.events.push('pip-cryo');
        }
        // Stop drifting bombs whose underlying current just froze (fuse keeps ticking!)
        for (const other of s.bombs) {
          if (other.id !== bomb.id && other.x === tx && other.y === ty) {
            other.vx = 0;
            other.vy = 0;
          }
        }
      }
    }
    return;
  }

  // Standard '+' blast for `bomb` and `fire` (reach = 1)
  const hitCells: Array<[number, number]> = [[cx, cy]];
  for (const dir of DIRS) {
    const [dx, dy] = DIR_DELTA[dir];
    const tx = cx + dx;
    const ty = cy + dy;
    if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) continue;
    if (rawTileAt(room, s, tx, ty) === '#') continue;
    if (labLedgeDrops(room, s, tx, ty) !== null) continue;
    hitCells.push([tx, ty]);
  }

  let flippedCrystal = false;
  let flippedSluice = false;

  for (const [tx, ty] of hitCells) {
    const key = cellKey(tx, ty);
    const raw = rawTileAt(room, s, tx, ty);

    if (kind === 'bomb') {
      if (raw === '%' && !s.brokenWalls.has(key)) {
        s.brokenWalls.add(key);
        s.events.push('wall-break');
      }
      if (hasRockBlockAt(s, tx, ty)) {
        s.rockCell = null;
        s.events.push('rock-shatter');
      }
    } else if (kind === 'fire') {
      applyHeatToCell(room, s, tx, ty, 0);
    }

    if (raw === 'C' && !flippedCrystal) {
      flippedCrystal = true;
      toggleCrystal(room, s);
    }
    if (raw === 'W' && !flippedSluice) {
      flippedSluice = true;
      toggleSluice(room, s);
    }
  }

  // Blast-shove adjacent props, rafts (stern recoil!), and live bombs (`bomb` only breaks crates on same tile)
  for (const p of [...s.props]) {
    if (p.submerged) continue;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (kind === 'bomb' && dist === 0 && p.kind === 'crate') {
      s.props = s.props.filter((item) => item.id !== p.id);
      s.events.push('crate-break');
      continue;
    }
    if (p.kind === 'raft' && dist <= 1) {
      const recoilDir =
        dist === 0 ? s.pip.dir : (dirFromDelta(Math.sign(dx), Math.sign(dy)) ?? s.pip.dir);
      propelRaft(room, s, p, recoilDir);
      continue;
    }
    if (dist === 1 && p.kind !== 'raft') {
      if (kind === 'bomb' && p.kind === 'crate' && !s.frostCells.has(cellKey(p.x, p.y))) {
        // Direct '+' arm breaks adjacent dry wooden crate unless frosted; diagonal or frost shoves
        if (p.frosted) {
          p.frosted = false;
        } else {
          s.props = s.props.filter((item) => item.id !== p.id);
          s.events.push('crate-break');
          continue;
        }
      }
      const shoveDir = dirFromDelta(dx, dy);
      if (shoveDir && canPropEnterCell(room, s, p, p.x + dx, p.y + dy)) {
        p.x += dx;
        p.y += dy;
        settleBuoyancy(room, s);
        slidePropIfOnFrost(room, s, p, shoveDir);
        s.events.push('prop-shove');
      }
    }
  }

  // Bomb-on-bomb: 1st blast shoves, 2nd blast chain-detonates
  for (const other of s.bombs) {
    if (other.id === bomb.id) continue;
    const dx = other.x - cx;
    const dy = other.y - cy;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      if (other.shoveCount === 0) {
        other.shoveCount = 1;
        other.vx = dx;
        other.vy = dy;
        other.fuse = Math.max(other.fuse, 1);
      } else {
        other.fuse = 0;
      }
    }
  }
}

function pullMagneticTargets(
  room: LabRoomSpec,
  s: LabState,
  mx: number,
  my: number,
  range: number,
): void {
  const repel = s.polarity === 'south';
  for (const p of s.props) {
    if (p.submerged || (p.kind !== 'metal' && p.kind !== 'sphere')) continue;
    const dx = mx - p.x;
    const dy = my - p.y;
    if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) continue;
    if (Math.abs(dx) + Math.abs(dy) > range) continue;
    const stepDx = (repel ? -1 : 1) * Math.sign(dx);
    const stepDy = (repel ? -1 : 1) * Math.sign(dy);
    const moveDir = dirFromDelta(stepDx, stepDy);
    if (moveDir && canPropEnterCell(room, s, p, p.x + stepDx, p.y + stepDy)) {
      p.x += stepDx;
      p.y += stepDy;
      settleBuoyancy(room, s);
      slidePropIfOnFrost(room, s, p, moveDir);
      s.events.push('magnet-pull');
    }
  }
  for (const c of s.creatures) {
    if (c.kind === 'tortoise' && Math.abs(c.x - mx) + Math.abs(c.y - my) <= range) {
      c.dazedTicks = Math.max(c.dazedTicks, 2);
    }
  }
}

export function stepLabTick(room: LabRoomSpec, s: LabState): string[] {
  s.tick++;
  s.events = [];

  // 1. Active Fan gusts: blow out exposed braziers, sail rafts/frosted crates/Ice-Pip, push bombs
  const fanField = activeFanCells(room, s);
  for (const fc of fanField) {
    for (const br of s.braziers) {
      if (br.x === fc.x && br.y === fc.y && br.lit && !s.roomSolved) {
        br.lit = false;
      }
    }
  }
  for (const raft of s.props.filter((p) => p.kind === 'raft')) {
    const rLevel = entityLevelAt(room, s, raft.x, raft.y);
    const gust = fanField.find((f) => f.x === raft.x && f.y === raft.y && f.level === rLevel);
    if (gust) {
      propelRaft(room, s, raft, gust.dir);
    } else {
      const cd = currentDir(rawTileAt(room, s, raft.x, raft.y));
      if (cd) propelRaft(room, s, raft, cd);
    }
  }
  for (const p of s.props) {
    if (p.submerged || p.kind === 'raft') continue;
    const pLevel = entityLevelAt(room, s, p.x, p.y);
    const gust = fanField.find((f) => f.x === p.x && f.y === p.y && f.level === pLevel);
    if (gust) {
      const key = cellKey(p.x, p.y);
      const floatingAlone =
        p.kind === 'crate' && liquidKindAt(room, s, p.x, p.y) === 'deep' && !s.frozenWater.has(key);
      if (s.frostCells.has(key)) {
        slidePropIfOnFrost(room, s, p, gust.dir);
      } else if (floatingAlone) {
        const [dx, dy] = DIR_DELTA[gust.dir];
        if (canPropEnterCell(room, s, p, p.x + dx, p.y + dy)) {
          p.x += dx;
          p.y += dy;
          settleBuoyancy(room, s);
        }
      }
    }
    // Floating crates in unfrozen currents drift 1 cell per tick
    if (
      p.kind === 'crate' &&
      liquidKindAt(room, s, p.x, p.y) === 'deep' &&
      !s.frozenWater.has(cellKey(p.x, p.y)) &&
      !raftAt(s, p.x, p.y)
    ) {
      const cd = currentDir(rawTileAt(room, s, p.x, p.y));
      if (cd) {
        const [dx, dy] = DIR_DELTA[cd];
        if (canPropEnterCell(room, s, p, p.x + dx, p.y + dy)) {
          p.x += dx;
          p.y += dy;
          settleBuoyancy(room, s);
        }
      }
    }
    // Iron spheres roll down slopes/chutes
    if (p.kind === 'sphere') {
      const sd = slopeDir(effectiveTileAt(room, s, p.x, p.y));
      if (sd) {
        const [dx, dy] = DIR_DELTA[sd];
        if (canPropEnterCell(room, s, p, p.x + dx, p.y + dy)) {
          p.x += dx;
          p.y += dy;
          settleBuoyancy(room, s);
          slidePropIfOnFrost(room, s, p, sd);
        }
      }
    }
  }

  // Ice-Pip slides in Fan lanes or down slopes/chutes (icedTicks decrements after Laser pass)
  if (s.pip.icedTicks > 0) {
    const pLevel = entityLevelAt(room, s, s.pip.x, s.pip.y);
    const gust = fanField.find((f) => f.x === s.pip.x && f.y === s.pip.y && f.level === pLevel);
    const sd = slopeDir(effectiveTileAt(room, s, s.pip.x, s.pip.y));
    const slideDir = gust?.dir ?? sd;
    if (slideDir) {
      slideIcePip(room, s, slideDir);
    }
  }

  // 2. Continuous Magnet pull & Squeak lure from live bombs
  for (const b of s.bombs) {
    if (b.kind === 'magnet') {
      pullMagneticTargets(room, s, b.x, b.y, 2);
    }
  }

  // 3. Advance Clockwork Creatures
  stepCreatures(room, s, fanField);

  // 4. Advance Bombs (airborne arcs, slopes, currents, fan gusts, frost slides, waterfall dousing, fuses)
  const survivingBombs: BombState[] = [];
  const detonating: BombState[] = [];

  for (const b of s.bombs) {
    if (b.carriedByOtterId) {
      b.fuse--;
      if (b.fuse <= 0) detonating.push(b);
      else survivingBombs.push(b);
      continue;
    }

    // Whirlwind vortex catapults any bomb on its cell
    const vort = s.vortices.find((v) => v.x === b.x && v.y === b.y && v.remainingTicks > 0);
    if (vort && b.airborneSteps === 0) {
      const [vdx, vdy] = DIR_DELTA[vort.dir];
      b.vx = vdx;
      b.vy = vdy;
      b.airborneSteps = 4;
      b.launchLevel = entityLevelAt(room, s, b.x, b.y);
      s.events.push('vortex-catapult');
    }

    if (b.airborneSteps > 0) {
      const stepsThisTick = Math.min(b.airborneSteps, 2);
      let doused = false;
      for (let k = 0; k < stepsThisTick; k++) {
        const bLevel = b.launchLevel;
        const crossFan = fanField.find((f) => f.x === b.x && f.y === b.y && f.level === bLevel);
        if (crossFan) {
          const [fdx, fdy] = DIR_DELTA[crossFan.dir];
          b.vx = fdx;
          b.vy = fdy;
        }
        const nx = b.x + b.vx;
        const ny = b.y + b.vy;
        if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) {
          b.airborneSteps = 0;
          b.vx = 0;
          b.vy = 0;
          break;
        }
        if (isVeilActiveAt(room, s, nx, ny)) {
          doused = true;
          s.events.push('bomb-doused');
          break;
        }
        // Solid walls, Bomb Grates ('g' blocks high throws!), and frozen veils stop throws in front
        const nt = effectiveTileAt(room, s, nx, ny);
        if (isOpaqueSolidTile(room, s, nx, ny) || nt === 'g') {
          b.airborneSteps = 0;
          b.vx = 0;
          b.vy = 0;
          break;
        }
        b.x = nx;
        b.y = ny;
        b.airborneSteps--;
        if (b.airborneSteps === 0 && !s.frostCells.has(cellKey(b.x, b.y))) {
          b.vx = 0;
          b.vy = 0;
        }
      }
      if (doused) continue;
    } else {
      // Grounded bomb movement: slope, current, fan, or existing roll velocity
      const bKey = cellKey(b.x, b.y);
      const t = effectiveTileAt(room, s, b.x, b.y);
      const liq = liquidKindAt(room, s, b.x, b.y);
      if (t === '^') {
        s.events.push('bomb-swallowed');
        continue;
      }
      if (isVeilActiveAt(room, s, b.x, b.y)) {
        s.events.push('bomb-doused');
        continue;
      }

      const bLevel = entityLevelAt(room, s, b.x, b.y);
      const sd = slopeDir(t);
      const cd =
        liq === 'deep' && !s.frozenWater.has(bKey)
          ? currentDir(rawTileAt(room, s, b.x, b.y))
          : null;
      const gust = fanField.find((f) => f.x === b.x && f.y === b.y && f.level === bLevel);

      if (sd) {
        [b.vx, b.vy] = DIR_DELTA[sd];
      } else if (cd) {
        [b.vx, b.vy] = DIR_DELTA[cd];
      } else if (gust) {
        [b.vx, b.vy] = DIR_DELTA[gust.dir];
      }

      if (b.vx !== 0 || b.vy !== 0) {
        const moveD = dirFromDelta(b.vx, b.vy);
        const maxRoll = s.frostCells.has(bKey) ? Math.max(room.width, room.height) : 1;
        let vanished = false;
        for (let step = 0; step < maxRoll; step++) {
          const nx = b.x + b.vx;
          const ny = b.y + b.vy;
          if (!canGroundedBombEnter(room, s, b.x, b.y, nx, ny)) {
            b.vx = 0;
            b.vy = 0;
            break;
          }
          // Ledge drop-off: bomb hops over the cliff face to the open tile below
          const drops = labLedgeDrops(room, s, nx, ny);
          if (drops && moveD) {
            const land = labHopLanding(
              room,
              s,
              b.x,
              b.y,
              b.vx,
              b.vy,
              (lx, ly) => !isOpaqueSolidTile(room, s, lx, ly),
            );
            if (land) {
              b.x = land.x;
              b.y = land.y;
            } else {
              b.vx = 0;
              b.vy = 0;
              break;
            }
          } else {
            b.x = nx;
            b.y = ny;
          }
          if (rawTileAt(room, s, b.x, b.y) === 'g') {
            s.events.push('bomb-grate-pass');
          }

          if (isVeilActiveAt(room, s, b.x, b.y)) {
            s.events.push('bomb-doused');
            vanished = true;
            break;
          }
          if (effectiveTileAt(room, s, b.x, b.y) === '^') {
            s.events.push('bomb-swallowed');
            vanished = true;
            break;
          }
          const springDir = findSpringAt(room, s, b.x, b.y, moveD ?? undefined);
          if (springDir) {
            const [spx, spy] = DIR_DELTA[springDir];
            b.vx = spx;
            b.vy = spy;
            b.airborneSteps = 2;
            b.launchLevel = entityLevelAt(room, s, b.x, b.y);
            s.events.push('bomb-spring-vault');
            break;
          }
          if (!s.frostCells.has(cellKey(b.x, b.y))) {
            // Keep rolling only if still on a chute/grate/current/fan
            const nextT = effectiveTileAt(room, s, b.x, b.y);
            if (!slopeDir(nextT) && nextT !== 'g' && !cd && !gust) {
              b.vx = 0;
              b.vy = 0;
            }
            break;
          }
        }
        if (vanished) continue;
      }
    }

    b.fuse--;
    if (b.fuse <= 0 && b.airborneSteps === 0) {
      detonating.push(b);
    } else {
      survivingBombs.push(b);
    }
  }

  s.bombs = survivingBombs;
  for (const b of detonating) {
    detonateBomb(room, s, b);
  }
  // Chain-detonate any bombs reduced to fuse <= 0 by a second blast
  for (let chainGuard = 0; chainGuard < 8; chainGuard++) {
    const chained = s.bombs.filter((b) => b.fuse <= 0 && b.airborneSteps === 0);
    if (chained.length === 0) break;
    s.bombs = s.bombs.filter((b) => !(b.fuse <= 0 && b.airborneSteps === 0));
    for (const cb of chained) detonateBomb(room, s, cb);
  }

  // 5. Burning Wooden Crates & Grass Fuse Spread + Timed Braziers + Vortices
  const nextIgnitions: Array<[number, number, number]> = [];
  for (const [key, burn] of [...s.burningCells.entries()]) {
    burn.ticks--;
    if (burn.ticks <= 0) {
      s.burningCells.delete(key);
      if (burn.gen < 16) {
        const [xs, ys] = key.split(',');
        const gx = Number(xs);
        const gy = Number(ys);
        for (const dir of DIRS) {
          const [dx, dy] = DIR_DELTA[dir];
          nextIgnitions.push([gx + dx, gy + dy, burn.gen + 1]);
        }
      }
    }
  }

  const survivingProps: PropState[] = [];
  for (const p of s.props) {
    if (p.burnTicks > 0) {
      p.burnTicks--;
      // Burning crate radiates fire to orthogonal neighbors (and 1 extra tile downwind in a Fan!)
      for (const dir of DIRS) {
        const [dx, dy] = DIR_DELTA[dir];
        nextIgnitions.push([p.x + dx, p.y + dy, 0]);
      }
      const pLevel = entityLevelAt(room, s, p.x, p.y);
      const gust = fanField.find((f) => f.x === p.x && f.y === p.y && f.level === pLevel);
      if (gust) {
        const [gdx, gdy] = DIR_DELTA[gust.dir];
        nextIgnitions.push([p.x + gdx * 2, p.y + gdy * 2, 0]);
      }
      if (p.burnTicks <= 0) {
        s.events.push('crate-burned-out');
        continue;
      }
    }
    survivingProps.push(p);
  }
  s.props = survivingProps;

  for (const [ix, iy, gen] of nextIgnitions) {
    if (ix >= 0 && iy >= 0 && ix < room.width && iy < room.height) {
      applyHeatToCell(room, s, ix, iy, gen);
    }
  }

  if (!s.roomSolved) {
    for (const br of s.braziers) {
      if (br.lit && br.timedTicks !== undefined && br.remainingTicks > 0) {
        br.remainingTicks--;
        if (br.remainingTicks <= 0) br.lit = false;
      }
    }
  }
  for (const v of s.vortices) v.remainingTicks--;
  s.vortices = s.vortices.filter((v) => v.remainingTicks > 0);

  // 6. Settle buoyancy, switches/pillars, Unified Lasers, cryo expiry, and Solve Condition
  settleBuoyancy(room, s);
  recomputeSwitchesAndGates(room, s);
  updateLasers(room, s);
  if (s.events.includes('ice-bridge-melt')) {
    settleBuoyancy(room, s);
    updateLasers(room, s);
  }
  if (s.pip.icedTicks > 0) {
    s.pip.icedTicks--;
    if (s.pip.icedTicks === 0 && effectiveTileAt(room, s, s.pip.x, s.pip.y) === '!') {
      s.pip.x = s.pip.safeX;
      s.pip.y = s.pip.safeY;
      s.events.push('pip-spike-reset');
    }
  }
  recomputeSwitchesAndGates(room, s);
  checkSolveCondition(room, s);

  return s.events;
}

function stepCreatures(
  room: LabRoomSpec,
  s: LabState,
  fanField: ReadonlyArray<{ x: number; y: number; dir: Dir; level: 0 | 1 | 2 }>,
): void {
  const squeaks = s.bombs.filter((b) => b.kind === 'squeak' && b.airborneSteps === 0);

  for (const c of s.creatures) {
    if (c.frozenTicks > 0) {
      const cLevel = entityLevelAt(room, s, c.x, c.y);
      const gust = fanField.find((f) => f.x === c.x && f.y === c.y && f.level === cLevel);
      if (gust && s.frostCells.has(cellKey(c.x, c.y))) {
        slideFrozenCreature(room, s, c, gust.dir);
      }
      c.frozenTicks--;
      continue;
    }
    if (c.dazedTicks > 0) {
      c.dazedTicks--;
      continue;
    }

    // Squeak lure within Manhattan/Euclidean reach <= 5
    const lure = squeaks.find((sq) => Math.hypot(sq.x - c.x, sq.y - c.y) <= 5.2);
    if (lure && (c.kind === 'beetle' || c.kind === 'mimic' || c.kind === 'otter')) {
      const dx = Math.sign(lure.x - c.x);
      const dy = Math.sign(lure.y - c.y);
      const candidates: Array<[number, number]> =
        Math.abs(lure.x - c.x) >= Math.abs(lure.y - c.y)
          ? [
              [dx, 0],
              [0, dy],
            ]
          : [
              [0, dy],
              [dx, 0],
            ];
      for (const [sdx, sdy] of candidates) {
        if (sdx === 0 && sdy === 0) continue;
        if (canCreatureStep(room, s, c, c.x + sdx, c.y + sdy)) {
          c.x += sdx;
          c.y += sdy;
          c.dir = dirFromDelta(sdx, sdy) ?? c.dir;
          break;
        }
      }
    } else if (c.kind === 'tortoise') {
      const [dx, dy] = DIR_DELTA[c.dir];
      if (canCreatureStep(room, s, c, c.x + dx, c.y + dy)) {
        c.x += dx;
        c.y += dy;
      } else {
        c.dir = oppositeDir(c.dir);
      }
    }

    // Pack-Otter picks up adjacent/co-located live bomb and ferries it through mouseholes!
    if (c.kind === 'otter') {
      let carried = s.bombs.find((b) => b.carriedByOtterId === c.id);
      if (!carried) {
        const nearby = s.bombs.find(
          (b) =>
            !b.carriedByOtterId &&
            b.kind !== 'squeak' &&
            b.airborneSteps === 0 &&
            Math.abs(b.x - c.x) + Math.abs(b.y - c.y) <= 1,
        );
        if (nearby) {
          nearby.carriedByOtterId = c.id;
          nearby.x = c.x;
          nearby.y = c.y;
          carried = nearby;
          s.events.push('otter-pickup');
        }
      }
      if (carried) {
        const [dx, dy] = DIR_DELTA[c.dir];
        if (canCreatureStep(room, s, c, c.x + dx, c.y + dy)) {
          c.x += dx;
          c.y += dy;
        }
        carried.x = c.x;
        carried.y = c.y;
      }
    }
  }
}

function canCreatureStep(
  room: LabRoomSpec,
  s: LabState,
  c: CreatureState,
  nx: number,
  ny: number,
): boolean {
  if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) return false;
  if (isOpaqueSolidTile(room, s, nx, ny)) return false;
  const t = effectiveTileAt(room, s, nx, ny);
  if (t === '=' || t === 'g' || t === '^' || t === '!') return false;
  if (t === 'm' && c.kind !== 'otter') return false;
  if (labLedgeDrops(room, s, nx, ny) !== null) return false;
  if (liquidKindAt(room, s, nx, ny) === 'deep' && !hasFloatingDeckAt(room, s, nx, ny)) return false;
  if (cargoPropAt(s, nx, ny)) return false;
  if (s.creatures.some((other) => other.id !== c.id && other.x === nx && other.y === ny)) {
    return false;
  }
  return true;
}

function slideFrozenCreature(room: LabRoomSpec, s: LabState, c: CreatureState, dir: Dir): void {
  const [dx, dy] = DIR_DELTA[dir];
  const maxSteps = Math.max(room.width, room.height);
  for (let step = 0; step < maxSteps; step++) {
    const nx = c.x + dx;
    const ny = c.y + dy;
    if (nx < 0 || ny < 0 || nx >= room.width || ny >= room.height) break;
    if (isOpaqueSolidTile(room, s, nx, ny)) break;
    const nt = effectiveTileAt(room, s, nx, ny);
    // Note: Bomb Grate 'g' passes sliding cubes (`P31 Beetle Curling`), '=' and 'm' block!
    if (nt === '=' || nt === 'm' || nt === '^') break;
    if (cargoPropAt(s, nx, ny)) break;
    c.x = nx;
    c.y = ny;
    if (!s.frostCells.has(cellKey(nx, ny)) && nt !== 'g') break;
  }
}

function checkSolveCondition(room: LabRoomSpec, s: LabState): void {
  if (s.roomSolved) return;

  const buttonsSatisfied = (): boolean => {
    const { oPlates } = getRoomSwitchCells(room, s);
    return (
      oPlates.length > 0 && oPlates.every(([ox, oy]) => isSwitchHeldAt(room, s, ox, oy, false))
    );
  };

  const torchesSatisfied = (): boolean => s.braziers.length > 0 && s.braziers.every((b) => b.lit);

  const sensorsSatisfied = (): boolean =>
    Boolean(room.sensors && room.sensors.length > 0) &&
    (room.sensors ?? []).every((sn) => s.activeSensors.has(sn.id));

  let solved = false;
  switch (room.condition) {
    case 'hold-buttons':
      solved = buttonsSatisfied();
      break;
    case 'all-torches':
    case 'ordered-torches':
      solved = torchesSatisfied();
      break;
    case 'sensors':
      solved = sensorsSatisfied();
      break;
    case 'buttons-and-sensors':
      solved = buttonsSatisfied() && sensorsSatisfied();
      break;
    case 'torches-and-sensors':
      solved = torchesSatisfied() && sensorsSatisfied();
      break;
  }

  if (solved) {
    s.roomSolved = true;
    s.events.push('room-solved');
  }
}

// ============================================================================
// High-Level Discrete Player Actions
// ============================================================================

export function reachableWalkCells(room: LabRoomSpec, s: LabState): Array<[number, number]> {
  if (s.pip.icedTicks > 0) return [[s.pip.x, s.pip.y]];
  const startKey = cellKey(s.pip.x, s.pip.y);
  const seen = new Set<string>([startKey]);
  const out: Array<[number, number]> = [];
  const queue: Array<[number, number]> = [[s.pip.x, s.pip.y]];
  const maxCells = room.width * room.height;

  for (let guard = 0; queue.length > 0 && guard < maxCells; guard++) {
    const cur = queue.shift();
    if (!cur) break;
    const [cx, cy] = cur;
    out.push([cx, cy]);
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const nx = cx + dx;
      const ny = cy + dy;
      const key = cellKey(nx, ny);
      if (seen.has(key)) continue;
      if (!canPipStandAt(room, s, nx, ny, cx, cy, false)) continue;
      if (effectiveTileAt(room, s, nx, ny) === 'J') continue;
      // Avoid walking directly into an active Laser ray during pure MoveTo navigation
      const dstL = entityLevelAt(room, s, nx, ny);
      if (s.lastLaserRays.some((r) => r.x === nx && r.y === ny && r.level === dstL)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return out;
}

export function applyLabAction(room: LabRoomSpec, s: LabState, action: LabAction): ActionResult {
  const collectedEvents: string[] = [];

  if (action.kind === 'wait') {
    const n = Math.max(1, Math.min(MAX_SETTLE_TICKS, action.ticks));
    for (let i = 0; i < n; i++) {
      collectedEvents.push(...stepLabTick(room, s));
      if (s.roomSolved) break;
    }
    return { ok: true, ticksElapsed: n, events: collectedEvents };
  }

  if (action.kind === 'settle') {
    const cap = Math.max(1, Math.min(MAX_SETTLE_TICKS, action.maxTicks ?? MAX_SETTLE_TICKS));
    let elapsed = 0;
    for (let i = 0; i < cap; i++) {
      const isBusy =
        s.bombs.length > 0 ||
        s.burningCells.size > 0 ||
        s.props.some((p) => p.burnTicks > 0) ||
        s.pip.icedTicks > 0;
      if (!isBusy && i > 0) break;
      elapsed++;
      collectedEvents.push(...stepLabTick(room, s));
      if (s.roomSolved) break;
    }
    return { ok: true, ticksElapsed: elapsed, events: collectedEvents };
  }

  if (s.pip.icedTicks > 0) {
    return { ok: false, reason: 'pip-iced', ticksElapsed: 0, events: [] };
  }

  if (action.kind === 'face') {
    s.pip.dir = action.dir;
    return { ok: true, ticksElapsed: 0, events: [] };
  }

  if (action.kind === 'step') {
    const [dx, dy] = DIR_DELTA[action.dir];
    s.pip.dir = action.dir;
    const nx = s.pip.x + dx;
    const ny = s.pip.y + dy;

    // 1. Kick a frozen creature cube!
    const frozenCreat = s.creatures.find((c) => c.x === nx && c.y === ny && c.frozenTicks > 0);
    if (frozenCreat) {
      slideFrozenCreature(room, s, frozenCreat, action.dir);
      collectedEvents.push('ice-kick', ...stepLabTick(room, s));
      return { ok: true, ticksElapsed: 1, events: collectedEvents };
    }

    // 2. Walk-push a Wooden Crate or Mirror Block!
    const cargo = cargoPropAt(s, nx, ny);
    if (cargo && (cargo.kind === 'crate' || cargo.kind === 'mirror')) {
      const isFloatingBridge =
        cargo.kind === 'crate' &&
        liquidKindAt(room, s, nx, ny) === 'deep' &&
        !raftAt(s, nx, ny) &&
        !s.frozenWater.has(cellKey(nx, ny));
      if (!isFloatingBridge) {
        const px = nx + dx;
        const py = ny + dy;
        if (!canPropEnterCell(room, s, cargo, px, py)) {
          return { ok: false, reason: 'push-blocked', ticksElapsed: 0, events: [] };
        }
        cargo.x = px;
        cargo.y = py;
        settleBuoyancy(room, s);
        const propSpring = findSpringAt(room, s, cargo.x, cargo.y, action.dir);
        if (propSpring) {
          triggerSpringForProp(room, s, cargo, propSpring);
        } else {
          slidePropIfOnFrost(room, s, cargo, action.dir);
        }
        if (canPipStandAt(room, s, nx, ny, s.pip.x, s.pip.y, false)) {
          s.pip.x = nx;
          s.pip.y = ny;
          s.pip.safeX = nx;
          s.pip.safeY = ny;
          stepMimics(room, s, action.dir);
        }
        collectedEvents.push('prop-push', ...stepLabTick(room, s));
        return { ok: true, ticksElapsed: 1, events: collectedEvents };
      }
    }

    // 3. Hop down a cardinal S/E/W ledge (`ELEVATION.md`)
    if (!canPipStandAt(room, s, nx, ny, s.pip.x, s.pip.y, false)) {
      const hop = labHopLanding(room, s, s.pip.x, s.pip.y, dx, dy, (lx, ly) =>
        canPipStandAt(room, s, lx, ly, undefined, undefined, false),
      );
      if (hop) {
        s.pip.x = hop.x;
        s.pip.y = hop.y;
        s.pip.safeX = hop.x;
        s.pip.safeY = hop.y;
        stepMimics(room, s, action.dir);
        collectedEvents.push('pip-hop', ...stepLabTick(room, s));
        return { ok: true, ticksElapsed: 1, events: collectedEvents };
      }
      return { ok: false, reason: 'step-blocked', ticksElapsed: 0, events: [] };
    }

    s.pip.x = nx;
    s.pip.y = ny;
    s.pip.safeX = nx;
    s.pip.safeY = ny;
    if (isVeilActiveAt(room, s, nx, ny) && s.pip.heldBomb !== null) {
      s.pip.heldBomb = null;
      collectedEvents.push('held-bomb-doused');
    }
    stepMimics(room, s, action.dir);
    const springDir = findSpringAt(room, s, s.pip.x, s.pip.y, action.dir);
    if (springDir) triggerSpringForPip(room, s, springDir);
    if (s.frostCells.has(cellKey(s.pip.x, s.pip.y))) {
      // Normal Pip walks on frost without sliding; only Ice-Pip slides!
    }
    collectedEvents.push(...stepLabTick(room, s));
    return { ok: true, ticksElapsed: 1, events: collectedEvents };
  }

  if (action.kind === 'moveTo') {
    if (s.pip.x === action.x && s.pip.y === action.y) {
      return { ok: true, ticksElapsed: 0, events: [] };
    }
    const path = findWalkPath(room, s, action.x, action.y);
    if (!path) return { ok: false, reason: 'unreachable', ticksElapsed: 0, events: [] };
    // Conservative 60 Hz walking rate: up to 3 connected safe tiles per causal tick (`0.5 s`)
    let ticks = 0;
    for (let i = 0; i < path.length; i++) {
      const stepDir = path[i];
      if (!stepDir) continue;
      const [dx, dy] = DIR_DELTA[stepDir];
      if (!canPipStandAt(room, s, s.pip.x + dx, s.pip.y + dy, s.pip.x, s.pip.y, false)) {
        return {
          ok: false,
          reason: 'path-interrupted',
          ticksElapsed: ticks,
          events: collectedEvents,
        };
      }
      s.pip.dir = stepDir;
      s.pip.x += dx;
      s.pip.y += dy;
      s.pip.safeX = s.pip.x;
      s.pip.safeY = s.pip.y;
      if (isVeilActiveAt(room, s, s.pip.x, s.pip.y) && s.pip.heldBomb !== null) {
        s.pip.heldBomb = null;
        collectedEvents.push('held-bomb-doused');
      }
      stepMimics(room, s, stepDir);
      const springDir = findSpringAt(room, s, s.pip.x, s.pip.y, stepDir);
      if (springDir) {
        triggerSpringForPip(room, s, springDir);
        ticks++;
        collectedEvents.push(...stepLabTick(room, s));
        break;
      }
      if ((i + 1) % 3 === 0 || i === path.length - 1) {
        ticks++;
        collectedEvents.push(...stepLabTick(room, s));
        if (s.roomSolved) break;
      }
    }
    return { ok: true, ticksElapsed: ticks, events: collectedEvents };
  }

  if (action.kind === 'roll') {
    if (s.pip.heldBomb !== null) {
      return { ok: false, reason: 'holding-bomb', ticksElapsed: 0, events: [] };
    }
    const [dx, dy] = DIR_DELTA[action.dir];
    s.pip.dir = action.dir;
    const midX = s.pip.x + dx;
    const midY = s.pip.y + dy;
    const landX = s.pip.x + dx * 2;
    const landY = s.pip.y + dy * 2;
    const midT = effectiveTileAt(room, s, midX, midY);
    const srcL = entityLevelAt(room, s, s.pip.x, s.pip.y);
    const landL = labLevelAt(room, s, landX, landY);

    // Roll leaps a 1-tile pit '^' or crosses a 1-tile spike '!' strip onto same-level floor
    if (
      (midT === '^' ||
        midT === '!' ||
        canPipStandAt(room, s, midX, midY, s.pip.x, s.pip.y, false)) &&
      landL === srcL &&
      canPipStandAt(room, s, landX, landY, undefined, undefined, false)
    ) {
      s.pip.x = landX;
      s.pip.y = landY;
      s.pip.safeX = landX;
      s.pip.safeY = landY;
      collectedEvents.push('pip-roll', ...stepLabTick(room, s));
      return { ok: true, ticksElapsed: 1, events: collectedEvents };
    }
    return { ok: false, reason: 'roll-blocked', ticksElapsed: 0, events: [] };
  }

  if (action.kind === 'pull') {
    if (!room.kit.includes(action.bomb)) {
      return { ok: false, reason: 'not-in-kit', ticksElapsed: 0, events: [] };
    }
    const cap = room.maxActiveBombs ?? 2;
    if (s.pip.heldBomb !== null || s.bombs.length >= cap) {
      return { ok: false, reason: 'bomb-cap', ticksElapsed: 0, events: [] };
    }
    s.pip.heldBomb = action.bomb;
    return { ok: true, ticksElapsed: 0, events: ['bomb-pull'] };
  }

  if (action.kind === 'drop' || action.kind === 'throw') {
    if (s.pip.heldBomb === null) {
      return { ok: false, reason: 'not-holding-bomb', ticksElapsed: 0, events: [] };
    }
    return placeOrThrowHeld(room, s, action.kind, action.dir, collectedEvents);
  }

  // Convenience `actBomb` = pull + drop/throw in one call
  if (!room.kit.includes(action.bomb)) {
    return { ok: false, reason: 'not-in-kit', ticksElapsed: 0, events: [] };
  }
  const cap = room.maxActiveBombs ?? 2;
  if (s.pip.heldBomb !== null || s.bombs.length >= cap) {
    return { ok: false, reason: 'bomb-cap', ticksElapsed: 0, events: [] };
  }
  s.pip.heldBomb = action.bomb;
  return placeOrThrowHeld(room, s, action.how, action.dir, collectedEvents);
}

function placeOrThrowHeld(
  room: LabRoomSpec,
  s: LabState,
  how: 'drop' | 'throw',
  dir: Dir,
  collectedEvents: string[],
): ActionResult {
  const kind = s.pip.heldBomb;
  if (!kind) return { ok: false, reason: 'not-holding-bomb', ticksElapsed: 0, events: [] };
  s.pip.heldBomb = null;
  s.pip.dir = dir;
  const [dx, dy] = DIR_DELTA[dir];

  if (how === 'drop') {
    const aheadX = s.pip.x + dx;
    const aheadY = s.pip.y + dy;
    const placeAhead = canGroundedBombEnter(room, s, s.pip.x, s.pip.y, aheadX, aheadY);
    const bx = placeAhead ? aheadX : s.pip.x;
    const by = placeAhead ? aheadY : s.pip.y;
    const onFrost = s.frostCells.has(cellKey(bx, by));
    s.bombs.push({
      id: s.nextBombId++,
      kind,
      x: bx,
      y: by,
      vx: placeAhead && onFrost ? dx : 0,
      vy: placeAhead && onFrost ? dy : 0,
      fuse: LAB_BOMB_FUSE_TICKS[kind],
      airborneSteps: 0,
      launchLevel: entityLevelAt(room, s, bx, by),
      shoveCount: 0,
    });
    if (rawTileAt(room, s, bx, by) === 'g') {
      collectedEvents.push('bomb-grate-pass');
    }
    collectedEvents.push('bomb-drop', ...stepLabTick(room, s));
    return { ok: true, ticksElapsed: 1, events: collectedEvents };
  }

  // Throw: launches 2 tiles airborne along `dir` (clears `=` fences, `^` pits, and `level 0` rays!)
  s.bombs.push({
    id: s.nextBombId++,
    kind,
    x: s.pip.x,
    y: s.pip.y,
    vx: dx,
    vy: dy,
    fuse: LAB_BOMB_FUSE_TICKS[kind],
    airborneSteps: 2,
    launchLevel: entityLevelAt(room, s, s.pip.x, s.pip.y),
    shoveCount: 0,
  });
  collectedEvents.push('bomb-throw', ...stepLabTick(room, s));
  return { ok: true, ticksElapsed: 1, events: collectedEvents };
}

function stepMimics(room: LabRoomSpec, s: LabState, dir: Dir): void {
  const [dx, dy] = DIR_DELTA[dir];
  const hasActiveSqueak = s.bombs.some((b) => b.kind === 'squeak' && b.airborneSteps === 0);
  if (hasActiveSqueak) return;
  for (const c of s.creatures) {
    if (c.kind === 'mimic' && c.frozenTicks === 0 && c.dazedTicks === 0) {
      if (canCreatureStep(room, s, c, c.x + dx, c.y + dy)) {
        c.x += dx;
        c.y += dy;
        c.dir = dir;
      }
    }
  }
}

function findWalkPath(room: LabRoomSpec, s: LabState, goalX: number, goalY: number): Dir[] | null {
  const startKey = cellKey(s.pip.x, s.pip.y);
  const parent = new Map<string, { prev: string; dir: Dir }>();
  const queue: Array<[number, number]> = [[s.pip.x, s.pip.y]];
  const seen = new Set<string>([startKey]);
  const maxCells = room.width * room.height;

  for (let guard = 0; queue.length > 0 && guard < maxCells; guard++) {
    const cur = queue.shift();
    if (!cur) break;
    const [cx, cy] = cur;
    if (cx === goalX && cy === goalY) {
      const dirs: Dir[] = [];
      let k = cellKey(goalX, goalY);
      for (let back = 0; back < maxCells && k !== startKey; back++) {
        const step = parent.get(k);
        if (!step) break;
        dirs.push(step.dir);
        k = step.prev;
      }
      return dirs.reverse();
    }
    for (const dir of DIRS) {
      const [dx, dy] = DIR_DELTA[dir];
      const nx = cx + dx;
      const ny = cy + dy;
      const key = cellKey(nx, ny);
      if (seen.has(key)) continue;
      if (!canPipStandAt(room, s, nx, ny, cx, cy, false)) continue;
      if (effectiveTileAt(room, s, nx, ny) === 'J') continue;
      const dstL = entityLevelAt(room, s, nx, ny);
      if (s.lastLaserRays.some((r) => r.x === nx && r.y === ny && r.level === dstL)) continue;
      seen.add(key);
      parent.set(key, { prev: cellKey(cx, cy), dir });
      queue.push([nx, ny]);
    }
  }
  return null;
}

// ============================================================================
// ASCII Board Renderer (for rapid debugging & test inspection)
// ============================================================================

export function renderLabAscii(room: LabRoomSpec, s: LabState): string {
  const grid: string[][] = [];
  for (let y = 0; y < room.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < room.width; x++) {
      const key = cellKey(x, y);
      let ch: string = effectiveTileAt(room, s, x, y);
      const liq = liquidKindAt(room, s, x, y);
      if (s.frozenWater.has(key) || s.frostCells.has(key) || s.frozenVeils.has(key)) {
        ch = 'I';
      } else if (liq === 'deep' && ch === ';') {
        ch = '~';
      } else if (liq === 'shallow' && ch === '.') {
        ch = ';';
      } else if (labLedgeDrops(room, s, x, y) !== null) {
        ch = 'H';
      }
      if (hasRockBlockAt(s, x, y)) ch = 'R';
      if (s.burningCells.has(key)) ch = '*';
      row.push(ch);
    }
    grid.push(row);
  }

  for (const ray of s.lastLaserRays) {
    const r = grid[ray.y];
    if (r && r[ray.x] === '.') {
      r[ray.x] = ray.dir === 'E' || ray.dir === 'W' ? '-' : ':';
    }
  }
  for (const br of s.braziers) {
    const r = grid[br.y];
    if (r) r[br.x] = br.lit ? 'T' : 't';
  }
  for (const p of s.props) {
    if (p.submerged) continue;
    const r = grid[p.y];
    if (!r) continue;
    r[p.x] =
      p.kind === 'crate'
        ? p.burnTicks > 0
          ? 'f'
          : 'w'
        : p.kind === 'stone'
          ? 'p'
          : p.kind === 'metal'
            ? 'M'
            : p.kind === 'sphere'
              ? 'o'
              : p.kind === 'mirror'
                ? '/'
                : 'u';
  }
  for (const c of s.creatures) {
    const r = grid[c.y];
    if (r) r[c.x] = c.frozenTicks > 0 ? 'c' : 'E';
  }
  for (const b of s.bombs) {
    const r = grid[b.y];
    if (r) r[b.x] = 'b';
  }
  const pr = grid[s.pip.y];
  if (pr) pr[s.pip.x] = s.pip.icedTicks > 0 ? '@' : 'P';

  return grid.map((r) => r.join('')).join('\n');
}

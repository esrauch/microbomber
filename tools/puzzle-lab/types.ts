/**
 * Standalone Abstracted Puzzle Lab — Types & Room Specification (`PUZZLE_MECHANICS.md`).
 *
 * Pure discrete grid & causal-tick representation decoupled from the 60 Hz continuous engine,
 * designed with conservative geometric and timing contracts so verified rooms backport cleanly
 * to `src/game/world.ts`.
 */

export type Dir = 'N' | 'E' | 'S' | 'W';

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

export const DIR_DELTA: Record<Dir, readonly [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

export function rotateDirCW(dir: Dir, quarterTurns = 1): Dir {
  const idx = DIRS.indexOf(dir);
  const next = (((idx + quarterTurns) % 4) + 4) % 4;
  return DIRS[next] ?? 'N';
}

export function oppositeDir(dir: Dir): Dir {
  return rotateDirCW(dir, 2);
}

export function dirFromDelta(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === -1) return 'N';
  if (dx === 1 && dy === 0) return 'E';
  if (dx === 0 && dy === 1) return 'S';
  if (dx === -1 && dy === 0) return 'W';
  return null;
}

export type LabBombKind = 'bomb' | 'fire' | 'squeak' | 'wind' | 'magnet' | 'ice' | 'rock';

/**
 * Discrete fuse durations in causal ticks.
 * Scaled conservatively (`1 tick ≈ 0.5 s` equivalent causal beat) so a player at 60 Hz always
 * has >= 0.4 s of timing slack on timed runs.
 */
export const LAB_BOMB_FUSE_TICKS: Record<LabBombKind, number> = {
  bomb: 4,
  fire: 3,
  squeak: 5,
  wind: 3,
  magnet: 5,
  ice: 3,
  rock: 3,
};

export const CRATE_BURN_TICKS = 4;
export const GRASS_BURN_TICKS = 2;
export const SELF_CRYO_TICKS = 6;
export const CREATURE_FREEZE_TICKS = 8;
export const CREATURE_DAZE_TICKS = 5;
export const VORTEX_TICKS = 6;

/**
 * ASCII terrain legend for `LabRoomSpec.rows`:
 * - `#` solid wall
 * - `%` cracked wall (broken by `bomb` blast)
 * - `.` open floor
 * - `,` dry grass / powder fuse trail
 * - `B` indoor ice block (melts into `;` shallow water when hit by Fire or Laser)
 * - `=` low fence (blocks Pip, props & grounded bombs; airborne thrown bombs, gusts & rays pass)
 * - `g` slotted bomb grate (blocks Pip, props & throws; grounded rolling/sliding bombs, gusts & rays pass)
 * - `m` mousehole (Pip squeezes through empty-handed `heldBomb === null`; Otter passes; bombs & props blocked)
 * - `|` waterfall douse veil (Pip walks/rolls through; live/held bombs fizzle unless frozen by `ice`)
 * - `^` pit (Pip `Roll` leaps 1-tile gap; `rock` plugs 1 tile; swallows grounded bombs)
 * - `!` spikes (`Roll` crosses 1-tile strip; `Ice-Pip` slides across; `rock` makes stepping stone)
 * - `X` retractable spikes (flat when `gatesOpen`, `!` otherwise)
 * - `~` deep water (floats bombs, wooden crates & rafts; sinks stone/metal; freezes `3x3` via `ice`)
 * - `1` | `2` | `3` | `4` N/S/E/W deep water currents
 * - `;` shallow water (walkable, douses fire/burning crates, freezes into slick curling frost via `ice`)
 * - `O` goal plate (held by Pip, crates/blocks/spheres, or creatures; never by bombs)
 * - `Q` momentary floor switch (held by Pip, crates/blocks/spheres, creatures, or live bombs)
 * - `G` iron gate (open while all `Q` switches are held)
 * - `S` exit/goal shutter (opens when `roomSolved`)
 * - `R` | `U` red / blue crystal barriers
 * - `C` crystal switch (`red <-> blue`, also pulses `'crystal'` turntables)
 * - `N` iron polarity switch (`north <-> south` via `magnet`, also pulses `'polarity'` turntables)
 * - `W` water sluice wheel/crystal (`0 <-> 1` water level when struck by `bomb` or `fire` blast)
 * - `L` raisable floor pillar (`0 <-> +1` level)
 * - `n` | `s` | `e` | `w` slope/chute (or ramp when bridging adjacent elevation levels)
 * - `J` spring pad (`2`-tile ballistic vault, up to `+1` level)
 */
export type LabTile =
  | '#'
  | '%'
  | '.'
  | ','
  | 'B'
  | '='
  | 'g'
  | 'm'
  | 't'
  | '|'
  | '^'
  | '!'
  | 'X'
  | '~'
  | '1'
  | '2'
  | '3'
  | '4'
  | ';'
  | 'O'
  | 'Q'
  | 'G'
  | 'S'
  | 'R'
  | 'U'
  | 'C'
  | 'N'
  | 'W'
  | 'L'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'J';

export type MirrorFacing = 'NE' | 'SE' | 'SW' | 'NW';

export function rotateMirrorCW(f: MirrorFacing, quarterTurns = 1): MirrorFacing {
  const order: readonly MirrorFacing[] = ['NE', 'SE', 'SW', 'NW'];
  const idx = order.indexOf(f);
  const next = (((idx + quarterTurns) % 4) + 4) % 4;
  return order[next] ?? 'NE';
}

/**
 * Reflection of a ray travelling in `rayDir` striking a `90°` Mirror with `facing`:
 * - `'NE'` has mirrored diagonal facing North & East (incoming `S -> E`, incoming `W -> N`);
 *   rays arriving from `N` or `E` hit its opaque fireproof rear faces (`'blocked'`).
 */
export function reflectLaserOnMirror(rayDir: Dir, facing: MirrorFacing): Dir | 'blocked' {
  switch (facing) {
    case 'NE':
      return rayDir === 'S' ? 'E' : rayDir === 'W' ? 'N' : 'blocked';
    case 'SE':
      return rayDir === 'N' ? 'E' : rayDir === 'W' ? 'S' : 'blocked';
    case 'SW':
      return rayDir === 'N' ? 'W' : rayDir === 'E' ? 'S' : 'blocked';
    case 'NW':
      return rayDir === 'S' ? 'W' : rayDir === 'E' ? 'N' : 'blocked';
  }
}

export type PropKind = 'crate' | 'stone' | 'metal' | 'sphere' | 'mirror' | 'raft';

export interface PropSpec {
  id?: string;
  kind: PropKind;
  x: number;
  y: number;
  /** Required when `kind === 'mirror'`. */
  facing?: MirrorFacing;
  /** Optional initial frost armor coat on `'crate'`. */
  frosted?: boolean;
}

export interface BrazierSpec {
  id?: string;
  x: number;
  y: number;
  lit?: boolean;
  order?: number;
  timedTicks?: number;
}

/**
 * Unified Laser Emitter: acts simultaneously as Signal (powers `BeamSensorSpec`) and Fire
 * (ignites un-frosted crates & `,` fuses, melts ice, thaws `Ice-Pip`/frosted props, pops Pip back).
 */
export interface LaserSpec {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  level: 0 | 1 | 2;
  turntableId?: string;
}

export interface BeamSensorSpec {
  id: string;
  x: number;
  y: number;
  level: 0 | 1 | 2;
  /** When true, satisfied while the Laser does NOT reach this sensor (eclipsed/shuttered). */
  inverted?: boolean;
  /** Optional latch: once satisfied on any tick, stays satisfied for the room visit. */
  latch?: boolean;
  /** Optional sink: rising edge flips room `waterLevel` (`0 <-> 1`). */
  togglesSluice?: boolean;
  /** Optional sink: rising edge rotates a turntable `90°` CW. */
  pulsesTurntableId?: string;
}

export interface FanSpec {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  level: 0 | 1 | 2;
  range?: number;
  /** If `'gates'`, blows only while `gatesOpen`; if `'inverted-gates'`, blows while `!gatesOpen`. */
  gateMode?: 'always' | 'gates' | 'inverted-gates';
  turntableId?: string;
}

export interface SpringSpec {
  x: number;
  y: number;
  /** Fixed launch direction; if omitted, launches along the actor/prop's entry direction. */
  dir?: Dir;
}

export interface SwitchSpec {
  x: number;
  y: number;
  kind: 'Q' | 'O';
}

export interface TurntableSpec {
  id: string;
  cx: number;
  cy: number;
  size: 1 | 3;
  trigger: 'crystal' | 'polarity' | 'sensor';
}

export interface SluiceSpec {
  initial: 0 | 1;
  /**
   * Optional explicit basin cells affected by `waterLevel = 1` (`dry '.' -> ';'`, `';' -> '~'`).
   * If omitted, every level-`0` cell in the room belongs to the floodable basin.
   */
  basinCells?: readonly (readonly [number, number])[];
  /** If true, waterfall veils `|` shut off while `waterLevel === 0`. */
  drainsVeilsWhenLow?: boolean;
}

export type CreatureKind = 'beetle' | 'mimic' | 'tortoise' | 'otter' | 'cart';

export interface CreatureSpec {
  id?: string;
  kind: CreatureKind;
  x: number;
  y: number;
  /** Initial patrol axis for `'tortoise'` or runnel facing for `'otter'`. */
  dir?: Dir;
}

export type SolveCondition =
  | 'hold-buttons'
  | 'all-torches'
  | 'ordered-torches'
  | 'sensors'
  | 'buttons-and-sensors'
  | 'torches-and-sensors';

export type PillarTrigger = 'switches' | 'red' | 'blue';

export interface PillarSpec {
  x: number;
  y: number;
  trigger: PillarTrigger;
}

export interface LabRoomSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  rows: readonly string[];
  levels?: readonly string[];
  entry: readonly [number, number];
  kit: readonly LabBombKind[];
  maxActiveBombs?: number;
  condition: SolveCondition;
  initialCrystal?: 'red' | 'blue';
  initialPolarity?: 'north' | 'south';
  pillars?: PillarTrigger;
  pillarSpecs?: readonly PillarSpec[];
  sluice?: SluiceSpec;
  props?: readonly PropSpec[];
  braziers?: readonly BrazierSpec[];
  lasers?: readonly LaserSpec[];
  sensors?: readonly BeamSensorSpec[];
  fans?: readonly FanSpec[];
  springs?: readonly SpringSpec[];
  switches?: readonly SwitchSpec[];
  turntables?: readonly TurntableSpec[];
  creatures?: readonly CreatureSpec[];
}

// ============================================================================
// Live Mutable Simulation State
// ============================================================================

export interface PropState {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  facing?: MirrorFacing;
  frosted: boolean;
  /** True when a heavy non-buoyant prop (`stone`/`metal`/`sphere`) has sunk into deep water. */
  submerged: boolean;
  /** `0` when not burning; counts down `CRATE_BURN_TICKS -> 0` then removes crate. */
  burnTicks: number;
  /** Sliding velocity on slick frost / fan / recoil (`[-1..1, -1..1]`). */
  vx: number;
  vy: number;
}

export interface BombState {
  id: number;
  kind: LabBombKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  /** Remaining airborne tiles during a throw/spring/vortex arc (`0` when grounded). */
  airborneSteps: number;
  /** Elevation level at launch when airborne. */
  launchLevel: number;
  shoveCount: number;
  carriedByOtterId?: string;
}

export interface BrazierState {
  id: string;
  x: number;
  y: number;
  lit: boolean;
  order?: number;
  timedTicks?: number;
  remainingTicks: number;
}

export interface CreatureState {
  id: string;
  kind: CreatureKind;
  x: number;
  y: number;
  dir: Dir;
  frozenTicks: number;
  dazedTicks: number;
  vx: number;
  vy: number;
}

export interface VortexState {
  x: number;
  y: number;
  dir: Dir;
  remainingTicks: number;
}

export interface LaserRaySegment {
  x: number;
  y: number;
  dir: Dir;
  level: 0 | 1 | 2;
}

export interface LabState {
  tick: number;
  pip: {
    x: number;
    y: number;
    safeX: number;
    safeY: number;
    dir: Dir;
    heldBomb: LabBombKind | null;
    icedTicks: number;
    vx: number;
    vy: number;
  };
  crystalColor: 'red' | 'blue';
  polarity: 'north' | 'south';
  waterLevel: 0 | 1;
  pillarsUp: boolean;
  gatesOpen: boolean;
  roomSolved: boolean;
  orderedStep: number;
  nextBombId: number;

  /** Dynamic cell mutations keyed by `"x,y"`. */
  brokenWalls: Set<string>;
  meltedBlocks: Set<string>;
  puddleCells: Set<string>;
  filledCells: Set<string>;
  burnedGrass: Set<string>;
  burningCells: Map<string, { ticks: number; gen: number }>;
  frozenWater: Set<string>;
  frostCells: Set<string>;
  frozenVeils: Set<string>;
  rockCell: readonly [number, number] | null;

  /** Turntable cumulative quarter-turns (`0..3`) keyed by `turntable.id`. */
  turntableTurns: Map<string, number>;
  /** Chute/ramp cells rotated by turntables, overriding `room.rows` at `"x,y"`. */
  rotatedTiles: Map<string, LabTile>;
  /** Sensor latch & previous-tick live state keyed by `sensor.id`. */
  latchedSensors: Set<string>;
  activeSensors: Set<string>;

  props: PropState[];
  bombs: BombState[];
  braziers: BrazierState[];
  creatures: CreatureState[];
  vortices: VortexState[];
  lastLaserRays: LaserRaySegment[];
  events: string[];
}

export type LabAction =
  | { kind: 'step'; dir: Dir }
  /** Turn in place without moving (0 ticks), mirroring the 60 Hz game's stand-and-aim. */
  | { kind: 'face'; dir: Dir }
  | { kind: 'moveTo'; x: number; y: number }
  | { kind: 'roll'; dir: Dir }
  | { kind: 'pull'; bomb: LabBombKind }
  | { kind: 'drop'; dir: Dir }
  | { kind: 'throw'; dir: Dir }
  | { kind: 'actBomb'; bomb: LabBombKind; how: 'drop' | 'throw'; dir: Dir }
  | { kind: 'wait'; ticks: number }
  | { kind: 'settle'; maxTicks?: number };

export interface ActionResult {
  ok: boolean;
  reason?: string;
  ticksElapsed: number;
  events: string[];
}

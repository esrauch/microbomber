/**
 * Pure data types for microbomber's simulation (`src/game/`).
 * Free of rendering and DOM APIs so the entire campaign and boss logic
 * can be simulated and verified headlessly in Vitest.
 */

/** Portrait one-screen room dimensions (odd width & height so doors/altars centre cleanly). */
export const ROOM_W = 11;
export const ROOM_H = 13;

export type ZoneId = 'overworld' | 'ice-cave';

export type BombKind = 'bomb' | 'fire';

/**
 * Room ASCII tile legend:
 * '.' open floor (meadow grass in Overworld, stone flagstone in Shrines)
 * ':' dirt trail / cobble path (walkable floor, autotiled with curved edges)
 * '_' wooden / stone bridge deck (walkable floor spanning water or pits)
 * '#' solid cliff / 2-tile-deep dungeon stone wall
 * 'Y' solid forest tree (Overworld, auto-paired into 2×2 interlocking canopies)
 * '%' cracked wall / cliff seam (always visibly seamed; broken by Bomb)
 * '~' water (blocks walking; airborne bombs pass over it)
 * ';' shallow water (walkable with wading ripples & reflections; douses fire)
 * '^' bottomless pit (blocks walking; knockback into pit costs 1 half-heart; airborne bombs pass over)
 * '=' low fence / stone balustrade (blocks walking and rolling bombs; airborne bombs pass over)
 * 'B' dry brambles (blocks walking; burned away by Fire)
 * 'W' wooden crate (blocks walking; broken by Bomb or burned by Fire)
 * 'R' red crystal barrier (raised when crystal === 'red', flat when 'blue')
 * 'U' blue crystal barrier (raised when crystal === 'blue', flat when 'red')
 * 'C' crystal switch orb (solid pedestal; any bomb blast toggles red <-> blue)
 * 'T' brazier / torch (solid pedestal; lit by a Fire blast)
 * 'D' locked key door (solid until unlocked with 1 Small Key)
 * 'K' boss key door (solid until unlocked with the Shrine's Boss Key)
 * 'S' shutter door (solid while the room's puzzle/combat lock is active)
 * 'O' floor button (opens shutter / spawns reward when stepped on or weighted by a push block)
 * '!' floor spikes (deal 1 half-heart hazard damage on contact)
 * '>' stair / warp portal (transitions between zones or midpoint warp pad)
 * 'n' | 's' | 'e' | 'w' directional stone slope / chute (rolls grounded bombs downhill N/S/E/W)
 * ',' dry autumn grass (walkable; ignites and spreads fire tile-by-tile, burning down to '.')
 * '1' | '2' | '3' | '4' directional water currents (N, S, E, W; block walking, float & drift bombs)
 */
export type Tile =
  | '.'
  | ','
  | ':'
  | '_'
  | '#'
  | 'Y'
  | '%'
  | '~'
  | ';'
  | '1'
  | '2'
  | '3'
  | '4'
  | '^'
  | '='
  | 'B'
  | 'W'
  | 'R'
  | 'U'
  | 'C'
  | 'T'
  | 'D'
  | 'K'
  | 'S'
  | 'O'
  | '!'
  | '>'
  | 'n'
  | 's'
  | 'e'
  | 'w';

export type StampId =
  'bram-workshop' | 'rusted-smithy' | 'crypt-mausoleum' | 'spire-gate' | 'spire-seal';

export interface StampSpec {
  id: StampId;
  x: number;
  y: number;
}

export type CrystalColor = 'red' | 'blue';

export type EnemyKind = 'slime' | 'bat' | 'shielder' | 'wickgeist' | 'cinderhull';

export type PickupKind =
  | 'small-key'
  | 'boss-key'
  | 'fire-bomb'
  | 'heart-shard'
  | 'heart-container'
  | 'satchel-upgrade'
  | 'cinder-core'
  | 'heart-drop';

export interface PortalSpec {
  x: number;
  y: number;
  targetZone: ZoneId;
  targetRx: number;
  targetRy: number;
  targetX: number;
  targetY: number;
  /** If true, this portal is the Shrine midpoint warp pad (active only once unlocked). */
  requiresWarpUnlock?: boolean;
  label?: string;
}

export interface TorchSpec {
  x: number;
  y: number;
  /** Optional 1-based sequence order (1, 2, 3) for ordered-brazier puzzles. */
  order?: number;
  /** If set, torch burns out after this many seconds unless all torches finish the puzzle. */
  timedSeconds?: number;
  /** Starts already lit on room entry. */
  initiallyLit?: boolean;
  /** Always-lit room light, never part of a brazier puzzle (so no crypt room is pitch dark). */
  decor?: boolean;
}

export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  y: number;
}

export interface NpcSpec {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  dialogue: string;
  /** Alternate dialogue shown once Ice Cave's Cinder Core is reclaimed. */
  afterCinderDialogue?: string;
}

export interface PickupSpec {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  /** If true, spawns only after the room's puzzle/combat condition completes. */
  spawnOnSolve?: boolean;
}

export type RoomCondition =
  | 'none'
  | 'clear-enemies'
  | 'all-torches'
  | 'ordered-torches'
  | 'hold-buttons'
  | 'miniboss'
  | 'boss';

export interface RoomSpec {
  zone: ZoneId;
  rx: number;
  ry: number;
  name: string;
  /** Optional short objective hint shown in the corner HUD. */
  objective?: string;
  /** ROOM_H strings of ROOM_W characters. `'P'` in rows spawns a pushable stone block on `'.'`. */
  rows: string[];
  /** Room starts dark until lit by braziers or live Fire fire. */
  dark?: boolean;
  /** Condition that opens `'S'` shutter doors and/or spawns `spawnOnSolve` pickups. */
  condition?: RoomCondition;
  torches?: TorchSpec[];
  enemies?: EnemySpawn[];
  npcs?: NpcSpec[];
  pickups?: PickupSpec[];
  portals?: PortalSpec[];
  /** Multi-tile visual setpiece stamps placed over underlying solid/floor tiles. */
  stamps?: StampSpec[];
  /** Optional ambient wind vector `(dx, dy)` in tiles/s carrying smoke, fire & light objects. */
  wind?: { dx: number; dy: number };
  /** Fourfold Tower barrier room: blocks north passage until all 4 Cores (or Cinder demo note) are checked. */
  spireSeal?: boolean;
}

export interface World {
  rooms: Map<string, RoomSpec>;
}

export interface Bomb {
  id: number;
  kind: BombKind;
  /** Current world position in tiles (tile centres are `k + 0.5`). */
  x: number;
  y: number;
  /** Planar velocity in tiles / second (rolling, kicked, bounced, or blast-shoved). */
  vx: number;
  vy: number;
  /** Vertical height above floor in tiles (`0` when grounded, `> 0` during lob/bounce). */
  z: number;
  /** Vertical velocity in tiles / second. */
  vz: number;
  /** Remaining fuse in seconds (counts down while grounded, airborne, or rolling). */
  fuse: number;
  /** True while the player is still overlapping a freshly dropped/landed bomb. */
  graceOverlap: boolean;
  /** Number of blast shoves absorbed; a shoved bomb (`>= 1`) hit again chain-detonates. */
  shoveCount: number;
  /** True while rolling from Pip's kick (enables Bomb enemy impact detonation). */
  kicked?: boolean;
}

export interface FirePatch {
  x: number; // integer tile x
  y: number; // integer tile y
  remaining: number; // seconds left
  tickCooldown: number;
  /** Seconds until this patch attempts to ignite adjacent flammable tiles (',', 'B', 'W'). */
  spreadTimer?: number;
  /** Bounded spread hop count (`0..MAX_FIRE_GENERATION`) so fire spread always terminates. */
  generation?: number;
}

export interface WindGust {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  remaining: number;
}

export type EnemyAiState = 'patrol' | 'notice' | 'chase' | 'windup' | 'flee' | 'recover';

export interface PushBlock {
  x: number; // integer tile x (slides smoothly via anim or discrete push)
  y: number; // integer tile y
  pushCharge: number;
  pushDirX: number;
  pushDirY: number;
}

export interface TorchState {
  x: number;
  y: number;
  order?: number;
  timedSeconds?: number;
  /** Always-lit room light that brazier puzzles ignore. */
  decor?: boolean;
  lit: boolean;
  timer: number; // remaining seconds if timed and not yet locked
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  /** True while protected by wooden shield (`shielder`) or thorn-vine wraps (`cinderhull`). */
  armored: boolean;
  /** Seconds remaining in exposed/vulnerable state (`cinderhull` after Fire burn, or stun). */
  exposedTimer: number;
  invulnTimer: number;
  aiTimer: number;
  phase: number;
  /** Systemic AI state machine (`patrol`, `notice`, `chase`, `windup`, `flee`, `recover`). */
  aiState: EnemyAiState;
  stateTimer: number;
  stumbleTimer: number;
  homeX: number;
  homeY: number;
  /** Generation count for fire-split slimes (`0`/undefined = full slime, `1` = mini-slime). */
  splitGen?: number;
}

export interface ActivePickup {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
}

export type BlastShape = 'single' | 'hub' | 'armH' | 'armV' | 'capN' | 'capS' | 'capE' | 'capW';

export interface BlastVisual {
  x: number;
  y: number;
  kind: BombKind;
  shape?: BlastShape;
}

export interface Input {
  /** Analogue movement vector (-1..1 each). */
  dx: number;
  dy: number;
  /** B = Roll (`GAME.md` §2 & §10): dodge ~2 tiles in 0.25s (lays no bomb). */
  holdB?: boolean;
  /** A = Place (`GAME.md` §2): a press puts the equipped bomb just ahead of Pip. */
  holdA?: boolean;
}

export interface State {
  zone: ZoneId;
  rx: number;
  ry: number;
  /** Player position in room tiles (`0..ROOM_W`, `0..ROOM_H`). */
  x: number;
  y: number;
  /** Unit facing vector (defaults to `(0, -1)` north). */
  fx: number;
  fy: number;
  /** Continuous 360° unit aim vector for analog Throw & Roll. */
  aimX: number;
  aimY: number;
  /** Entry doorway snapshot for instant room-doorway respawn on death (`GAME.md` §1). */
  entryX: number;
  entryY: number;
  /** Knockback velocity applied by self-blasts or enemy hits. */
  vx: number;
  vy: number;
  invulnTimer: number;
  portalCooldown: number;
  /** Seconds until another new bomb can be dropped or lobbed (stops spamming the satchel). */
  bombCooldown: number;

  /** Active dodge-roll state (`B = Roll`: 0.25s burst, middle 0.15s i-frames, 0.35s recovery). */
  rollTimer: number;
  rollRecoveryTimer: number;
  rollDirX: number;
  rollDirY: number;

  /** Button edges & 100-150ms input forgiveness buffers. */
  prevHoldB: boolean;
  prevHoldA: boolean;
  rollBufferTimer: number;
  placeBufferTimer: number;

  /** Health in half-hearts (`6` = 3 full hearts; `20` = 10 full hearts). */
  hp: number;
  maxHp: number;
  heartShards: number;

  /** Unlocked bombs and the single equipped bomb that A pulls out (`null` = None). */
  unlockedBombs: BombKind[];
  equipped: BombKind | null;
  maxBombs: number;
  blastRadius: number;

  /** Dungeon & plot inventory. */
  smallKeys: number;
  hasBossKey: boolean;
  cryptWarpUnlocked: boolean;
  cores: string[];

  /** Persistent world mutations (`"zone:rx,ry"` or `"zone:rx,ry:x,y"`). */
  visitedRooms: Set<string>;
  brokenTiles: Set<string>;
  burnedTiles: Set<string>;
  openedDoors: Set<string>;
  solvedRooms: Set<string>;
  collectedPickups: Set<string>;
  crystalColor: CrystalColor;
  spireCinderSlotted: boolean;

  /** Live per-room entities (repopulated on room cut). */
  nextEntityId: number;
  bombs: Bomb[];
  fires: FirePatch[];
  gusts: WindGust[];
  blocks: PushBlock[];
  torches: TorchState[];
  orderedStep: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: ActivePickup[];
  roomSolved: boolean;

  /** Transient frame events for UI / audio / renderer. */
  blasts: BlastVisual[];
  events: string[];
  bannerText: string | null;
  bannerTimer: number;
}

export interface SaveData {
  version: 3;
  zone: ZoneId;
  rx: number;
  ry: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  heartShards: number;
  unlockedBombs: BombKind[];
  equipped: BombKind | null;
  maxBombs: number;
  blastRadius: number;
  smallKeys: number;
  hasBossKey: boolean;
  cryptWarpUnlocked: boolean;
  cores: string[];
  visitedRooms: string[];
  brokenTiles: string[];
  burnedTiles: string[];
  openedDoors: string[];
  solvedRooms: string[];
  collectedPickups: string[];
  crystalColor: CrystalColor;
  spireCinderSlotted: boolean;
}

/**
 * Core headless simulation for microbomber (`GAME.md`).
 * Pure TypeScript data & rules (no rendering or DOM) so movement, bombs,
 * puzzles, enemies, bosses, and autosave are 100% testable in Vitest.
 */
import { campaignWorld, roomKey } from './campaign';
import {
  hasLevels,
  hopLanding,
  isPillarMoving,
  isPillarTile,
  isRampTile,
  ledgeDrops,
  levelAt,
} from './elevation';
import {
  type ActivePickup,
  type BlastShape,
  type Bomb,
  type BombKind,
  type Enemy,
  type EnemyAiState,
  type FirePatch,
  type Input,
  ROOM_H,
  ROOM_W,
  type RoomSpec,
  type SaveData,
  type State,
  type Tile,
  type WindGust,
  type World,
  type ZoneId,
  type PillarTrigger,
  type PillarState,
} from './types';

export { ROOM_H, ROOM_W, campaignWorld, roomKey };
export type {
  BombKind,
  Enemy,
  EnemyAiState,
  FirePatch,
  Input,
  RoomSpec,
  SaveData,
  State,
  Tile,
  WindGust,
  World,
  ZoneId,
};

export const FIXED_DT = 1 / 60; // 60 Hz deterministic simulation step
export const SPEED = 3.15; // tiles / second
export const BOMB_FUSE = 3.0; // seconds
export const FIRE_FUSE = 2.6; // seconds
export const ALL_BOMBS: readonly BombKind[] = [
  'bomb',
  'fire',
  'squeak',
  'wind',
  'magnet',
  'ice',
  'rock',
] as const;
export const BOMB_FUSES: Record<BombKind, number> = {
  bomb: BOMB_FUSE,
  fire: FIRE_FUSE,
  squeak: 5.0,
  wind: 1.6,
  magnet: 3.0,
  ice: 2.6,
  rock: 2.0,
};
// Lingering effects run long so a room is about planning, not reflexes
export const SQUEAK_DAZE = 5.0; // seconds a Squeak pop dazes nearby creatures
export const WHIRLWIND_DURATION = 5.0; // seconds a Wind Bomb's whirlwind lingers
export const FREEZE_DURATION = 8.0; // seconds an Ice Bomb keeps a creature frozen
/** Heart Pieces (quarters) that make one more heart. */
export const HEART_PIECES_PER_HEART = 4;
export const FIRE_DURATION = 5.0; // seconds a Fire hearth patch burns
export const BOMB_COOLDOWN = 0.7; // seconds between placing new bombs
export const ROLL_DURATION = 0.25; // seconds in dodge roll
export const ROLL_DISTANCE = 2.0; // tiles covered per dodge roll
export const ROLL_IFRAME_START = 0.05; // seconds into roll where i-frames start
export const ROLL_IFRAME_END = 0.2; // seconds into roll where i-frames end (middle 0.15s)
export const ROLL_RECOVERY = 0.35; // seconds after roll ends before next roll
export const INPUT_BUFFER_WINDOW = 0.13; // 130ms input forgiveness window
export const PICKUP_MAGNET_RADIUS = 1.15; // ~1 tile centre-to-centre pickup magnet radius
export const BOMB_RADIUS = 0.12; // planar bomb collision radius in tiles
export const BOMB_FRICTION = 13.5; // tiles/s² ground deceleration
export const BOMB_WALL_BOUNCE = 0.65; // wall restitution coefficient
export const BOMB_GRAVITY = 24.0; // tiles/s² vertical gravity
export const KICK_SPEED = 6.8; // planar speed imparted when throwing an overhead bomb
export const THROW_LOB_VZ = 2.6; // vertical hop velocity imparted when throwing an overhead bomb (clears '=' fences)
export const SHOVE_BOMB_SPEED = 8.4; // planar impulse speed imparted to a blast-shoved bomb
export const SLOPE_ACCEL = 22.0; // tiles/s² downhill acceleration on 'n' | 's' | 'e' | 'w' slope tiles
export const SLOPE_MAX_SPEED = 8.2; // terminal downhill roll speed on slopes
export const BUTTON_CONTACT_RADIUS = 0.58; // centre-to-centre contact radius for 'O' floor buttons
export const BLAST_CONTACT_PADDING = 0.68; // reach + BLAST_CONTACT_PADDING continuous blast trigger radius

export const MAX_FIRE_GENERATION = 6;
export const FIRE_SPREAD_INTERVAL = 0.72;
export const CURRENT_SPEED = 1.4; // tiles / s: half speed, so a doubled fuse floats as far
export const ENEMY_NOTICE_RADIUS = 5.2;
export const ENEMY_FLEE_RADIUS = 2.1;

const ROLL_SPEED = ROLL_DISTANCE / ROLL_DURATION;
const PLAYER_RADIUS = 0.14;
const PLAYER_SLOPE_DRIFT = 0.75;
const CORNER_SLIDE_MAX = 0.42;
/** Stick magnitude below which a move doesn't re-aim (thumb drift as it lifts off). */
const AIM_MIN_INPUT = 0.22;

const firePatchTorchContacts = new WeakMap<State, WeakMap<object, Set<string>>>();
const floatingBombIds = new WeakMap<State, Set<number>>();
const catapultedBombIds = new WeakMap<State, Set<number>>();

function getFloatingBombs(s: State): Set<number> {
  let set = floatingBombIds.get(s);
  if (!set) {
    set = new Set();
    floatingBombIds.set(s, set);
  }
  return set;
}

function getCatapultedBombs(s: State): Set<number> {
  let set = catapultedBombIds.get(s);
  if (!set) {
    set = new Set();
    catapultedBombIds.set(s, set);
  }
  return set;
}

function getFireTorchContacts(s: State, patch: object): Set<string> {
  let byPatch = firePatchTorchContacts.get(s);
  if (!byPatch) {
    byPatch = new WeakMap();
    firePatchTorchContacts.set(s, byPatch);
  }
  let set = byPatch.get(patch);
  if (!set) {
    set = new Set();
    byPatch.set(patch, set);
  }
  return set;
}

/** Downhill unit vector for `'n' | 's' | 'e' | 'w'` slope tiles, or `null` for non-slopes. */
export function slopeVector(t: Tile): { dx: number; dy: number } | null {
  switch (t) {
    case 'n':
      return { dx: 0, dy: -1 };
    case 's':
      return { dx: 0, dy: 1 };
    case 'e':
      return { dx: 1, dy: 0 };
    case 'w':
      return { dx: -1, dy: 0 };
    default:
      return null;
  }
}

/** True for still deep water (`'~'`) and directional water currents (`'1'..'4'`). */
export function isWaterTile(t: Tile): boolean {
  return t === '~' || t === '1' || t === '2' || t === '3' || t === '4';
}

/** True for walkable shallow water (`';'`). */
export function isShallowWaterTile(t: Tile): boolean {
  return t === ';';
}

/** Unit flow vector for `'1'..'4'` water current tiles (N, S, E, W), or `null` otherwise. */
export function currentVector(t: Tile): { dx: number; dy: number } | null {
  switch (t) {
    case '1':
      return { dx: 0, dy: -1 };
    case '2':
      return { dx: 0, dy: 1 };
    case '3':
      return { dx: 1, dy: 0 };
    case '4':
      return { dx: -1, dy: 0 };
    default:
      return null;
  }
}

/** Spawn a transient radial/directional wind gust that pushes smoke, fire, bombs & pickups. */
export function spawnWindGust(
  s: State,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius = 2.8,
  duration = 0.55,
  vortex = false,
): void {
  s.gusts.push({
    x,
    y,
    dx,
    dy,
    radius,
    remaining: duration,
    ...(vortex ? { vortex: true } : {}),
  });
  s.events.push('wind-gust');
}

/** Net wind vector at `(x, y)` combining ambient room wind with active radial falloff gusts. */
export function windVectorAt(
  world: World,
  s: State,
  x: number,
  y: number,
): { dx: number; dy: number } {
  const ambient = currentRoom(world, s)?.wind;
  if (ambient && (Math.abs(ambient.dx) > 1e-4 || Math.abs(ambient.dy) > 1e-4)) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    for (const blk of s.blocks) {
      if (!blk.rock) continue;
      if (Math.abs(ambient.dx) >= Math.abs(ambient.dy)) {
        const sign = Math.sign(ambient.dx);
        const dTile = (tx - blk.x) * sign;
        const dCont = (x - (blk.x + 0.5)) * sign;
        if (
          (ty === blk.y || Math.abs(y - (blk.y + 0.5)) < 0.75) &&
          ((dTile >= 0 && dTile <= 4) || (dCont >= -0.5 && dCont <= 4.5))
        ) {
          return { dx: 0, dy: 0 };
        }
      } else {
        const sign = Math.sign(ambient.dy);
        const dTile = (ty - blk.y) * sign;
        const dCont = (y - (blk.y + 0.5)) * sign;
        if (
          (tx === blk.x || Math.abs(x - (blk.x + 0.5)) < 0.75) &&
          ((dTile >= 0 && dTile <= 4) || (dCont >= -0.5 && dCont <= 4.5))
        ) {
          return { dx: 0, dy: 0 };
        }
      }
    }
  }
  let dx = ambient?.dx ?? 0;
  let dy = ambient?.dy ?? 0;
  for (const g of s.gusts) {
    if (g.remaining <= 0 || g.radius <= 0) continue;
    const dist = Math.hypot(x - g.x, y - g.y);
    if (dist < g.radius) {
      const weight = 1 - dist / g.radius;
      dx += g.dx * weight;
      dy += g.dy * weight;
    }
  }
  return { dx, dy };
}

export function cellKey(zone: ZoneId, rx: number, ry: number, x: number, y: number): string {
  return `${zone}:${rx},${ry}:${x},${y}`;
}

export function currentRoom(
  world: World,
  s: Pick<State, 'zone' | 'rx' | 'ry'>,
): RoomSpec | undefined {
  return world.rooms.get(roomKey(s.zone, s.rx, s.ry));
}

/** Effective tile at `(x, y)` in `(zone, rx, ry)` after accounting for broken/burned/opened state. */
export function tileAt(
  world: World,
  s: Pick<
    State,
    | 'brokenTiles'
    | 'burnedTiles'
    | 'frozenTiles'
    | 'openedDoors'
    | 'crystalColor'
    | 'roomSolved'
    | 'solvedRooms'
    | 'gatesOpen'
    | 'pillars'
  >,
  zone: ZoneId,
  rx: number,
  ry: number,
  x: number,
  y: number,
): Tile {
  const room = world.rooms.get(roomKey(zone, rx, ry));
  const raw = room?.rows[y]?.[x] ?? '#';
  if (raw === 'P' || raw === 'M') return '.';
  const t = raw as Tile;
  const ck = cellKey(zone, rx, ry, x, y);
  if (s.frozenTiles?.has(ck) && (isWaterTile(t) || t === ';' || t === '!' || t === '^')) {
    return '.';
  }
  if ((t === '%' || t === 'W' || t === ';' || t === '!') && s.brokenTiles.has(ck)) return '.';
  if ((t === ',' || t === 'B' || t === 'W') && s.burnedTiles.has(ck)) return '.';
  if ((t === 'D' || t === 'K') && s.openedDoors.has(ck)) return '.';
  if (t === 'S' && (s.roomSolved || s.solvedRooms.has(roomKey(zone, rx, ry)))) return '.';
  if (t === 'G' && s.gatesOpen) return '.';
  // Retractable spikes are plain spikes until the room's switches sink them
  if (t === 'X') return s.gatesOpen ? '.' : '!';
  // A moving pillar is solid to everything but what rides it
  if (t === 'L' && isPillarMoving(s, x, y)) return 'H';
  if (room?.levels && ledgeDrops(room, s, x, y)) return 'H';
  return t;
}

/** Whether tile `t` blocks ground walking for the player and non-flying enemies. */
export function isTileSolidForWalk(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (
    t === '.' ||
    t === ',' ||
    t === ':' ||
    t === '_' ||
    t === ';' ||
    t === 'O' ||
    t === 'Q' ||
    t === 'L' ||
    t === '!' ||
    t === '>' ||
    slopeVector(t) !== null
  ) {
    return false;
  }
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return true;
}

/** Whether a push block (`'P'`) may slide onto tile `t`. */
function isPushBlockFloor(t: Tile): boolean {
  return (
    t === '.' ||
    t === ',' ||
    t === ':' ||
    t === '_' ||
    t === 'O' ||
    t === 'Q' ||
    t === 'L' ||
    slopeVector(t) !== null
  );
}

/** Whether tile `t` is a tall wall that stops an airborne bomb. */
function isTallWall(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (
    t === '#' ||
    t === 'Y' ||
    t === '%' ||
    t === 'D' ||
    t === 'K' ||
    t === 'S' ||
    t === 'G' ||
    t === 'H'
  ) {
    return true;
  }
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return false;
}

/** Whether a room is currently illuminated (true for normal rooms, or dark rooms with a lit torch). */
export function isRoomLit(world: World, s: State): boolean {
  const room = currentRoom(world, s);
  if (!room?.dark) return true;
  if (s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry))) return true;
  if (s.torches.some((t) => !t.decor && t.lit)) return true;
  return false;
}

function overlapsTile(world: World, s: State, x: number, y: number, tile: Tile): boolean {
  for (let cy = Math.floor(y - PLAYER_RADIUS); cy <= Math.floor(y + PLAYER_RADIUS); cy++) {
    for (let cx = Math.floor(x - PLAYER_RADIUS); cx <= Math.floor(x + PLAYER_RADIUS); cx++) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      if (tileAt(world, s, s.zone, s.rx, s.ry, cx, cy) === tile) return true;
    }
  }
  return false;
}

/**
 * Settle the player at the doorway they arrived through. A locked door met from its far
 * side opens (you came through it), and a closed shutter carries the player one step
 * inward so it slams shut behind them instead of closing around them.
 */
function settleAtDoorway(world: World, s: State): void {
  for (let cy = Math.floor(s.y - PLAYER_RADIUS); cy <= Math.floor(s.y + PLAYER_RADIUS); cy++) {
    for (let cx = Math.floor(s.x - PLAYER_RADIUS); cx <= Math.floor(s.x + PLAYER_RADIUS); cx++) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
      if (t === 'D' || t === 'K') s.openedDoors.add(cellKey(s.zone, s.rx, s.ry, cx, cy));
    }
  }
  if (!overlapsTile(world, s, s.x, s.y, 'S')) return;
  const toLeft = s.x;
  const toRight = ROOM_W - s.x;
  const toTop = s.y;
  const toBottom = ROOM_H - s.y;
  const nearest = Math.min(toLeft, toRight, toTop, toBottom);
  const dx = nearest === toLeft ? 1 : nearest === toRight ? -1 : 0;
  const dy = dx !== 0 ? 0 : nearest === toTop ? 1 : -1;
  for (let i = 0; i < 20 && overlapsTile(world, s, s.x, s.y, 'S'); i++) {
    s.x += dx * 0.1;
    s.y += dy * 0.1;
  }
}

/** Populate per-room live entities when entering `(zone, rx, ry)` at `(x, y)`. */
export function enterRoom(
  world: World,
  s: State,
  zone: ZoneId,
  rx: number,
  ry: number,
  x: number,
  y: number,
): void {
  const prevZone = s.zone;
  if (prevZone !== zone) {
    s.crystalColor = 'red';
  }
  s.frozenTiles = new Set();
  s.gatesOpen = false;
  delete s.hop;
  s.hopZ = 0;
  s.pillars = {};
  s.roomClock = 0;
  s.ridingPillar = false;
  if (prevZone === 'dungeon-999' || zone === 'dungeon-999') {
    for (const set of [
      s.brokenTiles,
      s.burnedTiles,
      s.openedDoors,
      s.solvedRooms,
      s.fledMinibossRooms,
    ]) {
      for (const k of [...set]) {
        if (k.startsWith('dungeon-999:')) set.delete(k);
      }
    }
    s.crystalColor = 'red';
  }
  if (zone === 'dungeon-999') {
    // A puzzle room hands over its own campaign-sized kit; the Lobby hands over everything
    const kit = world.rooms.get(roomKey(zone, rx, ry))?.kit;
    s.unlockedBombs = kit ? [...kit.bombs] : [...ALL_BOMBS];
    if (!s.equipped || !s.unlockedBombs.includes(s.equipped)) {
      s.equipped = s.unlockedBombs[0] ?? null;
    }
    s.maxBombs = kit ? (kit.maxBombs ?? 2) : 4;
    s.blastRadius = kit ? (kit.blastRadius ?? 1) : 2;
  }
  s.zone = zone;
  s.rx = rx;
  s.ry = ry;
  s.x = x;
  s.y = y;
  s.vx = 0;
  s.vy = 0;
  s.rollTimer = 0;
  s.rollRecoveryTimer = 0;
  s.rollBufferTimer = 0;
  s.placeBufferTimer = 0;
  s.pickupFreezeTimer = 0;
  s.heldBomb = null;
  s.bombs = [];
  s.fires = [];
  s.gusts = [];
  firePatchTorchContacts.delete(s);
  floatingBombIds.delete(s);
  catapultedBombIds.delete(s);
  s.blocks = [];
  s.torches = [];
  s.orderedStep = 0;
  s.enemies = [];
  s.projectiles = [];
  s.pickups = [];

  const rk = roomKey(zone, rx, ry);
  s.visitedRooms.add(rk);
  const room = world.rooms.get(rk);
  const alreadySolved = s.solvedRooms.has(rk);
  s.roomSolved = alreadySolved || !room?.condition || room.condition === 'none';
  settleAtDoorway(world, s);
  s.entryX = s.x;
  s.entryY = s.y;

  if (!room) return;

  // Spawn push blocks from 'P' and metal blocks from 'M' markers in rows
  for (let ty = 0; ty < ROOM_H; ty++) {
    const row = room.rows[ty] ?? '';
    for (let tx = 0; tx < ROOM_W; tx++) {
      if (row[tx] === 'P') {
        s.blocks.push({ x: tx, y: ty, pushCharge: 0, pushDirX: 0, pushDirY: 0 });
      } else if (row[tx] === 'M') {
        s.blocks.push({ x: tx, y: ty, pushCharge: 0, pushDirX: 0, pushDirY: 0, metal: true });
      }
    }
  }

  // Spawn torches
  for (const ts of room.torches ?? []) {
    const lit =
      Boolean(ts.initiallyLit) || Boolean(ts.decor) || (alreadySolved && Boolean(room.condition));
    s.torches.push({
      x: ts.x,
      y: ts.y,
      ...(ts.order !== undefined ? { order: ts.order } : {}),
      ...(ts.timedSeconds !== undefined ? { timedSeconds: ts.timedSeconds } : {}),
      ...(ts.decor ? { decor: true } : {}),
      lit,
      timer: ts.timedSeconds ?? 0,
    });
  }

  // Spawn enemies (bosses/minibosses & clear-enemies rooms stay cleared once solved)
  const minibossFled = s.fledMinibossRooms.has(rk);
  const skipEnemies =
    alreadySolved &&
    (room.condition === 'clear-enemies' ||
      room.condition === 'miniboss' ||
      room.condition === 'boss');
  if (!skipEnemies) {
    for (const es of room.enemies ?? []) {
      if (es.fleeOnDefeat && minibossFled) continue;
      const hp =
        es.kind === 'cinderhull'
          ? 12
          : es.kind === 'wickgeist'
            ? 8
            : es.kind === 'shielder' ||
                es.kind === 'slime' ||
                es.kind === 'beetle' ||
                es.kind === 'mimic' ||
                es.kind === 'tortoise' ||
                es.kind === 'otter'
              ? 2
              : 1;
      s.enemies.push({
        id: s.nextEntityId++,
        kind: es.kind,
        x: es.x,
        y: es.y,
        vx: 0,
        vy: 0,
        fx: es.facing?.dx ?? 0,
        fy: es.facing?.dy ?? 1,
        hp,
        maxHp: hp,
        armored: es.unarmoredStart
          ? false
          : es.kind === 'shielder' || es.kind === 'cinderhull' || es.kind === 'wickgeist',
        exposedTimer: 0,
        invulnTimer: 0,
        aiTimer: 0.8,
        phase: 1,
        aiState: 'patrol',
        stateTimer: 0,
        stumbleTimer: 0,
        homeX: es.x,
        homeY: es.y,
        frozenTimer: 0,
        ...(es.fleeOnDefeat ? { fleeOnDefeat: true } : {}),
        ...(es.fleeBanner ? { fleeBanner: es.fleeBanner } : {}),
      });
    }
  }

  // Spawn pickups that aren't collected yet
  for (const ps of room.pickups ?? []) {
    if (s.collectedPickups.has(ps.id)) continue;
    if (ps.spawnOnSolve && !alreadySolved) continue;
    if (ps.spawnOnMinibossFlee && !minibossFled) continue;
    s.pickups.push({ id: ps.id, kind: ps.kind, x: ps.x, y: ps.y });
  }

  // Auto-slot Cinder Core when visiting Tower Courtyard with it
  if (room.spireSeal && s.cores.includes('cinder') && !s.spireCinderSlotted) {
    s.spireCinderSlotted = true;
    for (const t of s.torches) t.lit = true;
    showBanner(
      s,
      'The Cinder Core blazes on the Tower Seal! (1 of 4 Elemental Cores restored — Vertical Slice Complete!)',
      6,
    );
    s.events.push('core-slotted');
  }
}

export function enterDungeon999(world: World, s: State): void {
  s.unlockedBombs = [...ALL_BOMBS];
  s.equipped = s.equipped ?? 'bomb';
  s.maxBombs = 4;
  s.blastRadius = 2;
  enterRoom(world, s, 'dungeon-999', 0, 0, 5.5, 6.5);
}

export function showBanner(s: State, text: string, duration = 4.2): void {
  s.bannerText = text;
  s.bannerTimer = duration;
}

export function newState(
  world: World,
  zone: ZoneId = 'basement',
  rx = zone === 'dungeon-999' ? 0 : zone === 'basement' ? 1 : 3,
  ry = zone === 'dungeon-999' ? 0 : zone === 'basement' ? 3 : 2,
  x = 5.5,
  y = 6.5,
): State {
  const startBombs: BombKind[] =
    zone === 'dungeon-999' ? [...ALL_BOMBS] : zone === 'basement' ? [] : ['bomb'];
  const s: State = {
    zone,
    rx,
    ry,
    x,
    y,
    fx: 0,
    fy: -1,
    aimX: 0,
    aimY: -1,
    entryX: x,
    entryY: y,
    vx: 0,
    vy: 0,
    invulnTimer: 0,
    portalCooldown: 0,
    bombCooldown: 0,
    rollTimer: 0,
    rollRecoveryTimer: 0,
    rollDirX: 0,
    rollDirY: -1,
    prevHoldB: false,
    prevHoldA: false,
    rollBufferTimer: 0,
    placeBufferTimer: 0,
    hp: 6,
    maxHp: 6,
    heartShards: 0,
    unlockedBombs: startBombs,
    equipped: startBombs[0] ?? null,
    heldBomb: null,
    maxBombs: zone === 'dungeon-999' ? 4 : 2,
    blastRadius: zone === 'dungeon-999' ? 2 : 1,
    smallKeys: 0,
    hasBossKey: false,
    cryptWarpUnlocked: false,
    cores: [],
    visitedRooms: new Set(),
    brokenTiles: new Set(),
    burnedTiles: new Set(),
    frozenTiles: new Set(),
    openedDoors: new Set(),
    solvedRooms: new Set(),
    fledMinibossRooms: new Set(),
    collectedPickups: new Set(),
    crystalColor: 'red',
    spireCinderSlotted: false,
    nextEntityId: 1,
    bombs: [],
    fires: [],
    gusts: [],
    blocks: [],
    torches: [],
    orderedStep: 0,
    enemies: [],
    projectiles: [],
    pickups: [],
    roomSolved: true,
    blasts: [],
    events: [],
    bannerText: null,
    bannerTimer: 0,
    pickupFreezeTimer: 0,
  };
  enterRoom(world, s, zone, rx, ry, x, y);
  return s;
}

/** START menu equip: select `kind` as the single equipped bomb, or `null` for none. */
export function equipBomb(s: State, kind: BombKind | null): void {
  if (kind === null) {
    s.equipped = null;
    s.heldBomb = null;
    return;
  }
  if (s.unlockedBombs.includes(kind)) {
    s.equipped = kind;
    if (s.heldBomb !== null) s.heldBomb = kind;
  }
}

/** Fast in-play bomb swap: cycle directly through unlocked bombs without opening START. */
export function cycleEquippedBomb(s: State): BombKind | null {
  if (s.unlockedBombs.length === 0) return null;
  const curIdx = s.equipped ? s.unlockedBombs.indexOf(s.equipped) : -1;
  const next = s.unlockedBombs[(curIdx + 1) % s.unlockedBombs.length] ?? null;
  const changed = next !== s.equipped;
  s.equipped = next;
  if (s.heldBomb !== null && next !== null) {
    s.heldBomb = next;
  }
  if (changed) {
    s.events.push('bomb-swap');
  }
  return s.equipped;
}

/** True during the middle 0.15s (`[0.05, 0.20]`) of an active 0.25s dodge roll. */
export function isRollInvulnerable(s: Pick<State, 'rollTimer'>): boolean {
  if (s.rollTimer <= 0) return false;
  const elapsed = ROLL_DURATION - s.rollTimer;
  return elapsed >= ROLL_IFRAME_START - 1e-9 && elapsed <= ROLL_IFRAME_END + 1e-9;
}

/** Snap facing vector to the nearest cardinal direction `(-1|0|1)` for push-block pushing. */
export function cardinalFacing(s: Pick<State, 'fx' | 'fy'>): { dx: number; dy: number } {
  if (Math.abs(s.fx) > Math.abs(s.fy)) {
    return { dx: s.fx >= 0 ? 1 : -1, dy: 0 };
  }
  return { dx: 0, dy: s.fy > 0 ? 1 : -1 };
}

/**
 * Move the player along one axis by `d`, stopping flush against whatever blocks it
 * rather than short of it. Returns true if the whole move was free.
 */
function sweepAxis(
  world: World,
  s: State,
  axis: 'x' | 'y',
  d: number,
  unlockDoors = true,
): boolean {
  const at = (f: number): [number, number] =>
    axis === 'x' ? [s.x + d * f, s.y] : [s.x, s.y + d * f];
  if (!playerBlockedAt(world, s, ...at(1), unlockDoors)) {
    [s.x, s.y] = at(1);
    return true;
  }
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    if (playerBlockedAt(world, s, ...at(mid), false)) hi = mid;
    else lo = mid;
  }
  [s.x, s.y] = at(lo);
  return false;
}

/**
 * Corner assist (`GAME.md` §2): blocked while pushing mostly straight, ease toward the
 * nearest open lane within reach, stopping on its centre line rather than overshooting.
 */
function cornerSlide(
  world: World,
  s: State,
  axis: 'x' | 'y',
  d: number,
  dt: number,
  slideSpeed = SPEED,
): void {
  const along = axis === 'x' ? s.x : s.y;
  const across = axis === 'x' ? s.y : s.x;
  const probe = (a: number, c: number): boolean =>
    axis === 'x' ? playerBlockedAt(world, s, a, c, false) : playerBlockedAt(world, s, c, a, false);
  const lanes = [-1, 1]
    .map((sign) => Math.floor(across + sign * CORNER_SLIDE_MAX) + 0.5)
    .filter((c) => !probe(along + d, c))
    .sort((a, b) => Math.abs(a - across) - Math.abs(b - across));
  const lane = lanes[0];
  if (lane === undefined) return;
  const step = Math.sign(lane - across) * Math.min(slideSpeed * dt, Math.abs(lane - across));
  if (axis === 'x' && !probe(s.x, s.y + step)) s.y += step;
  if (axis === 'y' && !probe(s.y, s.x + step)) s.x += step;
}

function hasBlockAt(s: State, tx: number, ty: number): boolean {
  return s.blocks.some((b) => b.x === tx && b.y === ty);
}

type BombBlockerKind = 'none' | 'wall' | 'interactive';

/** Classify whether grid cell `(cx, cy)` blocks a bomb at height `z`. */
function classifyBombBlocker(
  world: World,
  s: State,
  cx: number,
  cy: number,
  z: number,
  b?: Bomb,
  dirX = 0,
  dirY = 0,
): BombBlockerKind {
  if (b) {
    const verdict = bombLevelVerdict(world, s, b, cx, cy, dirX, dirY);
    if (verdict) return verdict;
  }
  const t = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
  if (t === '%') return 'interactive';
  if (isTallWall(t, s.crystalColor)) return 'wall';
  if (z < 0.42 && (t === 'C' || t === 'T' || t === 'B' || t === 'W')) return 'interactive';
  if (z < 0.22 && (t === '=' || hasBlockAt(s, cx, cy))) return 'wall';
  return 'none';
}

/** The effective level of a tile, reading the cliff top above a two-level lower face. */
function edgeLevelAt(room: RoomSpec | undefined, s: State, x: number, y: number): number | null {
  return ledgeDrops(room, s, x, y)?.lower ? levelAt(room, s, x, y - 1) : levelAt(room, s, x, y);
}

/**
 * How floor levels stop a moving bomb (`ELEVATION.md`): it never goes up a level except on
 * a ramp, goes down over ledge edges, and never down a north rim. `null` defers to the tiles.
 */
function bombLevelVerdict(
  world: World,
  s: State,
  b: Bomb,
  cx: number,
  cy: number,
  _dirX: number,
  dirY: number,
): BombBlockerKind | null {
  const room = currentRoom(world, s);
  if (!hasLevels(room)) return null;
  const bx = Math.floor(b.x);
  const by = Math.floor(b.y);
  if (isRampTile(room, cx, cy) || isRampTile(room, bx, by)) return null;
  const lt = edgeLevelAt(room, s, cx, cy);
  const bl = edgeLevelAt(room, s, bx, by);
  if (lt === null || bl === null) return null;
  if (lt > bl) return 'wall';
  if (lt < bl && dirY < 0) return 'wall';
  if (ledgeDrops(room, s, cx, cy)) return 'none';
  return null;
}

/**
 * After a bomb moves, crossing off a ledge onto lower ground gives it a short fall bounce;
 * slowing on an edge tips it over the drop.
 */
function settleBombLevel(world: World, s: State, b: Bomb, fromX: number, fromY: number): void {
  const room = currentRoom(world, s);
  if (!hasLevels(room)) return;
  const tx = Math.floor(b.x);
  const ty = Math.floor(b.y);
  if (isRampTile(room, tx, ty)) return;
  const edge = ledgeDrops(room, s, tx, ty);
  if (edge) {
    // An edge is no place to rest: a bomb slowing to a stop on one tips over the drop
    if (b.z <= 0.02 && Math.hypot(b.vx, b.vy) < 1.2) {
      if (edge.s || edge.lower) b.vy = Math.max(b.vy, 2.4);
      else if (edge.e) b.vx = Math.max(b.vx, 2.4);
      else if (edge.w) b.vx = Math.min(b.vx, -2.4);
    }
    return;
  }
  if (tx === fromX && ty === fromY) return;
  const lt = levelAt(room, s, tx, ty);
  const bl = edgeLevelAt(room, s, fromX, fromY);
  if (lt === null || bl === null) return;
  if (lt < bl && !isRampTile(room, fromX, fromY) && !isPillarTile(room, tx, ty)) {
    b.z = Math.max(b.z, 0.3 * (bl - lt));
    b.vz = Math.min(b.vz, 0);
    s.events.push('bomb-fall');
  }
}

/** Clamp a newly spawned bomb inside room bounds and outside adjacent solid walls. */
function clampBombSpawn(world: World, s: State, x: number, y: number): [number, number] {
  let px = Math.max(BOMB_RADIUS, Math.min(ROOM_W - BOMB_RADIUS, x));
  let py = Math.max(BOMB_RADIUS, Math.min(ROOM_H - BOMB_RADIUS, y));
  const homeCx = Math.floor(px);
  const homeCy = Math.floor(py);

  for (let cy = Math.floor(py - BOMB_RADIUS); cy <= Math.floor(py + BOMB_RADIUS); cy++) {
    for (let cx = Math.floor(px - BOMB_RADIUS); cx <= Math.floor(px + BOMB_RADIUS); cx++) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      if (cx === homeCx && cy === homeCy) continue;
      if (classifyBombBlocker(world, s, cx, cy, 0) === 'none') continue;
      if (cx !== homeCx && cy === homeCy) {
        px =
          cx < homeCx
            ? Math.max(px, cx + 1 + BOMB_RADIUS + 1e-4)
            : Math.min(px, cx - BOMB_RADIUS - 1e-4);
      } else if (cy !== homeCy && cx === homeCx) {
        py =
          cy < homeCy
            ? Math.max(py, cy + 1 + BOMB_RADIUS + 1e-4)
            : Math.min(py, cy - BOMB_RADIUS - 1e-4);
      }
    }
  }

  px = Math.max(BOMB_RADIUS, Math.min(ROOM_W - BOMB_RADIUS, px));
  py = Math.max(BOMB_RADIUS, Math.min(ROOM_H - BOMB_RADIUS, py));
  return [px, py];
}

/**
 * Axis-separated planar step for a bomb body (`x, y, vx, vy`) at current `b.z`.
 */
function stepBombPlanar(world: World, s: State, b: Bomb, subDt: number, emitEvents: boolean): void {
  let bouncedThisStep = false;
  const preSpeed = Math.hypot(b.vx, b.vy);
  const bxCell = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
  const byCell = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
  const onWater = b.z <= 0.02 && isWaterTile(tileAt(world, s, s.zone, s.rx, s.ry, bxCell, byCell));

  const dx = b.vx * subDt;
  if (Math.abs(dx) > 1e-9) {
    const nx = b.x + dx;
    let clampX = nx;
    let hitWall = false;
    let hitInteractive = false;

    if (nx < BOMB_RADIUS) {
      clampX = BOMB_RADIUS;
      hitWall = true;
    } else if (nx > ROOM_W - BOMB_RADIUS) {
      clampX = ROOM_W - BOMB_RADIUS;
      hitWall = true;
    }

    const prevMinCx = Math.floor(b.x - BOMB_RADIUS);
    const prevMaxCx = Math.floor(b.x + BOMB_RADIUS);
    const minCy = Math.floor(b.y - BOMB_RADIUS);
    const maxCy = Math.floor(b.y + BOMB_RADIUS);
    const minCx = Math.floor(nx - BOMB_RADIUS);
    const maxCx = Math.floor(nx + BOMB_RADIUS);

    for (let cy = minCy; cy <= maxCy; cy++) {
      if (cy < 0 || cy >= ROOM_H) continue;
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (cx < 0 || cx >= ROOM_W) continue;
        const kind = classifyBombBlocker(world, s, cx, cy, b.z, b, Math.sign(dx), 0);
        if (kind === 'none') continue;
        const wasOverlapped = cx >= prevMinCx && cx <= prevMaxCx;
        if (!wasOverlapped) {
          if (dx > 0) clampX = Math.min(clampX, cx - BOMB_RADIUS - 1e-4);
          else clampX = Math.max(clampX, cx + 1 + BOMB_RADIUS + 1e-4);
          if (kind === 'interactive') hitInteractive = true;
          else hitWall = true;
        } else if (Math.abs(nx - (cx + 0.5)) < Math.abs(b.x - (cx + 0.5))) {
          clampX = b.x;
          if (kind === 'interactive') hitInteractive = true;
          else hitWall = true;
        }
      }
    }

    if (hitInteractive || hitWall) {
      b.x = Math.max(BOMB_RADIUS, Math.min(ROOM_W - BOMB_RADIUS, clampX));
      if (onWater) {
        b.vx = 0;
      } else if (hitInteractive) {
        b.vx = -b.vx * 0.2;
        b.vy *= 0.6;
      } else {
        if (emitEvents && preSpeed > 1.0) {
          s.events.push('bomb-bounce');
          bouncedThisStep = true;
        }
        b.vx = -b.vx * BOMB_WALL_BOUNCE;
      }
    } else {
      b.x = nx;
    }
  }

  const dy = b.vy * subDt;
  if (Math.abs(dy) > 1e-9) {
    const ny = b.y + dy;
    let clampY = ny;
    let hitWall = false;
    let hitInteractive = false;

    if (ny < BOMB_RADIUS) {
      clampY = BOMB_RADIUS;
      hitWall = true;
    } else if (ny > ROOM_H - BOMB_RADIUS) {
      clampY = ROOM_H - BOMB_RADIUS;
      hitWall = true;
    }

    const prevMinCy = Math.floor(b.y - BOMB_RADIUS);
    const prevMaxCy = Math.floor(b.y + BOMB_RADIUS);
    const minCx = Math.floor(b.x - BOMB_RADIUS);
    const maxCx = Math.floor(b.x + BOMB_RADIUS);
    const minCy = Math.floor(ny - BOMB_RADIUS);
    const maxCy = Math.floor(ny + BOMB_RADIUS);

    for (let cy = minCy; cy <= maxCy; cy++) {
      if (cy < 0 || cy >= ROOM_H) continue;
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (cx < 0 || cx >= ROOM_W) continue;
        const kind = classifyBombBlocker(world, s, cx, cy, b.z, b, 0, Math.sign(dy));
        if (kind === 'none') continue;
        const wasOverlapped = cy >= prevMinCy && cy <= prevMaxCy;
        if (!wasOverlapped) {
          if (dy > 0) clampY = Math.min(clampY, cy - BOMB_RADIUS - 1e-4);
          else clampY = Math.max(clampY, cy + 1 + BOMB_RADIUS + 1e-4);
          if (kind === 'interactive') hitInteractive = true;
          else hitWall = true;
        } else if (Math.abs(ny - (cy + 0.5)) < Math.abs(b.y - (cy + 0.5))) {
          clampY = b.y;
          if (kind === 'interactive') hitInteractive = true;
          else hitWall = true;
        }
      }
    }

    if (hitInteractive || hitWall) {
      b.y = Math.max(BOMB_RADIUS, Math.min(ROOM_H - BOMB_RADIUS, clampY));
      if (onWater) {
        b.vy = 0;
      } else if (hitInteractive) {
        b.vy = -b.vy * 0.2;
        b.vx *= 0.6;
      } else {
        if (emitEvents && preSpeed > 1.0 && !bouncedThisStep) {
          s.events.push('bomb-bounce');
        }
        b.vy = -b.vy * BOMB_WALL_BOUNCE;
      }
    } else {
      b.y = ny;
    }
  }
}

/** Cardinal direction of Pip's aim: the dominant axis of the 360° stick aim. */
export function cardinalAim(s: Pick<State, 'aimX' | 'aimY'>): { dx: number; dy: number } {
  if (Math.abs(s.aimX) >= Math.abs(s.aimY)) return { dx: s.aimX >= 0 ? 1 : -1, dy: 0 };
  return { dx: 0, dy: s.aimY >= 0 ? 1 : -1 };
}

/**
 * Where A places a bomb (`GAME.md` §2): directly in front of Pip along the cardinal aim,
 * without snapping to the tile grid (pulling back toward Pip only when blocked by a wall or prop).
 */
export function computePlaceTarget(world: World, s: State): { x: number; y: number } {
  const { dx, dy } = cardinalAim(s);
  const ahead = PLAYER_RADIUS + BOMB_RADIUS + 0.1;
  const x = s.x + dx * ahead;
  const y = s.y + dy * ahead;
  // Facing a wall or prop up close: pull the bomb back toward Pip until it fits
  for (let back = 0; back <= ahead + 1e-9; back += 0.05) {
    const [px, py] = clampBombSpawn(world, s, x - dx * back, y - dy * back);
    if (isBombSpotFree(world, s, px, py, 0)) return { x: px, y: py };
  }
  const [px, py] = clampBombSpawn(world, s, s.x, s.y);
  return { x: px, y: py };
}

/** Try unlocking a `D` or `K` door when the player walks into it. */
function tryUnlockDoor(world: World, s: State, tx: number, ty: number): boolean {
  const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
  const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
  if (t === 'D' && s.smallKeys > 0) {
    s.smallKeys--;
    s.openedDoors.add(ck);
    s.events.push('door-unlock');
    showBanner(s, 'Unlocked the door with a Small Key!', 2.2);
    return true;
  }
  if (t === 'K' && s.hasBossKey) {
    s.openedDoors.add(ck);
    s.events.push('door-unlock');
    showBanner(s, 'Unlocked the Sanctum Boss Door!', 2.5);
    return true;
  }
  return false;
}

/** Tiles that can end up under the player (a barrier rising, a shove over a pit edge). */
function canStandInside(t: Tile): boolean {
  return t === 'R' || t === 'U' || t === 'G' || t === '^' || isWaterTile(t);
}

/**
 * Floor levels (`ELEVATION.md`): Pip walks only onto tiles of his own level, except on and
 * off ramps. Going down a level is a hop; going up takes a ramp or a lift.
 */
function levelBlocks(world: World, s: State, cx: number, cy: number): boolean {
  const room = currentRoom(world, s);
  if (!hasLevels(room)) return false;
  const px = Math.floor(s.x);
  const py = Math.floor(s.y);
  if (isRampTile(room, cx, cy) || isRampTile(room, px, py)) return false;
  const pl = levelAt(room, s, px, py);
  const l = levelAt(room, s, cx, cy);
  return pl !== null && l !== null && l !== pl;
}

const HOP_DURATION = 0.45; // seconds: the Oracle hop is a little under half a second
const HOP_PEAK = 0.75; // tiles: about 12 pixels up

/**
 * Pushing straight (never diagonally) into a ledge edge that drops that way hops Pip off at
 * once, over the edge, onto the first open tile below. North rims never hop.
 */
function tryStartHop(world: World, s: State, input: Input, inLen: number): void {
  const room = currentRoom(world, s);
  if (!hasLevels(room) || s.hop || s.rollTimer > 0 || inLen < 0.5) return;
  const ax = Math.abs(input.dx);
  const ay = Math.abs(input.dy);
  const horizontal = ax >= ay;
  if ((horizontal ? ay : ax) > 0.25 * Math.max(ax, ay)) return;
  const dx = horizontal ? Math.sign(input.dx) : 0;
  const dy = horizontal ? 0 : Math.sign(input.dy);
  if (!playerBlockedAt(world, s, s.x + dx * 0.05, s.y + dy * 0.05, false)) return;
  const isOpen = (tx: number, ty: number): boolean =>
    !isTileSolidForWalk(tileAt(world, s, s.zone, s.rx, s.ry, tx, ty), s.crystalColor) &&
    !hasBlockAt(s, tx, ty);
  const land = hopLanding(room, s, Math.floor(s.x), Math.floor(s.y), dx, dy, isOpen);
  if (!land) return;
  const clampAcross = (v: number, tile: number): number =>
    Math.max(tile + 0.5 - 0.3, Math.min(tile + 0.5 + 0.3, v));
  s.hop = {
    x0: s.x,
    y0: s.y,
    x1: dx !== 0 || land.x !== Math.floor(s.x) ? land.x + 0.5 : clampAcross(s.x, land.x),
    y1: dy !== 0 || land.y !== Math.floor(s.y) ? land.y + 0.5 : clampAcross(s.y, land.y),
    t: 0,
    dur: HOP_DURATION,
  };
  s.vx = 0;
  s.vy = 0;
  s.events.push('player-hop');
}

/** Carry Pip along his hop arc until he lands on the tile below. */
function advanceHop(s: State, dt: number): void {
  const hop = s.hop;
  if (!hop) return;
  hop.t = Math.min(hop.dur, hop.t + dt);
  const f = hop.t / hop.dur;
  s.x = hop.x0 + (hop.x1 - hop.x0) * f;
  s.y = hop.y0 + (hop.y1 - hop.y0) * f;
  s.hopZ = 4 * HOP_PEAK * f * (1 - f);
  if (f >= 1) {
    s.hopZ = 0;
    delete s.hop;
    s.events.push('player-land');
  }
}

function playerBlockedAt(
  world: World,
  s: State,
  x: number,
  y: number,
  unlockDoors: boolean,
  knockback = false,
): boolean {
  const minCx = Math.floor(x - PLAYER_RADIUS);
  const maxCx = Math.floor(x + PLAYER_RADIUS);
  const minCy = Math.floor(y - PLAYER_RADIUS);
  const maxCy = Math.floor(y + PLAYER_RADIUS);
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      if (unlockDoors) tryUnlockDoor(world, s, cx, cy);
      const t = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
      // Knockback can shove the player over pits and water (`GAME.md` §1 hazards)
      const hazard = knockback && (t === '^' || isWaterTile(t));
      // Walking may free you from a tile you already overlap, but never steps you into a pit
      const alreadyInside =
        canStandInside(t) &&
        Math.abs(s.x - (cx + 0.5)) < 0.5 + PLAYER_RADIUS &&
        Math.abs(s.y - (cy + 0.5)) < 0.5 + PLAYER_RADIUS &&
        !((t === '^' || isWaterTile(t)) && Math.floor(x) === cx && Math.floor(y) === cy);
      if (isTileSolidForWalk(t, s.crystalColor) && !hazard && !alreadyInside) return true;
      if (levelBlocks(world, s, cx, cy)) return true;
      if (hasBlockAt(s, cx, cy)) {
        const overlappingNow =
          Math.abs(s.x - (cx + 0.5)) < 0.5 + PLAYER_RADIUS &&
          Math.abs(s.y - (cy + 0.5)) < 0.5 + PLAYER_RADIUS;
        const movingOut =
          Math.hypot(x - (cx + 0.5), y - (cy + 0.5)) >=
          Math.hypot(s.x - (cx + 0.5), s.y - (cy + 0.5));
        if (!(overlappingNow && movingOut)) return true;
      }
    }
  }
  return false;
}

/** Returns true if the hit knocked the player out and respawned them. */
function damagePlayer(world: World, s: State, halfHearts: number, ignoreInvuln = false): boolean {
  if (!ignoreInvuln && (s.invulnTimer > 0 || isRollInvulnerable(s))) return false;
  if (s.zone === 'dungeon-999') {
    s.x = s.entryX;
    s.y = s.entryY;
    s.vx = 0;
    s.vy = 0;
    s.invulnTimer = 0.35;
    s.events.push('player-hurt');
    return false;
  }
  s.hp = Math.max(0, Math.round((s.hp - halfHearts) * 4) / 4);
  s.invulnTimer = 1.05;
  s.events.push('player-hurt');
  if (s.hp <= 0) {
    // Dying in a dungeon returns you to the dungeon foyer; dying outside returns you to the initial screen
    s.hp = s.maxHp;
    s.invulnTimer = 1.2;
    s.events.push('player-respawn');
    if (s.zone === 'ice-cave') {
      enterRoom(world, s, 'ice-cave', 1, 3, 5.5, 9.5);
      showBanner(s, 'Knocked out! Returned to the dungeon foyer.', 2.8);
    } else if (s.zone === 'basement') {
      enterRoom(world, s, 'basement', 1, 3, 5.5, 6.5);
      showBanner(s, 'Knocked out! Returned to Grandma’s house.', 2.8);
    } else {
      enterRoom(world, s, 'overworld', 3, 2, 5.5, 6.5);
      showBanner(s, 'Knocked out! Returned to Mouse House.', 2.8);
    }
    return true;
  }
  return false;
}

/** Continuous contact-radius check (`BUTTON_CONTACT_RADIUS`) for `'O'` floor buttons. */
/**
 * Whether the `'O'` button or `'Q'` switch at `(bx, by)` is weighted. A live bomb holds a
 * momentary `'Q'` for one fuse but is too light to latch an `'O'` plate.
 */
export function isButtonPressed(world: World, s: State, bx: number, by: number): boolean {
  const plate = tileAt(world, s, s.zone, s.rx, s.ry, bx, by);
  if (plate !== 'O' && plate !== 'Q') return false;
  const cx = bx + 0.5;
  const cy = by + 0.5;
  if (Math.hypot(s.x - cx, s.y - cy) <= BUTTON_CONTACT_RADIUS) return true;
  if (
    s.blocks.some((blk) => Math.hypot(blk.x + 0.5 - cx, blk.y + 0.5 - cy) <= BUTTON_CONTACT_RADIUS)
  ) {
    return true;
  }
  if (
    plate === 'Q' &&
    s.bombs.some((b) => b.z <= 0.12 && Math.hypot(b.x - cx, b.y - cy) <= BUTTON_CONTACT_RADIUS)
  ) {
    return true;
  }
  if (
    s.enemies.some(
      (e) =>
        (e.kind === 'beetle' ||
          e.kind === 'mimic' ||
          e.kind === 'tortoise' ||
          (e.frozenTimer ?? 0) > 0 ||
          e.stumbleTimer > 0) &&
        Math.hypot(e.x - cx, e.y - cy) <= BUTTON_CONTACT_RADIUS,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Lower every `'G'` gate and `'X'` spike strip exactly while all `'Q'` switches are
 * weighted. A gate won't rise while Pip stands in its opening; spikes rise regardless.
 */
function updateGates(world: World, s: State): void {
  const room = currentRoom(world, s);
  if (!room?.rows.some((row) => row.includes('G') || row.includes('X') || row.includes('L'))) {
    return;
  }
  const switches: [number, number][] = [];
  const gates: [number, number][] = [];
  room.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'Q') switches.push([x, y]);
      else if (row[x] === 'G') gates.push([x, y]);
    }
  });
  // Read the switches with the gates up, so a weight standing in a gate never counts
  const wasOpen = s.gatesOpen ?? false;
  s.gatesOpen = false;
  let open = switches.length > 0 && switches.every(([x, y]) => isButtonPressed(world, s, x, y));
  if (!open && wasOpen) {
    open = gates.some(
      ([gx, gy]) =>
        Math.abs(s.x - (gx + 0.5)) < 0.5 + PLAYER_RADIUS &&
        Math.abs(s.y - (gy + 0.5)) < 0.5 + PLAYER_RADIUS,
    );
  }
  s.gatesOpen = open;
  if (open !== wasOpen) s.events.push(open ? 'gate-open' : 'gate-close');
}

export const PILLAR_TRAVEL = 1.2; // seconds a pillar takes to rise or sink, rumbling

/** What raises the pillar at `(x, y)`: its spec, or the room's switches by default. */
function pillarTrigger(room: RoomSpec, x: number, y: number): PillarTrigger {
  return room.pillars?.find((p) => p.x === x && p.y === y)?.trigger ?? 'switches';
}

function pillarWantsUp(s: State, trigger: PillarTrigger): boolean {
  if (trigger === 'switches') return s.gatesOpen ?? false;
  if (trigger === 'red' || trigger === 'blue') return s.crystalColor === trigger;
  const period = trigger.down + trigger.up;
  const phase = ((((s.roomClock ?? 0) + (trigger.offset ?? 0)) % period) + period) % period;
  return phase >= trigger.down;
}

/** Push a body of half-size `r` at `(px, py)` out of tile `(tx, ty)` the shortest way. */
function nudgeOutOfTile(
  px: number,
  py: number,
  r: number,
  tx: number,
  ty: number,
): [number, number] | null {
  if (px + r <= tx || px - r >= tx + 1 || py + r <= ty || py - r >= ty + 1) return null;
  const ways: [number, number, number][] = [
    [px + r - tx, -1, 0],
    [tx + 1 - (px - r), 1, 0],
    [py + r - ty, 0, -1],
    [ty + 1 - (py - r), 0, 1],
  ];
  const [d, dx, dy] = ways.reduce((best, w) => (w[0] < best[0] ? w : best));
  return [px + dx * (d + 0.01), py + dy * (d + 0.01)];
}

/**
 * A pillar starts moving. Its riders are settled once, now: anything whose centre is on the
 * tile rides it to the end; anything only overlapping its edge is nudged off to its side.
 */
function startPillar(
  world: World,
  s: State,
  st: PillarState,
  x: number,
  y: number,
  dir: -1 | 1,
): void {
  st.dir = dir;
  s.events.push(dir > 0 ? 'pillar-rise' : 'pillar-sink');
  const room = currentRoom(world, s);
  const northLipCloses = dir < 0 && Boolean(room && ledgeDrops(room, s, x, y - 1));
  const onTile = (px: number, py: number): boolean =>
    Math.floor(px) === x && (Math.floor(py) === y || (northLipCloses && Math.floor(py) === y - 1));
  if (!s.hop && onTile(s.x, s.y)) {
    s.ridingPillar = true;
    s.vx = 0;
    s.vy = 0;
    // Keep his whole body on the pillar for the ride
    const m = PLAYER_RADIUS + 0.01;
    s.x = Math.max(x + m, Math.min(x + 1 - m, s.x));
    s.y = Math.max(y + m, Math.min(y + 1 - m, s.y));
  } else if (!s.hop) {
    const out = nudgeOutOfTile(s.x, s.y, PLAYER_RADIUS, x, y);
    if (out) [s.x, s.y] = out;
    if (northLipCloses) {
      const outN = nudgeOutOfTile(s.x, s.y, PLAYER_RADIUS, x, y - 1);
      if (outN) [s.x, s.y] = outN;
    }
  }
  for (const b of s.bombs) {
    if (b.z <= 0.05 && onTile(b.x, b.y)) {
      b.ridingPillar = true;
      b.vx = 0;
      b.vy = 0;
      const m = BOMB_RADIUS + 0.01;
      b.y = Math.max(y + m, Math.min(y + 1 - m, b.y));
    } else if (b.z <= 0.05) {
      const out = nudgeOutOfTile(b.x, b.y, BOMB_RADIUS, x, y);
      if (out) [b.x, b.y] = out;
      if (northLipCloses) {
        const outN = nudgeOutOfTile(b.x, b.y, BOMB_RADIUS, x, y - 1);
        if (outN) [b.x, b.y] = outN;
      }
    }
  }
  for (const e of s.enemies) {
    if (onTile(e.x, e.y)) {
      e.ridingPillar = true;
      e.vx = 0;
      e.vy = 0;
    }
  }
}

/** The pillar arrives: riders step back into the world on its new level. */
function stopPillar(s: State, st: PillarState, x: number, y: number): void {
  st.pos = st.dir > 0 ? 1 : 0;
  st.dir = 0;
  s.events.push('pillar-stop');
  const onTile = (px: number, py: number): boolean => Math.floor(px) === x && Math.floor(py) === y;
  if (s.ridingPillar && onTile(s.x, s.y)) {
    s.ridingPillar = false;
  }
  for (const b of s.bombs) {
    if (b.ridingPillar && onTile(b.x, b.y)) {
      b.ridingPillar = false;
    }
  }
  for (const e of s.enemies) {
    if (e.ridingPillar && onTile(e.x, e.y)) e.ridingPillar = false;
  }
}

/**
 * Pillars follow their triggers. Each move runs to the end (a trigger that flips mid-move is
 * answered once it stops), taking `PILLAR_TRAVEL` seconds.
 */
function updatePillars(world: World, s: State, dt: number): void {
  const room = currentRoom(world, s);
  if (!room?.rows.some((row) => row.includes('L'))) return;
  s.roomClock = (s.roomClock ?? 0) + dt;
  const pillars = (s.pillars ??= {});
  room.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 'L') continue;
      const key = `${x},${y}`;
      const wantsUp = pillarWantsUp(s, pillarTrigger(room, x, y));
      const st = (pillars[key] ??= { pos: wantsUp ? 1 : 0, dir: 0 });
      if (st.dir === 0) {
        if (wantsUp !== st.pos >= 1) startPillar(world, s, st, x, y, wantsUp ? 1 : -1);
      } else {
        st.pos = Math.max(0, Math.min(1, st.pos + (st.dir * dt) / PILLAR_TRAVEL));
        if ((st.dir > 0 && st.pos >= 1) || (st.dir < 0 && st.pos <= 0)) {
          stopPillar(s, st, x, y);
        }
      }
    }
  });
}

function checkSolveCondition(world: World, s: State): void {
  if (s.roomSolved) return;
  const room = currentRoom(world, s);
  if (!room?.condition || room.condition === 'none') {
    s.roomSolved = true;
    return;
  }

  let solved = false;
  if (
    room.condition === 'clear-enemies' ||
    room.condition === 'miniboss' ||
    room.condition === 'boss'
  ) {
    solved = s.enemies.length === 0;
  } else if (room.condition === 'all-torches' || room.condition === 'ordered-torches') {
    const puzzle = s.torches.filter((t) => !t.decor);
    solved = puzzle.length > 0 && puzzle.every((t) => t.lit);
  } else if (room.condition === 'hold-buttons') {
    // Only a raw 'O' can read as a button (tileAt never turns another tile into one)
    const buttons: [number, number][] = [];
    room.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'O' && tileAt(world, s, s.zone, s.rx, s.ry, x, y) === 'O') {
          buttons.push([x, y]);
        }
      }
    });
    solved = buttons.length > 0 && buttons.every(([bx, by]) => isButtonPressed(world, s, bx, by));
  }

  if (!solved) return;

  s.roomSolved = true;
  const rk = roomKey(s.zone, s.rx, s.ry);
  s.solvedRooms.add(rk);
  s.events.push('room-solved');

  // Lock timed torches lit once solved
  for (const t of s.torches) {
    if (t.lit) delete t.timedSeconds;
  }

  if (room.condition === 'miniboss') {
    s.cryptWarpUnlocked = true;
    showBanner(s, 'Ice Golem shattered! The Midpoint Warp Pad (>) is now active.', 4.2);
  } else if (room.condition === 'boss') {
    showBanner(s, 'Ice Wraith banished! Claim your Heart Container and the Cinder Core!', 5.0);
  }

  for (const ps of room.pickups ?? []) {
    if (
      ps.spawnOnSolve &&
      !s.collectedPickups.has(ps.id) &&
      !s.pickups.some((p) => p.id === ps.id)
    ) {
      s.pickups.push({ id: ps.id, kind: ps.kind, x: ps.x, y: ps.y });
    }
  }
}

/** The cracked rubble over the Mouse House's front door, bombed open on the way out. */
const MOUSE_HOUSE_FRONT_DOOR = cellKey('basement', 1, 3, 5, 9);

/** Grandma's advice: where Pip should go next, from what Pip has done so far. */
export function grandmaAdvice(s: State): string {
  if (!s.unlockedBombs.includes('bomb')) {
    return 'Grandma: Your brother is making trouble again—he raised that Iron Tower overnight! Head down to the basement, fetch the Magic Bomb Sack, and keep him out of mischief!';
  }
  if (!s.brokenTiles.has(MOUSE_HOUSE_FRONT_DOOR)) {
    return 'Grandma: You got the Magic Bomb Sack! Blast the rubble blocking the front door, then head southwest through the Orchard Gate toward the Ice Cave.';
  }
  if (!s.unlockedBombs.includes('fire')) {
    return 'Grandma: Monsters are coming out of the Shrines, dear! Blast the cracked Orchard Gate to the southwest, then head south to the Ice Cave.';
  }
  if (!s.cores.includes('cinder')) {
    return 'Grandma: A Fire Bomb! It melts ice and lights braziers. Find the Core deep in the Ice Cave.';
  }
  if (!s.spireCinderSlotted) {
    return 'Grandma: The Cinder Core! Set it in the seal at Tower Courtyard, up north.';
  }
  return 'Grandma: One seal broken, three to go. Rest a while, dear, and try Fire on the brambles west of town.';
}

function lightTorchAt(world: World, s: State, tx: number, ty: number): void {
  const torch = s.torches.find((t) => t.x === tx && t.y === ty);
  if (!torch || torch.lit) return;

  const room = currentRoom(world, s);
  if (room?.condition === 'ordered-torches' && torch.order !== undefined) {
    if (torch.order === s.orderedStep + 1) {
      torch.lit = true;
      s.orderedStep++;
      s.events.push('torch-lit');
      const flames = s.torches.filter((t) => t.order !== undefined).length;
      showBanner(s, `Flame ${torch.order} of ${flames} lit!`, 1.8);
    } else {
      // Wrong order: fizzle all ordered torches so the player clearly sees the reset
      for (const other of s.torches) {
        if (other.order !== undefined) other.lit = false;
      }
      s.orderedStep = 0;
      s.events.push('torch-fizzle');
      showBanner(s, 'The flames sputter out—light them in order: I → II → III!', 2.8);
    }
    return;
  }

  torch.lit = true;
  torch.timer = (torch.timedSeconds ?? 0) + 0.35; // +0.35 s touch slack (`GAME.md` §2)
  s.events.push('torch-lit');
}

function radialDir(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  fallbackX = 0,
  fallbackY = 1,
): { dirX: number; dirY: number; dist: number } {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) {
    const fLen = Math.hypot(fallbackX, fallbackY) || 1;
    return { dirX: fallbackX / fLen, dirY: fallbackY / fLen, dist };
  }
  return { dirX: dx / dist, dirY: dy / dist, dist };
}

function isSolidBlastWall(t: Tile): boolean {
  // A ledge edge is a wall to blasts: they reach lower ground only past it, never up a face
  return t === '#' || t === 'Y' || t === 'D' || t === 'K' || t === 'S' || t === 'H';
}

/** False when a solid indestructible stone/door wall sits directly between blast origin and target. */
function hasBlastLineOfSight(
  world: World,
  s: State,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
): boolean {
  for (const frac of [0.2, 0.4, 0.6, 0.8]) {
    const mx = Math.floor(ox + (tx - ox) * frac);
    const my = Math.floor(oy + (ty - oy) * frac);
    if (mx < 0 || my < 0 || mx >= ROOM_W || my >= ROOM_H) continue;
    if (isSolidBlastWall(tileAt(world, s, s.zone, s.rx, s.ry, mx, my))) return false;
  }
  return true;
}

/** True when the segment from `(ox, oy)` to closest tile point `(clampedX, clampedY)` on `(tx, ty)` is blocked by a solid wall. */
function isBlastContactOccluded(
  world: World,
  s: State,
  ox: number,
  oy: number,
  clampedX: number,
  clampedY: number,
  tx: number,
  ty: number,
): boolean {
  const ocx = Math.floor(ox);
  const ocy = Math.floor(oy);
  for (let i = 1; i <= 7; i++) {
    const frac = i / 8;
    const mx = Math.floor(ox + (clampedX - ox) * frac);
    const my = Math.floor(oy + (clampedY - oy) * frac);
    if ((mx === ocx && my === ocy) || (mx === tx && my === ty)) continue;
    if (mx < 0 || my < 0 || mx >= ROOM_W || my >= ROOM_H) continue;
    if (isSolidBlastWall(tileAt(world, s, s.zone, s.rx, s.ry, mx, my))) return true;
  }
  // Prevent diagonal blasts leaking through a sealed corner between two adjacent solid walls
  if (Math.abs(tx - ocx) === 1 && Math.abs(ty - ocy) === 1) {
    const wallA = isSolidBlastWall(tileAt(world, s, s.zone, s.rx, s.ry, tx, ocy));
    const wallB = isSolidBlastWall(tileAt(world, s, s.zone, s.rx, s.ry, ocx, ty));
    if (wallA && wallB) return true;
  }
  return false;
}

function upsertFirePatch(s: State, tx: number, ty: number, generation: number): FirePatch {
  let patch = s.fires.find((f) => f.x === tx && f.y === ty);
  if (patch) {
    patch.remaining = FIRE_DURATION;
    patch.spreadTimer = FIRE_SPREAD_INTERVAL;
    patch.generation = Math.min(patch.generation ?? generation, generation);
    getFireTorchContacts(s, patch).clear();
  } else {
    patch = {
      x: tx,
      y: ty,
      remaining: FIRE_DURATION,
      tickCooldown: 0,
      spreadTimer: FIRE_SPREAD_INTERVAL,
      generation,
    };
    s.fires.push(patch);
  }
  return patch;
}

function igniteTile(
  world: World,
  s: State,
  tx: number,
  ty: number,
  generation: number,
  sourcePatch?: FirePatch,
): FirePatch | null {
  if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H || generation > MAX_FIRE_GENERATION) {
    return null;
  }
  const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
  if (isWaterTile(t) || isShallowWaterTile(t) || isSolidBlastWall(t) || t === '%' || t === '^')
    return null;

  if (t === ',' || t === 'B' || t === 'W') {
    const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
    s.burnedTiles.add(ck);
    s.events.push('tile-burn');
    return upsertFirePatch(s, tx, ty, generation);
  }

  if (t === 'T') {
    const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
    const torch = s.torches.find((tr) => tr.x === tx && tr.y === ty);
    if (torch?.order !== undefined && sourcePatch) {
      const contacts = getFireTorchContacts(s, sourcePatch);
      if (!contacts.has(ck)) {
        contacts.add(ck);
        lightTorchAt(world, s, tx, ty);
      }
    } else {
      lightTorchAt(world, s, tx, ty);
    }
  }

  return null;
}

function slideMetalBlockToward(
  world: World,
  s: State,
  blk: { x: number; y: number; pushCharge: number; metal?: boolean },
  targetX: number,
  targetY: number,
  maxRange = 3.5,
): boolean {
  if (!blk.metal) return false;
  const mdx = targetX - (blk.x + 0.5);
  const mdy = targetY - (blk.y + 0.5);
  const mDist = Math.hypot(mdx, mdy);
  if (mDist > maxRange || mDist < 0.45) return false;
  // Once pulled onto an 'O' floor button, keep it parked on the button unless the magnet is still further along and the button isn't the target
  if (
    tileAt(world, s, s.zone, s.rx, s.ry, blk.x, blk.y) === 'O' &&
    Math.hypot(targetX - (blk.x + 0.5), targetY - (blk.y + 0.5)) <= 1.25
  ) {
    return false;
  }
  let sdx = 0;
  let sdy = 0;
  if (Math.abs(mdy) <= 0.85 && Math.abs(mdx) >= 0.45) {
    sdx = Math.sign(mdx);
  } else if (Math.abs(mdx) <= 0.85 && Math.abs(mdy) >= 0.45) {
    sdy = Math.sign(mdy);
  } else {
    return false;
  }
  const destX = blk.x + sdx;
  const destY = blk.y + sdy;
  if (destX < 1 || destX > ROOM_W - 2 || destY < 1 || destY > ROOM_H - 2) return false;
  const destTile = tileAt(world, s, s.zone, s.rx, s.ry, destX, destY);
  if (!isPushBlockFloor(destTile) || hasBlockAt(s, destX, destY)) return false;
  blk.x = destX;
  blk.y = destY;
  blk.pushCharge = 0.35;
  s.events.push('block-push');
  return true;
}

function detonateSingleBomb(world: World, s: State, bomb: Bomb, blownIds: Set<number>): Bomb[] {
  const cx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(bomb.x)));
  const cy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(bomb.y)));
  getFloatingBombs(s).delete(bomb.id);
  getCatapultedBombs(s).delete(bomb.id);
  const facing =
    s.fx !== 0 || s.fy !== -1
      ? cardinalFacing(s)
      : s.aimX !== 0 || s.aimY !== -1
        ? cardinalAim(s)
        : cardinalFacing(s);

  if (bomb.kind === 'squeak') {
    s.events.push('boom-squeak');
    s.blasts.push({ x: cx + 0.5, y: cy + 0.5, kind: 'squeak', shape: 'single' });
    for (const e of s.enemies) {
      if (
        Math.hypot(e.x - bomb.x, e.y - bomb.y) <= 1.85 ||
        Math.hypot(e.x - (cx + 0.5), e.y - (cy + 0.5)) <= 1.85
      ) {
        e.stumbleTimer = SQUEAK_DAZE;
        e.aiState = 'recover';
        e.stateTimer = SQUEAK_DAZE;
        e.vx = 0;
        e.vy = 0;
        e.homeX = e.x;
        e.homeY = e.y;
        s.events.push('enemy-stumble');
      }
    }
    return [];
  }

  if (bomb.kind === 'wind') {
    s.events.push('boom-wind');
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
        if (isSolidBlastWall(tileAt(world, s, s.zone, s.rx, s.ry, tx, ty))) continue;
        s.blasts.push({
          x: tx + 0.5,
          y: ty + 0.5,
          kind: 'wind',
          shape: dx === 0 && dy === 0 ? 'hub' : 'single',
        });
      }
    }
    for (const e of s.enemies) {
      const eDir = radialDir(bomb.x, bomb.y, e.x, e.y, facing.dx, facing.dy);
      if (eDir.dist <= 2.2 && hasBlastLineOfSight(world, s, bomb.x, bomb.y, e.x, e.y)) {
        e.vx = eDir.dirX * 6.5;
        e.vy = eDir.dirY * 6.5;
      }
    }
    if (Math.hypot(s.x - bomb.x, s.y - bomb.y) <= 1.35) {
      const ptx = Math.floor(s.x);
      const pty = Math.floor(s.y);
      const isJumpObstacle = (t: Tile): boolean =>
        t === '^' || t === '=' || t === '!' || isWaterTile(t);
      const isWalkLanding = (tx: number, ty: number): boolean => {
        if (tx < 1 || tx > ROOM_W - 2 || ty < 1 || ty > ROOM_H - 2) return false;
        const lt = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
        return (
          !isTileSolidForWalk(lt, s.crystalColor) &&
          lt !== '^' &&
          lt !== '!' &&
          !isWaterTile(lt) &&
          !hasBlockAt(s, tx, ty)
        );
      };
      const candidates: Array<{ dx: number; dy: number }> = [
        facing,
        cardinalAim(s),
        cardinalFacing({ fx: s.x - bomb.x, fy: s.y - bomb.y }),
        cardinalFacing({ fx: bomb.x - s.x, fy: bomb.y - s.y }),
      ];
      let jumped = false;
      for (const dir of candidates) {
        if (dir.dx === 0 && dir.dy === 0) continue;
        const t1 = tileAt(world, s, s.zone, s.rx, s.ry, ptx + dir.dx, pty + dir.dy);
        const t2 = tileAt(world, s, s.zone, s.rx, s.ry, ptx + dir.dx * 2, pty + dir.dy * 2);
        if (isJumpObstacle(t1) && isWalkLanding(ptx + dir.dx * 2, pty + dir.dy * 2)) {
          s.x = ptx + dir.dx * 2 + 0.5;
          s.y = pty + dir.dy * 2 + 0.5;
          jumped = true;
          break;
        }
        if (
          (isJumpObstacle(t1) || isJumpObstacle(t2)) &&
          isWalkLanding(ptx + dir.dx * 3, pty + dir.dy * 3)
        ) {
          s.x = ptx + dir.dx * 3 + 0.5;
          s.y = pty + dir.dy * 3 + 0.5;
          jumped = true;
          break;
        }
      }
      if (!jumped) {
        for (const dir of candidates) {
          if (dir.dx === 0 && dir.dy === 0) continue;
          if (isWalkLanding(ptx + dir.dx * 2, pty + dir.dy * 2)) {
            s.x = ptx + dir.dx * 2 + 0.5;
            s.y = pty + dir.dy * 2 + 0.5;
            jumped = true;
            break;
          }
        }
      }
      if (jumped) {
        s.vx = 0;
        s.vy = 0;
        s.events.push('wind-jump');
      }
    }
    spawnWindGust(
      s,
      cx + 0.5,
      cy + 0.5,
      facing.dx * 3.2,
      facing.dy * 3.2,
      1.2,
      WHIRLWIND_DURATION,
      true,
    );
    return [];
  }

  if (bomb.kind === 'magnet') {
    s.events.push('boom-magnet');
    s.blasts.push({ x: cx + 0.5, y: cy + 0.5, kind: 'magnet', shape: 'single' });
    for (const blk of s.blocks) {
      slideMetalBlockToward(world, s, blk, bomb.x, bomb.y, 3.5);
    }
    let flipped = false;
    for (let ty = Math.max(0, cy - 2); ty <= Math.min(ROOM_H - 1, cy + 2); ty++) {
      for (let tx = Math.max(0, cx - 2); tx <= Math.min(ROOM_W - 1, cx + 2); tx++) {
        if (
          tileAt(world, s, s.zone, s.rx, s.ry, tx, ty) === 'C' &&
          (Math.hypot(tx + 0.5 - bomb.x, ty + 0.5 - bomb.y) <= 1.85 ||
            Math.hypot(tx - cx, ty - cy) <= 1.85) &&
          !flipped
        ) {
          flipped = true;
          s.crystalColor = s.crystalColor === 'red' ? 'blue' : 'red';
          s.events.push('crystal-flip');
        }
      }
    }
    return [];
  }

  if (bomb.kind === 'ice') {
    s.events.push('boom-ice');
    s.frozenTiles ??= new Set();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
        const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
        if (isSolidBlastWall(t)) continue;
        s.blasts.push({
          x: tx + 0.5,
          y: ty + 0.5,
          kind: 'ice',
          shape: dx === 0 && dy === 0 ? 'hub' : 'single',
        });
        const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
        if (isWaterTile(t)) {
          s.frozenTiles.add(ck);
          for (const other of s.bombs) {
            if (other.id !== bomb.id && Math.floor(other.x) === tx && Math.floor(other.y) === ty) {
              other.vx = 0;
              other.vy = 0;
              other.kicked = false;
              getFloatingBombs(s).delete(other.id);
            }
          }
        }
        for (const f of s.fires) {
          if (f.x === tx && f.y === ty) f.remaining = 0;
        }
        if (!s.roomSolved) {
          for (const tr of s.torches) {
            if (tr.x === tx && tr.y === ty && !tr.decor) tr.lit = false;
          }
        }
      }
    }
    for (const e of s.enemies) {
      if (
        Math.hypot(e.x - bomb.x, e.y - bomb.y) <= 1.85 ||
        (Math.abs(e.x - (cx + 0.5)) <= 1.65 && Math.abs(e.y - (cy + 0.5)) <= 1.65)
      ) {
        e.frozenTimer = FREEZE_DURATION;
        e.vx = 0;
        e.vy = 0;
        s.events.push('enemy-freeze');
      }
    }
    return [];
  }

  if (bomb.kind === 'rock') {
    s.events.push('boom-rock');
    s.blasts.push({ x: cx + 0.5, y: cy + 0.5, kind: 'rock', shape: 'single' });
    s.blocks = s.blocks.filter((blk) => !blk.rock);
    s.frozenTiles ??= new Set();
    const hereTile = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
    const aheadX = cx + facing.dx;
    const aheadY = cy + facing.dy;
    const aheadTile =
      aheadX >= 0 && aheadX < ROOM_W && aheadY >= 0 && aheadY < ROOM_H
        ? tileAt(world, s, s.zone, s.rx, s.ry, aheadX, aheadY)
        : '#';
    if (hereTile === ';' || hereTile === '!') {
      const ck = cellKey(s.zone, s.rx, s.ry, cx, cy);
      s.frozenTiles.add(ck);
      s.brokenTiles.add(ck);
    } else if (aheadTile === ';' || aheadTile === '!') {
      const ck = cellKey(s.zone, s.rx, s.ry, aheadX, aheadY);
      s.frozenTiles.add(ck);
      s.brokenTiles.add(ck);
    } else {
      s.blocks.push({ x: cx, y: cy, pushCharge: 0, pushDirX: 0, pushDirY: 0, rock: true });
    }
    return [];
  }

  s.events.push(bomb.kind === 'fire' ? 'boom-fire' : 'boom-bomb');

  const hitTiles: Array<[number, number, BlastShape]> = [[cx, cy, 'hub']];
  const reach = bomb.kind === 'bomb' ? s.blastRadius : 1;
  const shoveRadius = reach + 0.85;

  for (const [dx, dy, armShape, capShape] of [
    [1, 0, 'armH', 'capE'],
    [-1, 0, 'armH', 'capW'],
    [0, 1, 'armV', 'capS'],
    [0, -1, 'armV', 'capN'],
  ] as const) {
    const ray: Array<[number, number]> = [];
    for (let r = 1; r <= reach; r++) {
      const tx = cx + dx * r;
      const ty = cy + dy * r;
      if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) break;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
      if (isSolidBlastWall(t)) break;
      ray.push([tx, ty]);
      // Stop arm after hitting a solid destructible/pedestal tile so blasts don't pierce walls
      if (t === '%' || t === 'W' || t === 'B' || t === 'C' || t === 'T') break;
    }
    ray.forEach(([tx, ty], idx) => {
      hitTiles.push([tx, ty, idx === ray.length - 1 ? capShape : armShape]);
    });
  }
  if (hitTiles.length === 1 && hitTiles[0]) {
    hitTiles[0][2] = 'single';
  }

  for (const [tx, ty, shape] of hitTiles) {
    s.blasts.push({ x: tx + 0.5, y: ty + 0.5, kind: bomb.kind, shape });
  }

  // Combine visual '+' arm cells with continuous contact-radius cells around (bomb.x, bomb.y)
  const triggeredCells = new Map<string, [number, number]>();
  for (const [tx, ty] of hitTiles) {
    triggeredCells.set(`${tx},${ty}`, [tx, ty]);
  }
  const maxDist = reach + BLAST_CONTACT_PADDING;
  const maxEdgeDist = reach + (BLAST_CONTACT_PADDING - 0.5); // reach + 0.18
  const minTx = Math.max(0, Math.floor(bomb.x - maxDist));
  const maxTx = Math.min(ROOM_W - 1, Math.floor(bomb.x + maxDist));
  const minTy = Math.max(0, Math.floor(bomb.y - maxDist));
  const maxTy = Math.min(ROOM_H - 1, Math.floor(bomb.y + maxDist));
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const key = `${tx},${ty}`;
      if (triggeredCells.has(key)) continue;
      const clampedX = Math.max(tx, Math.min(tx + 1, bomb.x));
      const clampedY = Math.max(ty, Math.min(ty + 1, bomb.y));
      const edgeDist = Math.hypot(bomb.x - clampedX, bomb.y - clampedY);
      if (
        edgeDist <= maxEdgeDist &&
        !isBlastContactOccluded(world, s, bomb.x, bomb.y, clampedX, clampedY, tx, ty)
      ) {
        triggeredCells.set(key, [tx, ty]);
      }
    }
  }

  let flippedCrystal = false;
  const blastTouchedTorches: string[] = [];
  const blastPatches: FirePatch[] = [];

  for (const [tx, ty] of triggeredCells.values()) {
    const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
    const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);

    if (bomb.kind === 'bomb') {
      if (t === '%' || t === 'W') {
        s.brokenTiles.add(ck);
        s.events.push('tile-break');
      }
      const hadRock = s.blocks.some((blk) => blk.rock && blk.x === tx && blk.y === ty);
      if (hadRock) {
        s.blocks = s.blocks.filter((blk) => !(blk.rock && blk.x === tx && blk.y === ty));
        s.events.push('tile-break');
      }
    } else if (bomb.kind === 'fire') {
      if (s.frozenTiles?.has(ck)) {
        s.frozenTiles.delete(ck);
      }
      if (t === ',' || t === 'B' || t === 'W') {
        const spawned = igniteTile(world, s, tx, ty, 0);
        if (spawned) blastPatches.push(spawned);
      }
      if (t === 'T') {
        blastTouchedTorches.push(ck);
        lightTorchAt(world, s, tx, ty);
      }
    }

    if (t === 'C' && !flippedCrystal) {
      flippedCrystal = true;
      s.crystalColor = s.crystalColor === 'red' ? 'blue' : 'red';
      s.events.push('crystal-flip');
    }
  }

  // Fire leaves a burning hearth patch (FIRE_DURATION) on its centre tile if walkable
  if (bomb.kind === 'fire') {
    const centreTile = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
    if (
      !isTileSolidForWalk(centreTile, s.crystalColor) &&
      !isWaterTile(centreTile) &&
      !isShallowWaterTile(centreTile) &&
      centreTile !== '^'
    ) {
      blastPatches.push(upsertFirePatch(s, cx, cy, 0));
    }
    for (const patch of blastPatches) {
      const patchContacts = getFireTorchContacts(s, patch);
      for (const ck of blastTouchedTorches) patchContacts.add(ck);
    }
  }

  // Unified radial impulse pass around (bomb.x, bomb.y) with shoveRadius = reach + 0.85:
  // 1. Enemies: radial shove velocity scaled by mass + continuous/cross-blast damage & armor strip
  let hitAnyEnemy = false;
  const litNow = isRoomLit(world, s);
  for (const enemy of [...s.enemies]) {
    const eDir = radialDir(bomb.x, bomb.y, enemy.x, enemy.y, enemy.fx || 0, enemy.fy || 1);
    const hasLos = hasBlastLineOfSight(world, s, bomb.x, bomb.y, enemy.x, enemy.y);
    const hit =
      hitTiles.some(([tx, ty]) => Math.hypot(enemy.x - (tx + 0.5), enemy.y - (ty + 0.5)) < 0.92) ||
      (eDir.dist <= reach + 0.55 && hasLos);
    const inShove = hit || (eDir.dist <= shoveRadius && hasLos);
    if (inShove) {
      const massScale =
        enemy.kind === 'cinderhull'
          ? 0.35
          : enemy.kind === 'shielder' || enemy.kind === 'wickgeist'
            ? 0.75
            : 1.0;
      const proximity = Math.max(0.45, 1 - Math.min(1, eDir.dist / shoveRadius) * 0.55);
      enemy.vx = eDir.dirX * 7.2 * proximity * massScale;
      enemy.vy = eDir.dirY * 7.2 * proximity * massScale;
    }
    if (hit) {
      hitAnyEnemy = true;
      applyBombHitToEnemy(world, s, enemy, bomb.kind, bomb.x, bomb.y, litNow, false);
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);

  // 2. Pip: radial shove velocity; deals 1/4th heart (0.5 half-hearts) splashback unless the bomb hit an enemy
  const pipDir = radialDir(bomb.x, bomb.y, s.x, s.y, -facing.dx, -facing.dy);
  const pipOnHitTile = hitTiles.some(
    ([tx, ty]) => Math.hypot(s.x - (tx + 0.5), s.y - (ty + 0.5)) < 0.85,
  );
  if (
    !isRollInvulnerable(s) &&
    (pipOnHitTile ||
      (pipDir.dist <= shoveRadius && hasBlastLineOfSight(world, s, bomb.x, bomb.y, s.x, s.y)))
  ) {
    const proximity = Math.max(0.45, 1 - Math.min(1, pipDir.dist / shoveRadius) * 0.55);
    s.vx = pipDir.dirX * 7.0 * proximity;
    s.vy = pipDir.dirY * 7.0 * proximity;
    if (!hitAnyEnemy && s.zone !== 'dungeon-999') {
      damagePlayer(world, s, 0.5);
    }
  }

  // 3. Push blocks (s.blocks): shove 1 tile along dominant cardinal radial vector
  const blocksByDist = [...s.blocks].sort(
    (a, b) =>
      Math.hypot(b.x + 0.5 - bomb.x, b.y + 0.5 - bomb.y) -
      Math.hypot(a.x + 0.5 - bomb.x, a.y + 0.5 - bomb.y),
  );
  for (const blk of blocksByDist) {
    if (blk.rock) continue;
    const bdx = blk.x + 0.5 - bomb.x;
    const bdy = blk.y + 0.5 - bomb.y;
    const bDist = Math.hypot(bdx, bdy);
    const onHit = hitTiles.some(([tx, ty]) => tx === blk.x && ty === blk.y);
    if (
      !onHit &&
      (bDist > shoveRadius ||
        !hasBlastLineOfSight(world, s, bomb.x, bomb.y, blk.x + 0.5, blk.y + 0.5))
    ) {
      continue;
    }
    let sdx = 0;
    let sdy = 0;
    if (Math.abs(bdx) < 1e-5 && Math.abs(bdy) < 1e-5) {
      sdx = -facing.dx;
      sdy = -facing.dy;
    } else if (Math.abs(bdx) >= Math.abs(bdy)) {
      sdx = bdx >= 0 ? 1 : -1;
    } else {
      sdy = bdy >= 0 ? 1 : -1;
    }
    const destX = blk.x + sdx;
    const destY = blk.y + sdy;
    if (destX >= 1 && destX <= ROOM_W - 2 && destY >= 1 && destY <= ROOM_H - 2) {
      const destTile = tileAt(world, s, s.zone, s.rx, s.ry, destX, destY);
      if (isPushBlockFloor(destTile) && !hasBlockAt(s, destX, destY)) {
        blk.x = destX;
        blk.y = destY;
        blk.pushCharge = 0;
        s.events.push('block-push');
      }
    }
  }

  // 4. Other live bombs (s.bombs): 1st hit blast-shoves, 2nd hit chain-detonates!
  const cascaded: Bomb[] = [];
  for (const other of s.bombs) {
    if (other.id === bomb.id || blownIds.has(other.id)) continue;
    const oDir = radialDir(bomb.x, bomb.y, other.x, other.y, s.aimX || 0, s.aimY || 1);
    const onHit = hitTiles.some(
      ([tx, ty]) => Math.floor(other.x) === tx && Math.floor(other.y) === ty,
    );
    if (
      !onHit &&
      (oDir.dist > shoveRadius || !hasBlastLineOfSight(world, s, bomb.x, bomb.y, other.x, other.y))
    ) {
      continue;
    }
    if (other.shoveCount >= 1) {
      cascaded.push(other);
    } else {
      other.shoveCount = 1;
      other.vx = oDir.dirX * SHOVE_BOMB_SPEED;
      other.vy = oDir.dirY * SHOVE_BOMB_SPEED;
      other.vz = 1.5;
      other.z = Math.max(other.z, 0.04);
      other.graceOverlap = true;
      other.kicked = false;
      other.fuse = Math.max(other.fuse, 0.35);
      getFloatingBombs(s).delete(other.id);
      s.events.push('bomb-shove');
    }
  }

  return cascaded;
}

/** Iteratively process detonating bombs and any 2-hit cascade chain detonations. */
function detonateBombs(world: World, s: State, initial: Bomb[]): void {
  if (initial.length === 0) return;
  const blownIds = new Set<number>();
  const queue: Bomb[] = [];
  for (const b of initial) {
    if (!blownIds.has(b.id)) {
      blownIds.add(b.id);
      queue.push(b);
    }
  }
  s.bombs = s.bombs.filter((b) => !blownIds.has(b.id));

  for (let qi = 0; qi < queue.length && qi < 64; qi++) {
    const bomb = queue[qi];
    if (!bomb) continue;
    const cascaded = detonateSingleBomb(world, s, bomb, blownIds);
    if (cascaded.length > 0) {
      for (const next of cascaded) {
        if (!blownIds.has(next.id)) {
          blownIds.add(next.id);
          queue.push(next);
        }
      }
      s.bombs = s.bombs.filter((b) => !blownIds.has(b.id));
    }
  }
}

function markEnemyStumble(s: State, enemy: Enemy): void {
  enemy.stumbleTimer = 0.42;
  enemy.aiState = 'recover';
  enemy.stateTimer = 0.42;
  s.events.push('enemy-stumble');
}

function applyBombHitToEnemy(
  world: World,
  s: State,
  enemy: Enemy,
  kind: BombKind,
  originX: number,
  originY: number,
  roomLit: boolean,
  applyFireShove = true,
): void {
  if (enemy.invulnTimer > 0) return;

  if (enemy.kind === 'wickgeist') {
    if (!roomLit) {
      s.events.push('armor-clank');
      showBanner(
        s,
        'The Ice Wraith is immune in the dark—light a corner brazier with Fire first!',
        2.6,
      );
      return;
    }
    enemy.armored = false;
    enemy.hp = Math.max(0, enemy.hp - (kind === 'bomb' ? 2 : 1));
    enemy.invulnTimer = 0.25;
    s.events.push('enemy-hit');
    if (enemy.hp > 0) {
      // 3 fixed health thresholds (6 HP, 4 HP, 2 HP): unleash an Ice Storm that snuffs all braziers!
      const targetPhase = enemy.hp <= 2 ? 4 : enemy.hp <= 4 ? 3 : enemy.hp <= 6 ? 2 : 1;
      if (targetPhase > enemy.phase) {
        enemy.phase = targetPhase;
        for (const t of s.torches) {
          if (!t.decor) t.lit = false;
        }
        s.fires = [];
        enemy.armored = true;
        enemy.aiState = 'windup';
        enemy.stateTimer = 0.65;
        enemy.invulnTimer = 0.65;
        enemy.x = enemy.x < ROOM_W / 2 ? ROOM_W - 3.5 : 3.5;
        enemy.y = enemy.y < ROOM_H / 2 ? ROOM_H - 4.5 : 4.5;
        enemy.vx = 0;
        enemy.vy = 0;
        for (const [gx, gy] of [
          [-2.2, -2.2],
          [2.2, -2.2],
          [-2.2, 2.2],
          [2.2, 2.2],
        ] as const) {
          spawnWindGust(s, enemy.x, enemy.y, gx, gy, 3.2, 0.55);
        }
        s.events.push('ice-storm');
        s.events.push('flame-snuff');
        showBanner(s, 'The Ice Wraith unleashes an Ice Storm—all braziers snuffed!', 2.8);
      } else {
        markEnemyStumble(s, enemy);
      }
    }
    return;
  }

  if (enemy.kind === 'shielder') {
    if (enemy.armored) {
      if (kind === 'fire') {
        enemy.armored = false;
        enemy.exposedTimer = 99;
        s.events.push('armor-burn');
        markEnemyStumble(s, enemy);
        showBanner(s, 'Burned away its wooden shield!', 1.8);
        return;
      }
      // Bomb from behind still hurts; frontal shield blocks
      const toBombX = originX - enemy.x;
      const toBombY = originY - enemy.y;
      const dot = toBombX * enemy.fx + toBombY * enemy.fy;
      if (dot > -0.1) {
        s.events.push('armor-clank');
        showBanner(s, 'Blocked by its wooden shield—burn it with a Fire Bomb!', 2.4);
        return;
      }
    }
  }

  if (enemy.kind === 'cinderhull') {
    if (enemy.armored) {
      if (kind === 'fire') {
        enemy.armored = false;
        enemy.exposedTimer = 5.2; // generous window (`GAME.md` §2)
        s.events.push('armor-burn');
        markEnemyStumble(s, enemy);
        showBanner(s, 'The Ice Golem’s armour melted—blast its exposed core!', 2.6);
      } else {
        s.events.push('armor-clank');
        showBanner(s, 'Ice armour deflected the blast—melt it with Fire first!', 2.4);
      }
      return;
    }
    const dmg = kind === 'bomb' ? 2 : 1;
    const prevBracket = Math.ceil(enemy.hp / 4);
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.invulnTimer = 0.2;
    s.events.push('enemy-hit');
    if (enemy.fleeOnDefeat && enemy.hp <= enemy.maxHp / 2) {
      enemy.hp = 0;
      const rk = roomKey(s.zone, s.rx, s.ry);
      s.fledMinibossRooms.add(rk);
      s.events.push('boss-flee');
      showBanner(s, enemy.fleeBanner ?? 'The miniboss retreats!', 3.8);
      const room = currentRoom(world, s);
      for (const ps of room?.pickups ?? []) {
        if (
          ps.spawnOnMinibossFlee &&
          !s.collectedPickups.has(ps.id) &&
          !s.pickups.some((p) => p.id === ps.id)
        ) {
          s.pickups.push({ id: ps.id, kind: ps.kind, x: ps.x, y: ps.y });
        }
      }
      return;
    }
    const nextBracket = Math.ceil(enemy.hp / 4);
    if (enemy.hp > 0) {
      enemy.phase = enemy.hp <= 4 ? 3 : enemy.hp <= 8 ? 2 : 1;
      if (!enemy.fleeOnDefeat && nextBracket < prevBracket) {
        // Regrow ice armour for the next phase!
        enemy.armored = true;
        enemy.exposedTimer = 0;
        showBanner(s, 'The Ice Golem froze over again!', 2.0);
      }
      markEnemyStumble(s, enemy);
    }
    return;
  }

  // Full-size slimes split into two mini-slimes when hit by Fire fire!
  if (enemy.kind === 'slime' && !enemy.splitGen && enemy.hp > 0 && kind === 'fire') {
    enemy.hp = 0;
    let awayX = enemy.x - originX;
    let awayY = enemy.y - originY;
    const awayLen = Math.hypot(awayX, awayY);
    if (awayLen > 1e-4) {
      awayX /= awayLen;
      awayY /= awayLen;
    } else {
      awayX = 0;
      awayY = 1;
    }
    const perpX = -awayY;
    const perpY = awayX;
    for (const sign of [-1, 1] as const) {
      const candX = Math.max(0.75, Math.min(ROOM_W - 0.75, enemy.x + perpX * 0.32 * sign));
      const candY = Math.max(0.75, Math.min(ROOM_H - 0.75, enemy.y + perpY * 0.32 * sign));
      const ct = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(candX), Math.floor(candY));
      const canStand =
        !isTileSolidForWalk(ct, s.crystalColor) &&
        ct !== '^' &&
        !isWaterTile(ct) &&
        !hasBlockAt(s, Math.floor(candX), Math.floor(candY));
      const sx = canStand ? candX : enemy.x;
      const sy = canStand ? candY : enemy.y;
      s.enemies.push({
        id: s.nextEntityId++,
        kind: 'slime',
        x: sx,
        y: sy,
        vx: (awayX * 0.5 + perpX * sign * 0.85) * 4.2,
        vy: (awayY * 0.5 + perpY * sign * 0.85) * 4.2,
        fx: perpX * sign,
        fy: perpY * sign,
        hp: 1,
        maxHp: 1,
        armored: false,
        exposedTimer: 0,
        invulnTimer: 0.28,
        aiTimer: 0,
        phase: 1,
        aiState: 'recover',
        stateTimer: 0.25,
        stumbleTimer: 0.25,
        homeX: enemy.x,
        homeY: enemy.y,
        splitGen: 1,
      });
    }
    s.events.push('slime-split');
    return;
  }

  // Standard enemies (`slime`, `bat`, unshielded `shielder`)
  enemy.hp -= kind === 'bomb' ? 2 : 1;
  enemy.invulnTimer = 0.18;
  if (applyFireShove) {
    let kx = enemy.x - originX;
    let ky = enemy.y - originY;
    const len = Math.hypot(kx, ky) || 1;
    kx /= len;
    ky /= len;
    enemy.vx = kx * 5;
    enemy.vy = ky * 5;
  }
  s.events.push(enemy.hp <= 0 ? 'enemy-defeat' : 'enemy-hit');
  if (enemy.hp > 0) {
    markEnemyStumble(s, enemy);
  }
}

function collectPickup(s: State, pickup: ActivePickup): void {
  if (pickup.kind !== 'heart-drop') {
    s.collectedPickups.add(pickup.id);
    // Freeze player and monsters while holding item overhead: quick for small keys, longer for new items with text
    s.pickupFreezeTimer = pickup.kind === 'small-key' ? 0.45 : 1.25;
    s.vx = 0;
    s.vy = 0;
  }
  s.events.push(`pickup-${pickup.kind}`);
  switch (pickup.kind) {
    case 'bomb-sack':
      if (!s.unlockedBombs.includes('bomb')) s.unlockedBombs.unshift('bomb');
      s.equipped = 'bomb';
      showBanner(
        s,
        'Found the MAGIC BOMB SACK! Press [A] to Pull overhead, then [B] Drop or [A] Throw!',
        5.0,
      );
      break;
    case 'small-key':
      s.smallKeys++;
      showBanner(s, 'Found a Small Key!', 1.5);
      break;
    case 'boss-key':
      s.hasBossKey = true;
      showBanner(
        s,
        'Found the Sanctum Boss Key! Opens the Boss Door in the Sanctum Ante-Room.',
        3.4,
      );
      break;
    case 'fire-bomb':
      if (!s.unlockedBombs.includes('fire')) s.unlockedBombs.push('fire');
      s.equipped = 'fire';
      showBanner(
        s,
        'Learned the FIRE BOMB! Lights braziers, melts ice, burns brambles & wooden shields, and lights the dark.',
        5.0,
      );
      break;
    case 'heart-shard': {
      // A Heart Piece is a quarter heart: every fourth one adds a heart
      s.heartShards++;
      const pieces = s.heartShards % HEART_PIECES_PER_HEART;
      if (pieces === 0) {
        s.maxHp = Math.min(20, s.maxHp + 2);
        s.hp = s.maxHp;
        showBanner(s, 'Four Heart Pieces make a Heart! Max Hearts +1 & full heal!', 4.0);
      } else {
        s.hp = Math.min(s.maxHp, s.hp + 2);
        showBanner(s, `Found a Heart Piece (${pieces}/${HEART_PIECES_PER_HEART})!`, 3.6);
      }
      break;
    }
    case 'heart-container':
      s.maxHp = Math.min(20, s.maxHp + 2);
      s.hp = s.maxHp;
      showBanner(s, 'Heart Container! Max Hearts increased & health fully restored!', 4.2);
      break;
    case 'satchel-upgrade':
      if (s.maxBombs < 3) {
        s.maxBombs = 3;
        showBanner(s, 'Magic Bomb Sack upgraded! You can now have 3 live bombs at once.', 4.2);
      } else if (s.blastRadius < 2) {
        s.blastRadius = 2;
        showBanner(s, 'Alchemist’s Powder! Bomb blast reach increased to 2 tiles!', 4.2);
      } else {
        s.maxBombs = Math.min(4, s.maxBombs + 1);
        showBanner(s, 'Master Bandolier! You can now have 4 live bombs at once.', 4.2);
      }
      break;
    case 'cinder-core':
      if (!s.cores.includes('cinder')) s.cores.push('cinder');
      s.hp = s.maxHp;
      showBanner(
        s,
        'Reclaimed the CINDER CORE (1st Primeval Core)! Return to Tower Courtyard or explore with Fire!',
        6.0,
      );
      break;
    case 'heart-drop':
      s.hp = Math.min(s.maxHp, s.hp + 2);
      break;
  }
}

/**
 * Advance simulation by `dt` seconds.
 * Returns `true` when a room cut occurred (edge walk or portal warp) so the view fades &autosaves.
 */
function newBomb(s: State, kind: BombKind, x: number, y: number): Bomb {
  s.bombCooldown = BOMB_COOLDOWN;
  return {
    id: s.nextEntityId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    z: 0,
    vz: 0,
    fuse: BOMB_FUSES[kind],
    graceOverlap: false,
    shoveCount: 0,
  };
}

/** New bombs are limited by the satchel and share a cooldown. */
function canPullBomb(s: State): boolean {
  return (
    s.heldBomb === null && s.equipped !== null && s.bombs.length < s.maxBombs && s.bombCooldown <= 0
  );
}

function hasStoppedGroundedBombNear(s: State, x: number, y: number): boolean {
  return s.bombs.some(
    (b) => b.z <= 0.05 && Math.hypot(b.vx, b.vy) <= 0.1 && Math.hypot(b.x - x, b.y - y) < 0.45,
  );
}

/** A = Pull (when empty-handed): take out the equipped bomb and hold it over Pip's head (timer paused). */
function pullBomb(s: State): void {
  if (!s.equipped || !canPullBomb(s)) return;
  s.heldBomb = s.equipped;
  s.events.push('bomb-lift');
}

/** B = Drop (while holding overhead): put the held bomb on the ground ahead of Pip and start its fuse. */
function dropHeldBomb(world: World, s: State): void {
  const kind = s.heldBomb;
  if (!kind) return;
  const { x, y } = computePlaceTarget(world, s);
  if (hasStoppedGroundedBombNear(s, x, y)) return;
  s.heldBomb = null;
  const overlapsPip = Math.hypot(x - s.x, y - s.y) < PLAYER_RADIUS + BOMB_RADIUS + 0.06;
  s.bombs.push({ ...newBomb(s, kind, x, y), graceOverlap: overlapsPip });
  s.events.push('bomb-drop');
}

/**
 * A = Throw (while holding overhead): throw the held bomb in the nearest orthogonal direction.
 * The lob clears `'='` fences and rolls with `KICK_SPEED` physics on touchdown.
 */
function throwHeldBomb(world: World, s: State): void {
  const kind = s.heldBomb;
  if (!kind) return;
  s.heldBomb = null;
  const { dx, dy } = cardinalAim(s);
  const ahead = PLAYER_RADIUS + BOMB_RADIUS + 0.1;
  const candX = s.x + dx * ahead;
  const candY = s.y + dy * ahead;
  const [px, py] = isBombSpotFree(world, s, candX, candY, 0.24)
    ? clampBombSpawn(world, s, candX, candY)
    : clampBombSpawn(world, s, s.x, s.y);
  const bomb = newBomb(s, kind, px, py);
  bomb.vx = dx * KICK_SPEED;
  bomb.vy = dy * KICK_SPEED;
  bomb.z = 0.24;
  bomb.vz = THROW_LOB_VZ;
  bomb.graceOverlap = true;
  bomb.kicked = true;
  s.bombs.push(bomb);
  s.events.push('bomb-throw');
  s.events.push('bomb-kick');
}

function startRoll(world: World, s: State, input: Input, inLen: number): void {
  if (inLen > 0.15) {
    s.rollDirX = input.dx / inLen;
    s.rollDirY = input.dy / inLen;
    s.fx = s.rollDirX;
    s.fy = s.rollDirY;
    s.aimX = s.rollDirX;
    s.aimY = s.rollDirY;
  } else {
    const fLen = Math.hypot(s.fx, s.fy);
    s.rollDirX = fLen > 1e-5 ? s.fx / fLen : 0;
    s.rollDirY = fLen > 1e-5 ? s.fy / fLen : -1;
  }

  s.vx = 0;
  s.vy = 0;
  s.rollTimer = ROLL_DURATION;

  // Rolling never lays the equipped bomb by default; a bomb-laying roll is a possible
  // future unlock for specific puzzles (`GAME.md` §10)

  s.events.push('player-roll');
}

function isBombSpotFree(world: World, s: State, px: number, py: number, z: number): boolean {
  if (
    px < BOMB_RADIUS ||
    px > ROOM_W - BOMB_RADIUS ||
    py < BOMB_RADIUS ||
    py > ROOM_H - BOMB_RADIUS
  ) {
    return false;
  }
  for (let cy = Math.floor(py - BOMB_RADIUS); cy <= Math.floor(py + BOMB_RADIUS); cy++) {
    for (let cx = Math.floor(px - BOMB_RADIUS); cx <= Math.floor(px + BOMB_RADIUS); cx++) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      if (classifyBombBlocker(world, s, cx, cy, z) !== 'none') return false;
    }
  }
  return true;
}

function resolveBombPairCollisions(world: World, s: State, swallowedIds: Set<number>): void {
  const minDist = BOMB_RADIUS * 2;
  for (let i = 0; i < s.bombs.length; i++) {
    const a = s.bombs[i];
    if (!a || a.z >= 0.22 || swallowedIds.has(a.id)) continue;
    for (let j = i + 1; j < s.bombs.length; j++) {
      const b = s.bombs[j];
      if (!b || b.z >= 0.22 || swallowedIds.has(b.id)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;

      const nx = dist > 1e-5 ? dx / dist : 1;
      const ny = dist > 1e-5 ? dy / dist : 0;
      const overlap = minDist - dist + 0.002;
      const half = overlap * 0.5;
      const aHalfFree = isBombSpotFree(world, s, a.x - nx * half, a.y - ny * half, a.z);
      const bHalfFree = isBombSpotFree(world, s, b.x + nx * half, b.y + ny * half, b.z);
      if (aHalfFree && bHalfFree) {
        a.x -= nx * half;
        a.y -= ny * half;
        b.x += nx * half;
        b.y += ny * half;
      } else if (isBombSpotFree(world, s, a.x - nx * overlap, a.y - ny * overlap, a.z)) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      } else if (isBombSpotFree(world, s, b.x + nx * overlap, b.y + ny * overlap, b.z)) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      }

      const relVn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relVn < 0) {
        const impulse = -0.95 * relVn;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        if (-relVn > 1.0) s.events.push('bomb-bounce');
      }
    }
  }
}

function advanceRoll(world: World, s: State, budgetDt: number): number {
  if (budgetDt <= 0 || s.rollTimer <= 0) return budgetDt;
  const stepDt = Math.min(budgetDt, s.rollTimer);
  const subSteps = Math.max(1, Math.ceil(stepDt / 0.025));
  const subDt = stepDt / subSteps;
  const subDx = s.rollDirX * ROLL_SPEED * subDt;
  const subDy = s.rollDirY * ROLL_SPEED * subDt;
  s.fx = s.rollDirX;
  s.fy = s.rollDirY;

  for (let i = 0; i < subSteps; i++) {
    if (Math.abs(subDx) > 1e-6 && !sweepAxis(world, s, 'x', subDx) && Math.abs(s.rollDirY) < 0.5) {
      cornerSlide(world, s, 'x', subDx, subDt, ROLL_SPEED);
    }
    if (Math.abs(subDy) > 1e-6 && !sweepAxis(world, s, 'y', subDy) && Math.abs(s.rollDirX) < 0.5) {
      cornerSlide(world, s, 'y', subDy, subDt, ROLL_SPEED);
    }
  }

  s.rollTimer -= stepDt;
  const leftoverDt = budgetDt - stepDt;
  if (s.rollTimer <= 1e-9) {
    s.rollTimer = 0;
    s.rollRecoveryTimer = Math.max(0, ROLL_RECOVERY - leftoverDt);
  }
  return leftoverDt;
}

function advanceWalk(world: World, s: State, input: Input, inLen: number, walkDt: number): void {
  if (walkDt <= 0) return;

  // Subtle downhill slope drift on Pip when standing on 'n' | 's' | 'e' | 'w' (never out of bounds or into pits)
  let driftDx = 0;
  let driftDy = 0;
  const px = Math.floor(s.x);
  const py = Math.floor(s.y);
  if (px >= 0 && px < ROOM_W && py >= 0 && py < ROOM_H) {
    const sv = slopeVector(tileAt(world, s, s.zone, s.rx, s.ry, px, py));
    if (sv !== null) {
      const rawDx = sv.dx * PLAYER_SLOPE_DRIFT * walkDt;
      const rawDy = sv.dy * PLAYER_SLOPE_DRIFT * walkDt;
      if (rawDx < 0 && s.x > PLAYER_RADIUS) {
        driftDx = Math.max(rawDx, PLAYER_RADIUS - s.x);
      } else if (rawDx > 0 && s.x < ROOM_W - PLAYER_RADIUS) {
        driftDx = Math.min(rawDx, ROOM_W - PLAYER_RADIUS - s.x);
      }
      if (rawDy < 0 && s.y > PLAYER_RADIUS) {
        driftDy = Math.max(rawDy, PLAYER_RADIUS - s.y);
      } else if (rawDy > 0 && s.y < ROOM_H - PLAYER_RADIUS) {
        driftDy = Math.min(rawDy, ROOM_H - PLAYER_RADIUS - s.y);
      }
    }
  }

  if (inLen <= 0.01) {
    if (Math.abs(driftDx) > 1e-6) sweepAxis(world, s, 'x', driftDx, false);
    if (Math.abs(driftDy) > 1e-6) sweepAxis(world, s, 'y', driftDy, false);
    return;
  }

  // Movement speed is halved while holding a bomb overhead
  const walkSpeed = s.heldBomb !== null ? SPEED * 0.5 : SPEED;
  const scale = walkSpeed / Math.max(1, inLen);
  const moveVx = input.dx * scale;
  const moveVy = input.dy * scale;
  s.fx = input.dx / inLen;
  s.fy = input.dy / inLen;

  const totalDx = moveVx * walkDt + driftDx;
  const totalDy = moveVy * walkDt + driftDy;
  if (
    Math.abs(totalDx) > 1e-5 &&
    !sweepAxis(world, s, 'x', totalDx) &&
    Math.abs(input.dy) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'x', totalDx, walkDt, walkSpeed);
  }
  if (
    Math.abs(totalDy) > 1e-5 &&
    !sweepAxis(world, s, 'y', totalDy) &&
    Math.abs(input.dx) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'y', totalDy, walkDt, walkSpeed);
  }
}

function applyBombSlopePhysics(b: Bomb, sv: { dx: number; dy: number }, subDt: number): void {
  b.vx += sv.dx * SLOPE_ACCEL * subDt;
  b.vy += sv.dy * SLOPE_ACCEL * subDt;
  const crossDamp = 0.2 * BOMB_FRICTION * subDt;
  if (sv.dx !== 0) {
    b.vy = Math.abs(b.vy) <= crossDamp ? 0 : b.vy - Math.sign(b.vy) * crossDamp;
    if (b.vx * sv.dx > SLOPE_MAX_SPEED) b.vx = sv.dx * SLOPE_MAX_SPEED;
  } else {
    b.vx = Math.abs(b.vx) <= crossDamp ? 0 : b.vx - Math.sign(b.vx) * crossDamp;
    if (b.vy * sv.dy > SLOPE_MAX_SPEED) b.vy = sv.dy * SLOPE_MAX_SPEED;
  }
}

export function tick(world: World, s: State, input: Input, dt: number = FIXED_DT): boolean {
  s.blasts = [];
  s.events = [];

  if (s.bannerTimer > 0) {
    s.bannerTimer = Math.max(0, s.bannerTimer - dt);
    if (s.bannerTimer <= 0) s.bannerText = null;
  }
  if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - dt);
  if (s.portalCooldown > 0) s.portalCooldown = Math.max(0, s.portalCooldown - dt);

  if (s.bombCooldown > 0) s.bombCooldown = Math.max(0, s.bombCooldown - dt);

  if ((s.pickupFreezeTimer ?? 0) > 0) {
    s.pickupFreezeTimer = Math.max(0, (s.pickupFreezeTimer ?? 0) - dt);
    s.vx = 0;
    s.vy = 0;
    s.prevHoldB = Boolean(input.holdB);
    s.prevHoldA = Boolean(input.holdA);
    return false;
  }

  // 1. Continuous 360° aim, B = Roll + recovery + input buffer, walking + corner slide + knockback
  const inLen = Math.hypot(input.dx, input.dy);
  if (inLen >= AIM_MIN_INPUT) {
    s.aimX = input.dx / inLen;
    s.aimY = input.dy / inLen;
  }

  const heldB = Boolean(input.holdB);
  const pressedB = heldB && !s.prevHoldB;
  const heldA = Boolean(input.holdA);
  const pressedA = heldA && !s.prevHoldA;
  const wasHoldingBombAtTickStart = s.heldBomb !== null;

  const wasRollingAtTickStart = s.rollTimer > 0;
  const prevPipX = s.x;
  const prevPipY = s.y;

  if (s.hop) {
    advanceHop(s, dt);
  } else if (s.ridingPillar) {
    // Carried by a moving pillar: no stepping on or off until it stops
  } else if (wasHoldingBombAtTickStart) {
    // While holding a bomb overhead, B is Drop (not Roll) and movement speed is halved
    s.rollBufferTimer = 0;
    advanceWalk(world, s, input, inLen, dt);
  } else if (wasRollingAtTickStart) {
    if (pressedB) {
      s.rollBufferTimer = INPUT_BUFFER_WINDOW;
    } else if (s.rollBufferTimer > 0) {
      s.rollBufferTimer = Math.max(0, s.rollBufferTimer - dt);
    }
    const leftoverDt = advanceRoll(world, s, dt);
    advanceWalk(world, s, input, inLen, leftoverDt);
  } else if (s.rollRecoveryTimer > 0) {
    if (pressedB) {
      s.rollBufferTimer = INPUT_BUFFER_WINDOW;
    }
    const recBefore = s.rollRecoveryTimer;
    s.rollRecoveryTimer = Math.max(0, s.rollRecoveryTimer - dt);
    if (
      s.rollRecoveryTimer <= 0 &&
      s.rollBufferTimer > 0 &&
      s.rollBufferTimer + 1e-9 >= recBefore
    ) {
      advanceWalk(world, s, input, inLen, recBefore);
      s.rollBufferTimer = 0;
      startRoll(world, s, input, inLen);
      const leftoverDt = advanceRoll(world, s, dt - recBefore);
      advanceWalk(world, s, input, inLen, leftoverDt);
    } else {
      if (!pressedB && s.rollBufferTimer > 0) {
        s.rollBufferTimer = Math.max(0, s.rollBufferTimer - dt);
      }
      advanceWalk(world, s, input, inLen, dt);
    }
  } else if (pressedB) {
    s.rollBufferTimer = 0;
    startRoll(world, s, input, inLen);
    const leftoverDt = advanceRoll(world, s, dt);
    advanceWalk(world, s, input, inLen, leftoverDt);
  } else {
    if (s.rollBufferTimer > 0) {
      s.rollBufferTimer = Math.max(0, s.rollBufferTimer - dt);
    }
    advanceWalk(world, s, input, inLen, dt);
  }
  if (!s.hop && !s.ridingPillar) {
    tryStartHop(world, s, input, inLen);
  }

  const knockDx = s.vx * dt;
  const knockDy = s.vy * dt;
  // Tiles Pip stepped across this tick (the Mimic copies whole steps, not slides)
  const pipStepDx = Math.floor(s.x) - Math.floor(prevPipX);
  const pipStepDy = Math.floor(s.y) - Math.floor(prevPipY);
  s.vx *= Math.pow(0.001, dt);
  s.vy *= Math.pow(0.001, dt);
  if (Math.hypot(s.vx, s.vy) < 0.08) {
    s.vx = 0;
    s.vy = 0;
  }

  // Knockback moves separately: it ignores corner sliding and can carry you over a pit,
  // but never out through a doorway; only walking/rolling leaves a room
  const keepInRoom = (v: number, size: number, d: number): number =>
    d < 0
      ? Math.max(v, Math.min(v - d, PLAYER_RADIUS))
      : Math.min(v, Math.max(v - d, size - PLAYER_RADIUS));
  if (Math.abs(knockDx) > 1e-5 && !playerBlockedAt(world, s, s.x + knockDx, s.y, false, true)) {
    s.x = keepInRoom(s.x + knockDx, ROOM_W, knockDx);
  }
  if (Math.abs(knockDy) > 1e-5 && !playerBlockedAt(world, s, s.x, s.y + knockDy, false, true)) {
    s.y = keepInRoom(s.y + knockDy, ROOM_H, knockDy);
  }

  // Check if knockback pushed player onto pit/water/spikes
  const underTile = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(s.x), Math.floor(s.y));
  if (underTile === '^' || isWaterTile(underTile)) {
    // A fall always costs a half-heart, even mid-invulnerability
    if (!damagePlayer(world, s, 1, true)) {
      s.x = s.entryX;
      s.y = s.entryY;
      s.vx = 0;
      s.vy = 0;
    }
    return false;
  } else if (underTile === '!') {
    if (damagePlayer(world, s, 1)) return false;
  }

  // Grandma, the only one who speaks, says where to go next when Pip is beside her
  const room = currentRoom(world, s);
  for (const npc of room?.npcs ?? []) {
    if (Math.hypot(s.x - npc.x, s.y - npc.y) < 1.15) {
      const text = npc.id === 'grandma' ? grandmaAdvice(s) : npc.dialogue;
      if (s.bannerText !== text) showBanner(s, text, 5.5);
    }
  }

  // 2. Two-state verb buttons (`GAME.md` §2):
  // - Empty-handed: B = Roll, A = Pull (takes out a bomb and holds it overhead with timer paused)
  // - While holding overhead: B = Drop (places bomb ahead), A = Throw (orthogonal throw that clears fences & rolls)
  if (wasHoldingBombAtTickStart) {
    s.placeBufferTimer = 0;
    if (pressedB) {
      dropHeldBomb(world, s);
    } else if (pressedA) {
      throwHeldBomb(world, s);
    }
  } else {
    const readyToPull = s.rollTimer <= 0 && canPullBomb(s);
    if (pressedA) {
      if (readyToPull) pullBomb(s);
      else s.placeBufferTimer = INPUT_BUFFER_WINDOW;
    } else if (s.placeBufferTimer > 0) {
      if (readyToPull) {
        s.placeBufferTimer = 0;
        pullBomb(s);
      } else {
        s.placeBufferTimer = Math.max(0, s.placeBufferTimer - dt);
      }
    }
  }

  s.prevHoldB = heldB;
  s.prevHoldA = heldA;

  // 3. Step-by-step continuous bomb body simulation (carry, lob, bounce, roll, hazards, fuse)
  const toDetonate: Bomb[] = [];
  const swallowedIds = new Set<number>();
  const floatingSet = getFloatingBombs(s);
  const catapultedSet = getCatapultedBombs(s);
  const luredEnemyIds = new Set<number>();
  const bombSubSteps = Math.max(1, Math.ceil(dt / (FIXED_DT + 1e-6)));
  const bombSubDt = dt / bombSubSteps;

  for (const blk of s.blocks) {
    if (blk.pushCharge > 0) {
      blk.pushCharge = Math.max(0, blk.pushCharge - dt);
    }
  }

  for (const b of s.bombs) {
    if (b.graceOverlap && Math.hypot(b.x - s.x, b.y - s.y) > PLAYER_RADIUS + BOMB_RADIUS + 0.06) {
      b.graceOverlap = false;
    }

    // Squeak Bomb continuous lure: pulls Clockwork Creatures ('beetle', 'mimic', 'otter', 'slime') within 4.5 tiles at 1.8 tiles/s
    if (b.kind === 'squeak') {
      const canEnemyStep = (nx: number, ny: number): boolean => {
        if (nx < 0.55 || ny < 0.55 || nx > ROOM_W - 0.55 || ny > ROOM_H - 0.55) return false;
        const t = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(nx), Math.floor(ny));
        return (
          !isTileSolidForWalk(t, s.crystalColor) && !hasBlockAt(s, Math.floor(nx), Math.floor(ny))
        );
      };
      for (const e of s.enemies) {
        if (
          (e.kind === 'beetle' || e.kind === 'mimic' || e.kind === 'otter' || e.kind === 'slime') &&
          (e.frozenTimer ?? 0) <= 0
        ) {
          const ldx = b.x - e.x;
          const ldy = b.y - e.y;
          const lDist = Math.hypot(ldx, ldy);
          if (lDist <= 4.5) {
            luredEnemyIds.add(e.id);
            if (lDist > 0.06) {
              const stepLen = Math.min(lDist, 1.8 * dt);
              const ux = ldx / lDist;
              const uy = ldy / lDist;
              if (canEnemyStep(e.x + ux * stepLen, e.y + uy * stepLen)) {
                e.x += ux * stepLen;
                e.y += uy * stepLen;
              } else if (
                Math.abs(ldx) > 0.04 &&
                canEnemyStep(e.x + Math.sign(ldx) * Math.min(Math.abs(ldx), stepLen), e.y)
              ) {
                e.x += Math.sign(ldx) * Math.min(Math.abs(ldx), stepLen);
              } else if (
                Math.abs(ldy) > 0.04 &&
                canEnemyStep(e.x, e.y + Math.sign(ldy) * Math.min(Math.abs(ldy), stepLen))
              ) {
                e.y += Math.sign(ldy) * Math.min(Math.abs(ldy), stepLen);
              }
              e.fx = ux;
              e.fy = uy;
              e.homeX = e.x;
              e.homeY = e.y;
            }
          }
        }
      }
    }

    // Magnet Bomb continuous pull: slides aligned metal blocks 1 tile toward magnet & curves rolling bombs within 3.2 tiles
    if (b.kind === 'magnet') {
      for (const blk of s.blocks) {
        if (blk.metal && blk.pushCharge <= 0) {
          slideMetalBlockToward(world, s, blk, b.x, b.y, 3.2);
        }
      }
      for (const other of s.bombs) {
        if (other.id === b.id || other.kind !== 'bomb') continue;
        const mdx = b.x - other.x;
        const mdy = b.y - other.y;
        const mDist = Math.hypot(mdx, mdy);
        if (mDist <= 3.2 && mDist > 0.08) {
          const ux = mdx / mDist;
          const uy = mdy / mDist;
          other.vx += ux * 12.5 * dt;
          other.vy += uy * 12.5 * dt;
        }
      }
    }

    // Lingering Wind Whirlwind (WindGust with vortex: true): catapults any live bomb entering within 0.85 tiles downwind
    for (const g of s.gusts) {
      if (!g.vortex || g.remaining <= 0) continue;
      if (Math.hypot(b.x - g.x, b.y - g.y) <= 0.85) {
        b.vx = g.dx * 2.2;
        b.vy = g.dy * 2.2;
        b.vz = 3.2;
        b.z = Math.max(b.z, 0.26);
        b.kicked = true;
        floatingSet.delete(b.id);
        if (!catapultedSet.has(b.id)) {
          catapultedSet.add(b.id);
          s.events.push('wind-catapult');
        }
      }
    }

    b.fuse -= dt;
    let swallowed = false;
    let impactDetonated = false;

    for (let step = 0; step < bombSubSteps && !b.ridingPillar; step++) {
      let appliedSlopeThisStep = false;
      let strongDryWind = false;
      if (b.z <= 0.12) {
        const sx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
        const sy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
        const st = tileAt(world, s, s.zone, s.rx, s.ry, sx, sy);
        const sv = slopeVector(st);
        if (sv !== null) {
          applyBombSlopePhysics(b, sv, bombSubDt);
          appliedSlopeThisStep = true;
        } else if (b.z <= 0.05 && !isWaterTile(st) && st !== '^') {
          const wv = windVectorAt(world, s, b.x, b.y);
          const wMag = Math.hypot(wv.dx, wv.dy);
          if (wMag > 1.5) {
            strongDryWind = true;
            b.vx += wv.dx * 3.8 * bombSubDt;
            b.vy += wv.dy * 3.8 * bombSubDt;
            // Wind alone never blows a bomb into a pit: it stops at the edge (a kicked or
            // shoved bomb still falls in)
            const intoPit = (px: number, py: number): boolean =>
              tileAt(
                world,
                s,
                s.zone,
                s.rx,
                s.ry,
                Math.max(0, Math.min(ROOM_W - 1, Math.floor(px))),
                Math.max(0, Math.min(ROOM_H - 1, Math.floor(py))),
              ) === '^';
            if (intoPit(b.x + b.vx * bombSubDt, b.y)) b.vx = 0;
            if (intoPit(b.x, b.y + b.vy * bombSubDt)) b.vy = 0;
          } else if (wMag > 0.2 && Math.hypot(b.vx, b.vy) > 0.05) {
            b.vx += wv.dx * 3.8 * bombSubDt;
            b.vy += wv.dy * 3.8 * bombSubDt;
          }
        }
      }

      const fromTileX = Math.floor(b.x);
      const fromTileY = Math.floor(b.y);
      stepBombPlanar(world, s, b, bombSubDt, true);
      settleBombLevel(world, s, b, fromTileX, fromTileY);

      if (b.z > 0 || b.vz > 0) {
        const effGrav = catapultedSet.has(b.id) ? BOMB_GRAVITY * 0.55 : BOMB_GRAVITY;
        b.vz -= effGrav * bombSubDt;
        b.z += b.vz * bombSubDt;
        if (b.z <= 0) {
          b.z = 0;
          catapultedSet.delete(b.id);
          const lx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
          const ly = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
          const landedTile = tileAt(world, s, s.zone, s.rx, s.ry, lx, ly);
          if (landedTile === '^') {
            swallowed = true;
            swallowedIds.add(b.id);
            floatingSet.delete(b.id);
            s.events.push('bomb-swallow');
            break;
          } else if (isWaterTile(landedTile)) {
            b.vz = 0;
            b.kicked = false;
            if (!floatingSet.has(b.id)) {
              floatingSet.add(b.id);
              s.events.push('bomb-splash');
            }
            const cv = currentVector(landedTile);
            const wv = windVectorAt(world, s, b.x, b.y);
            const tvx = (cv?.dx ?? 0) * CURRENT_SPEED + wv.dx * 1.4;
            const tvy = (cv?.dy ?? 0) * CURRENT_SPEED + wv.dy * 1.4;
            if (Math.hypot(tvx, tvy) < 0.02) {
              b.vx = 0;
              b.vy = 0;
            } else {
              b.vx *= 0.25;
              b.vy *= 0.25;
            }
          } else if (Math.abs(b.vz) > 1.35) {
            b.vz = -b.vz * 0.38;
            b.vx *= 0.8;
            b.vy *= 0.8;
            s.events.push('bomb-bounce');
          } else {
            b.vz = 0;
          }
        }
      }

      if (b.z <= 0.02 && b.vz <= 0) {
        const gx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
        const gy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
        const groundTile = tileAt(world, s, s.zone, s.rx, s.ry, gx, gy);
        const groundSv = slopeVector(groundTile);
        if (groundTile === '^') {
          swallowed = true;
          swallowedIds.add(b.id);
          floatingSet.delete(b.id);
          s.events.push('bomb-swallow');
          break;
        } else if (isWaterTile(groundTile)) {
          if (!floatingSet.has(b.id)) {
            floatingSet.add(b.id);
            b.kicked = false;
            b.vx *= 0.25;
            b.vy *= 0.25;
            s.events.push('bomb-splash');
          }
          const cv = currentVector(groundTile);
          const wv = windVectorAt(world, s, b.x, b.y);
          const tvx = (cv?.dx ?? 0) * CURRENT_SPEED + wv.dx * 1.4;
          const tvy = (cv?.dy ?? 0) * CURRENT_SPEED + wv.dy * 1.4;
          if (Math.hypot(tvx, tvy) < 0.02) {
            b.vx = 0;
            b.vy = 0;
            b.kicked = false;
          } else {
            const dvx = tvx - b.vx;
            const dvy = tvy - b.vy;
            const dLen = Math.hypot(dvx, dvy);
            const maxDelta = 18.0 * bombSubDt;
            if (dLen <= maxDelta) {
              b.vx = tvx;
              b.vy = tvy;
            } else {
              b.vx += (dvx / dLen) * maxDelta;
              b.vy += (dvy / dLen) * maxDelta;
            }
          }
        } else {
          floatingSet.delete(b.id);
          if (groundSv !== null) {
            if (!appliedSlopeThisStep) {
              applyBombSlopePhysics(b, groundSv, bombSubDt);
            }
          } else {
            const speed = Math.hypot(b.vx, b.vy);
            if (speed > 0) {
              const effFriction = strongDryWind ? 2.2 : BOMB_FRICTION;
              const stopThresh = strongDryWind ? 0.005 : 0.08;
              const nextSpeed = speed - effFriction * bombSubDt;
              if (nextSpeed <= stopThresh) {
                b.vx = 0;
                b.vy = 0;
                b.kicked = false;
              } else {
                const ratio = nextSpeed / speed;
                b.vx *= ratio;
                b.vy *= ratio;
              }
            }
          }
        }
      } else if (b.kicked && !catapultedSet.has(b.id)) {
        // Thrown bombs decelerate during their hop so total travel matches the ~1.7-tile kick distance
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 0) {
          const nextSpeed = speed - BOMB_FRICTION * 0.45 * bombSubDt;
          if (nextSpeed <= 0.08) {
            b.vx = 0;
            b.vy = 0;
            b.kicked = false;
          } else {
            const ratio = nextSpeed / speed;
            b.vx *= ratio;
            b.vy *= ratio;
          }
        }
      }

      if (!s.roomSolved && b.z <= 0.12 && room?.condition === 'hold-buttons') {
        checkSolveCondition(world, s);
      }

      if (b.graceOverlap && Math.hypot(b.x - s.x, b.y - s.y) > PLAYER_RADIUS + BOMB_RADIUS + 0.06) {
        b.graceOverlap = false;
      }

      // Impact detonation: any kicked bomb goes off when it hits an enemy (`GAME.md` §4)
      const clearOfPip = !b.graceOverlap || Math.hypot(b.x - s.x, b.y - s.y) > 0.35;
      if (
        b.kicked &&
        Math.hypot(b.vx, b.vy) > 2.0 &&
        clearOfPip &&
        s.enemies.some((e) => Math.hypot(e.x - b.x, e.y - b.y) < 0.68)
      ) {
        impactDetonated = true;
        break;
      }
    }

    if (!swallowed && (impactDetonated || b.fuse <= 0)) {
      toDetonate.push(b);
    }
  }

  if (swallowedIds.size > 0) {
    s.bombs = s.bombs.filter((b) => !swallowedIds.has(b.id));
  }

  resolveBombPairCollisions(world, s, swallowedIds);

  // Re-check grounded hazard tiles if bomb-vs-bomb separation nudged a bomb into a pit or water
  if (s.bombs.length > 1) {
    const postSwallowed = new Set<number>();
    for (const b of s.bombs) {
      if (b.z > 0.02) continue;
      const gx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
      const gy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
      const gt = tileAt(world, s, s.zone, s.rx, s.ry, gx, gy);
      if (gt === '^') {
        postSwallowed.add(b.id);
        floatingSet.delete(b.id);
        s.events.push('bomb-swallow');
      } else if (isWaterTile(gt)) {
        if (!floatingSet.has(b.id)) {
          floatingSet.add(b.id);
          b.kicked = false;
          s.events.push('bomb-splash');
        }
        const cv = currentVector(gt);
        const wv = windVectorAt(world, s, b.x, b.y);
        if (
          Math.hypot(
            (cv?.dx ?? 0) * CURRENT_SPEED + wv.dx * 1.4,
            (cv?.dy ?? 0) * CURRENT_SPEED + wv.dy * 1.4,
          ) < 0.02
        ) {
          b.vx = 0;
          b.vy = 0;
        }
      }
    }
    if (postSwallowed.size > 0) {
      s.bombs = s.bombs.filter((b) => !postSwallowed.has(b.id));
    }
  }

  if (!s.roomSolved && room?.condition === 'hold-buttons') {
    checkSolveCondition(world, s);
  }

  if (toDetonate.length > 0) {
    const activeIds = new Set(s.bombs.map((b) => b.id));
    detonateBombs(
      world,
      s,
      toDetonate.filter((b) => activeIds.has(b.id)),
    );
  }

  const liveBombIds = new Set(s.bombs.map((b) => b.id));
  if (floatingSet.size > 0) {
    for (const id of floatingSet) {
      if (!liveBombIds.has(id)) floatingSet.delete(id);
    }
  }

  // 4. Update burning Fire patches (FIRE_DURATION), bounded tile-by-tile fire spread & brazier ignition
  for (const f of [...s.fires]) {
    const fcx = Math.round(f.x);
    const fcy = Math.round(f.y);
    const ft = tileAt(world, s, s.zone, s.rx, s.ry, fcx, fcy);
    if (isWaterTile(ft) || isShallowWaterTile(ft)) {
      f.remaining = 0;
      continue;
    }

    f.remaining -= dt;
    f.tickCooldown = Math.max(0, f.tickCooldown - dt);

    const patchContacts = getFireTorchContacts(s, f);
    for (let ty = Math.max(0, fcy - 1); ty <= Math.min(ROOM_H - 1, fcy + 1); ty++) {
      for (let tx = Math.max(0, fcx - 1); tx <= Math.min(ROOM_W - 1, fcx + 1); tx++) {
        if (Math.hypot(tx + 0.5 - (f.x + 0.5), ty + 0.5 - (f.y + 0.5)) > 1.25) continue;
        if (tileAt(world, s, s.zone, s.rx, s.ry, tx, ty) !== 'T') continue;
        const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
        const torch = s.torches.find((tr) => tr.x === tx && tr.y === ty);
        if (torch?.order !== undefined) {
          if (!patchContacts.has(ck)) {
            patchContacts.add(ck);
            lightTorchAt(world, s, tx, ty);
          }
        } else {
          lightTorchAt(world, s, tx, ty);
        }
      }
    }

    f.spreadTimer = (f.spreadTimer ?? FIRE_SPREAD_INTERVAL) - dt;
    const gen = f.generation ?? 0;
    if (f.spreadTimer <= 0 && gen < MAX_FIRE_GENERATION && f.remaining > 0) {
      f.spreadTimer = FIRE_SPREAD_INTERVAL;
      const nextGen = gen + 1;
      const w = windVectorAt(world, s, f.x + 0.5, f.y + 0.5);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = fcx + dx;
        const ny = fcy + dy;
        igniteTile(world, s, nx, ny, nextGen, f);
        if (w.dx * dx + w.dy * dy > 0.6 && nx >= 0 && ny >= 0 && nx < ROOM_W && ny < ROOM_H) {
          const midT = tileAt(world, s, s.zone, s.rx, s.ry, nx, ny);
          if (!isWaterTile(midT) && !isTallWall(midT, s.crystalColor)) {
            igniteTile(world, s, fcx + dx * 2, fcy + dy * 2, nextGen, f);
          }
        }
      }
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        if ((w.dx * dx + w.dy * dy) * Math.SQRT1_2 > 0.6) {
          const sideA = tileAt(world, s, s.zone, s.rx, s.ry, fcx + dx, fcy);
          const sideB = tileAt(world, s, s.zone, s.rx, s.ry, fcx, fcy + dy);
          const openA = !isWaterTile(sideA) && !isTallWall(sideA, s.crystalColor);
          const openB = !isWaterTile(sideB) && !isTallWall(sideB, s.crystalColor);
          if (openA || openB) {
            igniteTile(world, s, fcx + dx, fcy + dy, nextGen, f);
          }
        }
      }
    }

    if (f.tickCooldown <= 0 && f.remaining > 0) {
      const litNow = isRoomLit(world, s);
      for (const e of [...s.enemies]) {
        if (e.kind === 'bat' && (e.stumbleTimer ?? 0) <= 0) continue;
        if (Math.hypot(e.x - (f.x + 0.5), e.y - (f.y + 0.5)) < 0.72) {
          applyBombHitToEnemy(world, s, e, 'fire', f.x + 0.5, f.y + 0.5, litNow);
          f.tickCooldown = 0.55;
        }
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
    }
    if (f.remaining > 0 && Math.hypot(s.x - (f.x + 0.5), s.y - (f.y + 0.5)) < 0.62) {
      if (damagePlayer(world, s, 1)) return false;
    }
  }
  s.fires = s.fires.filter((f) => f.remaining > 0);

  // 5. Update timed braziers
  for (const t of s.torches) {
    if (t.lit && t.timedSeconds !== undefined && !s.roomSolved) {
      t.timer -= dt;
      if (t.timer <= 0) {
        t.lit = false;
        t.timer = 0;
      }
    }
  }

  // 6. Update systemic enemy FSM, fuse awareness, world reactions & boss AI
  const roomLit = isRoomLit(world, s);
  for (const e of s.enemies) {
    // A creature riding a moving pillar holds still until it stops
    if (e.ridingPillar) {
      e.vx = 0;
      e.vy = 0;
      continue;
    }
    e.aiState ??= 'patrol';
    e.stateTimer ??= 0;
    e.stumbleTimer ??= 0;
    e.homeX ??= e.x;
    e.homeY ??= e.y;

    const canFly = e.kind === 'bat' || e.kind === 'wickgeist';
    const enemyBlocked = (nx: number, ny: number): boolean => {
      if (nx < 0.7 || ny < 0.7 || nx > ROOM_W - 0.7 || ny > ROOM_H - 0.7) return true;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(nx), Math.floor(ny));
      if (canFly) return isTallWall(t, s.crystalColor);
      return isTileSolidForWalk(t, s.crystalColor) || hasBlockAt(s, Math.floor(nx), Math.floor(ny));
    };

    if ((e.frozenTimer ?? 0) > 0) {
      e.frozenTimer = Math.max(0, (e.frozenTimer ?? 0) - dt);
      if ((e.frozenTimer ?? 0) > 0) {
        if (Math.hypot(s.x - e.x, s.y - e.y) <= 0.65) {
          const kickDir = cardinalFacing(s);
          e.vx = kickDir.dx * 6.5;
          e.vy = kickDir.dy * 6.5;
          s.events.push('ice-kick');
        }
        const nextX = e.x + e.vx * dt;
        const nextY = e.y + e.vy * dt;
        if (!enemyBlocked(nextX, e.y)) e.x = nextX;
        else e.vx = 0;
        if (!enemyBlocked(e.x, nextY)) e.y = nextY;
        else e.vy = 0;
        e.vx *= Math.pow(0.18, dt);
        e.vy *= Math.pow(0.18, dt);
        const etx = Math.floor(e.x);
        const ety = Math.floor(e.y);
        if (
          tileAt(world, s, s.zone, s.rx, s.ry, etx, ety) === 'O' &&
          Math.hypot(e.x - (etx + 0.5), e.y - (ety + 0.5)) <= 0.35
        ) {
          e.x = etx + 0.5;
          e.y = ety + 0.5;
          e.vx = 0;
          e.vy = 0;
          e.homeX = e.x;
          e.homeY = e.y;
        }
        continue;
      }
    }

    if (e.invulnTimer > 0) e.invulnTimer = Math.max(0, e.invulnTimer - dt);
    if (e.stumbleTimer > 0) e.stumbleTimer = Math.max(0, e.stumbleTimer - dt);
    if (e.stateTimer > 0) e.stateTimer = Math.max(0, e.stateTimer - dt);
    if (e.exposedTimer > 0) {
      e.exposedTimer = Math.max(0, e.exposedTimer - dt);
      if (e.exposedTimer <= 0 && e.kind === 'cinderhull') {
        e.armored = true;
      }
    }

    // Deterministic Clockwork Creatures ('beetle', 'mimic', 'tortoise', 'otter')
    if (e.kind === 'beetle' || e.kind === 'mimic' || e.kind === 'tortoise' || e.kind === 'otter') {
      if (e.kind === 'mimic' && e.stumbleTimer <= 0 && !luredEnemyIds.has(e.id)) {
        // The Mimic walks tile to tile: each tile Pip steps into, it steps the same way
        // from its own tile if that one is free, then glides there at Pip's pace
        const tx = Math.floor(e.homeX) + 0.5;
        const ty = Math.floor(e.homeY) + 0.5;
        e.homeX = tx;
        e.homeY = ty;
        if (pipStepDx !== 0 && !enemyBlocked(e.homeX + pipStepDx, e.homeY)) {
          e.homeX += pipStepDx;
        }
        if (pipStepDy !== 0 && !enemyBlocked(e.homeX, e.homeY + pipStepDy)) {
          e.homeY += pipStepDy;
        }
        const gx = e.homeX - e.x;
        const gy = e.homeY - e.y;
        const gLen = Math.hypot(gx, gy);
        if (gLen > 1e-4) {
          const stepLen = Math.min(gLen, SPEED * 1.25 * dt);
          e.x += (gx / gLen) * stepLen;
          e.y += (gy / gLen) * stepLen;
          e.fx = gx / gLen;
          e.fy = gy / gLen;
        }
      } else if (e.kind === 'tortoise' && e.stumbleTimer <= 0) {
        if (Math.hypot(e.fx, e.fy) < 0.1) {
          e.fx = 1;
          e.fy = 0;
        }
        const tx = e.x + e.fx * 1.1 * dt;
        const ty = e.y + e.fy * 1.1 * dt;
        if (!enemyBlocked(tx, ty)) {
          e.x = tx;
          e.y = ty;
        } else {
          e.fx = -e.fx;
          e.fy = -e.fy;
        }
      }
      if (Math.hypot(e.vx, e.vy) > 1e-4) {
        const nx = e.x + e.vx * dt;
        const ny = e.y + e.vy * dt;
        if (!enemyBlocked(nx, e.y)) e.x = nx;
        if (!enemyBlocked(e.x, ny)) e.y = ny;
        e.vx *= Math.pow(0.002, dt);
        e.vy *= Math.pow(0.002, dt);
      }
      continue;
    }

    if (luredEnemyIds.has(e.id)) {
      continue;
    }

    const toPx = s.x - e.x;
    const toPy = s.y - e.y;
    const dist = Math.hypot(toPx, toPy) || 1;
    const dirX = toPx / dist;
    const dirY = toPy / dist;

    let speed = 0;
    if (e.kind === 'wickgeist') {
      e.armored = !roomLit;
      if (e.hp <= 4 && e.phase < 2) e.phase = 2;
      if (e.stumbleTimer > 0) {
        speed = 0;
      } else if (e.aiState === 'windup') {
        e.fx = dirX;
        e.fy = dirY;
        speed = 0;
        if (e.stateTimer <= 0) {
          s.projectiles.push({ x: e.x, y: e.y, vx: dirX * 3.1, vy: dirY * 3.1, life: 3.2 });
          if (e.phase >= 2) {
            spawnWindGust(s, e.x, e.y, dirX * 2.2, dirY * 2.2, 3.2, 0.5);
          }
          e.aiState = 'recover';
          e.stateTimer = 0.22;
          e.aiTimer = e.phase >= 2 ? 2.0 : 2.4;
        }
      } else if (e.aiState === 'recover' && e.stateTimer > 0) {
        e.fx = dirX;
        e.fy = dirY;
        speed = (roomLit ? 1.1 : 1.65) * 0.35;
      } else {
        const nearBomb = roomLit
          ? s.bombs.find((b) => b.fuse < 1.0 && Math.hypot(b.x - e.x, b.y - e.y) <= 1.9)
          : undefined;
        if (nearBomb) {
          e.aiState = 'flee';
          const awayX = e.x - nearBomb.x;
          const awayY = e.y - nearBomb.y;
          const awayLen = Math.hypot(awayX, awayY) || 1;
          const ax = awayX / awayLen;
          const ay = awayY / awayLen;
          const toCx = ROOM_W * 0.5 - e.x;
          const toCy = ROOM_H * 0.5 - e.y;
          const sign = -ay * toCx + ax * toCy >= 0 ? 1 : -1;
          const sx = -ay * sign * 0.8 + ax * 0.6;
          const sy = ax * sign * 0.8 + ay * 0.6;
          const sLen = Math.hypot(sx, sy) || 1;
          e.fx = sx / sLen;
          e.fy = sy / sLen;
          speed = 1.65;
        } else {
          e.aiState = 'chase';
          e.fx = dirX;
          e.fy = dirY;
          speed = roomLit ? 1.1 : 1.65;
        }
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiState = 'windup';
          e.stateTimer = 0.25;
          speed = 0;
          s.events.push('enemy-windup');
        }
      }
    } else if (e.kind === 'cinderhull') {
      e.phase = e.hp <= 4 ? 3 : e.hp <= 8 ? 2 : 1;
      const armoredSpeed = 1.1 + (e.phase - 1) * 0.25;
      if (e.stumbleTimer > 0) {
        speed = 0;
      } else if (!e.armored && !e.fleeOnDefeat) {
        e.fx = dirX;
        e.fy = dirY;
        speed = e.aiState === 'recover' && e.stateTimer > 0 ? 0.25 : 0.45;
        if (e.stateTimer <= 0) e.aiState = 'chase';
      } else if (e.aiState === 'windup') {
        e.fx = dirX;
        e.fy = dirY;
        speed = 0;
        if (e.stateTimer <= 0) {
          const baseAngle = Math.atan2(dirY, dirX);
          for (const spread of [-0.32, 0, 0.32]) {
            const a = baseAngle + spread;
            s.projectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 3.4,
              vy: Math.sin(a) * 3.4,
              life: 3.0,
            });
          }
          spawnWindGust(s, e.x, e.y, dirX * 2.4, dirY * 2.4, 2.8, 0.45);
          e.aiState = 'recover';
          e.stateTimer = 0.3;
          e.aiTimer = Math.max(1.8, 2.7 - (e.phase - 1) * 0.3);
        }
      } else if (e.aiState === 'recover' && e.stateTimer > 0) {
        e.fx = dirX;
        e.fy = dirY;
        speed = armoredSpeed * 0.25;
      } else {
        e.aiState = 'chase';
        e.fx = dirX;
        e.fy = dirY;
        speed = armoredSpeed;
        e.aiTimer -= dt;
        if (e.aiTimer <= 0) {
          e.aiState = 'windup';
          e.stateTimer = 0.28;
          speed = 0;
          s.events.push('enemy-windup');
        }
      }
    } else {
      const baseSpeed =
        e.kind === 'slime'
          ? e.splitGen === 1
            ? 1.75
            : 1.35
          : e.kind === 'bat'
            ? 1.9
            : e.armored
              ? 1.25
              : 1.7;

      if (e.stumbleTimer > 0) {
        speed = 0;
      } else {
        // World reaction 1: Bats snuff ground flames within 0.88 tiles
        if (e.kind === 'bat') {
          for (const f of s.fires) {
            if (f.remaining > 0 && Math.hypot(e.x - (f.x + 0.5), e.y - (f.y + 0.5)) <= 0.88) {
              f.remaining = 0;
              s.events.push('flame-snuff');
            }
          }
        }

        // World reaction 2: Armored shielders kick grounded front-arc bombs back
        if (e.kind === 'shielder' && e.armored) {
          for (const b of s.bombs) {
            if (b.z > 0.16 || b.fuse <= 0.12) continue;
            const relX = b.x - e.x;
            const relY = b.y - e.y;
            const bDist = Math.hypot(relX, relY);
            if (bDist > 0.88) continue;
            if (relX * e.fx + relY * e.fy < -0.15) continue;
            let kdx: number;
            let kdy: number;
            if (toPx * e.fx + toPy * e.fy > 0.15 && Math.hypot(toPx, toPy) > 0.2) {
              kdx = dirX;
              kdy = dirY;
            } else if (bDist > 0.05) {
              kdx = relX / bDist;
              kdy = relY / bDist;
            } else {
              const fLen = Math.hypot(e.fx, e.fy) || 1;
              kdx = e.fx / fLen;
              kdy = e.fy / fLen;
            }
            if (b.vx * kdx + b.vy * kdy < KICK_SPEED * 0.75) {
              b.vx = kdx * KICK_SPEED * 1.05;
              b.vy = kdy * KICK_SPEED * 1.05;
              b.vz = 0.8;
              b.z = Math.max(b.z, 0.02);
              b.graceOverlap = false;
              b.kicked = false;
              floatingSet.delete(b.id);
              e.aiState = 'recover';
              e.stateTimer = 0.28;
              s.events.push('shielder-kick');
              break;
            }
          }
        }

        // Fuse awareness: non-armored-shielder enemies flee live bombs with fuse < 0.95s
        let threatBomb: Bomb | undefined;
        if (!(e.kind === 'shielder' && e.armored)) {
          let bestBombDist = ENEMY_FLEE_RADIUS;
          for (const b of s.bombs) {
            if (b.fuse >= 0.95) continue;
            const bd = Math.hypot(b.x - e.x, b.y - e.y);
            if (bd <= bestBombDist) {
              bestBombDist = bd;
              threatBomb = b;
            }
          }
        }

        if (threatBomb) {
          e.aiState = 'flee';
          const awayX = e.x - threatBomb.x;
          const awayY = e.y - threatBomb.y;
          const awayLen = Math.hypot(awayX, awayY);
          e.fx = awayLen > 1e-4 ? awayX / awayLen : -dirX;
          e.fy = awayLen > 1e-4 ? awayY / awayLen : -dirY;
          if (e.invulnTimer <= 0 && e.vx * e.fx + e.vy * e.fy < 0) {
            e.vx *= 0.2;
            e.vy *= 0.2;
          }
          speed = baseSpeed * 1.25;
        } else {
          if (e.aiState === 'flee') {
            e.aiState = dist <= ENEMY_NOTICE_RADIUS && roomLit ? 'chase' : 'patrol';
          }

          // Bats steer toward active FirePatches within 3.5 tiles to snuff them
          let targetFire: FirePatch | undefined;
          if (e.kind === 'bat') {
            let bestFireDist = 3.5;
            for (const f of s.fires) {
              if (f.remaining <= 0) continue;
              const fd = Math.hypot(f.x + 0.5 - e.x, f.y + 0.5 - e.y);
              if (fd <= bestFireDist) {
                bestFireDist = fd;
                targetFire = f;
              }
            }
          }

          if (targetFire) {
            const tx = targetFire.x + 0.5 - e.x;
            const ty = targetFire.y + 0.5 - e.y;
            const tLen = Math.hypot(tx, ty) || 1;
            e.fx = tx / tLen;
            e.fy = ty / tLen;
            speed = baseSpeed;
          } else if (e.aiState === 'patrol') {
            if (dist <= ENEMY_NOTICE_RADIUS && roomLit) {
              e.aiState = 'notice';
              e.stateTimer = 0.16;
              e.fx = dirX;
              e.fy = dirY;
              speed = 0;
              s.events.push('enemy-notice');
            } else {
              e.aiTimer += dt * 1.6;
              const orbitX = e.homeX + Math.cos(e.aiTimer + e.id * 1.7) * 0.85;
              const orbitY = e.homeY + Math.sin(e.aiTimer + e.id * 1.7) * 0.85;
              const ox = orbitX - e.x;
              const oy = orbitY - e.y;
              const oLen = Math.hypot(ox, oy);
              if (oLen > 0.08) {
                e.fx = ox / oLen;
                e.fy = oy / oLen;
                speed = 0.45 * baseSpeed;
              } else {
                speed = 0;
              }
            }
          } else if (e.aiState === 'notice') {
            e.fx = dirX;
            e.fy = dirY;
            speed = 0;
            if (e.stateTimer <= 0) {
              e.aiState = 'chase';
            }
          } else if (e.aiState === 'chase') {
            if (dist > 6.4 || !roomLit) {
              e.aiState = 'patrol';
              speed = 0;
            } else if (dist <= 1.45) {
              e.aiState = 'windup';
              e.stateTimer = 0.22;
              e.fx = dirX;
              e.fy = dirY;
              speed = 0;
              s.events.push('enemy-windup');
            } else {
              if (e.kind === 'bat') {
                e.aiTimer += dt * 3.2;
                const wx = dirX + Math.cos(e.aiTimer) * 0.38;
                const wy = dirY + Math.sin(e.aiTimer) * 0.38;
                const wLen = Math.hypot(wx, wy) || 1;
                e.fx = wx / wLen;
                e.fy = wy / wLen;
              } else {
                e.fx = dirX;
                e.fy = dirY;
              }
              speed = baseSpeed;
            }
          } else if (e.aiState === 'windup') {
            const fLen = Math.hypot(e.fx, e.fy);
            if (fLen > 1e-4) {
              e.fx /= fLen;
              e.fy /= fLen;
            } else {
              e.fx = dirX;
              e.fy = dirY;
            }
            speed = 0;
            if (e.stateTimer <= 0) {
              e.vx += e.fx * 4.6;
              e.vy += e.fy * 4.6;
              e.aiState = 'recover';
              e.stateTimer = 0.34;
            }
          } else if (e.aiState === 'recover') {
            e.fx = dirX;
            e.fy = dirY;
            speed = 0.25 * baseSpeed;
            if (e.stateTimer <= 0) {
              e.aiState = dist <= ENEMY_NOTICE_RADIUS && roomLit ? 'chase' : 'patrol';
            }
          }
        }
      }
    }

    const ex = e.x + (e.fx * speed + e.vx) * dt;
    const ey = e.y + (e.fy * speed + e.vy) * dt;
    e.vx *= Math.pow(0.002, dt);
    e.vy *= Math.pow(0.002, dt);

    if (!enemyBlocked(ex, e.y)) e.x = ex;
    if (!enemyBlocked(e.x, ey)) e.y = ey;

    // Contact damage to player (Wickgeist while ghostly in dark deals 1, Cinderhull deals 2, others 1)
    const hitDist = e.kind === 'cinderhull' ? 0.78 : 0.58;
    if (
      e.stumbleTimer <= 0 &&
      Math.hypot(s.x - e.x, s.y - e.y) < hitDist &&
      s.invulnTimer <= 0 &&
      !isRollInvulnerable(s)
    ) {
      if (damagePlayer(world, s, e.kind === 'cinderhull' ? 2 : 1)) {
        return false; // respawned
      }
      s.vx = dirX * 5.5;
      s.vy = dirY * 5.5;
    }
  }
  if (s.fires.some((f) => f.remaining <= 0)) {
    s.fires = s.fires.filter((f) => f.remaining > 0);
  }

  // 7. Update enemy projectiles
  const keptProjectiles = [];
  for (const p of s.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x >= ROOM_W || p.y >= ROOM_H) continue;
    const t = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(p.x), Math.floor(p.y));
    if (isTallWall(t, s.crystalColor)) continue;
    if (Math.hypot(p.x - s.x, p.y - s.y) < 0.45) {
      if (isRollInvulnerable(s)) {
        keptProjectiles.push(p);
        continue;
      }
      if (damagePlayer(world, s, 1)) return false; // respawned; enterRoom cleared projectiles
      continue;
    }
    keptProjectiles.push(p);
  }
  s.projectiles = keptProjectiles;

  // 8. Check puzzle/combat completion, wind-drifted light objects & magnetized pickup collection
  updateGates(world, s);
  updatePillars(world, s, dt);
  checkSolveCondition(world, s);

  const canPickupStand = (nx: number, ny: number): boolean => {
    if (nx < 1.15 || nx > ROOM_W - 1.15 || ny < 1.15 || ny > ROOM_H - 1.15) return false;
    const tx = Math.floor(nx);
    const ty = Math.floor(ny);
    const pt = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
    return (
      !isTileSolidForWalk(pt, s.crystalColor) &&
      pt !== '^' &&
      pt !== '!' &&
      !isWaterTile(pt) &&
      !hasBlockAt(s, tx, ty)
    );
  };

  const remainingPickups: ActivePickup[] = [];
  for (const p of s.pickups) {
    const wv = windVectorAt(world, s, p.x, p.y);
    if (Math.hypot(wv.dx, wv.dy) > 0.05) {
      const nx = p.x + wv.dx * 1.1 * dt;
      const ny = p.y + wv.dy * 1.1 * dt;
      if (canPickupStand(nx, ny)) {
        p.x = nx;
        p.y = ny;
      } else if (canPickupStand(nx, p.y)) {
        p.x = nx;
      } else if (canPickupStand(p.x, ny)) {
        p.y = ny;
      }
    }

    const dist = Math.hypot(s.x - p.x, s.y - p.y);
    if (dist > 0.001 && dist <= PICKUP_MAGNET_RADIUS) {
      const pull = Math.min(dist, (5.5 + (1 - dist / PICKUP_MAGNET_RADIUS) * 4.5) * dt);
      p.x += ((s.x - p.x) / dist) * pull;
      p.y += ((s.y - p.y) / dist) * pull;
    }
    if (Math.hypot(s.x - p.x, s.y - p.y) < 0.52) {
      collectPickup(s, p);
    } else {
      remainingPickups.push(p);
    }
  }
  s.pickups = remainingPickups;

  if (s.gusts.length > 0) {
    for (const g of s.gusts) g.remaining -= dt;
    s.gusts = s.gusts.filter((g) => g.remaining > 0);
  }

  // 9. Portal transitions (`>` stairs & midpoint warp pad)
  if (s.portalCooldown <= 0 && room?.portals) {
    for (const portal of room.portals) {
      if (portal.requiresWarpUnlock && !s.cryptWarpUnlocked) continue;
      if (Math.hypot(s.x - (portal.x + 0.5), s.y - (portal.y + 0.5)) < 0.48) {
        s.portalCooldown = 0.7;
        enterRoom(
          world,
          s,
          portal.targetZone,
          portal.targetRx,
          portal.targetRy,
          portal.targetX,
          portal.targetY,
        );
        if (portal.requiresWarpUnlock) {
          s.events.push('portal-warp');
        }
        if (portal.label) showBanner(s, portal.label, 2.0);
        return true;
      }
    }
  }

  // 10. Flip-screen edge transitions (`GAME.md` §1 — quick fade cut, never a scroll)
  const edgeMoves: [boolean, number, number][] = [
    [s.x < 0, -1, 0],
    [s.x >= ROOM_W, 1, 0],
    [s.y < 0, 0, -1],
    [s.y >= ROOM_H, 0, 1],
  ];
  // Where crossing an edge would land, or null if there is no room or the arrival spot is
  // blocked (brambles or a raised barrier on the far side). Doors and shutters are settled
  // by enterRoom instead.
  const arrival = (
    dx: number,
    dy: number,
  ): { nrx: number; nry: number; nx: number; ny: number } | null => {
    const nrx = s.rx + dx;
    const nry = s.ry + dy;
    if (!world.rooms.has(roomKey(s.zone, nrx, nry))) return null;
    const nx = dx > 0 ? PLAYER_RADIUS + 0.15 : dx < 0 ? ROOM_W - PLAYER_RADIUS - 0.15 : s.x;
    const ny = dy > 0 ? PLAYER_RADIUS + 0.15 : dy < 0 ? ROOM_H - PLAYER_RADIUS - 0.15 : s.y;
    for (let cy = Math.floor(ny - PLAYER_RADIUS); cy <= Math.floor(ny + PLAYER_RADIUS); cy++) {
      for (let cx = Math.floor(nx - PLAYER_RADIUS); cx <= Math.floor(nx + PLAYER_RADIUS); cx++) {
        if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
        const t = tileAt(world, s, s.zone, nrx, nry, cx, cy);
        if (t === 'S' || t === 'D' || t === 'K') continue;
        if (isTileSolidForWalk(t, s.crystalColor)) return null;
      }
    }
    return { nrx, nry, nx, ny };
  };
  for (const [off, dx, dy] of edgeMoves) {
    if (!off) continue;
    const to = arrival(dx, dy);
    if (!to) continue;
    enterRoom(world, s, s.zone, to.nrx, to.nry, to.nx, to.ny);
    return true;
  }

  // Clamp inside room edges that cannot be crossed here
  if (!arrival(-1, 0)) s.x = Math.max(s.x, PLAYER_RADIUS);
  if (!arrival(1, 0)) s.x = Math.min(s.x, ROOM_W - PLAYER_RADIUS);
  if (!arrival(0, -1)) s.y = Math.max(s.y, PLAYER_RADIUS);
  if (!arrival(0, 1)) s.y = Math.min(s.y, ROOM_H - PLAYER_RADIUS);

  return false;
}

// =========================================================================
// Autosave Serialization (`GAME.md` §1)
// =========================================================================

export function exportSave(s: State): SaveData {
  return {
    version: 3,
    zone: s.zone,
    rx: s.rx,
    ry: s.ry,
    x: s.entryX,
    y: s.entryY,
    hp: s.hp,
    maxHp: s.maxHp,
    heartShards: s.heartShards,
    unlockedBombs: [...s.unlockedBombs],
    equipped: s.equipped,
    maxBombs: s.maxBombs,
    blastRadius: s.blastRadius,
    smallKeys: s.smallKeys,
    hasBossKey: s.hasBossKey,
    cryptWarpUnlocked: s.cryptWarpUnlocked,
    cores: [...s.cores],
    visitedRooms: [...s.visitedRooms],
    brokenTiles: [...s.brokenTiles],
    burnedTiles: [...s.burnedTiles],
    openedDoors: [...s.openedDoors],
    solvedRooms: [...s.solvedRooms],
    fledMinibossRooms: [...s.fledMinibossRooms],
    collectedPickups: [...s.collectedPickups],
    crystalColor: s.crystalColor,
    spireCinderSlotted: s.spireCinderSlotted,
  };
}

interface LegacySaveFields {
  version?: unknown;
  slots?: unknown;
  selectedBomb?: unknown;
}

export function importSave(world: World, raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<SaveData> & LegacySaveFields;
  if (d.version !== 3 && d.version !== 2) return null;
  // The first shrine was once 'ember-crypt', then briefly 'fire-mountain'; both load as Ice Cave,
  // in room keys too
  const zoneOf = (v: unknown): unknown =>
    v === 'ember-crypt' || v === 'fire-mountain' ? 'ice-cave' : v;
  const keys = (v: unknown): string[] | null =>
    Array.isArray(v)
      ? v
          .filter((k): k is string => typeof k === 'string')
          .map((k) => k.replace(/^(ember-crypt|fire-mountain):/, 'ice-cave:'))
      : null;
  d.zone = zoneOf(d.zone) as SaveData['zone'];
  if (d.zone !== 'overworld' && d.zone !== 'basement' && d.zone !== 'ice-cave') return null;
  if (typeof d.rx !== 'number' || typeof d.ry !== 'number') return null;
  if (!world.rooms.has(roomKey(d.zone, d.rx, d.ry))) return null;

  const s = newState(
    world,
    d.zone,
    d.rx,
    d.ry,
    typeof d.x === 'number' ? d.x : 5.5,
    typeof d.y === 'number' ? d.y : 6.5,
  );
  if (typeof d.maxHp === 'number' && d.maxHp >= 6) s.maxHp = Math.min(20, d.maxHp);
  if (typeof d.hp === 'number' && d.hp > 0) s.hp = Math.min(s.maxHp, d.hp);
  if (typeof d.heartShards === 'number') s.heartShards = d.heartShards;
  // Saves from before the rename store Blackpowder as 'powder' and Ember as 'ember'
  const bombKind = (v: unknown): BombKind | null => {
    const k = v === 'powder' ? 'bomb' : v === 'ember' ? 'fire' : v;
    return typeof k === 'string' && (ALL_BOMBS as readonly string[]).includes(k)
      ? (k as BombKind)
      : null;
  };
  if (Array.isArray(d.unlockedBombs)) {
    s.unlockedBombs = [];
    for (const b of d.unlockedBombs) {
      const k = bombKind(b);
      if (k && !s.unlockedBombs.includes(k)) s.unlockedBombs.push(k);
    }
    if (d.zone !== 'basement' && !s.unlockedBombs.includes('bomb')) {
      s.unlockedBombs.unshift('bomb');
    }
  }
  const okSlot = (v: unknown): BombKind | null => {
    const k = bombKind(v);
    return k && s.unlockedBombs.includes(k) ? k : null;
  };
  const fallbackBomb: BombKind | null = s.unlockedBombs[0] ?? null;
  if (d.version === 3 && 'equipped' in d && d.equipped !== undefined) {
    s.equipped = d.equipped === null ? null : (okSlot(d.equipped) ?? fallbackBomb);
  } else if (Array.isArray(d.slots) && d.slots.length > 0) {
    const first = d.slots[0];
    s.equipped = first === null ? null : (okSlot(first) ?? fallbackBomb);
  } else {
    s.equipped = okSlot(d.selectedBomb) ?? fallbackBomb;
  }
  if (typeof d.maxBombs === 'number') s.maxBombs = Math.max(2, Math.min(4, d.maxBombs));
  if (typeof d.blastRadius === 'number') s.blastRadius = Math.max(1, Math.min(2, d.blastRadius));
  if (typeof d.smallKeys === 'number') s.smallKeys = Math.max(0, d.smallKeys);
  s.hasBossKey = Boolean(d.hasBossKey);
  s.cryptWarpUnlocked = Boolean(d.cryptWarpUnlocked);
  if (Array.isArray(d.cores)) s.cores = d.cores.filter((c): c is string => typeof c === 'string');
  const visitedRooms = keys(d.visitedRooms);
  if (visitedRooms) s.visitedRooms = new Set(visitedRooms);
  const brokenTiles = keys(d.brokenTiles);
  if (brokenTiles) s.brokenTiles = new Set(brokenTiles);
  const burnedTiles = keys(d.burnedTiles);
  if (burnedTiles) s.burnedTiles = new Set(burnedTiles);
  const openedDoors = keys(d.openedDoors);
  if (openedDoors) s.openedDoors = new Set(openedDoors);
  const solvedRooms = keys(d.solvedRooms);
  if (solvedRooms) s.solvedRooms = new Set(solvedRooms);
  const fledMinibossRooms = keys(d.fledMinibossRooms);
  if (fledMinibossRooms) s.fledMinibossRooms = new Set(fledMinibossRooms);
  if (Array.isArray(d.collectedPickups)) s.collectedPickups = new Set(d.collectedPickups);
  if (d.crystalColor === 'red' || d.crystalColor === 'blue') s.crystalColor = d.crystalColor;
  s.spireCinderSlotted = Boolean(d.spireCinderSlotted);

  // Re-enter room so broken/burned/solved states apply cleanly to spawned entities
  enterRoom(world, s, s.zone, s.rx, s.ry, s.x, s.y);
  return s;
}

/**
 * Core headless simulation for microbomber (`GAME.md`).
 * Pure TypeScript data & rules (no rendering or DOM) so movement, bombs,
 * puzzles, enemies, bosses, and autosave are 100% testable in Vitest.
 */
import { campaignWorld, roomKey } from './campaign';
import {
  type ActivePickup,
  type BlastShape,
  type Bomb,
  type BombKind,
  type Enemy,
  type Input,
  ROOM_H,
  ROOM_W,
  type RoomSpec,
  type SaveData,
  type State,
  type Tile,
  type World,
  type ZoneId,
} from './types';

export { ROOM_H, ROOM_W, campaignWorld, roomKey };
export type { BombKind, Input, RoomSpec, SaveData, State, Tile, World, ZoneId };

export const FIXED_DT = 1 / 60; // 60 Hz deterministic simulation step
export const SPEED = 4.2; // tiles / second
export const POWDER_FUSE = 1.5; // seconds
export const EMBER_FUSE = 1.3; // seconds
export const FIRE_DURATION = 2.5; // seconds an Ember hearth patch burns
export const BOMB_COOLDOWN = 0.7; // seconds between placing new bombs
export const ROLL_DURATION = 0.25; // seconds in dodge roll
export const ROLL_DISTANCE = 2.0; // tiles covered per dodge roll
export const ROLL_IFRAME_START = 0.05; // seconds into roll where i-frames start
export const ROLL_IFRAME_END = 0.2; // seconds into roll where i-frames end (middle 0.15s)
export const ROLL_RECOVERY = 0.35; // seconds after roll ends before next roll
export const INPUT_BUFFER_WINDOW = 0.13; // 130ms input forgiveness window
export const PICKUP_MAGNET_RADIUS = 1.15; // ~1 tile centre-to-centre pickup magnet radius
export const LIFT_DELAY = 0.18; // hold Pull out (A) this long to lift instead of drop
export const THROW_RANGE = 2.8; // legacy nominal lob distance reference
export const THROW_DURATION = 0.26; // legacy nominal lob duration reference
export const BOMB_RADIUS = 0.24; // planar bomb collision radius in tiles
export const BOMB_FRICTION = 13.5; // tiles/s² ground deceleration
export const BOMB_WALL_BOUNCE = 0.65; // wall restitution coefficient
export const BOMB_GRAVITY = 24.0; // tiles/s² vertical gravity
export const THROW_SPEED = 6.0; // initial horizontal speed on lob (~2.8-3.1 tiles total with bounce & roll)
export const THROW_Z0 = 0.55; // initial carry release height in tiles
export const THROW_VZ0 = 1.9; // initial upward lob velocity
export const KICK_SPEED = 6.8; // planar speed imparted when walking into a grounded bomb
export const SHOVE_BOMB_SPEED = 8.4; // planar impulse speed imparted to a blast-shoved bomb

const ROLL_SPEED = ROLL_DISTANCE / ROLL_DURATION;
const PLAYER_RADIUS = 0.28;
const CORNER_SLIDE_MAX = 0.42;
/** Stick magnitude below which a move doesn't re-aim (thumb drift as it lifts off). */
const AIM_MIN_INPUT = 0.22;

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
    'brokenTiles' | 'burnedTiles' | 'openedDoors' | 'crystalColor' | 'roomSolved' | 'solvedRooms'
  >,
  zone: ZoneId,
  rx: number,
  ry: number,
  x: number,
  y: number,
): Tile {
  const room = world.rooms.get(roomKey(zone, rx, ry));
  const raw = room?.rows[y]?.[x] ?? '#';
  if (raw === 'P') return '.';
  const t = raw as Tile;
  const ck = cellKey(zone, rx, ry, x, y);
  if ((t === '%' || t === 'W') && s.brokenTiles.has(ck)) return '.';
  if ((t === 'B' || t === 'W') && s.burnedTiles.has(ck)) return '.';
  if ((t === 'D' || t === 'K') && s.openedDoors.has(ck)) return '.';
  if (t === 'S' && (s.roomSolved || s.solvedRooms.has(roomKey(zone, rx, ry)))) return '.';
  return t;
}

/** Whether tile `t` blocks ground walking for the player and non-flying enemies. */
export function isTileSolidForWalk(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (t === '.' || t === ':' || t === '_' || t === 'O' || t === '!' || t === '>') return false;
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return true;
}

/** Whether tile `t` is a tall wall that stops a thrown bomb's arc. */
function isTallWall(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (t === '#' || t === 'Y' || t === '%' || t === 'D' || t === 'K' || t === 'S') return true;
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return false;
}

/** Whether a room is currently illuminated (true for normal rooms, or dark rooms with fire/lit torches). */
export function isRoomLit(world: World, s: State): boolean {
  const room = currentRoom(world, s);
  if (!room?.dark) return true;
  if (s.roomSolved || s.solvedRooms.has(roomKey(s.zone, s.rx, s.ry))) return true;
  if (s.torches.some((t) => t.lit)) return true;
  if (s.fires.length > 0) return true;
  if (s.bombs.some((b) => b.kind === 'ember')) return true;
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
  s.zone = zone;
  s.rx = rx;
  s.ry = ry;
  s.x = x;
  s.y = y;
  s.vx = 0;
  s.vy = 0;
  s.rollTimer = 0;
  s.rollRecoveryTimer = 0;
  s.pullHoldTime = 0;
  s.rollBufferTimer = 0;
  s.pullBufferTimer = 0;
  s.pullBufferTap = false;
  s.bombs = [];
  s.fires = [];
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

  // Spawn push blocks from 'P' markers in rows
  for (let ty = 0; ty < ROOM_H; ty++) {
    const row = room.rows[ty] ?? '';
    for (let tx = 0; tx < ROOM_W; tx++) {
      if (row[tx] === 'P') {
        s.blocks.push({ x: tx, y: ty, pushCharge: 0, pushDirX: 0, pushDirY: 0 });
      }
    }
  }

  // Spawn torches
  for (const ts of room.torches ?? []) {
    const lit = Boolean(ts.initiallyLit) || (alreadySolved && Boolean(room.condition));
    s.torches.push({
      x: ts.x,
      y: ts.y,
      ...(ts.order !== undefined ? { order: ts.order } : {}),
      ...(ts.timedSeconds !== undefined ? { timedSeconds: ts.timedSeconds } : {}),
      lit,
      timer: ts.timedSeconds ?? 0,
    });
  }

  // Spawn enemies (bosses/minibosses & clear-enemies rooms stay cleared once solved)
  const skipEnemies =
    alreadySolved &&
    (room.condition === 'clear-enemies' ||
      room.condition === 'miniboss' ||
      room.condition === 'boss');
  if (!skipEnemies) {
    for (const es of room.enemies ?? []) {
      const hp =
        es.kind === 'cinderhull'
          ? 12
          : es.kind === 'wickgeist'
            ? 8
            : es.kind === 'shielder'
              ? 2
              : es.kind === 'slime'
                ? 2
                : 1;
      s.enemies.push({
        id: s.nextEntityId++,
        kind: es.kind,
        x: es.x,
        y: es.y,
        vx: 0,
        vy: 0,
        fx: 0,
        fy: 1,
        hp,
        maxHp: hp,
        armored: es.kind === 'shielder' || es.kind === 'cinderhull' || es.kind === 'wickgeist',
        exposedTimer: 0,
        invulnTimer: 0,
        aiTimer: 0.8,
        phase: 1,
      });
    }
  }

  // Spawn pickups that aren't collected yet
  for (const ps of room.pickups ?? []) {
    if (s.collectedPickups.has(ps.id)) continue;
    if (ps.spawnOnSolve && !alreadySolved) continue;
    s.pickups.push({ id: ps.id, kind: ps.kind, x: ps.x, y: ps.y });
  }

  // Auto-slot Cinder Core when visiting Spire Courtyard with it
  if (room.spireSeal && s.cores.includes('cinder') && !s.spireCinderSlotted) {
    s.spireCinderSlotted = true;
    for (const t of s.torches) t.lit = true;
    showBanner(
      s,
      'The Cinder Core blazes on the Spire Seal! (1 of 4 Elemental Cores restored — Vertical Slice Complete!)',
      6,
    );
    s.events.push('core-slotted');
  }
}

export function showBanner(s: State, text: string, duration = 4.2): void {
  s.bannerText = text;
  s.bannerTimer = duration;
}

export function newState(
  world: World,
  zone: ZoneId = 'overworld',
  rx = 3,
  ry = 2,
  x = 5.5,
  y = 6.5,
): State {
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
    pullHoldTime: 0,
    prevHoldB: false,
    prevHoldA: false,
    rollBufferTimer: 0,
    pullBufferTimer: 0,
    pullBufferTap: false,
    hp: 6,
    maxHp: 6,
    heartShards: 0,
    unlockedBombs: ['powder'],
    equipped: 'powder',
    maxBombs: 2,
    blastRadius: 1,
    smallKeys: 0,
    hasBossKey: false,
    cryptWarpUnlocked: false,
    cores: [],
    visitedRooms: new Set(),
    brokenTiles: new Set(),
    burnedTiles: new Set(),
    openedDoors: new Set(),
    solvedRooms: new Set(),
    collectedPickups: new Set(),
    crystalColor: 'red',
    spireCinderSlotted: false,
    nextEntityId: 1,
    bombs: [],
    fires: [],
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
  };
  enterRoom(world, s, zone, rx, ry, x, y);
  return s;
}

/** START menu equip: select `kind` as the single equipped bomb, or `null` for none. */
export function equipBomb(s: State, kind: BombKind | null): void {
  if (kind === null) {
    s.equipped = null;
    return;
  }
  if (s.unlockedBombs.includes(kind)) {
    s.equipped = kind;
  }
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
function sweepAxis(world: World, s: State, axis: 'x' | 'y', d: number): boolean {
  const at = (f: number): [number, number] =>
    axis === 'x' ? [s.x + d * f, s.y] : [s.x, s.y + d * f];
  if (!playerBlockedAt(world, s, ...at(1), true)) {
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
): BombBlockerKind {
  const t = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
  if (t === '%') return 'interactive';
  if (isTallWall(t, s.crystalColor)) return 'wall';
  if (z < 0.42 && (t === 'C' || t === 'T' || t === 'B' || t === 'W')) return 'interactive';
  if (z < 0.22 && (t === '=' || hasBlockAt(s, cx, cy))) return 'wall';
  return 'none';
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
 * Shared between live `tick` simulation and `computeThrowTarget` arc preview.
 */
function stepBombPlanar(world: World, s: State, b: Bomb, subDt: number, emitEvents: boolean): void {
  let bouncedThisStep = false;
  const preSpeed = Math.hypot(b.vx, b.vy);

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
        const kind = classifyBombBlocker(world, s, cx, cy, b.z);
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
      if (hitInteractive) {
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
        const kind = classifyBombBlocker(world, s, cx, cy, b.z);
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
      if (hitInteractive) {
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

/**
 * Deterministically simulate the airborne lob until first ground contact (`z <= 0`, max 45 `FIXED_DT` steps)
 * using the exact wall rebound & obstacle collision rules so the dotted Arc preview shows exact touchdown.
 */
export function computeThrowTarget(world: World, s: State): { targetX: number; targetY: number } {
  const aimLen = Math.hypot(s.aimX, s.aimY);
  const dirX = aimLen > 1e-5 ? s.aimX / aimLen : 0;
  const dirY = aimLen > 1e-5 ? s.aimY / aimLen : -1;
  const [startX, startY] = clampBombSpawn(world, s, s.x, s.y);

  const sim: Bomb = {
    id: -1,
    kind: s.equipped ?? 'powder',
    x: startX,
    y: startY,
    vx: dirX * THROW_SPEED,
    vy: dirY * THROW_SPEED,
    z: THROW_Z0,
    vz: THROW_VZ0,
    fuse: POWDER_FUSE,
    graceOverlap: true,
    shoveCount: 0,
    thrown: true,
  };

  for (let step = 0; step < 45; step++) {
    stepBombPlanar(world, s, sim, FIXED_DT, false);
    sim.vz -= BOMB_GRAVITY * FIXED_DT;
    sim.z += sim.vz * FIXED_DT;
    if (sim.z <= 0) {
      sim.z = 0;
      break;
    }
  }

  return { targetX: sim.x, targetY: sim.y };
}

/**
 * Compute the snapped tile indices where Drop and Throw will land (`GAME.md` §2).
 */
export function computeGhostTargets(
  world: World,
  s: State,
): { dropTile: [number, number]; throwTile: [number, number] } {
  const dropX = Math.max(0, Math.min(ROOM_W - 1, Math.floor(s.x)));
  const dropY = Math.max(0, Math.min(ROOM_H - 1, Math.floor(s.y)));
  const { targetX, targetY } = computeThrowTarget(world, s);
  const throwX = Math.max(0, Math.min(ROOM_W - 1, Math.floor(targetX)));
  const throwY = Math.max(0, Math.min(ROOM_H - 1, Math.floor(targetY)));
  return { dropTile: [dropX, dropY], throwTile: [throwX, throwY] };
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
  return t === 'R' || t === 'U' || t === '^' || t === '~';
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
      const hazard = knockback && (t === '^' || t === '~');
      // Walking may free you from a tile you already overlap, but never steps you into a pit
      const alreadyInside =
        canStandInside(t) &&
        Math.abs(s.x - (cx + 0.5)) < 0.5 + PLAYER_RADIUS &&
        Math.abs(s.y - (cy + 0.5)) < 0.5 + PLAYER_RADIUS &&
        !((t === '^' || t === '~') && Math.floor(x) === cx && Math.floor(y) === cy);
      if (isTileSolidForWalk(t, s.crystalColor) && !hazard && !alreadyInside) return true;
      if (hasBlockAt(s, cx, cy)) return true;
    }
  }
  return false;
}

/** Returns true if the hit knocked the player out and respawned them at the doorway. */
function damagePlayer(world: World, s: State, halfHearts: number, ignoreInvuln = false): boolean {
  if (!ignoreInvuln && (s.invulnTimer > 0 || isRollInvulnerable(s))) return false;
  s.hp = Math.max(0, s.hp - halfHearts);
  s.invulnTimer = 1.05;
  s.events.push('player-hurt');
  if (s.hp <= 0) {
    // Respawn right at the doorway of the room where you fell (`GAME.md` §1)
    s.hp = s.maxHp;
    s.invulnTimer = 1.2;
    s.events.push('player-respawn');
    enterRoom(world, s, s.zone, s.rx, s.ry, s.entryX, s.entryY);
    showBanner(s, 'knocked out! Back on your feet at the doorway.', 2.8);
    return true;
  }
  return false;
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
    solved = s.torches.length > 0 && s.torches.every((t) => t.lit);
  } else if (room.condition === 'hold-buttons') {
    const buttons: [number, number][] = [];
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        if (tileAt(world, s, s.zone, s.rx, s.ry, x, y) === 'O') buttons.push([x, y]);
      }
    }
    solved =
      buttons.length > 0 &&
      buttons.every(
        ([bx, by]) => hasBlockAt(s, bx, by) || (Math.floor(s.x) === bx && Math.floor(s.y) === by),
      );
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
    showBanner(s, 'Wickgeist banished! The Midpoint Warp Pad (>) is now active.', 4.2);
  } else if (room.condition === 'boss') {
    showBanner(s, 'Cinderhull shattered! Claim your Heart Container and the Cinder Core!', 5.0);
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

function lightTorchAt(world: World, s: State, tx: number, ty: number): void {
  const torch = s.torches.find((t) => t.x === tx && t.y === ty);
  if (!torch || torch.lit) return;

  const room = currentRoom(world, s);
  if (room?.condition === 'ordered-torches' && torch.order !== undefined) {
    if (torch.order === s.orderedStep + 1) {
      torch.lit = true;
      s.orderedStep++;
      s.events.push('torch-lit');
      showBanner(s, `Flame ${torch.order} of ${s.torches.length} lit!`, 1.8);
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

/** False when a solid indestructible stone/door wall sits directly between blast origin and target. */
function hasBlastLineOfSight(
  world: World,
  s: State,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
): boolean {
  for (const frac of [0.35, 0.65]) {
    const mx = Math.floor(ox + (tx - ox) * frac);
    const my = Math.floor(oy + (ty - oy) * frac);
    if (mx < 0 || my < 0 || mx >= ROOM_W || my >= ROOM_H) continue;
    const t = tileAt(world, s, s.zone, s.rx, s.ry, mx, my);
    if (t === '#' || t === 'Y' || t === 'D' || t === 'K' || t === 'S') return false;
  }
  return true;
}

function detonateSingleBomb(world: World, s: State, bomb: Bomb, blownIds: Set<number>): Bomb[] {
  const cx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(bomb.x)));
  const cy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(bomb.y)));
  s.events.push(bomb.kind === 'ember' ? 'boom-ember' : 'boom-powder');

  const hitTiles: Array<[number, number, BlastShape]> = [[cx, cy, 'hub']];
  const reach = bomb.kind === 'powder' ? s.blastRadius : 1;
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
      if (t === '#' || t === 'Y' || t === 'D' || t === 'K' || t === 'S') break;
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

  let flippedCrystal = false;

  for (const [tx, ty, shape] of hitTiles) {
    s.blasts.push({ x: tx + 0.5, y: ty + 0.5, kind: bomb.kind, shape });
    const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
    const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);

    if (bomb.kind === 'powder') {
      if (t === '%' || t === 'W') {
        s.brokenTiles.add(ck);
        s.events.push('tile-break');
      }
    } else if (bomb.kind === 'ember') {
      if (t === 'B' || t === 'W') {
        s.burnedTiles.add(ck);
        s.events.push('tile-burn');
      }
      if (t === 'T') {
        lightTorchAt(world, s, tx, ty);
      }
    }

    if (t === 'C' && !flippedCrystal) {
      flippedCrystal = true;
      s.crystalColor = s.crystalColor === 'red' ? 'blue' : 'red';
      s.events.push('crystal-flip');
    }
  }

  // Ember leaves a 2.5 s burning hearth patch on its centre tile if walkable
  if (bomb.kind === 'ember') {
    const centreTile = tileAt(world, s, s.zone, s.rx, s.ry, cx, cy);
    if (
      !isTileSolidForWalk(centreTile, s.crystalColor) &&
      centreTile !== '~' &&
      centreTile !== '^'
    ) {
      const existing = s.fires.find((f) => f.x === cx && f.y === cy);
      if (existing) existing.remaining = FIRE_DURATION;
      else s.fires.push({ x: cx, y: cy, remaining: FIRE_DURATION, tickCooldown: 0 });
    }
  }

  // Unified radial impulse pass around (bomb.x, bomb.y) with shoveRadius = reach + 0.85:
  // 1. Pip: radial shove velocity (~7.0 tiles/s scaled by proximity, 0 direct damage)
  const facing = cardinalFacing(s);
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
  }

  // 2. Enemies: radial shove velocity scaled by mass + cross-blast damage/armor strip
  const litNow = isRoomLit(world, s);
  for (const enemy of s.enemies) {
    const hit = hitTiles.some(
      ([tx, ty]) => Math.hypot(enemy.x - (tx + 0.5), enemy.y - (ty + 0.5)) < 0.92,
    );
    const eDir = radialDir(bomb.x, bomb.y, enemy.x, enemy.y, enemy.fx || 0, enemy.fy || 1);
    const inShove =
      hit ||
      (eDir.dist <= shoveRadius && hasBlastLineOfSight(world, s, bomb.x, bomb.y, enemy.x, enemy.y));
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
      applyBombHitToEnemy(s, enemy, bomb.kind, bomb.x, bomb.y, litNow, false);
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0);

  // 3. Push blocks (s.blocks): shove 1 tile along dominant cardinal radial vector
  const blocksByDist = [...s.blocks].sort(
    (a, b) =>
      Math.hypot(b.x + 0.5 - bomb.x, b.y + 0.5 - bomb.y) -
      Math.hypot(a.x + 0.5 - bomb.x, a.y + 0.5 - bomb.y),
  );
  for (const blk of blocksByDist) {
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
      if (
        (destTile === '.' || destTile === ':' || destTile === '_' || destTile === 'O') &&
        !hasBlockAt(s, destX, destY)
      ) {
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
    if (other.id === bomb.id || other.carried || blownIds.has(other.id)) continue;
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
      other.thrown = false;
      other.fuse = Math.max(other.fuse, 0.35);
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
    if (bomb.carried) s.pullHoldTime = 0;
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

function applyBombHitToEnemy(
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
      showBanner(s, 'Wickgeist fades through the dark—light a brazier with Ember first!', 2.6);
      return;
    }
    enemy.armored = false;
    enemy.hp -= kind === 'powder' ? 2 : 1;
    enemy.invulnTimer = 0.25;
    s.events.push('enemy-hit');
    if (enemy.hp > 0 && enemy.hp <= 4 && enemy.phase === 1) {
      enemy.phase = 2;
      // Snuff one lit torch and blink across the room
      const litTorch = s.torches.find((t) => t.lit);
      if (litTorch) litTorch.lit = false;
      enemy.x = enemy.x < ROOM_W / 2 ? ROOM_W - 3.5 : 3.5;
      enemy.y = enemy.y < ROOM_H / 2 ? ROOM_H - 4.5 : 4.5;
      enemy.vx = 0;
      enemy.vy = 0;
    }
    return;
  }

  if (enemy.kind === 'shielder') {
    if (enemy.armored) {
      if (kind === 'ember') {
        enemy.armored = false;
        enemy.exposedTimer = 99;
        s.events.push('armor-burn');
        showBanner(s, 'Burned away its wooden shield!', 1.8);
        return;
      }
      // Blackpowder from behind still hurts; frontal shield blocks
      const toBombX = originX - enemy.x;
      const toBombY = originY - enemy.y;
      const dot = toBombX * enemy.fx + toBombY * enemy.fy;
      if (dot > -0.1) {
        s.events.push('armor-clank');
        showBanner(s, 'Blocked by its wooden shield—burn it with an Ember Bomb!', 2.4);
        return;
      }
    }
  }

  if (enemy.kind === 'cinderhull') {
    if (enemy.armored) {
      if (kind === 'ember') {
        enemy.armored = false;
        enemy.exposedTimer = 5.2; // generous window (`GAME.md` §2)
        s.events.push('armor-burn');
        showBanner(s, 'Cinderhull’s thorn-vines burned away—blast its exposed core!', 2.6);
      } else {
        s.events.push('armor-clank');
        showBanner(s, 'Thorn-vine armor deflected the blast—burn it with Ember first!', 2.4);
      }
      return;
    }
    const dmg = kind === 'powder' ? 2 : 1;
    const prevBracket = Math.ceil(enemy.hp / 4);
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.invulnTimer = 0.2;
    s.events.push('enemy-hit');
    const nextBracket = Math.ceil(enemy.hp / 4);
    if (enemy.hp > 0 && nextBracket < prevBracket) {
      // Regrow thorn wraps for the next phase!
      enemy.armored = true;
      enemy.exposedTimer = 0;
      enemy.phase++;
      showBanner(s, 'Cinderhull regrew its thorn-vines!', 2.0);
    }
    return;
  }

  // Standard enemies (`slime`, `bat`, unshielded `shielder`)
  enemy.hp -= kind === 'powder' ? 2 : 1;
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
}

function collectPickup(s: State, pickup: ActivePickup): void {
  if (pickup.kind !== 'heart-drop') {
    s.collectedPickups.add(pickup.id);
  }
  s.events.push(`pickup-${pickup.kind}`);
  switch (pickup.kind) {
    case 'small-key':
      s.smallKeys++;
      showBanner(s, 'Found a Small Key! Walk into a locked door to open it.', 3.0);
      break;
    case 'boss-key':
      s.hasBossKey = true;
      showBanner(s, 'Found the Sanctum Boss Key!', 3.2);
      break;
    case 'ember-bomb':
      if (!s.unlockedBombs.includes('ember')) s.unlockedBombs.push('ember');
      s.equipped = 'ember';
      showBanner(
        s,
        'Learned the EMBER BOMB! Lights braziers, burns brambles & wooden shields, and lights the dark.',
        5.0,
      );
      break;
    case 'heart-shard':
      s.heartShards++;
      if (s.heartShards % 2 === 0) {
        s.maxHp = Math.min(20, s.maxHp + 2);
        s.hp = s.maxHp;
        showBanner(s, 'Completed a Heart Shard pair! Max Hearts +1 & full heal!', 4.0);
      } else {
        s.hp = Math.min(s.maxHp, s.hp + 2);
        showBanner(s, 'Found a Heart Shard (1/2)! Find one more for a full Heart.', 3.6);
      }
      break;
    case 'heart-container':
      s.maxHp = Math.min(20, s.maxHp + 2);
      s.hp = s.maxHp;
      showBanner(s, 'Heart Container! Max Hearts increased & health fully restored!', 4.2);
      break;
    case 'satchel-upgrade':
      if (s.maxBombs < 3) {
        s.maxBombs = 3;
        showBanner(s, 'Spark Satchel Upgraded! You can now have 3 live bombs at once.', 4.2);
      } else if (s.blastRadius < 2) {
        s.blastRadius = 2;
        showBanner(s, 'Alchemist’s Powder! Blackpowder blast reach increased to 2 tiles!', 4.2);
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
        'Reclaimed the CINDER CORE (1st Primeval Core)! Return to Spire Courtyard or explore with Ember!',
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
    fuse: kind === 'ember' ? EMBER_FUSE : POWDER_FUSE,
    graceOverlap: false,
    shoveCount: 0,
  };
}

/** New bombs are limited by the satchel and share a cooldown. */
function canPlaceBomb(s: State): boolean {
  return s.bombs.length < s.maxBombs && s.bombCooldown <= 0;
}

function hasStoppedGroundedBombNear(s: State, x: number, y: number): boolean {
  return s.bombs.some(
    (b) =>
      !b.carried &&
      b.z <= 0.05 &&
      Math.hypot(b.vx, b.vy) <= 0.1 &&
      Math.hypot(b.x - x, b.y - y) < 0.45,
  );
}

function dropBomb(world: World, s: State, kind: BombKind | null): void {
  if (!kind || !canPlaceBomb(s)) return;
  const [spawnX, spawnY] = clampBombSpawn(world, s, s.x, s.y);
  if (hasStoppedGroundedBombNear(s, spawnX, spawnY)) return;
  s.bombs.push({ ...newBomb(s, kind, spawnX, spawnY), graceOverlap: true });
  s.events.push('bomb-drop');
}

function hasUnderfootBomb(s: State): boolean {
  return s.bombs.some((b) => !b.carried && b.z < 0.35 && Math.hypot(b.x - s.x, b.y - s.y) < 0.78);
}

/** Lift a live grounded/low bomb underfoot (whatever its kind), else spawn & carry `s.equipped`. */
function liftBomb(s: State): boolean {
  let underfoot: Bomb | undefined;
  let bestDist = 0.78;
  for (const b of s.bombs) {
    if (b.carried || b.z >= 0.35) continue;
    const d = Math.hypot(b.x - s.x, b.y - s.y);
    if (d < bestDist) {
      bestDist = d;
      underfoot = b;
    }
  }
  if (underfoot) {
    underfoot.x = s.x;
    underfoot.y = s.y;
    underfoot.vx = 0;
    underfoot.vy = 0;
    underfoot.z = THROW_Z0;
    underfoot.vz = 0;
    underfoot.carried = true;
    underfoot.thrown = false;
    underfoot.graceOverlap = false;
  } else if (s.equipped !== null && canPlaceBomb(s)) {
    s.bombs.push({ ...newBomb(s, s.equipped, s.x, s.y), z: THROW_Z0, carried: true });
  } else {
    return false;
  }
  s.events.push('bomb-lift');
  return true;
}

function throwCarried(world: World, s: State): void {
  const b = s.bombs.find((bomb) => bomb.carried);
  if (!b) return;
  const aimLen = Math.hypot(s.aimX, s.aimY);
  const dirX = aimLen > 1e-5 ? s.aimX / aimLen : 0;
  const dirY = aimLen > 1e-5 ? s.aimY / aimLen : -1;
  const [startX, startY] = clampBombSpawn(world, s, s.x, s.y);
  delete b.carried;
  b.x = startX;
  b.y = startY;
  b.vx = dirX * THROW_SPEED;
  b.vy = dirY * THROW_SPEED;
  b.z = THROW_Z0;
  b.vz = THROW_VZ0;
  b.thrown = true;
  b.graceOverlap = true;
  s.events.push('bomb-throw');
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

  const [spawnX, spawnY] = clampBombSpawn(world, s, s.x, s.y);
  const carried = s.bombs.find((b) => b.carried);
  if (carried) {
    delete carried.carried;
    carried.x = spawnX;
    carried.y = spawnY;
    carried.vx = 0;
    carried.vy = 0;
    carried.z = 0;
    carried.vz = 0;
    carried.thrown = false;
    carried.graceOverlap = true;
    s.pullHoldTime = 0;
    s.events.push('bomb-drop');
  }
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
    if (!a || a.carried || a.z >= 0.22 || swallowedIds.has(a.id)) continue;
    for (let j = i + 1; j < s.bombs.length; j++) {
      const b = s.bombs[j];
      if (!b || b.carried || b.z >= 0.22 || swallowedIds.has(b.id)) continue;
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
  let moveVx = 0;
  let moveVy = 0;
  if (inLen > 0.01) {
    const scale = SPEED / Math.max(1, inLen);
    moveVx = input.dx * scale;
    moveVy = input.dy * scale;
    s.fx = input.dx / inLen;
    s.fy = input.dy / inLen;
  }
  const totalDx = moveVx * walkDt;
  const totalDy = moveVy * walkDt;
  if (
    Math.abs(totalDx) > 1e-5 &&
    !sweepAxis(world, s, 'x', totalDx) &&
    Math.abs(input.dy) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'x', totalDx, walkDt);
  }
  if (
    Math.abs(totalDy) > 1e-5 &&
    !sweepAxis(world, s, 'y', totalDy) &&
    Math.abs(input.dx) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'y', totalDy, walkDt);
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

  const prevBombCooldown = s.bombCooldown;
  if (s.bombCooldown > 0) s.bombCooldown = Math.max(0, s.bombCooldown - dt);

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
  const releasedA = !heldA && s.prevHoldA;

  const wasRollingAtTickStart = s.rollTimer > 0;
  const prevRollTimer = s.rollTimer;

  if (wasRollingAtTickStart) {
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

  // Kick: walking into a grounded non-carried bomb sends it rolling
  if (s.rollTimer <= 0 && inLen > 0.15) {
    const ux = input.dx / inLen;
    const uy = input.dy / inLen;
    const kickReach = PLAYER_RADIUS + BOMB_RADIUS + 0.06;
    for (const b of s.bombs) {
      if (b.carried || b.z > 0.12 || b.graceOverlap) continue;
      if (Math.hypot(b.x - s.x, b.y - s.y) > kickReach) continue;
      if ((b.x - s.x) * input.dx + (b.y - s.y) * input.dy <= 0.05) continue;
      if (b.vx * ux + b.vy * uy < KICK_SPEED * 0.7) {
        b.vx = ux * KICK_SPEED;
        b.vy = uy * KICK_SPEED;
        b.thrown = false;
        s.events.push('bomb-kick');
      }
    }
  }

  const knockDx = s.vx * dt;
  const knockDy = s.vy * dt;
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
  if (underTile === '^' || underTile === '~') {
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

  // Push-block interaction (`P`)
  if (inLen > 0.4 && s.rollTimer <= 0) {
    const { dx: pdx, dy: pdy } = cardinalFacing(s);
    const aheadX = Math.floor(s.x + pdx * (PLAYER_RADIUS + 0.22));
    const aheadY = Math.floor(s.y + pdy * (PLAYER_RADIUS + 0.22));
    const blk = s.blocks.find((b) => b.x === aheadX && b.y === aheadY);
    if (blk) {
      if (blk.pushDirX === pdx && blk.pushDirY === pdy) {
        blk.pushCharge += dt;
      } else {
        blk.pushDirX = pdx;
        blk.pushDirY = pdy;
        blk.pushCharge = dt;
      }
      if (blk.pushCharge >= 0.16) {
        blk.pushCharge = 0;
        const destX = blk.x + pdx;
        const destY = blk.y + pdy;
        if (destX >= 1 && destY >= 1 && destX < ROOM_W - 1 && destY < ROOM_H - 1) {
          const destTile = tileAt(world, s, s.zone, s.rx, s.ry, destX, destY);
          if (
            (destTile === '.' || destTile === ':' || destTile === '_' || destTile === 'O') &&
            !hasBlockAt(s, destX, destY)
          ) {
            blk.x = destX;
            blk.y = destY;
            s.events.push('block-push');
          }
        }
      }
    }
  }

  // NPC proximity greeting
  const room = currentRoom(world, s);
  for (const npc of room?.npcs ?? []) {
    if (Math.hypot(s.x - npc.x, s.y - npc.y) < 1.15) {
      const text =
        s.cores.includes('cinder') && npc.afterCinderDialogue
          ? npc.afterCinderDialogue
          : npc.dialogue;
      if (s.bannerText !== text) showBanner(s, text, 4.5);
    }
  }

  // 2. A = Pull out (tap drops at feet, hold lifts & carries, release throws along 360° aim)
  for (const b of s.bombs) {
    if (b.carried) {
      b.x = s.x;
      b.y = s.y;
      b.z = THROW_Z0;
    }
  }

  const carryingBeforeA = s.bombs.some((b) => b.carried);
  const underfootAvailable = hasUnderfootBomb(s);
  const prevPullBuffer = s.pullBufferTimer;
  let armedPullBufferThisTick = false;

  if (
    pressedA &&
    (s.bombCooldown > 0 || s.rollTimer > 0) &&
    !carryingBeforeA &&
    !(s.rollTimer <= 0 && underfootAvailable)
  ) {
    s.pullBufferTimer = INPUT_BUFFER_WINDOW;
    s.pullBufferTap = false;
    armedPullBufferThisTick = true;
  }

  if (releasedA && (s.pullBufferTimer > 0 || prevPullBuffer > 0)) {
    s.pullBufferTap = true;
  }

  if (!armedPullBufferThisTick && s.pullBufferTimer > 0) {
    const waitReady = Math.max(
      s.bombCooldown > 0 ? dt + 1 : prevBombCooldown,
      s.rollTimer > 0 ? dt + 1 : prevRollTimer,
    );
    if (s.bombCooldown <= 0 && s.rollTimer <= 0 && prevPullBuffer + 1e-9 >= waitReady) {
      const wasTap = s.pullBufferTap || !heldA;
      s.pullBufferTimer = 0;
      s.pullBufferTap = false;
      if (wasTap) {
        s.pullHoldTime = 0;
        dropBomb(world, s, s.equipped);
      }
    } else {
      s.pullBufferTimer = Math.max(0, s.pullBufferTimer - dt);
      if (s.pullBufferTimer <= 0) {
        s.pullBufferTap = false;
      }
    }
  }

  if (pressedA) {
    s.pullHoldTime = dt;
  } else if (heldA && s.pullHoldTime > 0) {
    s.pullHoldTime += dt;
  }

  if (s.rollTimer <= 0) {
    const carryingNow = s.bombs.some((b) => b.carried);
    if (heldA) {
      if (s.pullHoldTime >= LIFT_DELAY - 1e-9 && !carryingNow) {
        if (liftBomb(s)) {
          s.pullBufferTimer = 0;
          s.pullBufferTap = false;
        }
      }
    } else if (s.pullHoldTime > 0) {
      const was = s.pullHoldTime;
      s.pullHoldTime = 0;
      if (carryingNow) {
        throwCarried(world, s);
      } else if (was < LIFT_DELAY - 1e-9 && s.pullBufferTimer <= 0) {
        dropBomb(world, s, s.equipped);
      }
    }
  } else if (!heldA) {
    s.pullHoldTime = 0;
  }

  s.prevHoldB = heldB;
  s.prevHoldA = heldA;

  // 3. Step-by-step continuous bomb body simulation (carry, lob, bounce, roll, hazards, fuse)
  const toDetonate: Bomb[] = [];
  const swallowedIds = new Set<number>();
  const bombSubSteps = Math.max(1, Math.ceil(dt / (FIXED_DT + 1e-6)));
  const bombSubDt = dt / bombSubSteps;

  for (const b of s.bombs) {
    if (b.carried) {
      b.x = s.x;
      b.y = s.y;
      b.z = THROW_Z0;
      b.vz = 0;
      b.vx = 0;
      b.vy = 0;
      b.fuse -= dt;
      if (b.fuse <= 0) toDetonate.push(b);
      continue;
    }

    if (b.graceOverlap && Math.hypot(b.x - s.x, b.y - s.y) > PLAYER_RADIUS + BOMB_RADIUS + 0.06) {
      b.graceOverlap = false;
    }

    b.fuse -= dt;
    let swallowed = false;
    let impactDetonated = false;

    for (let step = 0; step < bombSubSteps; step++) {
      stepBombPlanar(world, s, b, bombSubDt, true);

      if (b.z > 0 || b.vz > 0) {
        b.vz -= BOMB_GRAVITY * bombSubDt;
        b.z += b.vz * bombSubDt;
        if (b.z <= 0) {
          b.z = 0;
          const lx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
          const ly = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
          const landedTile = tileAt(world, s, s.zone, s.rx, s.ry, lx, ly);
          if (landedTile === '^') {
            swallowed = true;
            swallowedIds.add(b.id);
            s.events.push('bomb-swallow');
            break;
          } else if (landedTile === '~') {
            b.vx = 0;
            b.vy = 0;
            b.vz = 0;
            b.thrown = false;
            s.events.push('bomb-splash');
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

      if (b.z <= 0.01 && b.vz <= 0) {
        const gx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
        const gy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
        const groundTile = tileAt(world, s, s.zone, s.rx, s.ry, gx, gy);
        if (groundTile === '^') {
          swallowed = true;
          swallowedIds.add(b.id);
          s.events.push('bomb-swallow');
          break;
        } else if (groundTile === '~') {
          if (Math.hypot(b.vx, b.vy) > 0.05) {
            b.vx = 0;
            b.vy = 0;
            b.thrown = false;
            s.events.push('bomb-splash');
          }
        } else {
          const speed = Math.hypot(b.vx, b.vy);
          if (speed > 0) {
            const nextSpeed = speed - BOMB_FRICTION * bombSubDt;
            if (nextSpeed <= 0.08) {
              b.vx = 0;
              b.vy = 0;
              b.thrown = false;
            } else {
              const ratio = nextSpeed / speed;
              b.vx *= ratio;
              b.vy *= ratio;
            }
          }
        }
      }

      if (b.graceOverlap && Math.hypot(b.x - s.x, b.y - s.y) > PLAYER_RADIUS + BOMB_RADIUS + 0.06) {
        b.graceOverlap = false;
      }

      // Impact detonation for thrown Blackpowder hitting an enemy (`GAME.md` §4.0)
      const clearOrAged =
        !b.graceOverlap ||
        Math.hypot(b.x - s.x, b.y - s.y) > 0.35 ||
        b.vz <= THROW_VZ0 - BOMB_GRAVITY * 0.045;
      if (
        b.kind === 'powder' &&
        b.thrown &&
        (b.z > 0.05 || Math.hypot(b.vx, b.vy) > 2.0) &&
        clearOrAged &&
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
      if (b.carried || b.z > 0.01) continue;
      const gx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(b.x)));
      const gy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(b.y)));
      const gt = tileAt(world, s, s.zone, s.rx, s.ry, gx, gy);
      if (gt === '^') {
        postSwallowed.add(b.id);
        s.events.push('bomb-swallow');
      } else if (gt === '~' && Math.hypot(b.vx, b.vy) > 0.05) {
        b.vx = 0;
        b.vy = 0;
        b.thrown = false;
        s.events.push('bomb-splash');
      }
    }
    if (postSwallowed.size > 0) {
      s.bombs = s.bombs.filter((b) => !postSwallowed.has(b.id));
    }
  }

  if (toDetonate.length > 0) {
    const activeIds = new Set(s.bombs.map((b) => b.id));
    detonateBombs(
      world,
      s,
      toDetonate.filter((b) => activeIds.has(b.id)),
    );
  }

  // 4. Update burning Ember patches (`2.5 s`)
  for (const f of s.fires) {
    f.remaining -= dt;
    f.tickCooldown = Math.max(0, f.tickCooldown - dt);
    if (f.tickCooldown <= 0) {
      const litNow = isRoomLit(world, s);
      for (const e of s.enemies) {
        if (Math.hypot(e.x - (f.x + 0.5), e.y - (f.y + 0.5)) < 0.72) {
          applyBombHitToEnemy(s, e, 'ember', f.x + 0.5, f.y + 0.5, litNow);
          f.tickCooldown = 0.55;
        }
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
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

  // 6. Update enemies & boss AI
  const roomLit = isRoomLit(world, s);
  for (const e of s.enemies) {
    if (e.invulnTimer > 0) e.invulnTimer = Math.max(0, e.invulnTimer - dt);
    if (e.exposedTimer > 0) {
      e.exposedTimer = Math.max(0, e.exposedTimer - dt);
      if (e.exposedTimer <= 0 && e.kind === 'cinderhull') {
        e.armored = true;
      }
    }

    const toPx = s.x - e.x;
    const toPy = s.y - e.y;
    const dist = Math.hypot(toPx, toPy) || 1;
    const dirX = toPx / dist;
    const dirY = toPy / dist;

    let speed = 0;
    if (e.kind === 'slime') {
      speed = 1.35;
      e.fx = dirX;
      e.fy = dirY;
    } else if (e.kind === 'bat') {
      e.aiTimer += dt * 3.2;
      speed = 1.9;
      e.fx = dirX + Math.cos(e.aiTimer) * 0.45;
      e.fy = dirY + Math.sin(e.aiTimer) * 0.45;
    } else if (e.kind === 'shielder') {
      speed = e.armored ? 1.25 : 1.7;
      e.fx = dirX;
      e.fy = dirY;
    } else if (e.kind === 'wickgeist') {
      e.armored = !roomLit;
      speed = roomLit ? 1.1 : 1.65;
      e.fx = dirX;
      e.fy = dirY;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0) {
        e.aiTimer = 2.4;
        s.projectiles.push({ x: e.x, y: e.y, vx: dirX * 3.1, vy: dirY * 3.1, life: 3.2 });
      }
    } else if (e.kind === 'cinderhull') {
      speed = e.armored ? 1.1 + (e.phase - 1) * 0.25 : 0.45;
      e.fx = dirX;
      e.fy = dirY;
      e.aiTimer -= dt;
      if (e.aiTimer <= 0 && e.armored) {
        e.aiTimer = Math.max(1.8, 2.7 - (e.phase - 1) * 0.3);
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
      }
    }

    const ex = e.x + (e.fx * speed + e.vx) * dt;
    const ey = e.y + (e.fy * speed + e.vy) * dt;
    e.vx *= Math.pow(0.002, dt);
    e.vy *= Math.pow(0.002, dt);

    const canFly = e.kind === 'bat' || e.kind === 'wickgeist';
    const enemyBlocked = (nx: number, ny: number): boolean => {
      if (nx < 0.7 || ny < 0.7 || nx > ROOM_W - 0.7 || ny > ROOM_H - 0.7) return true;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(nx), Math.floor(ny));
      if (canFly) return isTallWall(t, s.crystalColor);
      return isTileSolidForWalk(t, s.crystalColor) || hasBlockAt(s, Math.floor(nx), Math.floor(ny));
    };

    if (!enemyBlocked(ex, e.y)) e.x = ex;
    if (!enemyBlocked(e.x, ey)) e.y = ey;

    // Contact damage to player (Wickgeist while ghostly in dark deals 1, Cinderhull deals 2, others 1)
    const hitDist = e.kind === 'cinderhull' ? 0.78 : 0.58;
    if (
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

  // 8. Check puzzle/combat completion & magnetized pickup collection
  checkSolveCondition(world, s);

  const remainingPickups: ActivePickup[] = [];
  for (const p of s.pickups) {
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

  for (const b of s.bombs) {
    if (b.carried) {
      b.x = s.x;
      b.y = s.y;
      b.z = THROW_Z0;
    }
  }

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
  if (d.zone !== 'overworld' && d.zone !== 'ember-crypt') return null;
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
  if (Array.isArray(d.unlockedBombs) && d.unlockedBombs.length > 0) {
    s.unlockedBombs = d.unlockedBombs.filter((b): b is BombKind => b === 'powder' || b === 'ember');
    if (!s.unlockedBombs.includes('powder')) s.unlockedBombs.unshift('powder');
  }
  const okSlot = (v: unknown): BombKind | null =>
    (v === 'powder' || v === 'ember') && s.unlockedBombs.includes(v) ? v : null;
  if (d.version === 3 && 'equipped' in d && d.equipped !== undefined) {
    s.equipped = d.equipped === null ? null : (okSlot(d.equipped) ?? 'powder');
  } else if (Array.isArray(d.slots) && d.slots.length > 0) {
    const first = d.slots[0];
    s.equipped = first === null ? null : (okSlot(first) ?? 'powder');
  } else {
    s.equipped = okSlot(d.selectedBomb) ?? 'powder';
  }
  if (typeof d.maxBombs === 'number') s.maxBombs = Math.max(2, Math.min(4, d.maxBombs));
  if (typeof d.blastRadius === 'number') s.blastRadius = Math.max(1, Math.min(2, d.blastRadius));
  if (typeof d.smallKeys === 'number') s.smallKeys = Math.max(0, d.smallKeys);
  s.hasBossKey = Boolean(d.hasBossKey);
  s.cryptWarpUnlocked = Boolean(d.cryptWarpUnlocked);
  if (Array.isArray(d.cores)) s.cores = d.cores.filter((c): c is string => typeof c === 'string');
  if (Array.isArray(d.visitedRooms)) s.visitedRooms = new Set(d.visitedRooms);
  if (Array.isArray(d.brokenTiles)) s.brokenTiles = new Set(d.brokenTiles);
  if (Array.isArray(d.burnedTiles)) s.burnedTiles = new Set(d.burnedTiles);
  if (Array.isArray(d.openedDoors)) s.openedDoors = new Set(d.openedDoors);
  if (Array.isArray(d.solvedRooms)) s.solvedRooms = new Set(d.solvedRooms);
  if (Array.isArray(d.collectedPickups)) s.collectedPickups = new Set(d.collectedPickups);
  if (d.crystalColor === 'red' || d.crystalColor === 'blue') s.crystalColor = d.crystalColor;
  s.spireCinderSlotted = Boolean(d.spireCinderSlotted);

  // Re-enter room so broken/burned/solved states apply cleanly to spawned entities
  enterRoom(world, s, s.zone, s.rx, s.ry, s.x, s.y);
  return s;
}

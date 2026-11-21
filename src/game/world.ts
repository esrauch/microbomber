/**
 * Core headless simulation for microbomber (`GAME.md`).
 * Pure TypeScript data & rules (no three.js or DOM) so movement, bombs,
 * puzzles, enemies, bosses, and autosave are 100% testable in Vitest.
 */
import { campaignWorld, roomKey } from './campaign';
import {
  type ActivePickup,
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
export type { Input, RoomSpec, SaveData, State, Tile, World, ZoneId };

export const SPEED = 4.2; // tiles / second
export const POWDER_FUSE = 1.5; // seconds
export const EMBER_FUSE = 1.3; // seconds
export const FIRE_DURATION = 2.5; // seconds an Ember hearth patch burns
export const THROW_RANGE = 3; // tiles lobbed ahead
export const THROW_DURATION = 0.24; // seconds in flight
const PLAYER_RADIUS = 0.28;
const CORNER_SLIDE_MAX = 0.42;
/** Stick magnitude below which a move doesn't re-aim (thumb drift as it lifts off). */
const AIM_MIN_INPUT = 0.3;
/** The off-axis must beat the current aim axis by this ratio to turn (~50 degrees). */
const AIM_TURN_RATIO = 1.2;

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
  if (t === '.' || t === 'O' || t === '!' || t === '>') return false;
  if (t === 'R') return crystalColor === 'red';
  if (t === 'U') return crystalColor === 'blue';
  return true;
}

/** Whether tile `t` is a tall wall that stops a thrown bomb's arc. */
function isTallWall(t: Tile, crystalColor: 'red' | 'blue'): boolean {
  if (t === '#' || t === '%' || t === 'D' || t === 'K' || t === 'S') return true;
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
  x = 4.5,
  y = 5.5,
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
    hp: 6,
    maxHp: 6,
    heartShards: 0,
    unlockedBombs: ['powder'],
    selectedBomb: 'powder',
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

/** Snap facing vector to the nearest cardinal direction for crisp tile-aligned throws. */
export function cardinalFacing(s: Pick<State, 'aimX' | 'aimY'>): { dx: number; dy: number } {
  return { dx: s.aimX, dy: s.aimY };
}

/** Re-aim toward stick direction `(dx, dy)`, holding the current axis near diagonals. */
function updateAim(s: State, dx: number, dy: number): void {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const onX = s.aimX !== 0;
  if (onX ? ay > ax * AIM_TURN_RATIO : ax <= ay * AIM_TURN_RATIO) {
    s.aimX = 0;
    s.aimY = dy >= 0 ? 1 : -1;
  } else {
    s.aimX = dx >= 0 ? 1 : -1;
    s.aimY = 0;
  }
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
function cornerSlide(world: World, s: State, axis: 'x' | 'y', d: number, dt: number): void {
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
  const step = Math.sign(lane - across) * Math.min(SPEED * dt, Math.abs(lane - across));
  if (axis === 'x' && !probe(s.x, s.y + step)) s.y += step;
  if (axis === 'y' && !probe(s.y, s.x + step)) s.x += step;
}

/**
 * Compute the snapped tile centres where Drop and Throw will land (`GAME.md` §2 ghost marker).
 */
export function computeGhostTargets(
  world: World,
  s: State,
): { dropTile: [number, number]; throwTile: [number, number] } {
  const dropX = Math.max(0, Math.min(ROOM_W - 1, Math.floor(s.x)));
  const dropY = Math.max(0, Math.min(ROOM_H - 1, Math.floor(s.y)));
  const { dx, dy } = cardinalFacing(s);

  let bestX = dropX;
  let bestY = dropY;
  for (let step = 1; step <= THROW_RANGE; step++) {
    const tx = dropX + dx * step;
    const ty = dropY + dy * step;
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) break;
    const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
    if (isTallWall(t, s.crystalColor)) {
      // Allow landing right at a `%` cracked wall's inner face (`bestX, bestY` already holds it)
      break;
    }
    bestX = tx;
    bestY = ty;
    // Stop directly on interactive pedestals/brambles/crates so thrown bombs strike them squarely
    if (t === 'C' || t === 'T' || t === 'B' || t === 'W') break;
  }
  return { dropTile: [dropX, dropY], throwTile: [bestX, bestY] };
}

function hasBlockAt(s: State, tx: number, ty: number): boolean {
  return s.blocks.some((b) => b.x === tx && b.y === ty);
}

function hasSolidBombAt(s: State, tx: number, ty: number): boolean {
  return s.bombs.some(
    (b) => !b.flight && !b.graceOverlap && Math.floor(b.x) === tx && Math.floor(b.y) === ty,
  );
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
      if (hasSolidBombAt(s, cx, cy)) return true;
    }
  }
  return false;
}

/** Returns true if the hit knocked the player out and respawned them at the doorway. */
function damagePlayer(world: World, s: State, halfHearts: number, ignoreInvuln = false): boolean {
  if (s.invulnTimer > 0 && !ignoreInvuln) return false;
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

function detonateBomb(world: World, s: State, bomb: Bomb): void {
  const cx = Math.max(0, Math.min(ROOM_W - 1, Math.floor(bomb.x)));
  const cy = Math.max(0, Math.min(ROOM_H - 1, Math.floor(bomb.y)));
  s.events.push(bomb.kind === 'ember' ? 'boom-ember' : 'boom-powder');

  const hitTiles: [number, number][] = [[cx, cy]];
  const reach = bomb.kind === 'powder' ? s.blastRadius : 1;

  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    for (let r = 1; r <= reach; r++) {
      const tx = cx + dx * r;
      const ty = cy + dy * r;
      if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) break;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, tx, ty);
      if (t === '#' || t === 'D' || t === 'K' || t === 'S') break;
      hitTiles.push([tx, ty]);
      // Stop arm after hitting a solid destructible/pedestal tile so blasts don't pierce walls
      if (t === '%' || t === 'W' || t === 'B' || t === 'C' || t === 'T') break;
    }
  }

  let flippedCrystal = false;

  for (const [tx, ty] of hitTiles) {
    s.blasts.push({ x: tx + 0.5, y: ty + 0.5, kind: bomb.kind });
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

    // Chain-detonate other grounded bombs caught in the blast
    for (const other of s.bombs) {
      if (other.id !== bomb.id && !other.flight) {
        if (Math.floor(other.x) === tx && Math.floor(other.y) === ty) {
          other.fuse = Math.min(other.fuse, 0.05);
        }
      }
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

  // Harmless self-knockback (`~1` tile shove, 0 direct damage; `GAME.md` §1)
  const inBlast = hitTiles.some(
    ([tx, ty]) => Math.hypot(s.x - (tx + 0.5), s.y - (ty + 0.5)) < 0.85,
  );
  if (inBlast) {
    let kx = s.x - (cx + 0.5);
    let ky = s.y - (cy + 0.5);
    const kLen = Math.hypot(kx, ky);
    if (kLen < 0.05) {
      const f = cardinalFacing(s);
      kx = -f.dx;
      ky = -f.dy;
    } else {
      kx /= kLen;
      ky /= kLen;
    }
    s.vx = kx * 6.5;
    s.vy = ky * 6.5;
  }

  // Damage / strip armor on enemies caught in hitTiles
  const litNow = isRoomLit(world, s);
  for (const enemy of s.enemies) {
    const hit = hitTiles.some(
      ([tx, ty]) => Math.hypot(enemy.x - (tx + 0.5), enemy.y - (ty + 0.5)) < 0.92,
    );
    if (!hit) continue;
    applyBombHitToEnemy(s, enemy, bomb.kind, cx + 0.5, cy + 0.5, litNow);
  }

  s.enemies = s.enemies.filter((e) => e.hp > 0);
}

function applyBombHitToEnemy(
  s: State,
  enemy: Enemy,
  kind: BombKind,
  originX: number,
  originY: number,
  roomLit: boolean,
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
      enemy.x = enemy.x < 4.5 ? 6.5 : 2.5;
      enemy.y = enemy.y < 5.5 ? 7.5 : 3.5;
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
  let kx = enemy.x - originX;
  let ky = enemy.y - originY;
  const len = Math.hypot(kx, ky) || 1;
  kx /= len;
  ky /= len;
  enemy.vx = kx * 5;
  enemy.vy = ky * 5;
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
      s.selectedBomb = 'ember';
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
export function tick(world: World, s: State, input: Input, dt: number): boolean {
  s.blasts = [];
  s.events = [];

  if (s.bannerTimer > 0) {
    s.bannerTimer = Math.max(0, s.bannerTimer - dt);
    if (s.bannerTimer <= 0) s.bannerText = null;
  }
  if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - dt);
  if (s.portalCooldown > 0) s.portalCooldown = Math.max(0, s.portalCooldown - dt);

  if (input.selectBomb && s.unlockedBombs.includes(input.selectBomb)) {
    s.selectedBomb = input.selectBomb;
  }

  // 1. Player movement + corner sliding (`GAME.md` §2) + knockback velocity
  const inLen = Math.hypot(input.dx, input.dy);
  let moveVx = 0;
  let moveVy = 0;
  if (inLen > 0.01) {
    const scale = SPEED / Math.max(1, inLen);
    moveVx = input.dx * scale;
    moveVy = input.dy * scale;
    s.fx = input.dx / inLen;
    s.fy = input.dy / inLen;
    if (inLen >= AIM_MIN_INPUT) updateAim(s, input.dx, input.dy);
  }

  const totalDx = moveVx * dt;
  const totalDy = moveVy * dt;
  const knockDx = s.vx * dt;
  const knockDy = s.vy * dt;
  s.vx *= Math.pow(0.001, dt);
  s.vy *= Math.pow(0.001, dt);
  if (Math.hypot(s.vx, s.vy) < 0.08) {
    s.vx = 0;
    s.vy = 0;
  }

  // Move each axis flush to contact, with corner assist when pushing mostly straight
  if (
    Math.abs(totalDx) > 1e-5 &&
    !sweepAxis(world, s, 'x', totalDx) &&
    Math.abs(input.dy) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'x', totalDx, dt);
  }
  if (
    Math.abs(totalDy) > 1e-5 &&
    !sweepAxis(world, s, 'y', totalDy) &&
    Math.abs(input.dx) < 0.5 * inLen
  ) {
    cornerSlide(world, s, 'y', totalDy, dt);
  }

  // Knockback moves separately: it ignores corner sliding and can carry you over a pit,
  // but never out through a doorway; only walking leaves a room
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
  if (inLen > 0.4) {
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
          if ((destTile === '.' || destTile === 'O') && !hasBlockAt(s, destX, destY)) {
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

  // 2. Bomb Drop & Throw (`GAME.md` §2 — one gesture per button)
  const { dropTile, throwTile } = computeGhostTargets(world, s);

  if (input.drop && s.bombs.length < s.maxBombs) {
    const [bx, by] = dropTile;
    const occupied = s.bombs.some(
      (b) => !b.flight && Math.floor(b.x) === bx && Math.floor(b.y) === by,
    );
    if (!occupied) {
      s.bombs.push({
        id: s.nextEntityId++,
        kind: s.selectedBomb,
        x: bx + 0.5,
        y: by + 0.5,
        fuse: s.selectedBomb === 'ember' ? EMBER_FUSE : POWDER_FUSE,
        graceOverlap: true,
      });
      s.events.push('bomb-drop');
    }
  }

  if (input.throwBomb) {
    // If standing on/beside a grounded bomb on our tile, throw that one; else lob a fresh one
    const underfoot = s.bombs.find((b) => !b.flight && Math.hypot(b.x - s.x, b.y - s.y) < 0.75);
    const [tx, ty] = throwTile;
    if (underfoot) {
      underfoot.graceOverlap = false;
      underfoot.flight = {
        startX: underfoot.x,
        startY: underfoot.y,
        targetX: tx + 0.5,
        targetY: ty + 0.5,
        elapsed: 0,
        duration: THROW_DURATION,
      };
      s.events.push('bomb-throw');
    } else if (s.bombs.length < s.maxBombs) {
      s.bombs.push({
        id: s.nextEntityId++,
        kind: s.selectedBomb,
        x: s.x,
        y: s.y,
        fuse: s.selectedBomb === 'ember' ? EMBER_FUSE : POWDER_FUSE,
        graceOverlap: false,
        flight: {
          startX: s.x,
          startY: s.y,
          targetX: tx + 0.5,
          targetY: ty + 0.5,
          elapsed: 0,
          duration: THROW_DURATION,
        },
      });
      s.events.push('bomb-throw');
    }
  }

  // 3. Update active bombs (flight, overlap grace, impact detonation, fuse)
  const toDetonate: Bomb[] = [];
  for (const b of s.bombs) {
    if (b.graceOverlap && Math.hypot(s.x - b.x, s.y - b.y) > 0.78) {
      b.graceOverlap = false;
    }
    if (b.flight) {
      b.flight.elapsed += dt;
      const u = Math.min(1, b.flight.elapsed / b.flight.duration);
      b.x = b.flight.startX + (b.flight.targetX - b.flight.startX) * u;
      b.y = b.flight.startY + (b.flight.targetY - b.flight.startY) * u;

      // Impact detonation on enemy collision, thrown Blackpowder only (`GAME.md` §4.0)
      const clearOfThrower = Math.hypot(b.x - b.flight.startX, b.y - b.flight.startY) > 0.6;
      const hitEnemy =
        b.kind === 'powder' &&
        clearOfThrower &&
        s.enemies.some((e) => Math.hypot(e.x - b.x, e.y - b.y) < 0.68);
      if (hitEnemy) {
        delete b.flight;
        toDetonate.push(b);
        continue;
      }

      if (u >= 1) {
        b.x = b.flight.targetX;
        b.y = b.flight.targetY;
        delete b.flight;
        const landedTile = tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(b.x), Math.floor(b.y));
        // Instant detonation if thrown directly onto a Crystal, Brazier, Bramble, Crate, Pit, or Water
        if (
          landedTile === 'C' ||
          landedTile === 'T' ||
          landedTile === 'B' ||
          landedTile === 'W' ||
          landedTile === '^' ||
          landedTile === '~'
        ) {
          toDetonate.push(b);
          continue;
        }
      }
    } else {
      b.fuse -= dt;
      if (b.fuse <= 0) toDetonate.push(b);
    }
  }

  if (toDetonate.length > 0) {
    const blownIds = new Set(toDetonate.map((b) => b.id));
    s.bombs = s.bombs.filter((b) => !blownIds.has(b.id));
    for (const b of toDetonate) {
      detonateBomb(world, s, b);
    }
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
      return (
        isTileSolidForWalk(t, s.crystalColor) ||
        hasBlockAt(s, Math.floor(nx), Math.floor(ny)) ||
        hasSolidBombAt(s, Math.floor(nx), Math.floor(ny))
      );
    };

    if (!enemyBlocked(ex, e.y)) e.x = ex;
    if (!enemyBlocked(e.x, ey)) e.y = ey;

    // Contact damage to player (Wickgeist while ghostly in dark deals 1, Cinderhull deals 2, others 1)
    const hitDist = e.kind === 'cinderhull' ? 0.78 : 0.58;
    if (Math.hypot(s.x - e.x, s.y - e.y) < hitDist) {
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
      if (damagePlayer(world, s, 1)) return false; // respawned; enterRoom cleared projectiles
      continue;
    }
    keptProjectiles.push(p);
  }
  s.projectiles = keptProjectiles;

  // 8. Check puzzle/combat completion & pickup collection
  checkSolveCondition(world, s);

  const remainingPickups: ActivePickup[] = [];
  for (const p of s.pickups) {
    if (Math.hypot(s.x - p.x, s.y - p.y) < 0.65) {
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

  return false;
}

// =========================================================================
// Autosave Serialization (`GAME.md` §1)
// =========================================================================

export function exportSave(s: State): SaveData {
  return {
    version: 1,
    zone: s.zone,
    rx: s.rx,
    ry: s.ry,
    x: s.entryX,
    y: s.entryY,
    hp: s.hp,
    maxHp: s.maxHp,
    heartShards: s.heartShards,
    unlockedBombs: [...s.unlockedBombs],
    selectedBomb: s.selectedBomb,
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

export function importSave(world: World, raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<SaveData>;
  if (d.version !== 1) return null;
  if (d.zone !== 'overworld' && d.zone !== 'ember-crypt') return null;
  if (typeof d.rx !== 'number' || typeof d.ry !== 'number') return null;
  if (!world.rooms.has(roomKey(d.zone, d.rx, d.ry))) return null;

  const s = newState(
    world,
    d.zone,
    d.rx,
    d.ry,
    typeof d.x === 'number' ? d.x : 4.5,
    typeof d.y === 'number' ? d.y : 5.5,
  );
  if (typeof d.maxHp === 'number' && d.maxHp >= 6) s.maxHp = Math.min(20, d.maxHp);
  if (typeof d.hp === 'number' && d.hp > 0) s.hp = Math.min(s.maxHp, d.hp);
  if (typeof d.heartShards === 'number') s.heartShards = d.heartShards;
  if (Array.isArray(d.unlockedBombs) && d.unlockedBombs.length > 0) {
    s.unlockedBombs = d.unlockedBombs.filter((b): b is BombKind => b === 'powder' || b === 'ember');
    if (!s.unlockedBombs.includes('powder')) s.unlockedBombs.unshift('powder');
  }
  if (d.selectedBomb && s.unlockedBombs.includes(d.selectedBomb)) {
    s.selectedBomb = d.selectedBomb;
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

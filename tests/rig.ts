import { DUNGEON_999_ENTRIES } from '../src/game/dungeon999';
import { isRampTile, levelAt } from '../src/game/elevation';
import {
  BOMB_FUSES,
  FIXED_DT,
  type BombKind,
  type Input,
  type State,
  type World,
  currentRoom,
  equipBomb,
  isTileSolidForWalk,
  newState,
  tick,
  tileAt,
} from '../src/game/world';
import { idle, kickA, tapA } from './input';

/** A fresh state standing at the room's Lobby-pad arrival point. */
export function arrive(world: World, rx: number, ry: number): State {
  const [x, y] = DUNGEON_999_ENTRIES.get(`${rx},${ry}`)!;
  return newState(world, 'dungeon-999', rx, ry, x, y);
}

/** Tiles Pip can walk to from where he stands, with nothing changed in the room. */
export function walkable(world: World, s: State): [number, number][] {
  const start: [number, number] = [Math.floor(s.x), Math.floor(s.y)];
  const seen = new Set([start.join(',')]);
  const out: [number, number][] = [];
  const queue = [start];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    out.push([x, y]);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx!;
      const ny = y + dy!;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      const t = tileAt(world, s, s.zone, s.rx, s.ry, nx, ny);
      if (isTileSolidForWalk(t, s.crystalColor) || t === '!' || t === '>') continue;
      // Floor levels: Pip steps only onto his own level, except on and off ramps
      const room = currentRoom(world, s);
      if (
        !isRampTile(room, x, y) &&
        !isRampTile(room, nx, ny) &&
        levelAt(room, s, nx, ny) !== levelAt(room, s, x, y)
      ) {
        continue;
      }
      if (s.blocks.some((b) => b.x === nx && b.y === ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return out;
}

export const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Stand Pip on a tile centre facing `(dx, dy)`. */
export function standAt(s: State, x: number, y: number, dx: number, dy: number): void {
  s.x = x + 0.5;
  s.y = y + 0.5;
  s.fx = dx;
  s.fy = dy;
  s.aimX = dx;
  s.aimY = dy;
}

/** Drop (`'drop'`) or throw (`'throw'`) one `kind` bomb from where Pip stands, facing `(dx, dy)`. */
export function useBomb(
  world: World,
  s: State,
  kind: BombKind,
  how: 'drop' | 'throw',
  dx: number,
  dy: number,
): void {
  equipBomb(s, kind);
  s.bombCooldown = 0;
  s.fx = dx;
  s.fy = dy;
  s.aimX = dx;
  s.aimY = dy;
  if (how === 'drop') tapA(world, s);
  else kickA(world, s, dx, dy);
}

/** Walk toward each waypoint (tile centres) in turn; gives up after `maxSeconds`. */
export function walkPath(
  world: World,
  s: State,
  points: [number, number][],
  maxSeconds = 6,
): boolean {
  let budget = Math.ceil(maxSeconds / FIXED_DT);
  for (const [px, py] of points) {
    const tx = px + 0.5;
    const ty = py + 0.5;
    while (Math.hypot(tx - s.x, ty - s.y) > 0.12) {
      if (budget-- <= 0) return false;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const len = Math.hypot(dx, dy);
      const input: Input = { dx: dx / len, dy: dy / len };
      tick(world, s, input, FIXED_DT);
      if (s.zone !== 'dungeon-999') return false;
    }
  }
  return true;
}

export function wait(world: World, s: State, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / FIXED_DT); i++) tick(world, s, idle, FIXED_DT);
}

/**
 * Every single-bomb shortcut: from each tile Pip can walk to, drop or throw each kit bomb
 * in each direction and let it play out. Returns the ones that solve the room.
 */
export function singleBombShortcuts(world: World, rx: number, ry: number): string[] {
  const base = arrive(world, rx, ry);
  const kitBombs = currentRoom(world, base)?.kit?.bombs ?? [];
  const found: string[] = [];
  for (const [x, y] of walkable(world, base)) {
    for (const kind of kitBombs) {
      for (const how of ['drop', 'throw'] as const) {
        for (const [dx, dy] of DIRS) {
          const s = arrive(world, rx, ry);
          standAt(s, x, y, dx, dy);
          useBomb(world, s, kind, how, dx, dy);
          // Long enough for the burst and its aftermath (a fuse line burns for ~2.5 s)
          wait(world, s, BOMB_FUSES[kind] + (kind === 'fire' ? 2.6 : 0.6));
          const stayed = s.zone === 'dungeon-999' && s.rx === rx && s.ry === ry;
          if (stayed && s.roomSolved)
            found.push(`${how} ${kind} from (${x},${y}) facing (${dx},${dy})`);
        }
      }
    }
  }
  return found;
}

/**
 * A patient walker with no bombs: wanders for `seconds` of game time, changing direction
 * (or pausing) every half second to two, seeded so a failure replays. True if it ever
 * solves the room, which catches switches that moving creatures press on their own.
 */
export function wanderSolves(
  world: World,
  rx: number,
  ry: number,
  seed: number,
  seconds = 120,
): boolean {
  const s = arrive(world, rx, ry);
  let rng = seed >>> 0 || 1;
  const rand = (): number => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };
  let input: Input = { dx: 0, dy: 0 };
  let hold = 0;
  for (let t = 0; t < seconds; t += FIXED_DT) {
    if (hold <= 0) {
      const a = rand() * Math.PI * 2;
      input = rand() < 0.2 ? { dx: 0, dy: 0 } : { dx: Math.cos(a), dy: Math.sin(a) };
      hold = 0.5 + rand() * 1.5;
    }
    hold -= FIXED_DT;
    tick(world, s, input, FIXED_DT);
    // Stepping on the Lobby pad ends the walk
    if (s.zone !== 'dungeon-999' || s.rx !== rx || s.ry !== ry) return false;
    if (s.roomSolved) return true;
  }
  return false;
}

/**
 * A stubborn walker with no bombs: heads for the nearest goal plate along a route that
 * treats gates and crystal barriers as open, and keeps pushing against whatever is shut.
 * True if it ever solves the room (it would slip through any gap a creature opens).
 */
export function pushToGoalSolves(world: World, rx: number, ry: number, seconds = 120): boolean {
  const s = arrive(world, rx, ry);
  const room = currentRoom(world, s);
  if (!room) return false;
  const passable = (x: number, y: number): boolean => {
    const raw = room.rows[y]?.[x] ?? '#';
    if (raw === 'G' || raw === 'R' || raw === 'U' || raw === 'O') return true;
    const tile = tileAt(world, s, s.zone, rx, ry, x, y);
    return !isTileSolidForWalk(tile, s.crystalColor) && tile !== '!' && tile !== '>';
  };
  // Distance to the nearest plate from every tile, by breadth-first search outward
  const dist = new Map<string, number>();
  const queue: [number, number][] = [];
  room.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'O') {
        dist.set(`${x},${y}`, 0);
        queue.push([x, y]);
      }
    }
  });
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const d = dist.get(`${x},${y}`)!;
    for (const [dx, dy] of DIRS) {
      const key = `${x + dx},${y + dy}`;
      if (dist.has(key) || !passable(x + dx, y + dy)) continue;
      dist.set(key, d + 1);
      queue.push([x + dx, y + dy]);
    }
  }
  for (let t = 0; t < seconds; t += FIXED_DT) {
    const tx = Math.floor(s.x);
    const ty = Math.floor(s.y);
    let best: [number, number] | null = null;
    let bestD = dist.get(`${tx},${ty}`) ?? Infinity;
    for (const [dx, dy] of DIRS) {
      const d = dist.get(`${tx + dx},${ty + dy}`);
      if (d !== undefined && d < bestD) {
        bestD = d;
        best = [tx + dx, ty + dy];
      }
    }
    const input: Input = best
      ? (() => {
          const dx = best[0] + 0.5 - s.x;
          const dy = best[1] + 0.5 - s.y;
          const len = Math.hypot(dx, dy) || 1;
          return { dx: dx / len, dy: dy / len };
        })()
      : { dx: 0, dy: 0 };
    tick(world, s, input, FIXED_DT);
    if (s.zone !== 'dungeon-999' || s.rx !== rx || s.ry !== ry) return false;
    if (s.roomSolved) return true;
  }
  return false;
}

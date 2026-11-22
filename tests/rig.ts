import { DUNGEON_999_ENTRIES } from '../src/game/dungeon999';
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

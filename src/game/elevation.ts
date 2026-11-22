/**
 * Floor levels within a room (`ELEVATION.md`), shared by the engine and the autotiler.
 *
 * A room's optional `levels` layer gives each tile a level `0`, `1` or `2`. A tile next
 * to lower ground is a ledge edge: still part of the high ground, but solid, like the
 * Oracle games' cliff tiles. Where a level-2 face drops straight to level 0, the tile
 * under it is a second, solid face tile. Slope letters on an edge are ramps instead, and
 * `'L'` pillars stand one level up once they have risen.
 */
import { ROOM_H, ROOM_W, type RoomSpec, type State } from './types';

type LevelState = Pick<State, 'pillars'>;

/** Which sides of a tile drop to lower ground; diagonals only when both sides beside them don't. */
export interface LedgeDrops {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  ne: boolean;
  nw: boolean;
  se: boolean;
  sw: boolean;
  /** The second face tile under a two-level drop. */
  lower: boolean;
}

const SLOPES = 'nsew';

/** A room has floor levels if it has a `levels` layer or any pillar (which rises a level). */
export function hasLevels(room: RoomSpec | undefined): room is RoomSpec {
  return Boolean(room?.levels) || Boolean(room?.rows.some((row) => row.includes('L')));
}

/** True for a slope letter, which on a level boundary is a ramp. */
export function isRampTile(room: RoomSpec | undefined, x: number, y: number): boolean {
  return hasLevels(room) && SLOPES.includes(room.rows[y]?.[x] ?? '#');
}

/** A pillar tile (`'L'`): down, it is floor; risen, a block one level up. */
export function isPillarTile(room: RoomSpec | undefined, x: number, y: number): boolean {
  return room?.rows[y]?.[x] === 'L';
}

/** How far a pillar has risen: `0` down, `1` up, between while it moves. */
export function pillarPos(s: LevelState, x: number, y: number): number {
  return s.pillars?.[`${x},${y}`]?.pos ?? 0;
}

/** True while a pillar is moving: it is solid to everything but its riders. */
export function isPillarMoving(s: LevelState, x: number, y: number): boolean {
  return (s.pillars?.[`${x},${y}`]?.dir ?? 0) !== 0;
}

/** The floor level of a tile, or `null` for walls and outside the room (never lower ground). */
export function levelAt(
  room: RoomSpec | undefined,
  s: LevelState,
  x: number,
  y: number,
): number | null {
  if (!hasLevels(room) || x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_H) return null;
  if (room.rows[y]?.[x] === '#') return null;
  const base = Number(room.levels?.[y]?.[x] ?? '0') || 0;
  return isPillarTile(room, x, y) && pillarPos(s, x, y) >= 1 ? base + 1 : base;
}

/** How a tile's sides drop away, or `null` if it is not a ledge edge. */
export function ledgeDrops(
  room: RoomSpec | undefined,
  s: LevelState,
  x: number,
  y: number,
): LedgeDrops | null {
  if (!hasLevels(room) || isRampTile(room, x, y) || isPillarTile(room, x, y)) return null;
  const h = levelAt(room, s, x, y);
  if (h === null) return null;
  // A pillar never reshapes the ground around it: like Oracle's raisable floors, only the
  // pillar tile itself changes. Level checks keep Pip and bombs from walking between them.
  const lowerThan = (dx: number, dy: number): boolean => {
    if (isPillarTile(room, x + dx, y + dy)) return false;
    const l = levelAt(room, s, x + dx, y + dy);
    return l !== null && l < h;
  };
  const n = lowerThan(0, -1);
  const e = lowerThan(1, 0);
  const so = lowerThan(0, 1);
  const w = lowerThan(-1, 0);
  const drops: LedgeDrops = {
    n,
    e,
    s: so,
    w,
    ne: !n && !e && lowerThan(1, -1),
    nw: !n && !w && lowerThan(-1, -1),
    se: !so && !e && lowerThan(1, 1),
    sw: !so && !w && lowerThan(-1, 1),
    lower: false,
  };
  if (n || e || so || w || drops.ne || drops.nw || drops.se || drops.sw) return drops;
  // Under a two-level front face: the face continues one more tile down
  const above = levelAt(room, s, x, y - 1);
  if (above !== null && above - h >= 2 && !isRampTile(room, x, y - 1)) {
    return {
      ...drops,
      lower: true,
      e: (levelAt(room, s, x + 1, y - 1) ?? above) < above,
      w: (levelAt(room, s, x - 1, y - 1) ?? above) < above,
    };
  }
  return null;
}

/** The tile Pip lands on hopping from `(x, y)` one tile at a time in `(dx, dy)`. */
export function hopLanding(
  room: RoomSpec | undefined,
  s: LevelState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  isOpen: (tx: number, ty: number) => boolean,
): { x: number; y: number } | null {
  // North edges are never hoppable: the drop behind them is hidden
  if (dy < 0) return null;
  const fromLevel = levelAt(room, s, x, y);
  if (fromLevel === null) return null;
  for (let k = 1; k <= 4; k++) {
    const tx = x + dx * k;
    const ty = y + dy * k;
    const l = levelAt(room, s, tx, ty);
    if (l === null) return null;
    const drops = ledgeDrops(room, s, tx, ty);
    if (drops) {
      // Only over an edge that drops this way (or the second face under a tall one)
      const thisWay = (dx > 0 && drops.e) || (dx < 0 && drops.w) || (dy > 0 && drops.s);
      if (thisWay || drops.lower) continue;
      return null;
    }
    if (l < fromLevel && isOpen(tx, ty)) return { x: tx, y: ty };
    return null;
  }
  return null;
}

/**
 * Abstracted Puzzle Lab — Elevation, Buoyancy Surface Levels & Cliff Edges (`ELEVATION.md`).
 *
 * Mirrors `src/game/elevation.ts` so every multi-level ledge, ramp, pillar, and flooded-trench
 * bridge verified in the discrete lab has an exact 1-to-1 counterpart in the 60 Hz engine.
 */
import type { LabRoomSpec, LabState, LabTile } from './types';

export interface LabLedgeDrops {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
  ne: boolean;
  nw: boolean;
  se: boolean;
  sw: boolean;
  lower: boolean;
}

const SLOPES = new Set<string>(['n', 's', 'e', 'w']);

export function rawTileAt(room: LabRoomSpec, s: LabState, x: number, y: number): LabTile {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return '#';
  const rotated = s.rotatedTiles.get(`${x},${y}`);
  if (rotated !== undefined) return rotated;
  return (room.rows[y]?.[x] ?? '#') as LabTile;
}

export function inSluiceBasin(room: LabRoomSpec, x: number, y: number): boolean {
  if (!room.sluice) return false;
  if (room.sluice.basinCells) {
    return room.sluice.basinCells.some(([bx, by]) => bx === x && by === y);
  }
  const base = Number(room.levels?.[y]?.[x] ?? '0') || 0;
  return base === 0;
}

export function isDeepWaterTile(t: LabTile): boolean {
  return t === '~' || t === '1' || t === '2' || t === '3' || t === '4';
}

/**
 * Effective liquid state at `(x, y)` before considering floating props or frozen ice sheets:
 * - `'deep'`: `~` or `1..4` (or `;` inside the sluice basin when `waterLevel === 1`)
 * - `'shallow'`: `;` (or melted `B` puddle, or dry floor inside the basin when `waterLevel === 1`)
 * - `'none'`: dry terrain
 */
export function liquidKindAt(
  room: LabRoomSpec,
  s: LabState,
  x: number,
  y: number,
): 'deep' | 'shallow' | 'none' {
  const key = `${x},${y}`;
  if (s.filledCells.has(key)) return 'none';
  const raw = rawTileAt(room, s, x, y);
  if (raw === '#') return 'none';
  const flooded = s.waterLevel === 1 && inSluiceBasin(room, x, y);
  if (isDeepWaterTile(raw)) return 'deep';
  if (raw === ';' || s.puddleCells.has(key)) {
    return flooded ? 'deep' : 'shallow';
  }
  if (
    flooded &&
    (raw === '.' ||
      raw === ',' ||
      raw === 'O' ||
      raw === 'Q' ||
      raw === 'G' ||
      raw === 'X' ||
      raw === '!' ||
      SLOPES.has(raw))
  ) {
    return 'deep';
  }
  return 'none';
}

export function hasLabLevels(room: LabRoomSpec): boolean {
  return (
    Boolean(room.levels) ||
    Boolean(room.sluice) ||
    room.rows.some((r) => r.includes('L') || r.includes('J'))
  );
}

export function isLabRampTile(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  return Boolean(room.levels) && SLOPES.has(rawTileAt(room, s, x, y));
}

export function isLabPillarTile(room: LabRoomSpec, x: number, y: number): boolean {
  return room.rows[y]?.[x] === 'L';
}

export function isLabPillarUpAt(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  if (!isLabPillarTile(room, x, y)) return false;
  const spec = room.pillarSpecs?.find((p) => p.x === x && p.y === y);
  const mode = spec?.trigger ?? room.pillars ?? 'switches';
  return mode === 'switches'
    ? s.gatesOpen
    : mode === 'red'
      ? s.crystalColor === 'red'
      : s.crystalColor === 'blue';
}

export function hasFloatingDeckAt(room: LabRoomSpec, s: LabState, x: number, y: number): boolean {
  if (liquidKindAt(room, s, x, y) !== 'deep') return false;
  if (s.frozenWater.has(`${x},${y}`)) return true;
  return s.props.some((p) => p.x === x && p.y === y && (p.kind === 'crate' || p.kind === 'raft'));
}

/**
 * Walkable / physical surface level (`0 | 1 | 2`) at `(x, y)`, or `null` for outer walls.
 * - A risen `'L'` pillar stands at `base + 1`.
 * - A floating crate, raft, or frozen ice sheet on flooded deep water (`waterLevel === 1`)
 *   floats at `base + 1`, joining adjacent `level 1` ledges seamlessly (`ELEVATION.md`).
 */
export function labLevelAt(room: LabRoomSpec, s: LabState, x: number, y: number): 0 | 1 | 2 | null {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return null;
  if (rawTileAt(room, s, x, y) === '#') return null;
  const base = Math.max(0, Math.min(2, Number(room.levels?.[y]?.[x] ?? '0') || 0));
  if (isLabPillarTile(room, x, y) && isLabPillarUpAt(room, s, x, y)) {
    return Math.min(2, base + 1) as 0 | 1 | 2;
  }
  if (s.waterLevel === 1 && inSluiceBasin(room, x, y) && liquidKindAt(room, s, x, y) === 'deep') {
    return Math.min(2, base + 1) as 0 | 1 | 2;
  }
  return base as 0 | 1 | 2;
}

export function labLedgeDrops(
  room: LabRoomSpec,
  s: LabState,
  x: number,
  y: number,
): LabLedgeDrops | null {
  if (!room.levels || isLabRampTile(room, s, x, y) || isLabPillarTile(room, x, y)) return null;
  if (hasFloatingDeckAt(room, s, x, y)) return null;
  const h = labLevelAt(room, s, x, y);
  if (h === null) return null;

  const lowerThan = (dx: number, dy: number): boolean => {
    const nx = x + dx;
    const ny = y + dy;
    if (isLabRampTile(room, s, nx, ny)) return false;
    if (isLabPillarTile(room, nx, ny) && !(dx === 0 && dy === 1)) return false;
    const l = labLevelAt(room, s, nx, ny);
    return l !== null && l < h;
  };

  const n = lowerThan(0, -1);
  const e = lowerThan(1, 0);
  const so = lowerThan(0, 1);
  const w = lowerThan(-1, 0);
  const diagLowerThan = (dx: number, dy: number): boolean => {
    if (rawTileAt(room, s, x + dx, y) === '#' || rawTileAt(room, s, x, y + dy) === '#') {
      return false;
    }
    if (isLabPillarTile(room, x + dx, y) || isLabPillarTile(room, x, y + dy)) {
      return false;
    }
    return lowerThan(dx, dy);
  };
  const drops: LabLedgeDrops = {
    n,
    e,
    s: so,
    w,
    ne: !n && !e && diagLowerThan(1, -1),
    nw: !n && !w && diagLowerThan(-1, -1),
    se: !so && !e && diagLowerThan(1, 1),
    sw: !so && !w && diagLowerThan(-1, 1),
    lower: false,
  };
  if (n || e || so || w || drops.ne || drops.nw || drops.se || drops.sw) return drops;

  const above = labLevelAt(room, s, x, y - 1);
  if (above !== null && above - h >= 2 && !isLabRampTile(room, s, x, y - 1)) {
    return {
      ...drops,
      lower: true,
      e: (labLevelAt(room, s, x + 1, y - 1) ?? above) < above,
      w: (labLevelAt(room, s, x - 1, y - 1) ?? above) < above,
    };
  }
  return null;
}

export function labHopLanding(
  room: LabRoomSpec,
  s: LabState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  isOpen: (tx: number, ty: number) => boolean,
): { x: number; y: number } | null {
  if (dy < 0) return null;
  const fromLevel = labLevelAt(room, s, x, y);
  if (fromLevel === null) return null;
  for (let k = 1; k <= 4; k++) {
    const tx = x + dx * k;
    const ty = y + dy * k;
    const l = labLevelAt(room, s, tx, ty);
    if (l === null) return null;
    const drops = labLedgeDrops(room, s, tx, ty);
    if (drops) {
      if (
        drops.s &&
        isLabPillarTile(room, tx, ty + 1) &&
        (labLevelAt(room, s, tx, ty + 1) ?? fromLevel) < fromLevel &&
        isOpen(tx, ty + 1)
      ) {
        return { x: tx, y: ty + 1 };
      }
      const thisWay = (dx > 0 && drops.e) || (dx < 0 && drops.w) || (dy > 0 && drops.s);
      if (thisWay || drops.lower) continue;
      return null;
    }
    if (l < fromLevel && isOpen(tx, ty)) return { x: tx, y: ty };
    return null;
  }
  return null;
}

/**
 * Validates geometric & visual rules required for clean 60 Hz backport (`ELEVATION.md` §8):
 * - Room row/level dimensions match `width x height`.
 * - Every `'L'` pillar has plain walkable floor `'.'` directly north at `(x, y - 1)` so the
 *   8 px cliff wall and raised top plate never occlude walls or special tiles.
 */
export function validateBackportInvariants(room: LabRoomSpec): string[] {
  const errors: string[] = [];
  if (room.rows.length !== room.height) {
    errors.push(`rows length (${room.rows.length}) !== height (${room.height})`);
  }
  room.rows.forEach((row, y) => {
    if (row.length !== room.width) {
      errors.push(`row ${y} length (${row.length}) !== width (${room.width})`);
    }
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'L') {
        const north = room.rows[y - 1]?.[x];
        if (north !== '.') {
          errors.push(
            `pillar 'L' at (${x},${y}) requires plain '.' directly north at (${x},${y - 1}), found '${north ?? 'OOB'}'`,
          );
        }
      }
    }
  });
  if (room.levels) {
    if (room.levels.length !== room.height) {
      errors.push(`levels length (${room.levels.length}) !== height (${room.height})`);
    }
    room.levels.forEach((lrow, y) => {
      if (lrow.length !== room.width) {
        errors.push(`levels row ${y} length (${lrow.length}) !== width (${room.width})`);
      }
    });
  }
  return errors;
}

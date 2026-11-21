/**
 * The world: a grid of rooms, each exactly one phone screen of tiles. Walking
 * off a room's edge moves you to the next room (a flip-screen cut, never a
 * scroll). Your only tool is bombs. Pure data and rules, no three.js, so it's
 * testable headless.
 */

/** A room is this many tiles across and down: portrait, one phone screen. */
export const ROOM_W = 9;
export const ROOM_H = 15;

/**
 * Tiles, one character each:
 * '.' floor, '#' wall, '%' cracked wall (a bomb breaks it), '~' water.
 */
export type Tile = '.' | '#' | '%' | '~';

export interface Room {
  /** ROOM_H strings of ROOM_W tiles. */
  rows: string[];
}

export interface World {
  /** Rooms by "rx,ry" (a world map position); missing means no room there. */
  rooms: Map<string, Room>;
}

export interface Bomb {
  x: number;
  y: number;
  /** Seconds until it goes off. */
  fuse: number;
}

export interface State {
  /** The room the player is in. */
  rx: number;
  ry: number;
  /** The player's centre, in tiles within the room. */
  x: number;
  y: number;
  bombs: Bomb[];
  /** Tiles broken so far, by "rx,ry,x,y", so a bombed wall stays bombed. */
  broken: Set<string>;
  /** Blasts this tick, for the view (tile centres). */
  blasts: { x: number; y: number }[];
}

export interface Input {
  /** Movement direction (each -1..1); normalised by the rules. */
  dx: number;
  dy: number;
  /** Drop a bomb this tick. */
  bomb: boolean;
}

export const SPEED = 4; // tiles per second
export const FUSE = 1.6; // seconds
export const BLAST = 1; // tiles of reach from the bomb's tile (a plus shape)
const RADIUS = 0.3; // the player's half-width, in tiles
const MAX_BOMBS = 3;

export const roomKey = (rx: number, ry: number): string => `${rx},${ry}`;

/** The tile at (x, y) in a room, after bombing; outside the room is open (an exit) only where the edge is floor. */
export function tileAt(
  world: World,
  s: Pick<State, 'broken'>,
  rx: number,
  ry: number,
  x: number,
  y: number,
): Tile {
  const room = world.rooms.get(roomKey(rx, ry));
  const t = (room?.rows[y]?.[x] ?? '#') as Tile;
  if (t === '%' && s.broken.has(`${rx},${ry},${x},${y}`)) return '.';
  return t;
}

const solid = (t: Tile): boolean => t !== '.';

/** Whether a box of half-width RADIUS centred at (x, y) overlaps a solid tile. Off-room is open, so you can walk out. */
function blocked(world: World, s: State, x: number, y: number): boolean {
  for (const cy of [Math.floor(y - RADIUS), Math.floor(y + RADIUS)])
    for (const cx of [Math.floor(x - RADIUS), Math.floor(x + RADIUS)]) {
      if (cx < 0 || cy < 0 || cx >= ROOM_W || cy >= ROOM_H) continue;
      if (solid(tileAt(world, s, s.rx, s.ry, cx, cy))) return true;
    }
  return false;
}

export function newState(rx: number, ry: number, x: number, y: number): State {
  return { rx, ry, x, y, bombs: [], broken: new Set(), blasts: [] };
}

/**
 * Advance the game by `dt` seconds. Returns true when the player moved to a
 * new room (the view cuts to it).
 */
export function tick(world: World, s: State, input: Input, dt: number): boolean {
  s.blasts = [];
  // Move, one axis at a time, so you slide along walls.
  const len = Math.hypot(input.dx, input.dy);
  if (len > 0) {
    const step = (SPEED * dt) / Math.max(1, len);
    const nx = s.x + input.dx * step;
    if (!blocked(world, s, nx, s.y)) s.x = nx;
    const ny = s.y + input.dy * step;
    if (!blocked(world, s, s.x, ny)) s.y = ny;
  }
  // Bombs: drop one on your tile; fuses burn; a blast breaks cracked walls in a plus.
  if (input.bomb && s.bombs.length < MAX_BOMBS) {
    const bx = Math.floor(s.x);
    const by = Math.floor(s.y);
    if (!s.bombs.some((b) => b.x === bx && b.y === by)) s.bombs.push({ x: bx, y: by, fuse: FUSE });
  }
  for (const b of s.bombs) b.fuse -= dt;
  for (const b of s.bombs.filter((b) => b.fuse <= 0)) {
    for (const [dx, dy] of [
      [0, 0],
      ...[1, -1].flatMap((d) => [
        [d, 0],
        [0, d],
      ]),
    ] as [number, number][])
      for (let r = 0; r <= (dx || dy ? BLAST : 0); r++) {
        const x = b.x + dx * r;
        const y = b.y + dy * r;
        if (tileAt(world, s, s.rx, s.ry, x, y) === '%') s.broken.add(`${s.rx},${s.ry},${x},${y}`);
        s.blasts.push({ x: x + 0.5, y: y + 0.5 });
      }
  }
  s.bombs = s.bombs.filter((b) => b.fuse > 0);
  // Off an edge: into the neighbouring room, at the matching spot on its far edge.
  const moves: [boolean, number, number][] = [
    [s.x < 0, -1, 0],
    [s.x >= ROOM_W, 1, 0],
    [s.y < 0, 0, -1],
    [s.y >= ROOM_H, 0, 1],
  ];
  for (const [off, dx, dy] of moves) {
    if (!off || !world.rooms.has(roomKey(s.rx + dx, s.ry + dy))) continue;
    s.rx += dx;
    s.ry += dy;
    s.x = dx > 0 ? RADIUS : dx < 0 ? ROOM_W - RADIUS : s.x;
    s.y = dy > 0 ? RADIUS : dy < 0 ? ROOM_H - RADIUS : s.y;
    s.bombs = []; // bombs don't follow you through a cut
    return true;
  }
  // Keep inside the room only on sides with no room beyond (elsewhere you may step out).
  const has = (dx: number, dy: number): boolean => world.rooms.has(roomKey(s.rx + dx, s.ry + dy));
  if (!has(-1, 0)) s.x = Math.max(s.x, RADIUS);
  if (!has(1, 0)) s.x = Math.min(s.x, ROOM_W - RADIUS);
  if (!has(0, -1)) s.y = Math.max(s.y, RADIUS);
  if (!has(0, 1)) s.y = Math.min(s.y, ROOM_H - RADIUS);
  return false;
}

/** A tiny test world: two rooms side by side; the right one hides a passage behind a cracked wall. */
export function testWorld(): World {
  const left = [
    '#########',
    '#.......#',
    '#.......#',
    '#..~~...#',
    '#..~~...#',
    '#.......#',
    '#.......#',
    '#........',
    '#.......#',
    '#....#..#',
    '#....#..#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#########',
  ];
  const right = [
    '#########',
    '#...#...#',
    '#...#...#',
    '#...%...#',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '....#...#',
    '#...#...#',
    '#...#...#',
    '#...#...#',
    '#...#####',
    '#.......#',
    '#.......#',
    '#########',
  ];
  return {
    rooms: new Map([
      [roomKey(0, 0), { rows: left }],
      [roomKey(1, 0), { rows: right }],
    ]),
  };
}

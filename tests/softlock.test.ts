import { describe, expect, it } from 'vitest';
import type { BombKind, CrystalColor, RoomSpec, Tile, World, ZoneId } from '../src/game/types';
import { ROOM_H, ROOM_W, campaignWorld, roomKey } from '../src/game/world';

// The room size of the dungeon being verified: 22 x 26 outside Grandma's House (GAME.md 1.1).
// Every room in one dungeon shares it; set from the world at the start of each verification.
let W = ROOM_W;
let H = ROOM_H;

/**
 * Exhaustive State-Space No-Softlock Verifier (`DUNGEONS.md` Shared Rules, `ROADMAP.md` Phase 7).
 *
 * Explores the full reachable graph of discrete states:
 *   (room, canonical WalkableComponent, bombs, smallKeys, hasBossKey, warp, crystalColor,
 *    brokenTiles, burnedTiles, openedDoors, solvedRooms, fledRooms, collectedPickups)
 * treating every locked door unlock ('D') and crystal switch flip ('C') as an independent
 * branching player choice, then runs reverse BFS from completion states to prove that EVERY
 * reachable state can still complete the dungeon (`deadEnds.length === 0`).
 */

interface VerifierState {
  zone: ZoneId;
  rx: number;
  ry: number;
  /** Canonical top-left walkable cell `(x, y)` of Pip's connected component in `(rx, ry)`. */
  cx: number;
  cy: number;
  bombs: ReadonlySet<BombKind>;
  smallKeys: number;
  hasBossKey: boolean;
  warpUnlocked: boolean;
  crystalColor: CrystalColor;
  brokenTiles: ReadonlySet<string>;
  burnedTiles: ReadonlySet<string>;
  openedDoors: ReadonlySet<string>;
  solvedRooms: ReadonlySet<string>;
  fledRooms: ReadonlySet<string>;
  collectedPickups: ReadonlySet<string>;
  exitedToOverworld: boolean;
}

const cellKey = (zone: ZoneId, rx: number, ry: number, x: number, y: number): string =>
  `${zone}:${rx},${ry}:${x},${y}`;

function effectiveTile(room: RoomSpec, s: VerifierState, x: number, y: number): Tile {
  const raw = (room.rows[y]?.[x] ?? '#') as Tile | 'P';
  if (raw === 'P') return '.';
  const ck = cellKey(room.zone, room.rx, room.ry, x, y);
  if ((raw === '%' || raw === 'W') && s.brokenTiles.has(ck)) return '.';
  if ((raw === 'B' || raw === 'W' || raw === ',') && s.burnedTiles.has(ck)) return '.';
  if ((raw === 'D' || raw === 'K') && s.openedDoors.has(ck)) return '.';
  if (raw === 'S') {
    const rk = roomKey(room.zone, room.rx, room.ry);
    const solved = s.solvedRooms.has(rk) || !room.condition || room.condition === 'none';
    if (solved) return '.';
  }
  return raw;
}

/**
 * Cell keys of the connected block sharing the raw character at `(x, y)`: on doubled screens
 * a cracked wall, a bramble patch or a door is a 2 x 2 block that acts as one piece.
 */
function blockOf(room: RoomSpec, x: number, y: number): string[] {
  const ch = room.rows[y]?.[x];
  const seen = new Set([`${x},${y}`]);
  const queue: [number, number][] = [[x, y]];
  const out: string[] = [];
  for (let qi = 0; qi < queue.length && qi < 64; qi++) {
    const [cx, cy] = queue[qi]!;
    out.push(cellKey(room.zone, room.rx, room.ry, cx, cy));
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const key = `${cx + dx},${cy + dy}`;
      if (seen.has(key) || room.rows[cy + dy]?.[cx + dx] !== ch) continue;
      seen.add(key);
      queue.push([cx + dx, cy + dy]);
    }
  }
  return out;
}

function isWalkable(t: Tile, crystal: CrystalColor): boolean {
  if (
    t === '#' ||
    t === 'Y' ||
    t === '%' ||
    t === '~' ||
    t === '1' ||
    t === '2' ||
    t === '3' ||
    t === '4' ||
    t === '^' ||
    t === '=' ||
    t === 'B' ||
    t === 'W' ||
    t === 'C' ||
    t === 'T' ||
    t === 'D' ||
    t === 'K' ||
    t === 'S'
  ) {
    return false;
  }
  if (t === 'R') return crystal === 'blue';
  if (t === 'U') return crystal === 'red';
  return true;
}

function isAirPassableForThrow(t: Tile, crystal: CrystalColor): boolean {
  if (t === '#' || t === 'Y' || t === '%' || t === 'D' || t === 'K' || t === 'S') return false;
  if (t === 'R') return crystal === 'blue';
  if (t === 'U') return crystal === 'red';
  return true;
}

function floodWalkableComponent(
  room: RoomSpec,
  s: VerifierState,
  startX: number,
  startY: number,
): Set<number> {
  const visited = new Set<number>();
  const sx = Math.max(0, Math.min(W - 1, startX));
  const sy = Math.max(0, Math.min(H - 1, startY));
  if (!isWalkable(effectiveTile(room, s, sx, sy), s.crystalColor)) return visited;

  const queue: Array<[number, number]> = [[sx, sy]];
  visited.add(sy * W + sx);
  for (let qi = 0; qi < queue.length && qi < W * H; qi++) {
    const [x, y] = queue[qi]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const idx = ny * W + nx;
      if (visited.has(idx)) continue;
      if (isWalkable(effectiveTile(room, s, nx, ny), s.crystalColor)) {
        visited.add(idx);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

function canonicalize(world: World, initialState: VerifierState): VerifierState {
  if (initialState.exitedToOverworld) return initialState;
  const rk = roomKey(initialState.zone, initialState.rx, initialState.ry);
  const room = world.rooms.get(rk);
  if (!room) return initialState;

  // Saturate strictly monotone, zero-cost infinite-bomb actions within the current component
  // (breaking reachable %/W, burning reachable B, defeating enemies/braziers to open shutters)
  // while keeping all key pickups, key doors ('D'/'K'), crystal flips ('C'), and room moves
  // as explicit branching choices!
  let s = initialState;
  for (let pass = 0; pass < 8; pass++) {
    const comp = floodWalkableComponent(room, s, s.cx, s.cy);
    if (comp.size === 0) return s;

    const hasBomb = s.bombs.has('bomb');
    const hasFire = s.bombs.has('fire');
    const struck = hasBomb || hasFire ? computeBlastableCells(room, s, comp) : new Set<number>();

    let changed = false;
    let nextBroken = s.brokenTiles;
    let nextBurned = s.burnedTiles;
    let nextFled = s.fledRooms;
    let nextSolved = s.solvedRooms;
    let nextWarp = s.warpUnlocked;

    if (hasBomb || hasFire) {
      for (const sIdx of struck) {
        const tx = sIdx % W;
        const ty = Math.floor(sIdx / W);
        const t = effectiveTile(room, s, tx, ty);
        const ck = cellKey(s.zone, s.rx, s.ry, tx, ty);
        if (hasBomb && (t === '%' || t === 'W') && !nextBroken.has(ck)) {
          const copy = new Set(nextBroken);
          copy.add(ck);
          // A cracked wall breaks as one piece
          if (t === '%') for (const k of blockOf(room, tx, ty)) copy.add(k);
          nextBroken = copy;
          changed = true;
        } else if (hasFire && (t === 'B' || (t === 'W' && !hasBomb)) && !nextBurned.has(ck)) {
          const copy = new Set(nextBurned);
          copy.add(ck);
          // Fire spreads through a bramble patch
          if (t === 'B') for (const k of blockOf(room, tx, ty)) copy.add(k);
          nextBurned = copy;
          changed = true;
        }
      }
    }

    const hasFleeMiniboss = (room.enemies ?? []).some((e) => e.fleeOnDefeat);
    if (hasFleeMiniboss && !nextFled.has(rk) && hasBomb) {
      const copy = new Set(nextFled);
      copy.add(rk);
      nextFled = copy;
      changed = true;
    }

    const roomSolved = nextSolved.has(rk) || !room.condition || room.condition === 'none';
    if (!roomSolved && room.condition) {
      let canSolve = false;
      if (room.condition === 'hold-buttons') {
        const buttons: number[] = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (effectiveTile(room, s, x, y) === 'O') buttons.push(y * W + x);
          }
        }
        canSolve =
          buttons.length > 0 && buttons.every((bIdx) => comp.has(bIdx) || struck.has(bIdx));
      } else if (room.condition === 'all-torches' || room.condition === 'ordered-torches') {
        const puzzleTorches = (room.torches ?? []).filter((t) => !t.decor);
        canSolve =
          hasFire &&
          puzzleTorches.length > 0 &&
          // A brazier is struck through any of its tiles (2 x 2 on doubled screens)
          puzzleTorches.every((t) =>
            [0, 1].some((j) =>
              [0, 1].some(
                (i) => room.rows[t.y + j]?.[t.x + i] === 'T' && struck.has((t.y + j) * W + t.x + i),
              ),
            ),
          );
      } else if (room.condition === 'clear-enemies') {
        const needsFire = (room.enemies ?? []).some((e) => e.kind === 'cinderhull');
        canSolve = hasBomb && (!needsFire || hasFire);
      } else if (room.condition === 'miniboss' || room.condition === 'boss') {
        canSolve = hasBomb && hasFire;
      }

      if (canSolve) {
        const copy = new Set(nextSolved);
        copy.add(rk);
        nextSolved = copy;
        if (room.condition === 'miniboss') nextWarp = true;
        changed = true;
      }
    }

    if (!changed) {
      const minIdx = Math.min(...comp);
      return {
        ...s,
        cx: minIdx % W,
        cy: Math.floor(minIdx / W),
      };
    }

    s = {
      ...s,
      brokenTiles: nextBroken,
      burnedTiles: nextBurned,
      fledRooms: nextFled,
      solvedRooms: nextSolved,
      warpUnlocked: nextWarp,
    };
  }

  const finalComp = floodWalkableComponent(room, s, s.cx, s.cy);
  const minIdx = finalComp.size > 0 ? Math.min(...finalComp) : s.cy * W + s.cx;
  return {
    ...s,
    cx: minIdx % W,
    cy: Math.floor(minIdx / W),
  };
}

function serializeState(s: VerifierState): string {
  const sorted = (set: ReadonlySet<string>): string => [...set].sort().join(',');
  return [
    s.exitedToOverworld ? 'EXIT' : `${s.zone}:${s.rx},${s.ry}@${s.cx},${s.cy}`,
    `b:${sorted(s.bombs)}`,
    `k:${s.smallKeys}`,
    `bk:${s.hasBossKey ? 1 : 0}`,
    `w:${s.warpUnlocked ? 1 : 0}`,
    `c:${s.crystalColor}`,
    `brk:${sorted(s.brokenTiles)}`,
    `brn:${sorted(s.burnedTiles)}`,
    `opn:${sorted(s.openedDoors)}`,
    `slv:${sorted(s.solvedRooms)}`,
    `fld:${sorted(s.fledRooms)}`,
    `pck:${sorted(s.collectedPickups)}`,
  ].join('|');
}

/**
 * Compute all tiles `(tx, ty)` that can be struck by a dropped or orthogonally thrown bomb
 * (`reach = 1` cross arm around any landing spot reachable from `comp`).
 */
function computeBlastableCells(
  room: RoomSpec,
  s: VerifierState,
  comp: ReadonlySet<number>,
): Set<number> {
  const landingCenters = new Set<number>();
  for (const idx of comp) {
    const x = idx % W;
    const y = Math.floor(idx / W);
    landingCenters.add(idx);
    // Orthogonal Throw: clears '=' fences, water & pits up to 2 tiles ahead, stopping before walls/pedestals
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let dist = 1; dist <= 2; dist++) {
        const tx = x + dx * dist;
        const ty = y + dy * dist;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) break;
        const t = effectiveTile(room, s, tx, ty);
        if (!isAirPassableForThrow(t, s.crystalColor)) break;
        if (t === 'C' || t === 'T' || t === 'B' || t === 'W') {
          // Bomb stops adjacent to pedestal/prop on the cell before `(tx, ty)`
          const prevX = tx - dx;
          const prevY = ty - dy;
          const prevT = effectiveTile(room, s, prevX, prevY);
          if (prevT !== '^') landingCenters.add(prevY * W + prevX);
          break;
        }
        // Bombs landing on pits are swallowed; water or walkable floor detonates
        if (t !== '^' && t !== '=') {
          landingCenters.add(ty * W + tx);
        }
      }
    }
  }

  const struck = new Set<number>();
  for (const lIdx of landingCenters) {
    const lx = lIdx % W;
    const ly = Math.floor(lIdx / W);
    struck.add(lIdx);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const tx = lx + dx;
      const ty = ly + dy;
      if (tx >= 0 && ty >= 0 && tx < W && ty < H) {
        struck.add(ty * W + tx);
      }
    }
  }
  return struck;
}

function nextStates(world: World, s: VerifierState): VerifierState[] {
  if (s.exitedToOverworld) return [];
  const rk = roomKey(s.zone, s.rx, s.ry);
  const room = world.rooms.get(rk);
  if (!room) return [];

  const comp = floodWalkableComponent(room, s, s.cx, s.cy);
  if (comp.size === 0) return [];

  const out: VerifierState[] = [];
  const addSet = <T>(base: ReadonlySet<T>, val: T): Set<T> => {
    const next = new Set(base);
    next.add(val);
    return next;
  };

  // 1. Collect reachable spawned pickups in this component
  const roomSolved = s.solvedRooms.has(rk) || !room.condition || room.condition === 'none';
  const roomFled = s.fledRooms.has(rk);
  for (const pk of room.pickups ?? []) {
    if (s.collectedPickups.has(pk.id)) continue;
    if (pk.spawnOnSolve && !roomSolved) continue;
    if (pk.spawnOnMinibossFlee && !roomFled) continue;
    if (
      pk.kind !== 'bomb-sack' &&
      pk.kind !== 'fire-bomb' &&
      pk.kind !== 'small-key' &&
      pk.kind !== 'boss-key' &&
      pk.kind !== 'cinder-core'
    ) {
      continue;
    }
    const px = Math.floor(pk.x);
    const py = Math.floor(pk.y);
    if (!comp.has(py * W + px)) continue;

    let bombs = s.bombs;
    let smallKeys = s.smallKeys;
    let hasBossKey = s.hasBossKey;
    if (pk.kind === 'bomb-sack') bombs = addSet(s.bombs, 'bomb');
    else if (pk.kind === 'fire-bomb') bombs = addSet(s.bombs, 'fire');
    else if (pk.kind === 'small-key') smallKeys += 1;
    else if (pk.kind === 'boss-key') hasBossKey = true;

    out.push(
      canonicalize(world, {
        ...s,
        bombs,
        smallKeys,
        hasBossKey,
        collectedPickups: addSet(s.collectedPickups, pk.id),
      }),
    );
  }

  // 2. Unlock adjacent locked doors ('D' or 'K') — EACH door is a separate player choice!
  const adjObstacles = new Set<number>();
  for (const idx of comp) {
    const x = idx % W;
    const y = Math.floor(idx / W);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) {
        adjObstacles.add(ny * W + nx);
      }
    }
  }
  for (const obsIdx of adjObstacles) {
    const ox = obsIdx % W;
    const oy = Math.floor(obsIdx / W);
    const t = effectiveTile(room, s, ox, oy);
    const ck = cellKey(s.zone, s.rx, s.ry, ox, oy);
    // One key opens the whole door, however many tiles it spans
    const openDoor = (): Set<string> => {
      const next = new Set(s.openedDoors);
      for (const k of blockOf(room, ox, oy)) next.add(k);
      return next;
    };
    if (t === 'D' && s.smallKeys > 0 && !s.openedDoors.has(ck)) {
      out.push(
        canonicalize(world, {
          ...s,
          smallKeys: s.smallKeys - 1,
          openedDoors: openDoor(),
        }),
      );
    } else if (t === 'K' && s.hasBossKey && !s.openedDoors.has(ck)) {
      out.push(
        canonicalize(world, {
          ...s,
          openedDoors: openDoor(),
        }),
      );
    }
  }

  // 3. Crystal switch flips ('C') via Bomb or Fire blast — explored as both red & blue choices!
  const hasBomb = s.bombs.has('bomb');
  const hasFire = s.bombs.has('fire');
  if (hasBomb || hasFire) {
    const struck = computeBlastableCells(room, s, comp);
    let canFlipCrystal = false;
    for (const sIdx of struck) {
      const tx = sIdx % W;
      const ty = Math.floor(sIdx / W);
      if (effectiveTile(room, s, tx, ty) === 'C') {
        canFlipCrystal = true;
        break;
      }
    }
    if (canFlipCrystal) {
      const nextColor: CrystalColor = s.crystalColor === 'red' ? 'blue' : 'red';
      const flippedBase: VerifierState = { ...s, crystalColor: nextColor };
      const seenPostFlipMin = new Set<number>();
      for (const idx of comp) {
        const px = idx % W;
        const py = Math.floor(idx / W);
        if (!isWalkable(effectiveTile(room, flippedBase, px, py), nextColor)) continue;
        const postComp = floodWalkableComponent(room, flippedBase, px, py);
        if (postComp.size === 0) continue;
        const postMin = Math.min(...postComp);
        if (seenPostFlipMin.has(postMin)) continue;
        seenPostFlipMin.add(postMin);
        out.push(
          canonicalize(world, {
            ...flippedBase,
            cx: postMin % W,
            cy: Math.floor(postMin / W),
          }),
        );
      }
    }
  }

  // 5. Portals ('>') inside `comp`
  for (const portal of room.portals ?? []) {
    if (portal.requiresWarpUnlock && !s.warpUnlocked) continue;
    if (!comp.has(portal.y * W + portal.x)) continue;
    if (portal.targetZone !== s.zone) {
      if (portal.targetZone === 'overworld' && s.zone === 'basement') {
        out.push({ ...s, exitedToOverworld: true });
      }
      continue;
    }
    const destRoom = world.rooms.get(roomKey(portal.targetZone, portal.targetRx, portal.targetRy));
    if (!destRoom) continue;
    out.push(
      canonicalize(world, {
        ...s,
        rx: portal.targetRx,
        ry: portal.targetRy,
        cx: Math.floor(portal.targetX),
        cy: Math.floor(portal.targetY),
      }),
    );
  }

  // 6. Cardinal room-edge transitions from boundary cells in `comp`
  for (const idx of comp) {
    const x = idx % W;
    const y = Math.floor(idx / W);
    const dirs: Array<[boolean, number, number, number, number]> = [
      [x === 0, -1, 0, W - 1, y],
      [x === W - 1, 1, 0, 0, y],
      [y === 0, 0, -1, x, H - 1],
      [y === H - 1, 0, 1, x, 0],
    ];
    for (const [atEdge, dx, dy, destEdgeX, destEdgeY] of dirs) {
      if (!atEdge) continue;
      const nrx = s.rx + dx;
      const nry = s.ry + dy;
      const destRk = roomKey(s.zone, nrx, nry);
      const destRoom = world.rooms.get(destRk);
      if (!destRoom) continue;

      let nextOpened = s.openedDoors;
      let landX = destEdgeX;
      let landY = destEdgeY;
      const destTile = effectiveTile(destRoom, s, landX, landY);

      // Mirror `settleAtDoorway` (`world.ts`): paired 'D'/'K' on arrival side opens automatically,
      // and closed 'S' shutter steps 1 tile inward into the room!
      if (destTile === 'D' || destTile === 'K') {
        const opened = new Set(nextOpened);
        for (const k of blockOf(destRoom, landX, landY)) opened.add(k);
        nextOpened = opened;
      } else if (destTile === 'S') {
        // Step inward until clear of the shutter (2 tiles deep on doubled screens)
        for (let i = 0; i < 4 && effectiveTile(destRoom, s, landX, landY) === 'S'; i++) {
          landX = Math.max(0, Math.min(W - 1, landX + dx));
          landY = Math.max(0, Math.min(H - 1, landY + dy));
        }
      }

      const tempState: VerifierState = {
        ...s,
        rx: nrx,
        ry: nry,
        cx: landX,
        cy: landY,
        openedDoors: nextOpened,
      };
      if (!isWalkable(effectiveTile(destRoom, tempState, landX, landY), tempState.crystalColor)) {
        continue;
      }
      out.push(canonicalize(world, tempState));
    }
  }

  return out;
}

interface VerificationReport {
  reachableCount: number;
  goalCount: number;
  deadEndStates: string[];
}

function verifyDungeonNoSoftlock(
  world: World,
  initial: VerifierState,
  isGoal: (s: VerifierState) => boolean,
  maxStates = 15000,
): VerificationReport {
  const firstRoom = [...world.rooms.values()].find((r) => r.zone === initial.zone);
  W = firstRoom?.rows[0]?.length ?? ROOM_W;
  H = firstRoom?.rows.length ?? ROOM_H;
  const start = canonicalize(world, initial);
  const startKey = serializeState(start);

  const states = new Map<string, VerifierState>([[startKey, start]]);
  const reverseEdges = new Map<string, Set<string>>([[startKey, new Set()]]);
  const queue: string[] = [startKey];

  for (let qi = 0; qi < queue.length; qi++) {
    if (states.size > maxStates) {
      throw new Error(`State-space exceeded bound (${maxStates}); check state canonicalization.`);
    }
    const uKey = queue[qi]!;
    const u = states.get(uKey)!;
    for (const v of nextStates(world, u)) {
      const vKey = serializeState(v);
      if (!states.has(vKey)) {
        states.set(vKey, v);
        reverseEdges.set(vKey, new Set());
        queue.push(vKey);
      }
      reverseEdges.get(vKey)!.add(uKey);
    }
  }

  // Reverse BFS from all reachable goal states
  const canReachGoal = new Set<string>();
  const revQueue: string[] = [];
  for (const [k, st] of states) {
    if (isGoal(st)) {
      canReachGoal.add(k);
      revQueue.push(k);
    }
  }

  for (let ri = 0; ri < revQueue.length && ri <= states.size; ri++) {
    const cur = revQueue[ri]!;
    for (const prev of reverseEdges.get(cur) ?? []) {
      if (!canReachGoal.has(prev)) {
        canReachGoal.add(prev);
        revQueue.push(prev);
      }
    }
  }

  const deadEndStates: string[] = [];
  for (const k of states.keys()) {
    if (!canReachGoal.has(k)) deadEndStates.push(k);
  }

  return {
    reachableCount: states.size,
    goalCount: [...states.values()].filter(isGoal).length,
    deadEndStates,
  };
}

describe('Automated No-Key-Softlock Verifier (BFS + reverse reachability)', () => {
  const world = campaignWorld();

  it('certifies Grandma’s Basement (Dungeon 0) has zero soft-locks across all reachable states', () => {
    const initial: VerifierState = {
      zone: 'basement',
      rx: 1,
      ry: 3,
      cx: 5,
      cy: 6,
      bombs: new Set(),
      smallKeys: 0,
      hasBossKey: false,
      warpUnlocked: false,
      crystalColor: 'red',
      brokenTiles: new Set(),
      burnedTiles: new Set(),
      openedDoors: new Set(),
      solvedRooms: new Set(),
      fledRooms: new Set(),
      collectedPickups: new Set(),
      exitedToOverworld: false,
    };

    const report = verifyDungeonNoSoftlock(
      world,
      initial,
      (s) => s.exitedToOverworld && s.bombs.has('bomb'),
    );

    expect(report.goalCount).toBeGreaterThan(0);
    expect(report.deadEndStates).toEqual([]);
  });

  it('certifies Ice Cave (Shrine 1) has zero key/crystal/warp soft-locks across all reachable states', () => {
    const initial: VerifierState = {
      zone: 'ice-cave',
      rx: 1,
      ry: 3,
      cx: 5,
      cy: 9,
      bombs: new Set<BombKind>(['bomb']),
      smallKeys: 0,
      hasBossKey: false,
      warpUnlocked: false,
      crystalColor: 'red',
      brokenTiles: new Set(),
      burnedTiles: new Set(),
      openedDoors: new Set(),
      solvedRooms: new Set(),
      fledRooms: new Set(),
      collectedPickups: new Set(),
      exitedToOverworld: false,
    };

    const report = verifyDungeonNoSoftlock(
      world,
      initial,
      (s) =>
        s.solvedRooms.has('ice-cave:0,0') &&
        s.collectedPickups.has('boss-cinder-core') &&
        s.bombs.has('fire'),
    );

    expect(report.goalCount).toBeGreaterThan(0);
    expect(report.deadEndStates).toEqual([]);
    // 22 x 26 rooms make each flood fill four times bigger
  }, 60_000);

  it('detects a genuine key soft-lock on a synthetic flawed hub (negative control)', () => {
    // Hub (1,1) starts with 1 key and TWO reachable locked doors:
    // - North 'D' -> Dead-end treasure room (1,0) with NO key
    // - East  'D' -> Goal room (2,1) with 'boss-cinder-core'
    // Spending the single key on North permanently strands East!
    const makeRoom = (
      rx: number,
      ry: number,
      rows: string[],
      pickups?: RoomSpec['pickups'],
    ): RoomSpec => ({
      zone: 'ice-cave',
      rx,
      ry,
      name: `Test (${rx},${ry})`,
      rows,
      ...(pickups ? { pickups } : {}),
    });

    const flawedRooms: RoomSpec[] = [
      makeRoom(
        1,
        1,
        [
          '#####D#####',
          '#####.#####',
          '##.......##',
          '##.......##',
          '##.......##',
          '##.......##',
          '##........D',
          '##.......##',
          '##.......##',
          '##.......##',
          '##.......##',
          '###########',
          '###########',
        ],
        [{ id: 'hub-key', kind: 'small-key', x: 5.5, y: 6.5 }],
      ),
      makeRoom(1, 0, [
        '###########',
        '###########',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '##.......##',
        '#####.#####',
        '#####.#####',
      ]),
      makeRoom(
        2,
        1,
        [
          '###########',
          '###########',
          '##.......##',
          '##.......##',
          '##.......##',
          '##.......##',
          '...........',
          '##.......##',
          '##.......##',
          '##.......##',
          '##.......##',
          '###########',
          '###########',
        ],
        [{ id: 'goal-core', kind: 'cinder-core', x: 5.5, y: 6.5 }],
      ),
    ];
    const flawedWorld: World = {
      rooms: new Map(flawedRooms.map((r) => [roomKey(r.zone, r.rx, r.ry), r])),
    };

    const report = verifyDungeonNoSoftlock(
      flawedWorld,
      {
        zone: 'ice-cave',
        rx: 1,
        ry: 1,
        cx: 5,
        cy: 6,
        bombs: new Set<BombKind>(['bomb']),
        smallKeys: 0,
        hasBossKey: false,
        warpUnlocked: false,
        crystalColor: 'red',
        brokenTiles: new Set(),
        burnedTiles: new Set(),
        openedDoors: new Set(),
        solvedRooms: new Set(),
        fledRooms: new Set(),
        collectedPickups: new Set(),
        exitedToOverworld: false,
      },
      (s) => s.collectedPickups.has('goal-core'),
    );

    expect(report.goalCount).toBeGreaterThan(0);
    // Spending the key on North door (1,1:5,0) strands the player in a dead-end branch!
    expect(report.deadEndStates.length).toBeGreaterThan(0);
    expect(report.deadEndStates.some((st) => st.includes('ice-cave:1,1:5,0'))).toBe(true);
  });
});

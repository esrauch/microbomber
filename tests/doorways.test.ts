import { describe, expect, it } from 'vitest';
import {
  type Input,
  ROOM_H,
  ROOM_W,
  type State,
  campaignWorld,
  enterRoom,
  isTileSolidForWalk,
  newState,
  roomKey,
  tick,
  tileAt,
} from '../src/game/world';

const idle: Input = { dx: 0, dy: 0, drop: false, throwBomb: false };
const DT = 1 / 60;

function walk(
  world: ReturnType<typeof campaignWorld>,
  s: State,
  dx: number,
  dy: number,
  secs: number,
): boolean {
  let cut = false;
  for (let t = 0; t < secs && !cut; t += DT) cut = tick(world, s, { ...idle, dx, dy }, DT);
  return cut;
}

describe('doorways and hazards', () => {
  it('every doorway in the campaign can be walked through, and you can walk on into the next room', () => {
    const world = campaignWorld();
    const sides = [
      { dx: 0, dy: -1, edge: (i: number) => [i, 0] as const, len: ROOM_W },
      { dx: 0, dy: 1, edge: (i: number) => [i, ROOM_H - 1] as const, len: ROOM_W },
      { dx: -1, dy: 0, edge: (i: number) => [0, i] as const, len: ROOM_H },
      { dx: 1, dy: 0, edge: (i: number) => [ROOM_W - 1, i] as const, len: ROOM_H },
    ];
    let doorways = 0;
    for (const room of world.rooms.values()) {
      for (const side of sides) {
        const nKey = roomKey(room.zone, room.rx + side.dx, room.ry + side.dy);
        if (!world.rooms.has(nKey)) continue;
        for (let i = 0; i < side.len; i++) {
          const [ex, ey] = side.edge(i);
          // Leave with this room solved and every lock opened; the room beyond stays unsolved
          const s = newState(world, room.zone, room.rx, room.ry, ex + 0.5, ey + 0.5);
          s.solvedRooms.add(roomKey(room.zone, room.rx, room.ry));
          for (let y = 0; y < ROOM_H; y++) {
            for (let x = 0; x < ROOM_W; x++) {
              s.openedDoors.add(`${room.zone}:${room.rx},${room.ry}:${x},${y}`);
            }
          }
          enterRoom(world, s, room.zone, room.rx, room.ry, ex + 0.5, ey + 0.5);
          const t = tileAt(world, s, s.zone, s.rx, s.ry, ex, ey);
          if (t !== '.' && t !== 'O' && t !== '>') continue;
          s.enemies = [];

          const label = `${room.name} -> ${side.dx},${side.dy} at ${i}`;
          // The matching tile just across the edge, in the room beyond
          const fx = side.dx > 0 ? 0 : side.dx < 0 ? ROOM_W - 1 : ex;
          const fy = side.dy > 0 ? 0 : side.dy < 0 ? ROOM_H - 1 : ey;
          const far = tileAt(world, s, room.zone, room.rx + side.dx, room.ry + side.dy, fx, fy);
          if (
            far !== 'S' &&
            far !== 'D' &&
            far !== 'K' &&
            isTileSolidForWalk(far, s.crystalColor)
          ) {
            // Brambles or a raised barrier on the far side hold you at the edge
            expect(walk(world, s, side.dx, side.dy, 1.5), `${label}: crossed onto ${far}`).toBe(
              false,
            );
            continue;
          }
          expect(walk(world, s, side.dx, side.dy, 1.5), label).toBe(true);
          expect(roomKey(s.zone, s.rx, s.ry), label).toBe(nKey);
          s.enemies = [];
          s.projectiles = [];
          const x0 = s.x;
          const y0 = s.y;
          // Some doorways open onto a one-tile pocket (a cracked-wall secret), so only check not stuck
          walk(world, s, side.dx, side.dy, 0.3);
          expect(Math.hypot(s.x - x0, s.y - y0), `${label}: stuck after entering`).toBeGreaterThan(
            0.1,
          );
          doorways++;
        }
      }
    }
    expect(doorways).toBeGreaterThan(20);
  });

  it('a closed shutter slams behind you: you land inside the room and cannot walk back out', () => {
    const world = campaignWorld();
    // Sanctum Ante-Room (0,1) north through the boss door into the Sanctum of Ash (0,0)
    const s = newState(world, 'ember-crypt', 0, 1, 4.5, 2.5);
    s.hasBossKey = true;
    expect(walk(world, s, 0, -1, 3)).toBe(true);
    expect([s.rx, s.ry]).toEqual([0, 0]);
    expect(tileAt(world, s, s.zone, s.rx, s.ry, Math.floor(s.x), Math.floor(s.y))).toBe('.');
    // Keep the boss (clearing it would solve the room); it is too far off to reach you in 1 s
    walk(world, s, 0, 1, 1);
    expect([s.rx, s.ry]).toEqual([0, 0]);
  });

  it('knockback can shove you into a pit, which costs a half-heart even while invulnerable', () => {
    const world = campaignWorld();
    // Cinder Trail (3,4): pits along row 2; a blast just north pushes south into them
    const s = newState(world, 'overworld', 3, 4, 4.5, 1.6);
    s.invulnTimer = 1;
    s.bombs.push({ id: 999, kind: 'powder', x: 4.5, y: 0.9, fuse: 0.01, graceOverlap: false });
    for (let i = 0; i < 60; i++) tick(world, s, idle, DT);
    expect(s.hp).toBe(s.maxHp - 1);
    expect([s.x, s.y]).toEqual([s.entryX, s.entryY]);
  });

  it('a crystal barrier rising under you does not trap you', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1,2): a blue barrier at (4,7), raised while the crystal is blue
    const s = newState(world, 'ember-crypt', 1, 2, 4.5, 7.5);
    s.crystalColor = 'blue';
    s.enemies = [];
    const x0 = s.x;
    const y0 = s.y;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      walk(world, s, dx, dy, 0.4);
    }
    expect(Math.hypot(s.x - x0, s.y - y0)).toBeGreaterThan(0.5);
  });

  it('a projectile knockout respawns you with no projectiles following you', () => {
    const world = campaignWorld();
    const s = newState(world, 'ember-crypt', 1, 3, 4.5, 5.5);
    s.enemies = [];
    s.hp = 1;
    s.projectiles = [
      { x: s.x, y: s.y, vx: 0, vy: 0, life: 2 },
      { x: 1.5, y: 1.5, vx: 0, vy: 0, life: 2 },
    ];
    tick(world, s, idle, DT);
    expect(s.hp).toBe(s.maxHp);
    expect(s.projectiles).toHaveLength(0);
  });
});

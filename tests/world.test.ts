import { describe, expect, it } from 'vitest';
import { FUSE, ROOM_H, ROOM_W, newState, testWorld, tick, tileAt } from '../src/game/world';

const idle = { dx: 0, dy: 0, bomb: false };

describe('the world', () => {
  it('rooms are one portrait screen of tiles', () => {
    for (const room of testWorld().rooms.values()) {
      expect(room.rows).toHaveLength(ROOM_H);
      for (const row of room.rows) expect(row).toHaveLength(ROOM_W);
    }
  });

  it('walls stop you', () => {
    const world = testWorld();
    const s = newState(0, 0, 1.5, 1.5);
    for (let i = 0; i < 60; i++) tick(world, s, { dx: -1, dy: 0, bomb: false }, 0.05);
    expect(s.x).toBeGreaterThan(1.2); // the wall's inner face is at x = 1
  });

  it('walking off an open edge cuts to the next room', () => {
    const world = testWorld();
    const s = newState(0, 0, 7.5, 7.5); // row 7 of the left room opens to the east
    let moved = false;
    for (let i = 0; i < 40 && !moved; i++)
      moved = tick(world, s, { dx: 1, dy: 0, bomb: false }, 0.05);
    expect(moved).toBe(true);
    expect([s.rx, s.ry]).toEqual([1, 0]);
    expect(s.x).toBeLessThan(1); // arrived at the new room's west edge
  });

  it("there's no room past the world's edge, so you stay put", () => {
    const world = testWorld();
    const s = newState(1, 0, 0.5, 7.5);
    tick(world, s, idle, 0.05);
    for (let i = 0; i < 40; i++) tick(world, s, { dx: 0, dy: 1, bomb: false }, 0.05);
    expect([s.rx, s.ry]).toEqual([1, 0]);
  });

  it('a bomb breaks a cracked wall next to it once its fuse runs out', () => {
    const world = testWorld();
    // The right room's cracked wall is at (4, 3); stand just west of it.
    const s = newState(1, 0, 3.5, 3.5);
    expect(tileAt(world, s, 1, 0, 4, 3)).toBe('%');
    tick(world, s, { dx: 0, dy: 0, bomb: true }, 0.01);
    expect(s.bombs).toHaveLength(1);
    for (let t = 0; t < FUSE + 0.1; t += 0.05) tick(world, s, idle, 0.05);
    expect(s.bombs).toHaveLength(0);
    expect(tileAt(world, s, 1, 0, 4, 3)).toBe('.');
    // Plain walls survive.
    expect(tileAt(world, s, 1, 0, 4, 2)).toBe('#');
  });
});

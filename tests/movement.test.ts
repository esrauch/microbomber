import { describe, expect, it } from 'vitest';
import { idle, tapB, throwB } from './input';
import { campaignWorld, cardinalFacing, newState, tick } from '../src/game/world';

describe('movement feel', () => {
  it('stops flush against a wall even with a coarse frame step', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 1.5, 1.5);
    for (let i = 0; i < 20; i++) tick(world, s, { ...idle, dx: -1 }, 0.05);
    expect(s.x).toBeCloseTo(1.28, 2);
  });

  it('aim holds its axis near diagonals and ignores a lifting thumb', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 5.5);
    const aim = (dx: number, dy: number): { dx: number; dy: number } => {
      tick(world, s, { ...idle, dx, dy }, 0.001);
      return cardinalFacing(s);
    };
    expect(aim(0.7, -0.65)).toEqual({ dx: 0, dy: -1 }); // just past diagonal: still north
    expect(aim(0.7, -0.5)).toEqual({ dx: 1, dy: 0 }); // clearly east: turns
    expect(aim(0.6, -0.65)).toEqual({ dx: 1, dy: 0 }); // back near diagonal: holds east
    expect(aim(-0.2, 0)).toEqual({ dx: 1, dy: 0 }); // small drift as the thumb lifts
  });

  it('corner assist settles on the lane centre without overshooting', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1,2): one-tile south doorway at x=4, approached off-centre
    const s = newState(world, 'ember-crypt', 1, 2, 4.28, 9.8);
    s.enemies = [];
    const xs: number[] = [];
    for (let i = 0; i < 6; i++) {
      tick(world, s, { ...idle, dy: 1 }, 1 / 60);
      xs.push(s.x);
    }
    for (const x of xs) expect(x).toBeLessThanOrEqual(4.5 + 1e-9);
  });

  it('a blast never knocks you out through a doorway, but you can still walk out', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1,2): stand in the south doorway with a bomb just inside the room
    const s = newState(world, 'ember-crypt', 1, 2, 4.5, 10.4);
    s.enemies = [];
    s.bombs.push({ id: 999, kind: 'powder', x: 4.5, y: 9.5, fuse: 0.01, graceOverlap: false });
    let cut = false;
    for (let i = 0; i < 60; i++) cut = tick(world, s, idle, 1 / 60) || cut;
    expect(cut).toBe(false);
    expect([s.rx, s.ry]).toEqual([1, 2]);
    for (let i = 0; i < 30 && !cut; i++) cut = tick(world, s, { ...idle, dy: 1 }, 1 / 60);
    expect([s.rx, s.ry]).toEqual([1, 3]);
  });

  it('new bombs need a cooldown between them, but a grounded bomb can be thrown at once', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 4.5, 5.5);
    s.enemies = [];
    tapB(world, s);
    expect(s.bombs).toHaveLength(1);
    throwB(world, s); // lifts the dropped bomb underfoot and throws it
    expect(s.bombs).toHaveLength(1);
    expect(s.bombs[0]?.flight).toBeDefined();
    tapB(world, s);
    expect(s.bombs).toHaveLength(1);
    for (let i = 0; i < 40; i++) tick(world, s, idle, 1 / 60);
    tapB(world, s);
    expect(s.bombs).toHaveLength(2);
  });

  it('your own bomb never traps you: grace lasts until you have fully left its tile', () => {
    const world = campaignWorld();
    // Drop off-centre, then walk away at every angle in open floor
    for (let a = 0; a < 16; a++) {
      const s = newState(world, 'overworld', 3, 2, 4.25, 4.25);
      s.enemies = [];
      tapB(world, s);
      const dx = Math.cos((a * Math.PI) / 8);
      const dy = Math.sin((a * Math.PI) / 8);
      const x0 = s.x;
      const y0 = s.y;
      for (let i = 0; i < 20; i++) tick(world, s, { ...idle, dx, dy }, 1 / 60);
      expect(Math.hypot(s.x - x0, s.y - y0), `angle ${a}`).toBeGreaterThan(1.1);
    }
  });

  it('a point-blank throw at a wall lands under you without trapping you', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 1.5, 1.5);
    s.enemies = [];
    s.aimX = 0;
    s.aimY = -1;
    throwB(world, s);
    for (let i = 0; i < 20; i++) tick(world, s, idle, 1 / 60);
    expect(s.bombs).toHaveLength(1);
    const x0 = s.x;
    for (let i = 0; i < 20; i++) tick(world, s, { ...idle, dx: 1 }, 1 / 60);
    expect(s.x - x0).toBeGreaterThan(1);
  });
});

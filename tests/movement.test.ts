import { describe, expect, it } from 'vitest';
import { type Input, campaignWorld, cardinalFacing, newState, tick } from '../src/game/world';

const idle: Input = { dx: 0, dy: 0, drop: false, throwBomb: false };

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
});

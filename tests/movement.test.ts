import { describe, expect, it } from 'vitest';
import { idle, kickA, tapA } from './input';
import { campaignWorld, cardinalFacing, newState, tick } from '../src/game/world';
import { DEAD, TURN, mapJoystickDeflection } from '../src/ui/joystick';

describe('movement feel', () => {
  it('stops flush against a wall even with a coarse frame step', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 6.5, 8.5);
    for (let i = 0; i < 20; i++) tick(world, s, { ...idle, dx: -1 }, 0.05);
    expect(s.x).toBeCloseTo(4.14, 2);
  });

  it('tracks continuous 360° aim above deadzone, ignores a lifting thumb, and keeps cardinalFacing for blocks', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 5.5, 6.5);

    tick(world, s, { ...idle, dx: 0.6, dy: -0.8 }, 0.001);
    expect(s.aimX).toBeCloseTo(0.6, 4);
    expect(s.aimY).toBeCloseTo(-0.8, 4);
    expect(cardinalFacing(s)).toEqual({ dx: 0, dy: -1 });

    tick(world, s, { ...idle, dx: 0.8, dy: -0.6 }, 0.001);
    expect(s.aimX).toBeCloseTo(0.8, 4);
    expect(s.aimY).toBeCloseTo(-0.6, 4);
    expect(cardinalFacing(s)).toEqual({ dx: 1, dy: 0 });

    // Small thumb drift (< 0.22 deadzone) as the thumb lifts leaves aimX/aimY untouched
    tick(world, s, { ...idle, dx: -0.18, dy: 0 }, 0.001);
    expect(s.aimX).toBeCloseTo(0.8, 4);
    expect(s.aimY).toBeCloseTo(-0.6, 4);

    // Joystick dead zone (< DEAD): no turn, no movement
    const x0 = s.x;
    const y0 = s.y;
    tick(world, s, mapJoystickDeflection(0, DEAD * 0.8), 1 / 60);
    expect(s.aimX).toBeCloseTo(0.8, 4);
    expect([s.x, s.y]).toEqual([x0, y0]);

    // Joystick turn-only ring (DEAD <= m < TURN): changes facing without walking
    tick(world, s, mapJoystickDeflection(0, (DEAD + TURN) * 0.5), 1 / 60);
    expect([s.aimX, s.aimY]).toEqual([0, 1]);
    expect([s.fx, s.fy]).toEqual([0, 1]);
    expect([s.x, s.y]).toEqual([x0, y0]);

    // Joystick movement ring (m >= TURN): faces and walks
    tick(world, s, mapJoystickDeflection(0, TURN + 0.1), 1 / 60);
    expect(s.y).toBeGreaterThan(y0);

    // 8-way cone locking: a slight angle within the cone locks onto exact cardinal or diagonal
    const nearEast = mapJoystickDeflection(Math.cos(0.12) * 0.8, Math.sin(0.12) * 0.8);
    expect(nearEast.dy).toBe(0);
    expect(nearEast.dx).toBeGreaterThan(0.99);
    const diagAngle = Math.PI / 4 + 0.1;
    const nearSE = mapJoystickDeflection(Math.cos(diagAngle) * 0.8, Math.sin(diagAngle) * 0.8);
    expect(nearSE.dx).toBeCloseTo(nearSE.dy, 6);
    const betweenAngle = Math.PI / 8;
    const between = mapJoystickDeflection(
      Math.cos(betweenAngle) * 0.8,
      Math.sin(betweenAngle) * 0.8,
    );
    expect(between.dy).toBeGreaterThan(0.1);
    expect(between.dx).toBeGreaterThan(between.dy);
  });

  it('corner assist settles on the lane centre without overshooting', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1,2): two-tile south doorway at x = 10..11, approached off-centre
    // with Pip's left side over the wall
    const s = newState(world, 'ice-cave', 1, 2, 9.9, 20.8);
    s.enemies = [];
    const xs: number[] = [];
    for (let i = 0; i < 12; i++) {
      tick(world, s, { ...idle, dy: 1 }, 1 / 60);
      xs.push(s.x);
    }
    for (const x of xs) expect(x).toBeLessThanOrEqual(11 + 1e-9);
  });

  it('a blast never knocks you out through a doorway, but you can still walk out', () => {
    const world = campaignWorld();
    // Crystal Crossroads (1,2): stand in the south doorway with a bomb just inside the room
    const s = newState(world, 'ice-cave', 1, 2, 10.5, 24.4);
    s.enemies = [];
    s.bombs.push({
      id: 999,
      kind: 'bomb',
      x: 10.5,
      y: 22.5,
      vx: 0,
      vy: 0,
      z: 0,
      vz: 0,
      fuse: 0.01,
      graceOverlap: false,
      shoveCount: 0,
    });
    let cut = false;
    for (let i = 0; i < 60; i++) cut = tick(world, s, idle, 1 / 60) || cut;
    expect(cut).toBe(false);
    expect([s.rx, s.ry]).toEqual([1, 2]);
    for (let i = 0; i < 60 && !cut; i++) cut = tick(world, s, { ...idle, dy: 1 }, 1 / 60);
    expect([s.rx, s.ry]).toEqual([1, 3]);
  });

  it('new bombs need a cooldown between them, and while held overhead the timer pauses and walk speed is halved', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 5.5, 6.5);
    s.enemies = [];
    // Pull bomb #1 overhead: fuse does not tick while held, and walk speed is halved
    tick(world, s, { ...idle, holdA: true }, 1 / 60);
    tick(world, s, idle, 1 / 60);
    expect(s.heldBomb).toBe('bomb');
    expect(s.bombs).toHaveLength(0);
    const xBeforeHoldWalk = s.x;
    for (let i = 0; i < 12; i++) tick(world, s, { ...idle, dx: 1 }, 1 / 60);
    const holdWalkDist = s.x - xBeforeHoldWalk;
    // Drop it with B: now it enters s.bombs with full fuse and starts bombCooldown
    tick(world, s, { ...idle, holdB: true }, 1 / 60);
    tick(world, s, idle, 1 / 60);
    expect(s.heldBomb).toBeNull();
    expect(s.bombs).toHaveLength(1);
    const xBeforeFreeWalk = s.x;
    for (let i = 0; i < 12; i++) tick(world, s, { ...idle, dx: -1 }, 1 / 60);
    const freeWalkDist = xBeforeFreeWalk - s.x;
    expect(holdWalkDist).toBeCloseTo(freeWalkDist * 0.5, 2);

    // Still on cooldown: pressing A cannot pull a second bomb yet
    tick(world, s, { ...idle, holdA: true }, 1 / 60);
    tick(world, s, idle, 1 / 60);
    expect(s.heldBomb).toBeNull();
    expect(s.bombs).toHaveLength(1);
    for (let i = 0; i < 35; i++) tick(world, s, idle, 1 / 60);
    tapA(world, s);
    expect(s.bombs).toHaveLength(2);
  });

  it('your own bomb never traps you: grace lasts until you have fully left its tile', () => {
    const world = campaignWorld();
    // Drop off-centre, then walk away at every angle in open floor
    for (let a = 0; a < 16; a++) {
      const s = newState(world, 'overworld', 3, 2, 10.25, 12.25);
      s.enemies = [];
      tapA(world, s);
      const dx = Math.cos((a * Math.PI) / 8);
      const dy = Math.sin((a * Math.PI) / 8);
      const x0 = s.x;
      const y0 = s.y;
      for (let i = 0; i < 27; i++) tick(world, s, { ...idle, dx, dy }, 1 / 60);
      expect(Math.hypot(s.x - x0, s.y - y0), `angle ${a}`).toBeGreaterThan(1.1);
    }
  });

  it('a point-blank throw at a wall lands under you without trapping you', () => {
    const world = campaignWorld();
    const s = newState(world, 'overworld', 3, 2, 8.5, 2.5);
    s.enemies = [];
    s.aimX = -1;
    s.aimY = 0;
    kickA(world, s, s.aimX, s.aimY);
    for (let i = 0; i < 20; i++) tick(world, s, idle, 1 / 60);
    expect(s.bombs).toHaveLength(1);
    const y0 = s.y;
    for (let i = 0; i < 20; i++) tick(world, s, { ...idle, dy: 1 }, 1 / 60);
    expect(s.y - y0).toBeGreaterThan(1);
  });
});
